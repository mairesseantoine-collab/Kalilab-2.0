import json
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query, UploadFile, File
from fastapi.responses import JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, UserRole, DocumentQualite, DocumentStatus, Signature
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip
from services.storage_service import upload_file as storage_upload, get_file_url, delete_file as storage_delete

router = APIRouter()


class DocumentCreate(BaseModel):
    titre: str
    theme: Optional[str] = None
    classification: Optional[str] = "interne"
    contenu: Optional[str] = None
    date_validite: Optional[date] = None
    approbateurs: Optional[List[int]] = None
    lecteurs_autorises: Optional[List[int]] = None


class DocumentUpdate(BaseModel):
    titre: Optional[str] = None
    theme: Optional[str] = None
    classification: Optional[str] = None
    contenu: Optional[str] = None
    date_validite: Optional[date] = None
    approbateurs: Optional[List[int]] = None
    lecteurs_autorises: Optional[List[int]] = None


class StatusChange(BaseModel):
    new_status: DocumentStatus
    commentaire: Optional[str] = None


class SignRequest(BaseModel):
    role_signature: str
    commentaire: Optional[str] = None


@router.get("/")
async def list_documents(
    theme: Optional[str] = None,
    statut: Optional[DocumentStatus] = None,
    auteur_id: Optional[int] = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(DocumentQualite).where(
        DocumentQualite.statut != DocumentStatus.ARCHIVE
    )
    if theme:
        query = query.where(DocumentQualite.theme == theme)
    if statut:
        query = query.where(DocumentQualite.statut == statut)
    if auteur_id:
        query = query.where(DocumentQualite.auteur_id == auteur_id)
    query = query.order_by(DocumentQualite.created_at.desc())
    count_result = await session.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0
    result = await session.execute(query.offset(skip).limit(limit))
    docs = result.scalars().all()
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [
            {
                "id": d.id,
                "uuid": d.uuid,
                "titre": d.titre,
                "theme": d.theme,
                "classification": d.classification,
                "statut": d.statut.value,
                "version": d.version,
                "auteur_id": d.auteur_id,
                "date_validite": d.date_validite,
                "created_at": d.created_at,
                "updated_at": d.updated_at,
            }
            for d in docs
        ],
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_document(
    request: Request,
    data: DocumentCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = DocumentQualite(
        titre=data.titre,
        theme=data.theme,
        classification=data.classification,
        contenu=data.contenu,
        date_validite=data.date_validite,
        auteur_id=current_user.id,
        approbateurs=json.dumps(data.approbateurs or []),
        lecteurs_autorises=json.dumps(data.lecteurs_autorises or []),
        historique_versions=json.dumps([]),
        statut=DocumentStatus.BROUILLON,
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="document",
        resource_id=str(doc.id),
        details=f"Création document: {doc.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": doc.id, "uuid": doc.uuid, "titre": doc.titre}


@router.get("/{doc_id}")
async def get_document(
    doc_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = await session.get(DocumentQualite, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return {
        "id": doc.id,
        "uuid": doc.uuid,
        "titre": doc.titre,
        "theme": doc.theme,
        "classification": doc.classification,
        "statut": doc.statut.value,
        "version": doc.version,
        "contenu": doc.contenu,
        "fichier_path": doc.fichier_path,
        "auteur_id": doc.auteur_id,
        "approbateurs": json.loads(doc.approbateurs or "[]"),
        "lecteurs_autorises": json.loads(doc.lecteurs_autorises or "[]"),
        "date_validite": doc.date_validite,
        "historique_versions": json.loads(doc.historique_versions or "[]"),
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
    }


@router.put("/{doc_id}")
async def update_document(
    request: Request,
    doc_id: int,
    data: DocumentUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = await session.get(DocumentQualite, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if doc.statut not in (DocumentStatus.BROUILLON, DocumentStatus.RELECTURE):
        raise HTTPException(
            status_code=400,
            detail=f"Document en statut {doc.statut.value} ne peut être modifié",
        )
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        if key in ("approbateurs", "lecteurs_autorises") and value is not None:
            setattr(doc, key, json.dumps(value))
        else:
            setattr(doc, key, value)
    doc.updated_at = datetime.utcnow()
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="document",
        resource_id=str(doc.id),
        details=f"Mise à jour document {doc.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": doc.id, "titre": doc.titre, "statut": doc.statut.value}


@router.put("/{doc_id}/version")
async def new_version(
    request: Request,
    doc_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = await session.get(DocumentQualite, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    # Save current version to history
    history = json.loads(doc.historique_versions or "[]")
    history.append({
        "version": doc.version,
        "date": doc.updated_at.isoformat(),
        "auteur_id": doc.auteur_id,
        "statut": doc.statut.value,
    })
    # Increment version
    parts = doc.version.split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    doc.version = ".".join(parts)
    doc.historique_versions = json.dumps(history)
    doc.statut = DocumentStatus.BROUILLON
    doc.updated_at = datetime.utcnow()
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    await log_action(
        session,
        user_id=current_user.id,
        action="NEW_VERSION",
        resource_type="document",
        resource_id=str(doc.id),
        details=f"Nouvelle version {doc.version} du document {doc.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": doc.id, "version": doc.version, "statut": doc.statut.value}


WORKFLOW_TRANSITIONS = {
    DocumentStatus.BROUILLON: [DocumentStatus.RELECTURE],
    DocumentStatus.RELECTURE: [DocumentStatus.APPROBATION, DocumentStatus.BROUILLON],
    DocumentStatus.APPROBATION: [DocumentStatus.PUBLIE, DocumentStatus.RELECTURE],
    DocumentStatus.PUBLIE: [DocumentStatus.DIFFUSION, DocumentStatus.ARCHIVE],
    DocumentStatus.DIFFUSION: [DocumentStatus.ARCHIVE],
    DocumentStatus.ARCHIVE: [],
}


@router.put("/{doc_id}/status")
async def change_status(
    request: Request,
    doc_id: int,
    data: StatusChange,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = await session.get(DocumentQualite, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    allowed = WORKFLOW_TRANSITIONS.get(doc.statut, [])
    if data.new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transition {doc.statut.value} -> {data.new_status.value} non autorisée",
        )
    old_status = doc.statut
    doc.statut = data.new_status
    doc.updated_at = datetime.utcnow()
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    await log_action(
        session,
        user_id=current_user.id,
        action="STATUS_CHANGE",
        resource_type="document",
        resource_id=str(doc.id),
        details=f"Document {doc.titre}: {old_status.value} -> {data.new_status.value}. {data.commentaire or ''}",
        ip_address=get_client_ip(request),
    )
    return {"id": doc.id, "statut": doc.statut.value}


@router.post("/{doc_id}/sign")
async def sign_document(
    request: Request,
    doc_id: int,
    data: SignRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = await session.get(DocumentQualite, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    # Compute signature hash: sha256(user_id + doc_id + version + timestamp)
    ts = datetime.utcnow().isoformat()
    sig_data = f"{current_user.id}|{doc_id}|{doc.version}|{ts}|{data.role_signature}"
    sig_hash = hashlib.sha256(sig_data.encode()).hexdigest()
    signature = Signature(
        document_id=doc_id,
        user_id=current_user.id,
        role_signature=data.role_signature,
        signature_hash=sig_hash,
        commentaire=data.commentaire,
    )
    session.add(signature)
    await session.commit()
    await session.refresh(signature)
    await log_action(
        session,
        user_id=current_user.id,
        action="SIGN",
        resource_type="document",
        resource_id=str(doc.id),
        details=f"Signature {data.role_signature} du document {doc.titre} v{doc.version}",
        ip_address=get_client_ip(request),
    )
    return {"id": signature.id, "signature_hash": sig_hash, "signed_at": signature.signed_at}


@router.get("/{doc_id}/history")
async def get_history(
    doc_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = await session.get(DocumentQualite, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    sigs_result = await session.execute(
        select(Signature).where(Signature.document_id == doc_id).order_by(Signature.signed_at)
    )
    signatures = sigs_result.scalars().all()
    return {
        "versions": json.loads(doc.historique_versions or "[]"),
        "signatures": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "role_signature": s.role_signature,
                "signature_hash": s.signature_hash,
                "signed_at": s.signed_at,
                "commentaire": s.commentaire,
            }
            for s in signatures
        ],
    }


@router.post("/{doc_id}/upload")
async def upload_document_file(
    request: Request,
    doc_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Attach a file (PDF, Word, etc.) to a document and store it in MinIO."""
    doc = await session.get(DocumentQualite, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    # Read file content
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")

    # Determine content type
    content_type = file.content_type or "application/octet-stream"
    safe_filename = file.filename or "document"

    # Build path: documents/{doc_id}/v{version}_{filename}
    version_tag = doc.version.replace(".", "_")
    storage_path = f"documents/{doc_id}/v{version_tag}_{safe_filename}"

    # If a file already exists, archive the old path in historique_versions before replacing
    history = json.loads(doc.historique_versions or "[]")
    if doc.fichier_path:
        history.append({
            "type": "fichier",
            "version": doc.version,
            "date": datetime.utcnow().isoformat(),
            "auteur_id": current_user.id,
            "auteur_nom": f"{current_user.prenom} {current_user.nom}",
            "action": "remplacement",
            "ancien_fichier": doc.fichier_path,
            "nouveau_fichier": storage_path,
        })
    else:
        history.append({
            "type": "fichier",
            "version": doc.version,
            "date": datetime.utcnow().isoformat(),
            "auteur_id": current_user.id,
            "auteur_nom": f"{current_user.prenom} {current_user.nom}",
            "action": "ajout",
            "fichier": storage_path,
            "nom_fichier": safe_filename,
        })

    # Upload to MinIO
    try:
        await storage_upload(file_bytes, storage_path, content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur stockage: {str(e)}")

    # Save path and updated history
    doc.fichier_path = storage_path
    doc.historique_versions = json.dumps(history)
    doc.updated_at = datetime.utcnow()
    session.add(doc)
    await session.commit()
    await session.refresh(doc)

    await log_action(
        session,
        user_id=current_user.id,
        action="UPLOAD_FILE",
        resource_type="document",
        resource_id=str(doc.id),
        details=f"Fichier attaché: {safe_filename} (v{doc.version}) — {doc.titre}",
        ip_address=get_client_ip(request),
    )
    return {
        "fichier_path": storage_path,
        "nom_fichier": safe_filename,
        "version": doc.version,
    }


@router.get("/{doc_id}/download")
async def download_document_file(
    doc_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a pre-signed download URL for the attached file."""
    doc = await session.get(DocumentQualite, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if not doc.fichier_path:
        raise HTTPException(status_code=404, detail="Aucun fichier attaché à ce document")

    try:
        url = await get_file_url(doc.fichier_path, expires=3600)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur génération URL: {str(e)}")

    # Extract original filename from path
    nom_fichier = doc.fichier_path.split("/")[-1]
    # Remove version prefix like "v1_0_" if present
    if "_" in nom_fichier:
        parts = nom_fichier.split("_", 2)
        if len(parts) >= 3:
            nom_fichier = parts[2]

    return {"url": url, "nom_fichier": nom_fichier, "fichier_path": doc.fichier_path}


@router.post("/{doc_id}/remplacer-fichier")
async def remplacer_fichier(
    request: Request,
    doc_id: int,
    commentaire: Optional[str] = None,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Replace the attached file and record full traceability in version history."""
    doc = await session.get(DocumentQualite, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")

    content_type = file.content_type or "application/octet-stream"
    safe_filename = file.filename or "document"
    version_tag = doc.version.replace(".", "_")
    storage_path = f"documents/{doc_id}/v{version_tag}_{safe_filename}"

    history = json.loads(doc.historique_versions or "[]")
    history.append({
        "type": "fichier",
        "version": doc.version,
        "date": datetime.utcnow().isoformat(),
        "auteur_id": current_user.id,
        "auteur_nom": f"{current_user.prenom} {current_user.nom}",
        "action": "remplacement",
        "ancien_fichier": doc.fichier_path,
        "nouveau_fichier": storage_path,
        "nom_fichier": safe_filename,
        "commentaire": commentaire or "",
    })

    try:
        await storage_upload(file_bytes, storage_path, content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur stockage: {str(e)}")

    doc.fichier_path = storage_path
    doc.historique_versions = json.dumps(history)
    doc.updated_at = datetime.utcnow()
    session.add(doc)
    await session.commit()
    await session.refresh(doc)

    await log_action(
        session,
        user_id=current_user.id,
        action="REPLACE_FILE",
        resource_type="document",
        resource_id=str(doc.id),
        details=f"Fichier remplacé: {safe_filename} (v{doc.version}){' — ' + commentaire if commentaire else ''} — {doc.titre}",
        ip_address=get_client_ip(request),
    )
    return {
        "fichier_path": storage_path,
        "nom_fichier": safe_filename,
        "version": doc.version,
    }


@router.delete("/{doc_id}")
async def archive_document(
    request: Request,
    doc_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    doc = await session.get(DocumentQualite, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    doc.statut = DocumentStatus.ARCHIVE
    doc.updated_at = datetime.utcnow()
    session.add(doc)
    await session.commit()
    await log_action(
        session,
        user_id=current_user.id,
        action="ARCHIVE",
        resource_type="document",
        resource_id=str(doc.id),
        details=f"Archivage document {doc.titre}",
        ip_address=get_client_ip(request),
    )
    return {"detail": "Document archivé"}
