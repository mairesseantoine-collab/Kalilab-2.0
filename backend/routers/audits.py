import json
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from fastapi.responses import StreamingResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel
import io

from database.engine import get_session
from database.models import User, UserRole, Audit, AuditType
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip
from services.pdf_service import generate_audit_report

router = APIRouter()


class AuditCreate(BaseModel):
    type_audit: AuditType = AuditType.INTERNE
    referentiel: str = "ISO 15189"
    titre: str
    date_planifiee: date
    auditeur_externe: Optional[str] = None


class AuditUpdate(BaseModel):
    type_audit: Optional[AuditType] = None
    referentiel: Optional[str] = None
    titre: Optional[str] = None
    date_planifiee: Optional[date] = None
    date_realisation: Optional[date] = None
    auditeur_externe: Optional[str] = None
    constats: Optional[str] = None
    ecarts: Optional[str] = None
    statut: Optional[str] = None


class ConstatAdd(BaseModel):
    reference: str
    description: str
    gravite: str = "mineure"
    processus: Optional[str] = None


@router.get("/")
async def list_audits(
    statut: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Audit).order_by(Audit.date_planifiee.desc())
    if statut:
        query = query.where(Audit.statut == statut)
    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0
    result = await session.execute(query.offset(skip).limit(limit))
    audits = result.scalars().all()
    return {
        "total": total, "skip": skip, "limit": limit,
        "items": [
            {
                "id": a.id,
                "uuid": a.uuid,
                "type_audit": a.type_audit.value,
                "referentiel": a.referentiel,
                "titre": a.titre,
                "date_planifiee": a.date_planifiee,
                "date_realisation": a.date_realisation,
                "auditeur_id": a.auditeur_id,
                "statut": a.statut,
                "created_at": a.created_at,
            }
            for a in audits
        ],
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_audit(
    request: Request,
    data: AuditCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    audit = Audit(
        type_audit=data.type_audit,
        referentiel=data.referentiel,
        titre=data.titre,
        date_planifiee=data.date_planifiee,
        auditeur_id=current_user.id,
        auditeur_externe=data.auditeur_externe,
        constats=json.dumps([]),
        ecarts=json.dumps([]),
    )
    session.add(audit)
    await session.commit()
    await session.refresh(audit)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="audit",
        resource_id=str(audit.id),
        details=f"Planification audit {audit.titre} le {audit.date_planifiee}",
        ip_address=get_client_ip(request),
    )
    return {"id": audit.id, "uuid": audit.uuid, "statut": audit.statut}


@router.get("/{audit_id}")
async def get_audit(
    audit_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    audit = await session.get(Audit, audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit introuvable")
    return {
        "id": audit.id,
        "uuid": audit.uuid,
        "type_audit": audit.type_audit.value,
        "referentiel": audit.referentiel,
        "titre": audit.titre,
        "date_planifiee": audit.date_planifiee,
        "date_realisation": audit.date_realisation,
        "auditeur_id": audit.auditeur_id,
        "auditeur_externe": audit.auditeur_externe,
        "constats": json.loads(audit.constats or "[]"),
        "ecarts": json.loads(audit.ecarts or "[]"),
        "statut": audit.statut,
        "rapport_path": audit.rapport_path,
        "created_at": audit.created_at,
        "updated_at": audit.updated_at,
    }


@router.put("/{audit_id}")
async def update_audit(
    request: Request,
    audit_id: int,
    data: AuditUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    audit = await session.get(Audit, audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit introuvable")
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(audit, key, value)
    audit.updated_at = datetime.utcnow()
    session.add(audit)
    await session.commit()
    await session.refresh(audit)
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="audit",
        resource_id=str(audit.id),
        details=f"Mise à jour audit {audit.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": audit.id, "statut": audit.statut}


@router.post("/{audit_id}/constat")
async def add_constat(
    request: Request,
    audit_id: int,
    data: ConstatAdd,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    audit = await session.get(Audit, audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit introuvable")
    constats = json.loads(audit.constats or "[]")
    constat = {
        "id": len(constats) + 1,
        "reference": data.reference,
        "description": data.description,
        "gravite": data.gravite,
        "processus": data.processus,
        "date": datetime.utcnow().isoformat(),
        "auditeur_id": current_user.id,
    }
    constats.append(constat)
    if data.gravite in ("majeure", "critique"):
        ecarts = json.loads(audit.ecarts or "[]")
        ecarts.append(constat)
        audit.ecarts = json.dumps(ecarts)
    audit.constats = json.dumps(constats)
    audit.updated_at = datetime.utcnow()
    session.add(audit)
    await session.commit()
    await session.refresh(audit)
    await log_action(
        session,
        user_id=current_user.id,
        action="ADD_CONSTAT",
        resource_type="audit",
        resource_id=str(audit.id),
        details=f"Constat {data.reference} ajouté à l'audit {audit.titre}",
        ip_address=get_client_ip(request),
    )
    return {"constat_id": constat["id"], "gravite": data.gravite}


@router.get("/{audit_id}/report")
async def get_audit_report(
    audit_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    audit = await session.get(Audit, audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit introuvable")
    pdf_bytes = await generate_audit_report(audit, session)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=audit_{audit_id}.pdf"},
    )


@router.put("/{audit_id}/validate")
async def validate_audit(
    request: Request,
    audit_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    audit = await session.get(Audit, audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit introuvable")
    audit.statut = "valide"
    audit.date_realisation = audit.date_realisation or date.today()
    audit.updated_at = datetime.utcnow()
    session.add(audit)
    await session.commit()
    await log_action(
        session,
        user_id=current_user.id,
        action="VALIDATE",
        resource_type="audit",
        resource_id=str(audit.id),
        details=f"Validation audit {audit.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": audit.id, "statut": audit.statut}
