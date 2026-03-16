from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, UserRole, Equipement, EquipmentStatus, Calibration, Maintenance
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
