import json
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, UserRole, DossierVerification, ProcedureMammouth
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip
from services.export_verification import generate_docx
from services.export_amdec import generate_docx_amdec

router = APIRouter()


class DossierCreate(BaseModel):
    titre: str
    methode: Optional[str] = None
    type_methode: Optional[str] = "qualitatif"   # "qualitatif" | "quantitatif"
    tests: Optional[List[Dict[str, Any]]] = None


class DossierUpdate(BaseModel):
    titre: Optional[str] = None
    methode: Optional[str] = None
    type_methode: Optional[str] = None
    tests: Optional[List[Dict[str, Any]]] = None
    resultats: Optional[List[Dict[str, Any]]] = None
    conclusion: Optional[str] = None
    statut: Optional[str] = None
    document_id: Optional[int] = None


class DossierDataUpdate(BaseModel):
    """Mise à jour complète des données du dossier (formulaire structuré)."""
    data: Dict[str, Any]  # tout le JSON du formulaire


class ProcedureCreate(BaseModel):
    titre: str
    sections: Optional[List[Dict[str, Any]]] = None
    contributeurs: Optional[List[int]] = None


class ProcedureUpdate(BaseModel):
    titre: Optional[str] = None
    sections: Optional[List[Dict[str, Any]]] = None
    contributeurs: Optional[List[int]] = None
    statut: Optional[str] = None
    document_id: Optional[int] = None


@router.get("/dossiers-verification")
async def list_dossiers_verification(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(DossierVerification).order_by(DossierVerification.created_at.desc())
    )
    dossiers = result.scalars().all()
    return [
        {
            "id": d.id,
            "titre": d.titre,
            "methode": d.methode,
            "statut": d.statut,
            "redacteur_id": d.redacteur_id,
            "document_id": d.document_id,
            "created_at": d.created_at,
            "updated_at": d.updated_at,
        }
        for d in dossiers
    ]


@router.post("/dossiers-verification", status_code=status.HTTP_201_CREATED)
async def create_dossier_verification(
    request: Request,
    data: DossierCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    dossier = DossierVerification(
        titre=data.titre,
        methode=data.methode,
        tests=json.dumps(data.tests or []),
        redacteur_id=current_user.id,
    )
    session.add(dossier)
    await session.commit()
    await session.refresh(dossier)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="dossier_verification",
        resource_id=str(dossier.id),
        details=f"Création dossier vérification {dossier.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": dossier.id, "titre": dossier.titre, "statut": dossier.statut}


@router.get("/dossiers-verification/{dossier_id}")
async def get_dossier_verification(
    dossier_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    dossier = await session.get(DossierVerification, dossier_id)
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    data_raw = dossier.tests or "{}"
    try:
        data_parsed = json.loads(data_raw)
    except Exception:
        data_parsed = {}
    return {
        "id": dossier.id,
        "titre": dossier.titre,
        "methode": dossier.methode,
        "type_methode": data_parsed.get("type_methode", dossier.methode or "qualitatif"),
        "data": data_parsed,
        "statut": dossier.statut,
        "redacteur_id": dossier.redacteur_id,
        "document_id": dossier.document_id,
        "created_at": dossier.created_at,
        "updated_at": dossier.updated_at,
    }


@router.put("/dossiers-verification/{dossier_id}/data")
async def update_dossier_data(
    request: Request,
    dossier_id: int,
    body: DossierDataUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Sauvegarde tout le JSON du formulaire de vérification dans `tests`."""
    dossier = await session.get(DossierVerification, dossier_id)
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    dossier.tests = json.dumps(body.data, ensure_ascii=False)
    dossier.methode = body.data.get("type_methode", dossier.methode)
    dossier.updated_at = datetime.utcnow()
    session.add(dossier)
    await session.commit()
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="dossier_verification",
        resource_id=str(dossier.id),
        details=f"Données dossier {dossier.titre} sauvegardées",
        ip_address=get_client_ip(request),
    )
    return {"id": dossier.id, "statut": dossier.statut}


@router.get("/dossiers-verification/{dossier_id}/export-docx")
async def export_dossier_docx(
    dossier_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Génère et retourne le rapport DOCX (ENR04653 ou ENR04654) en téléchargement."""
    dossier = await session.get(DossierVerification, dossier_id)
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    try:
        data = json.loads(dossier.tests or "{}")
    except Exception:
        data = {}
    data["titre"] = dossier.titre
    type_m = data.get("type_methode", dossier.methode or "qualitatif")
    ref = "ENR04653" if "quant" in type_m.lower() else "ENR04654"
    nom_fichier = f"{ref}_{dossier.titre.replace(' ', '_')}.docx"

    docx_bytes = generate_docx(data)

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'},
    )


@router.put("/dossiers-verification/{dossier_id}")
async def update_dossier_verification(
    request: Request,
    dossier_id: int,
    data: DossierUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    dossier = await session.get(DossierVerification, dossier_id)
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        if key in ("tests", "resultats") and value is not None:
            setattr(dossier, key, json.dumps(value))
        else:
            setattr(dossier, key, value)
    dossier.updated_at = datetime.utcnow()
    session.add(dossier)
    await session.commit()
    await session.refresh(dossier)
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="dossier_verification",
        resource_id=str(dossier.id),
        details=f"Mise à jour dossier {dossier.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": dossier.id, "statut": dossier.statut}


@router.get("/procedures-mammouth")
async def list_procedures_mammouth(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(ProcedureMammouth).order_by(ProcedureMammouth.created_at.desc())
    )
    procedures = result.scalars().all()
    return [
        {
            "id": p.id,
            "titre": p.titre,
            "statut": p.statut,
            "document_id": p.document_id,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
        for p in procedures
    ]


@router.get("/procedures-mammouth/{procedure_id}")
async def get_procedure_mammouth(
    procedure_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    procedure = await session.get(ProcedureMammouth, procedure_id)
    if not procedure:
        raise HTTPException(status_code=404, detail="Procédure introuvable")
    return {
        "id": procedure.id,
        "titre": procedure.titre,
        "sections": json.loads(procedure.sections or "[]"),
        "contributeurs": json.loads(procedure.contributeurs or "[]"),
        "statut": procedure.statut,
        "document_id": procedure.document_id,
        "created_at": procedure.created_at,
        "updated_at": procedure.updated_at,
    }


@router.post("/procedures-mammouth/{procedure_id}/sections", status_code=status.HTTP_201_CREATED)
async def add_section_procedure(
    request: Request,
    procedure_id: int,
    data: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    procedure = await session.get(ProcedureMammouth, procedure_id)
    if not procedure:
        raise HTTPException(status_code=404, detail="Procédure introuvable")
    sections = json.loads(procedure.sections or "[]")
    titre = data.get("titre", "")
    contenu = data.get("contenu", "")
    ordre = data.get("ordre", len(sections) + 1)
    # Find or update existing section
    existing = next((s for s in sections if s.get("ordre") == ordre), None)
    if existing:
        existing["titre"] = titre
        existing["contenu"] = contenu
    else:
        sections.append({"ordre": ordre, "titre": titre, "contenu": contenu})
    sections.sort(key=lambda s: s.get("ordre", 0))
    procedure.sections = json.dumps(sections, ensure_ascii=False)
    procedure.updated_at = datetime.utcnow()
    session.add(procedure)
    await session.commit()
    return {"id": procedure.id, "titre": titre, "ordre": ordre}


@router.post("/procedures-mammouth", status_code=status.HTTP_201_CREATED)
async def create_procedure_mammouth(
    request: Request,
    data: ProcedureCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    procedure = ProcedureMammouth(
        titre=data.titre,
        sections=json.dumps(data.sections or []),
        contributeurs=json.dumps(data.contributeurs or [current_user.id]),
        historique=json.dumps([]),
    )
    session.add(procedure)
    await session.commit()
    await session.refresh(procedure)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="procedure_mammouth",
        resource_id=str(procedure.id),
        details=f"Création procédure mammouth {procedure.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": procedure.id, "titre": procedure.titre, "statut": procedure.statut}


@router.put("/procedures-mammouth/{procedure_id}")
async def update_procedure_mammouth(
    request: Request,
    procedure_id: int,
    data: ProcedureUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    procedure = await session.get(ProcedureMammouth, procedure_id)
    if not procedure:
        raise HTTPException(status_code=404, detail="Procédure introuvable")
    # Save to history before update
    history = json.loads(procedure.historique or "[]")
    history.append({
        "date": procedure.updated_at.isoformat(),
        "user_id": current_user.id,
        "sections_count": len(json.loads(procedure.sections or "[]")),
    })
    procedure.historique = json.dumps(history)
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        if key in ("sections", "contributeurs") and value is not None:
            setattr(procedure, key, json.dumps(value))
        else:
            setattr(procedure, key, value)
    procedure.updated_at = datetime.utcnow()
    session.add(procedure)
    await session.commit()
    await session.refresh(procedure)
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="procedure_mammouth",
        resource_id=str(procedure.id),
        details=f"Mise à jour procédure {procedure.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": procedure.id, "statut": procedure.statut}


# ═══════════════════════════════════════════════════════════
#  AMDEC — Analyse des Modes de Défaillance, de leurs
#          Effets et de leur Criticité
# ═══════════════════════════════════════════════════════════

# Default risk items from the laboratory's Excel model
DEFAULT_AMDEC_CATEGORIES = [
    {
        "code": "R1",
        "libelle": "Prélèvement / Echantillon",
        "items": [
            {"sous_item": "Erreur d'identification", "consequence": "Résultat rendu sous une mauvaise identité", "barriere": "Contrôle identité, double vérificateur, bracelet", "G": 10, "F": 1, "D": 5, "action": "", "decision": "AS", "Gp": 10, "Fp": 1, "Dp": 5},
            {"sous_item": "Centrifugation inadéquate", "consequence": "Mauvaise séparation sérum/plasma, résultat erroné", "barriere": "Protocole de centrifugation affiché", "G": 5, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 1},
            {"sous_item": "Lipémie / Ictère", "consequence": "Interférence analytique, résultat erroné", "barriere": "Détection automatique par analyseur", "G": 5, "F": 5, "D": 1, "action": "", "decision": "A", "Gp": 5, "Fp": 5, "Dp": 1},
            {"sous_item": "Hémolyse", "consequence": "Interférence analytique, résultat erroné", "barriere": "Détection visuelle ou automatique", "G": 5, "F": 5, "D": 1, "action": "", "decision": "A", "Gp": 5, "Fp": 5, "Dp": 1},
            {"sous_item": "Présence de caillots", "consequence": "Obstruction analyseur, résultat absent ou erroné", "barriere": "Vérification visuelle avant chargement", "G": 5, "F": 1, "D": 5, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 5},
            {"sous_item": "Interférences analytiques", "consequence": "Résultat erroné", "barriere": "Notice fabricant, SOP validation", "G": 5, "F": 1, "D": 5, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 5},
            {"sous_item": "Contamination croisée", "consequence": "Faux positif, résultat erroné", "barriere": "Nettoyage aiguille entre patients", "G": 5, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 1},
            {"sous_item": "Perte de volume", "consequence": "Résultat impossible, prélèvement à refaire", "barriere": "Contrôle volume minimum", "G": 5, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 1},
            {"sous_item": "Dégradation de l'échantillon", "consequence": "Résultat erroné", "barriere": "Délais analytiques définis", "G": 5, "F": 1, "D": 5, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 5},
            {"sous_item": "Mauvais anticoagulant/conservateur", "consequence": "Résultat erroné ou non valide", "barriere": "Vérification type de tube", "G": 10, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 10, "Fp": 1, "Dp": 1},
            {"sous_item": "Mauvaise conservation température", "consequence": "Dégradation analytique", "barriere": "Réfrigérateur contrôlé, alarme", "G": 5, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 1},
            {"sous_item": "Dépassement délai de stabilité", "consequence": "Résultat non fiable", "barriere": "Horodatage, SOP délais", "G": 5, "F": 1, "D": 5, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 5},
            {"sous_item": "Volume insuffisant / bulles", "consequence": "Résultat absent ou erroné", "barriere": "Détection automatique par analyseur", "G": 5, "F": 5, "D": 1, "action": "", "decision": "A", "Gp": 5, "Fp": 5, "Dp": 1},
            {"sous_item": "Erreur lecture code-barre", "consequence": "Mauvaise attribution du résultat", "barriere": "Double contrôle informatique", "G": 10, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 10, "Fp": 1, "Dp": 1},
        ]
    },
    {
        "code": "R2",
        "libelle": "Opérateur",
        "items": [
            {"sous_item": "Manque de compétences", "consequence": "Erreurs de manipulation, résultats non fiables", "barriere": "Formation initiale, habilitations", "G": 10, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 10, "Fp": 1, "Dp": 1},
            {"sous_item": "Fort turnover du personnel", "consequence": "Perte de compétences, erreurs accrues", "barriere": "Tutorat, compagnonnage", "G": 10, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 10, "Fp": 1, "Dp": 1},
            {"sous_item": "Mauvaise communication", "consequence": "Erreurs de transmission d'information", "barriere": "Transmission écrite, staff", "G": 5, "F": 1, "D": 5, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 5},
            {"sous_item": "Manque de personnel", "consequence": "Délais analytiques dépassés, erreurs de rush", "barriere": "Planning prévisionnel", "G": 5, "F": 1, "D": 5, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 5},
        ]
    },
    {
        "code": "R3",
        "libelle": "Réactifs",
        "items": [
            {"sous_item": "Dégradation pendant transport", "consequence": "Réactif non fonctionnel, résultats erronés", "barriere": "Chaîne du froid contrôlée, réception", "G": 10, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 10, "Fp": 1, "Dp": 1},
            {"sous_item": "Stockage hors température", "consequence": "Dégradation, résultats erronés", "barriere": "Réfrigérateur contrôlé T°, alarme", "G": 10, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 10, "Fp": 1, "Dp": 1},
            {"sous_item": "Instabilité après ouverture", "consequence": "Résultats erronés", "barriere": "Date ouverture notée, délai défini", "G": 5, "F": 1, "D": 5, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 5},
            {"sous_item": "Rupture de stock", "consequence": "Analyses non réalisables", "barriere": "Gestion stocks, seuil réappro", "G": 5, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 1},
            {"sous_item": "Erreur de préparation", "consequence": "Résultats erronés", "barriere": "SOP préparation, double contrôle", "G": 10, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 10, "Fp": 1, "Dp": 1},
            {"sous_item": "Utilisation réactif périmé", "consequence": "Résultats erronés", "barriere": "Contrôle date péremption", "G": 10, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 10, "Fp": 1, "Dp": 1},
            {"sous_item": "Défaut de fabrication (lot)", "consequence": "Résultats systématiquement erronés", "barriere": "CQI, EQAS, validation lot", "G": 10, "F": 1, "D": 5, "action": "", "decision": "AS", "Gp": 10, "Fp": 1, "Dp": 5},
        ]
    },
    {
        "code": "R4",
        "libelle": "Environnement",
        "items": [
            {"sous_item": "Poussières", "consequence": "Contamination des échantillons/réactifs", "barriere": "Nettoyage régulier, filtres air", "G": 1, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 1, "Fp": 1, "Dp": 1},
            {"sous_item": "Température hors normes", "consequence": "Dérive analytique", "barriere": "Climatisation, monitoring T°", "G": 5, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 1},
            {"sous_item": "Humidité excessive", "consequence": "Dégradation réactifs, dysfonctionnement", "barriere": "Hygrométrie surveillée", "G": 5, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 1},
            {"sous_item": "Vibrations", "consequence": "Perturbation analyseur", "barriere": "Isolateurs vibrations", "G": 5, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 1},
            {"sous_item": "Panne électrique", "consequence": "Perte de données, arrêt analyseur", "barriere": "UPS, groupe électrogène", "G": 10, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 10, "Fp": 1, "Dp": 1},
            {"sous_item": "Panne informatique / LIS", "consequence": "Perte résultats, erreur de transmission", "barriere": "Sauvegarde, redondance serveur", "G": 10, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 10, "Fp": 1, "Dp": 1},
        ]
    },
    {
        "code": "R5",
        "libelle": "Analyseur",
        "items": [
            {"sous_item": "Panne analyseur", "consequence": "Analyse impossible, délais non respectés", "barriere": "Maintenance préventive, contrat SAV", "G": 10, "F": 1, "D": 1, "action": "", "decision": "A", "Gp": 10, "Fp": 1, "Dp": 1},
            {"sous_item": "Dérive calibration", "consequence": "Résultats systématiquement erronés", "barriere": "Calibration régulière, CQI quotidien", "G": 10, "F": 1, "D": 5, "action": "", "decision": "AS", "Gp": 10, "Fp": 1, "Dp": 5},
            {"sous_item": "Problème pipetage / dispensation", "consequence": "Volume inexact, résultat erroné", "barriere": "Maintenance aiguilles, CQI", "G": 5, "F": 1, "D": 5, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 5},
            {"sous_item": "Contamination interne", "consequence": "Contamination croisée, faux positif", "barriere": "Nettoyage quotidien, cycle décontamination", "G": 5, "F": 1, "D": 5, "action": "", "decision": "A", "Gp": 5, "Fp": 1, "Dp": 5},
        ]
    },
]


class AmdecCreate(BaseModel):
    analyseur: str
    type_analyseur: Optional[str] = None


class AmdecStatutUpdate(BaseModel):
    statut: str  # brouillon | en_verification | valide | approuve
    responsable_nom: Optional[str] = None
    commentaire: Optional[str] = None


@router.get("/amdec")
async def list_amdec(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(DossierVerification)
        .where(DossierVerification.methode == "amdec")
        .order_by(DossierVerification.created_at.desc())
    )
    dossiers = result.scalars().all()
    items = []
    for d in dossiers:
        try:
            data = json.loads(d.tests or "{}")
        except Exception:
            data = {}
        items.append({
            "id": d.id,
            "analyseur": data.get("analyseur", d.titre),
            "type_analyseur": data.get("type_analyseur", ""),
            "statut": d.statut,
            "redacteur_id": d.redacteur_id,
            "created_at": d.created_at,
            "updated_at": d.updated_at,
        })
    return items


@router.post("/amdec", status_code=status.HTTP_201_CREATED)
async def create_amdec(
    request: Request,
    data: AmdecCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    initial_data = {
        "type_methode": "amdec",
        "analyseur": data.analyseur,
        "type_analyseur": data.type_analyseur or "",
        "redacteur": f"{current_user.prenom} {current_user.nom}",
        "verificateur": "",
        "validateur": "",
        "approbateur": "",
        "date_redaction": datetime.utcnow().strftime("%d/%m/%Y"),
        "date_verification": "",
        "date_validation": "",
        "date_approbation": "",
        "version": "1.0",
        "statut": "brouillon",
        "synthese": "",
        "categories": DEFAULT_AMDEC_CATEGORIES,
    }
    dossier = DossierVerification(
        titre=data.analyseur,
        methode="amdec",
        tests=json.dumps(initial_data, ensure_ascii=False),
        statut="brouillon",
        redacteur_id=current_user.id,
    )
    session.add(dossier)
    await session.commit()
    await session.refresh(dossier)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="amdec",
        resource_id=str(dossier.id),
        details=f"Création AMDEC: {data.analyseur}",
        ip_address=get_client_ip(request),
    )
    return {"id": dossier.id, "analyseur": data.analyseur, "statut": dossier.statut}


@router.get("/amdec/{amdec_id}")
async def get_amdec(
    amdec_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    dossier = await session.get(DossierVerification, amdec_id)
    if not dossier or dossier.methode != "amdec":
        raise HTTPException(status_code=404, detail="AMDEC introuvable")
    try:
        data = json.loads(dossier.tests or "{}")
    except Exception:
        data = {}
    return {
        "id": dossier.id,
        "statut": dossier.statut,
        "redacteur_id": dossier.redacteur_id,
        "created_at": dossier.created_at,
        "updated_at": dossier.updated_at,
        "data": data,
    }


@router.put("/amdec/{amdec_id}/data")
async def save_amdec_data(
    request: Request,
    amdec_id: int,
    body: DossierDataUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    dossier = await session.get(DossierVerification, amdec_id)
    if not dossier or dossier.methode != "amdec":
        raise HTTPException(status_code=404, detail="AMDEC introuvable")
    dossier.tests = json.dumps(body.data, ensure_ascii=False)
    dossier.titre = body.data.get("analyseur", dossier.titre)
    dossier.updated_at = datetime.utcnow()
    session.add(dossier)
    await session.commit()
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="amdec",
        resource_id=str(dossier.id),
        details=f"AMDEC sauvegardée: {dossier.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": dossier.id, "statut": dossier.statut}


@router.put("/amdec/{amdec_id}/statut")
async def update_amdec_statut(
    request: Request,
    amdec_id: int,
    body: AmdecStatutUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Avancement du workflow: brouillon → en_verification → valide → approuve."""
    dossier = await session.get(DossierVerification, amdec_id)
    if not dossier or dossier.methode != "amdec":
        raise HTTPException(status_code=404, detail="AMDEC introuvable")

    TRANSITIONS = {
        "brouillon": "en_verification",
        "en_verification": "valide",
        "valide": "approuve",
    }
    allowed = TRANSITIONS.get(dossier.statut)
    if body.statut != allowed and body.statut != dossier.statut:
        raise HTTPException(
            status_code=400,
            detail=f"Transition {dossier.statut} → {body.statut} non autorisée. Prochain statut autorisé: {allowed}"
        )

    old_statut = dossier.statut
    dossier.statut = body.statut

    # Update relevant date in the data JSON
    try:
        data = json.loads(dossier.tests or "{}")
    except Exception:
        data = {}

    today = datetime.utcnow().strftime("%d/%m/%Y")
    auteur = body.responsable_nom or f"{current_user.prenom} {current_user.nom}"

    if body.statut == "en_verification":
        data["verificateur"] = auteur
        data["date_verification"] = today
    elif body.statut == "valide":
        data["validateur"] = auteur
        data["date_validation"] = today
    elif body.statut == "approuve":
        data["approbateur"] = auteur
        data["date_approbation"] = today
    data["statut"] = body.statut

    dossier.tests = json.dumps(data, ensure_ascii=False)
    dossier.updated_at = datetime.utcnow()
    session.add(dossier)
    await session.commit()

    await log_action(
        session,
        user_id=current_user.id,
        action="WORKFLOW",
        resource_type="amdec",
        resource_id=str(dossier.id),
        details=f"AMDEC {dossier.titre}: {old_statut} → {body.statut}" + (f" — {body.commentaire}" if body.commentaire else ""),
        ip_address=get_client_ip(request),
    )
    return {"id": dossier.id, "statut": dossier.statut}


@router.get("/amdec/{amdec_id}/export-docx")
async def export_amdec_docx(
    amdec_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Génère et retourne le rapport AMDEC en DOCX (paysage A4)."""
    dossier = await session.get(DossierVerification, amdec_id)
    if not dossier or dossier.methode != "amdec":
        raise HTTPException(status_code=404, detail="AMDEC introuvable")
    try:
        data = json.loads(dossier.tests or "{}")
    except Exception:
        data = {}

    analyseur = data.get("analyseur", dossier.titre).replace(" ", "_")
    nom_fichier = f"AMDEC_{analyseur}.docx"

    docx_bytes = generate_docx_amdec(data)

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'},
    )
