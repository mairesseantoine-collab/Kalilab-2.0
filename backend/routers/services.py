"""
Arborescence documentaire — Services & Localisations.
GET  /services/              → liste complète avec zones imbriquées
POST /services/              → créer service (admin)
PUT  /services/{id}          → modifier service (admin)
DELETE /services/{id}        → désactiver service (admin)
POST /services/{id}/localisations → ajouter zone
PUT  /localisations/{id}     → modifier zone
DELETE /localisations/{id}   → désactiver zone
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from database.engine import get_session
from database.models import Service, Localisation, User, UserRole
from auth.dependencies import get_current_user, require_role

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ServiceCreate(BaseModel):
    label: str
    nom: str
    site: str = "both"   # "STE" | "STM" | "both"
    ordre: int = 0

class ServiceUpdate(BaseModel):
    label: Optional[str] = None
    nom: Optional[str] = None
    site: Optional[str] = None
    ordre: Optional[int] = None
    actif: Optional[bool] = None

class LocalisationCreate(BaseModel):
    nom: str
    parent_id: Optional[int] = None
    ordre: int = 0

class LocalisationUpdate(BaseModel):
    nom: Optional[str] = None
    parent_id: Optional[int] = None
    ordre: Optional[int] = None
    actif: Optional[bool] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_tree(localisations: list) -> list:
    """Construit une arborescence imbriquée à partir d'une liste plate."""
    by_id = {loc.id: {
        "id": loc.id,
        "service_id": loc.service_id,
        "parent_id": loc.parent_id,
        "nom": loc.nom,
        "ordre": loc.ordre,
        "actif": loc.actif,
        "enfants": [],
    } for loc in localisations}

    roots = []
    for loc in localisations:
        node = by_id[loc.id]
        if loc.parent_id and loc.parent_id in by_id:
            by_id[loc.parent_id]["enfants"].append(node)
        else:
            roots.append(node)

    def sort_tree(nodes):
        nodes.sort(key=lambda n: n["ordre"])
        for n in nodes:
            sort_tree(n["enfants"])
        return nodes

    return sort_tree(roots)


def _serialize_service(service: Service, zones: list) -> dict:
    return {
        "id": service.id,
        "label": service.label,
        "nom": service.nom,
        "site": service.site,
        "ordre": service.ordre,
        "actif": service.actif,
        "created_at": service.created_at.isoformat(),
        "localisations": _build_tree(zones),
        "nb_zones": len(zones),
    }


# ── Endpoints services ────────────────────────────────────────────────────────

@router.get("/")
async def list_services(
    site: Optional[str] = None,
    actif: Optional[bool] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Liste tous les services avec leurs zones imbriquées."""
    q = select(Service)
    if site:
        q = q.where((Service.site == site) | (Service.site == "both"))
    if actif is not None:
        q = q.where(Service.actif == actif)
    q = q.order_by(Service.ordre, Service.nom)
    result = await session.execute(q)
    services = result.scalars().all()

    output = []
    for svc in services:
        zones_result = await session.execute(
            select(Localisation)
            .where(Localisation.service_id == svc.id)
            .order_by(Localisation.ordre, Localisation.nom)
        )
        zones = zones_result.scalars().all()
        output.append(_serialize_service(svc, zones))

    return output


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_service(
    data: ServiceCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    result = await session.execute(select(Service).where(Service.label == data.label.upper()))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(400, f"Service avec le label '{data.label}' existe déjà")

    svc = Service(
        label=data.label.upper(),
        nom=data.nom,
        site=data.site,
        ordre=data.ordre,
    )
    session.add(svc)
    await session.commit()
    await session.refresh(svc)
    return _serialize_service(svc, [])


@router.put("/{service_id}")
async def update_service(
    service_id: int,
    data: ServiceUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    svc = await session.get(Service, service_id)
    if not svc:
        raise HTTPException(404, "Service introuvable")

    for field, val in data.model_dump(exclude_none=True).items():
        setattr(svc, field, val)
    session.add(svc)
    await session.commit()
    await session.refresh(svc)

    zones_result = await session.execute(
        select(Localisation).where(Localisation.service_id == svc.id)
    )
    zones = zones_result.scalars().all()
    return _serialize_service(svc, zones)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_service(
    service_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    svc = await session.get(Service, service_id)
    if not svc:
        raise HTTPException(404, "Service introuvable")
    svc.actif = False
    session.add(svc)
    await session.commit()


# ── Endpoints localisations ───────────────────────────────────────────────────

@router.post("/{service_id}/localisations", status_code=status.HTTP_201_CREATED)
async def add_localisation(
    service_id: int,
    data: LocalisationCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    svc = await session.get(Service, service_id)
    if not svc:
        raise HTTPException(404, "Service introuvable")

    if data.parent_id:
        parent = await session.get(Localisation, data.parent_id)
        if not parent or parent.service_id != service_id:
            raise HTTPException(400, "Zone parente invalide")

    loc = Localisation(
        service_id=service_id,
        parent_id=data.parent_id,
        nom=data.nom,
        ordre=data.ordre,
    )
    session.add(loc)
    await session.commit()
    await session.refresh(loc)
    return {
        "id": loc.id, "service_id": loc.service_id,
        "parent_id": loc.parent_id, "nom": loc.nom,
        "ordre": loc.ordre, "actif": loc.actif, "enfants": [],
    }


@router.put("/localisations/{loc_id}")
async def update_localisation(
    loc_id: int,
    data: LocalisationUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    loc = await session.get(Localisation, loc_id)
    if not loc:
        raise HTTPException(404, "Zone introuvable")

    for field, val in data.model_dump(exclude_none=True).items():
        setattr(loc, field, val)
    session.add(loc)
    await session.commit()
    await session.refresh(loc)
    return {"id": loc.id, "service_id": loc.service_id, "parent_id": loc.parent_id,
            "nom": loc.nom, "ordre": loc.ordre, "actif": loc.actif}


@router.delete("/localisations/{loc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_localisation(
    loc_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    loc = await session.get(Localisation, loc_id)
    if not loc:
        raise HTTPException(404, "Zone introuvable")
    loc.actif = False
    enfants_result = await session.execute(
        select(Localisation).where(Localisation.parent_id == loc_id)
    )
    enfants = enfants_result.scalars().all()
    for e in enfants:
        e.actif = False
        session.add(e)
    session.add(loc)
    await session.commit()
