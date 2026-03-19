from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, UserRole, Equipement, EquipmentStatus, Calibration, Maintenance, PanneEquipement, EquipementPiece
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip

router = APIRouter()


class EquipementCreate(BaseModel):
    nom: str
    categorie: str
    numero_inventaire: str
    fabricant: Optional[str] = None
    modele: Optional[str] = None
    numero_serie: Optional[str] = None
    date_acquisition: Optional[date] = None
    localisation: Optional[str] = None
    responsable_id: Optional[int] = None
    periodicite_calibration_jours: Optional[int] = None
    periodicite_maintenance_jours: Optional[int] = None
    prochaine_calibration: Optional[date] = None
    prochaine_maintenance: Optional[date] = None
    notes: Optional[str] = None


class EquipementUpdate(BaseModel):
    nom: Optional[str] = None
    categorie: Optional[str] = None
    localisation: Optional[str] = None
    responsable_id: Optional[int] = None
    statut: Optional[EquipmentStatus] = None
    prochaine_calibration: Optional[date] = None
    prochaine_maintenance: Optional[date] = None
    periodicite_calibration_jours: Optional[int] = None
    periodicite_maintenance_jours: Optional[int] = None
    notes: Optional[str] = None


class CalibrationCreate(BaseModel):
    date_calibration: date
    date_prochaine: Optional[date] = None
    realise_par: Optional[str] = None
    resultat: str
    notes: Optional[str] = None


class MaintenanceCreate(BaseModel):
    type_maintenance: str
    date_planifiee: Optional[date] = None
    date_realisation: Optional[date] = None
    realise_par: Optional[str] = None
    description: Optional[str] = None


@router.get("/")
async def list_equipments(
    statut: Optional[EquipmentStatus] = None,
    categorie: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Equipement).order_by(Equipement.nom)
    if statut:
        query = query.where(Equipement.statut == statut)
    if categorie:
        query = query.where(Equipement.categorie == categorie)
    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0
    result = await session.execute(query.offset(skip).limit(limit))
    equipments = result.scalars().all()
    return {
        "total": total, "skip": skip, "limit": limit,
        "items": [
            {
                "id": e.id,
                "uuid": e.uuid,
                "nom": e.nom,
                "categorie": e.categorie,
                "numero_inventaire": e.numero_inventaire,
                "fabricant": e.fabricant,
                "modele": e.modele,
                "statut": e.statut.value,
                "localisation": e.localisation,
                "prochaine_calibration": e.prochaine_calibration,
                "prochaine_maintenance": e.prochaine_maintenance,
            }
            for e in equipments
        ],
    }


@router.get("/due")
async def get_due_equipments(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    result = await session.execute(
        select(Equipement).where(
            (Equipement.prochaine_calibration <= today) |
            (Equipement.prochaine_maintenance <= today)
        )
    )
    equipments = result.scalars().all()
    return [
        {
            "id": e.id,
            "nom": e.nom,
            "numero_inventaire": e.numero_inventaire,
            "statut": e.statut.value,
            "prochaine_calibration": e.prochaine_calibration,
            "prochaine_maintenance": e.prochaine_maintenance,
            "calibration_echuee": e.prochaine_calibration is not None and e.prochaine_calibration <= today,
            "maintenance_echuee": e.prochaine_maintenance is not None and e.prochaine_maintenance <= today,
        }
        for e in equipments
    ]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_equipment(
    request: Request,
    data: EquipementCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.RESP_TECHNIQUE)),
):
    existing = await session.execute(
        select(Equipement).where(Equipement.numero_inventaire == data.numero_inventaire)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Numéro d'inventaire déjà utilisé")
    eq = Equipement(**data.dict())
    session.add(eq)
    await session.commit()
    await session.refresh(eq)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="equipement",
        resource_id=str(eq.id),
        details=f"Création équipement {eq.nom} ({eq.numero_inventaire})",
        ip_address=get_client_ip(request),
    )
    return {"id": eq.id, "uuid": eq.uuid, "numero_inventaire": eq.numero_inventaire}


@router.get("/{eq_id}")
async def get_equipment(
    eq_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    eq = await session.get(Equipement, eq_id)
    if not eq:
        raise HTTPException(status_code=404, detail="Équipement introuvable")
    cals_result = await session.execute(
        select(Calibration).where(Calibration.equipement_id == eq_id).order_by(Calibration.date_calibration.desc()).limit(5)
    )
    mains_result = await session.execute(
        select(Maintenance).where(Maintenance.equipement_id == eq_id).order_by(Maintenance.created_at.desc()).limit(5)
    )
    return {
        "id": eq.id,
        "uuid": eq.uuid,
        "nom": eq.nom,
        "categorie": eq.categorie,
        "numero_inventaire": eq.numero_inventaire,
        "fabricant": eq.fabricant,
        "modele": eq.modele,
        "numero_serie": eq.numero_serie,
        "date_acquisition": eq.date_acquisition,
        "statut": eq.statut.value,
        "localisation": eq.localisation,
        "responsable_id": eq.responsable_id,
        "prochaine_calibration": eq.prochaine_calibration,
        "prochaine_maintenance": eq.prochaine_maintenance,
        "periodicite_calibration_jours": eq.periodicite_calibration_jours,
        "periodicite_maintenance_jours": eq.periodicite_maintenance_jours,
        "notes": eq.notes,
        "derniere_calibration": [
            {"date": c.date_calibration, "resultat": c.resultat}
            for c in cals_result.scalars().all()
        ],
        "derniere_maintenance": [
            {"type": m.type_maintenance, "statut": m.statut}
            for m in mains_result.scalars().all()
        ],
    }


@router.put("/{eq_id}")
async def update_equipment(
    request: Request,
    eq_id: int,
    data: EquipementUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.RESP_TECHNIQUE)),
):
    eq = await session.get(Equipement, eq_id)
    if not eq:
        raise HTTPException(status_code=404, detail="Équipement introuvable")
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(eq, key, value)
    eq.updated_at = datetime.utcnow()
    session.add(eq)
    await session.commit()
    await session.refresh(eq)
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="equipement",
        resource_id=str(eq.id),
        details=f"Mise à jour équipement {eq.nom}",
        ip_address=get_client_ip(request),
    )
    return {"id": eq.id, "statut": eq.statut.value}


@router.put("/{eq_id}/block")
async def block_equipment(
    request: Request,
    eq_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.RESP_TECHNIQUE)),
):
    eq = await session.get(Equipement, eq_id)
    if not eq:
        raise HTTPException(status_code=404, detail="Équipement introuvable")
    eq.statut = EquipmentStatus.CALIBRATION_ECHUEE
    eq.updated_at = datetime.utcnow()
    session.add(eq)
    await session.commit()
    await log_action(
        session,
        user_id=current_user.id,
        action="BLOCK",
        resource_type="equipement",
        resource_id=str(eq.id),
        details=f"Blocage équipement {eq.nom} - calibration échue",
        ip_address=get_client_ip(request),
    )
    return {"id": eq.id, "statut": eq.statut.value}


@router.post("/{eq_id}/calibration", status_code=status.HTTP_201_CREATED)
async def add_calibration(
    request: Request,
    eq_id: int,
    data: CalibrationCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    eq = await session.get(Equipement, eq_id)
    if not eq:
        raise HTTPException(status_code=404, detail="Équipement introuvable")
    cal = Calibration(
        equipement_id=eq_id,
        date_calibration=data.date_calibration,
        date_prochaine=data.date_prochaine,
        realise_par=data.realise_par,
        user_id=current_user.id,
        resultat=data.resultat,
        notes=data.notes,
    )
    session.add(cal)
    # Update equipment next calibration date and status
    if data.date_prochaine:
        eq.prochaine_calibration = data.date_prochaine
    if data.resultat == "conforme":
        eq.statut = EquipmentStatus.OPERATIONNEL
    else:
        eq.statut = EquipmentStatus.HORS_SERVICE
    eq.updated_at = datetime.utcnow()
    session.add(eq)
    await session.commit()
    await session.refresh(cal)
    await log_action(
        session,
        user_id=current_user.id,
        action="CALIBRATION",
        resource_type="equipement",
        resource_id=str(eq.id),
        details=f"Calibration {data.resultat} équipement {eq.nom} le {data.date_calibration}",
        ip_address=get_client_ip(request),
    )
    return {"id": cal.id, "resultat": cal.resultat}


@router.post("/{eq_id}/maintenance", status_code=status.HTTP_201_CREATED)
async def add_maintenance(
    request: Request,
    eq_id: int,
    data: MaintenanceCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    eq = await session.get(Equipement, eq_id)
    if not eq:
        raise HTTPException(status_code=404, detail="Équipement introuvable")
    maint = Maintenance(
        equipement_id=eq_id,
        type_maintenance=data.type_maintenance,
        date_planifiee=data.date_planifiee,
        date_realisation=data.date_realisation,
        realise_par=data.realise_par,
        user_id=current_user.id,
        description=data.description,
        statut="terminee" if data.date_realisation else "planifiee",
    )
    session.add(maint)
    if data.date_realisation:
        eq.statut = EquipmentStatus.OPERATIONNEL
        eq.updated_at = datetime.utcnow()
        session.add(eq)
    await session.commit()
    await session.refresh(maint)
    await log_action(
        session,
        user_id=current_user.id,
        action="MAINTENANCE",
        resource_type="equipement",
        resource_id=str(eq.id),
        details=f"Maintenance {data.type_maintenance} équipement {eq.nom}",
        ip_address=get_client_ip(request),
    )
    return {"id": maint.id, "statut": maint.statut}


# ═══════════════════════════════════════════════════════════════════════════════
# ── PANNES & MTBF ─────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

class PanneCreate(BaseModel):
    date_debut: datetime
    date_fin: Optional[datetime] = None
    description: str
    cause: Optional[str] = None
    resolution: Optional[str] = None
    impact: str = "moyen"
    signale_par: Optional[str] = None


class PanneUpdate(BaseModel):
    date_fin: Optional[datetime] = None
    description: Optional[str] = None
    cause: Optional[str] = None
    resolution: Optional[str] = None
    impact: Optional[str] = None
    signale_par: Optional[str] = None


@router.get("/{eq_id}/pannes")
async def list_pannes(
    eq_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(PanneEquipement)
        .where(PanneEquipement.equipement_id == eq_id)
        .order_by(PanneEquipement.date_debut.desc())
    )
    pannes = result.scalars().all()

    # Calcul MTBF (Mean Time Between Failures)
    # MTBF = (date première panne - date acquisition) / nb_pannes  [en jours]
    eq_result = await session.execute(select(Equipement).where(Equipement.id == eq_id))
    eq = eq_result.scalars().first()
    mtbf_jours = None
    if eq and pannes:
        start = eq.date_acquisition or eq.created_at.date()
        total_days = (date.today() - start).days
        nb_pannes = len(pannes)
        if nb_pannes > 0 and total_days > 0:
            mtbf_jours = round(total_days / nb_pannes, 1)

    # Durée totale d'immobilisation
    total_downtime_h = 0.0
    for p in pannes:
        if p.date_fin:
            total_downtime_h += (p.date_fin - p.date_debut).total_seconds() / 3600

    return {
        "pannes": [
            {
                "id": p.id,
                "date_debut": p.date_debut.isoformat(),
                "date_fin": p.date_fin.isoformat() if p.date_fin else None,
                "description": p.description,
                "cause": p.cause,
                "resolution": p.resolution,
                "impact": p.impact,
                "signale_par": p.signale_par,
                "en_cours": p.date_fin is None,
                "duree_heures": round((p.date_fin - p.date_debut).total_seconds() / 3600, 1) if p.date_fin else None,
            }
            for p in pannes
        ],
        "mtbf_jours": mtbf_jours,
        "total_pannes": len(pannes),
        "pannes_en_cours": sum(1 for p in pannes if p.date_fin is None),
        "total_downtime_heures": round(total_downtime_h, 1),
    }


@router.post("/{eq_id}/pannes", status_code=201)
async def create_panne(
    eq_id: int,
    data: PanneCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    eq_result = await session.execute(select(Equipement).where(Equipement.id == eq_id))
    eq = eq_result.scalars().first()
    if not eq:
        raise HTTPException(status_code=404, detail="Équipement introuvable.")

    panne = PanneEquipement(
        equipement_id=eq_id,
        date_debut=data.date_debut,
        date_fin=data.date_fin,
        description=data.description,
        cause=data.cause,
        resolution=data.resolution,
        impact=data.impact,
        signale_par=data.signale_par,
        user_id=current_user.id,
    )
    session.add(panne)
    # Si panne non résolue, passer l'équipement en HORS_SERVICE
    if not data.date_fin:
        eq.statut = EquipmentStatus.HORS_SERVICE
        eq.updated_at = datetime.utcnow()
        session.add(eq)
    await session.commit()
    await session.refresh(panne)
    await log_action(
        session, user_id=current_user.id, action="PANNE_CREATE",
        resource_type="equipement", resource_id=str(eq_id),
        details=f"Panne signalée sur {eq.nom} — impact: {data.impact}",
        ip_address=get_client_ip(request),
    )
    return {"id": panne.id, "en_cours": panne.date_fin is None}


@router.put("/{eq_id}/pannes/{panne_id}")
async def update_panne(
    eq_id: int,
    panne_id: int,
    data: PanneUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(PanneEquipement).where(
            PanneEquipement.id == panne_id,
            PanneEquipement.equipement_id == eq_id,
        )
    )
    panne = result.scalars().first()
    if not panne:
        raise HTTPException(status_code=404, detail="Panne introuvable.")

    for field, val in data.dict(exclude_none=True).items():
        setattr(panne, field, val)
    panne.updated_at = datetime.utcnow()

    # Si résolution → repasser l'équipement en OPERATIONNEL
    if data.date_fin:
        eq_result = await session.execute(select(Equipement).where(Equipement.id == eq_id))
        eq = eq_result.scalars().first()
        if eq:
            eq.statut = EquipmentStatus.OPERATIONNEL
            eq.updated_at = datetime.utcnow()
            session.add(eq)

    await session.commit()
    return {"id": panne.id, "resolved": panne.date_fin is not None}


@router.delete("/{eq_id}/pannes/{panne_id}", status_code=204)
async def delete_panne(
    eq_id: int,
    panne_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    result = await session.execute(
        select(PanneEquipement).where(
            PanneEquipement.id == panne_id,
            PanneEquipement.equipement_id == eq_id,
        )
    )
    panne = result.scalars().first()
    if not panne:
        raise HTTPException(status_code=404, detail="Panne introuvable.")
    await session.delete(panne)
    await session.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# ── PIÈCES DE RECHANGE ────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

class PieceCreate(BaseModel):
    designation: str
    reference: Optional[str] = None
    article_id: Optional[int] = None
    quantite_min: Optional[float] = None
    notes: Optional[str] = None


@router.get("/{eq_id}/pieces")
async def list_pieces(
    eq_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(EquipementPiece)
        .where(EquipementPiece.equipement_id == eq_id)
        .order_by(EquipementPiece.designation)
    )
    pieces = result.scalars().all()
    return [
        {
            "id": p.id,
            "designation": p.designation,
            "reference": p.reference,
            "article_id": p.article_id,
            "quantite_min": p.quantite_min,
            "notes": p.notes,
        }
        for p in pieces
    ]


@router.post("/{eq_id}/pieces", status_code=201)
async def create_piece(
    eq_id: int,
    data: PieceCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    eq_result = await session.execute(select(Equipement).where(Equipement.id == eq_id))
    if not eq_result.scalars().first():
        raise HTTPException(status_code=404, detail="Équipement introuvable.")
    piece = EquipementPiece(equipement_id=eq_id, **data.dict())
    session.add(piece)
    await session.commit()
    await session.refresh(piece)
    return {"id": piece.id, "designation": piece.designation}


@router.delete("/{eq_id}/pieces/{piece_id}", status_code=204)
async def delete_piece(
    eq_id: int,
    piece_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    result = await session.execute(
        select(EquipementPiece).where(
            EquipementPiece.id == piece_id,
            EquipementPiece.equipement_id == eq_id,
        )
    )
    piece = result.scalars().first()
    if not piece:
        raise HTTPException(status_code=404, detail="Pièce introuvable.")
    await session.delete(piece)
    await session.commit()
