from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, NonConformite, NCStatus, Action
from auth.dependencies import get_current_user, log_action, get_client_ip

router = APIRouter()

NC_STATUS_TRANSITIONS = {
    NCStatus.OUVERTE: [NCStatus.EN_ANALYSE],
    NCStatus.EN_ANALYSE: [NCStatus.CAPA_EN_COURS, NCStatus.CLOTUREE],
    NCStatus.CAPA_EN_COURS: [NCStatus.VERIFICATION],
    NCStatus.VERIFICATION: [NCStatus.CLOTUREE, NCStatus.CAPA_EN_COURS],
    NCStatus.CLOTUREE: [],
}


class NCCreate(BaseModel):
    type_nc: str
    nature: Optional[str] = None
    source_nc: Optional[str] = None
    processus_concerne: Optional[str] = None
    degre: Optional[str] = None
    document_sq: Optional[str] = None
    description: str
    impact: Optional[str] = None
    traitement_immediat: Optional[str] = None
    effectue_par_id: Optional[int] = None
    date_traitement: Optional[date] = None
    date_echeance: Optional[date] = None
    responsable_id: Optional[int] = None
    processus_id: Optional[int] = None


class NCUpdate(BaseModel):
    type_nc: Optional[str] = None
    nature: Optional[str] = None
    source_nc: Optional[str] = None
    processus_concerne: Optional[str] = None
    degre: Optional[str] = None
    document_sq: Optional[str] = None
    description: Optional[str] = None
    impact: Optional[str] = None
    traitement_immediat: Optional[str] = None
    effectue_par_id: Optional[int] = None
    date_traitement: Optional[date] = None
    acceptation: Optional[bool] = None
    motivation_refus: Optional[str] = None
    analyse_causes: Optional[str] = None
    analyse_etendue: Optional[str] = None
    capa: Optional[str] = None
    action_corrective_secondaire: Optional[str] = None
    action_preventive: Optional[str] = None
    verification_efficacite: Optional[str] = None
    efficacite: Optional[str] = None
    reference_pag: Optional[str] = None
    date_echeance: Optional[date] = None
    responsable_id: Optional[int] = None
    processus_id: Optional[int] = None


class NCStatusChange(BaseModel):
    new_status: NCStatus
    commentaire: Optional[str] = None


def _nc_full(nc: NonConformite) -> dict:
    return {
        "id": nc.id,
        "uuid": nc.uuid,
        "type_nc": nc.type_nc,
        "nature": nc.nature,
        "source_nc": nc.source_nc,
        "processus_concerne": nc.processus_concerne,
        "degre": nc.degre,
        "document_sq": nc.document_sq,
        "description": nc.description,
        "impact": nc.impact,
        "traitement_immediat": nc.traitement_immediat,
        "effectue_par_id": nc.effectue_par_id,
        "date_traitement": nc.date_traitement,
        "acceptation": nc.acceptation,
        "motivation_refus": nc.motivation_refus,
        "analyse_causes": nc.analyse_causes,
        "analyse_etendue": nc.analyse_etendue,
        "capa": nc.capa,
        "action_corrective_secondaire": nc.action_corrective_secondaire,
        "action_preventive": nc.action_preventive,
        "verification_efficacite": nc.verification_efficacite,
        "efficacite": nc.efficacite,
        "reference_pag": nc.reference_pag,
        "statut": nc.statut.value,
        "declarant_id": nc.declarant_id,
        "responsable_id": nc.responsable_id,
        "processus_id": nc.processus_id,
        "date_detection": nc.date_detection,
        "date_echeance": nc.date_echeance,
        "date_cloture": nc.date_cloture,
        "created_at": nc.created_at,
        "updated_at": nc.updated_at,
    }


@router.get("/")
async def list_ncs(
    statut: Optional[NCStatus] = None,
    type_nc: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    page: Optional[int] = None,
    size: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if page is not None and size is not None:
        skip = (page - 1) * size
        limit = size
    elif size is not None:
        limit = size

    query = select(NonConformite).order_by(NonConformite.created_at.desc())
    if statut:
        query = query.where(NonConformite.statut == statut)
    if type_nc:
        query = query.where(NonConformite.type_nc == type_nc)
    if search:
        query = query.where(NonConformite.description.ilike(f"%{search}%"))
    count_result = await session.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0
    result = await session.execute(query.offset(skip).limit(limit))
    ncs = result.scalars().all()
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [
        {
            "id": nc.id,
            "uuid": nc.uuid,
            "type_nc": nc.type_nc,
            "nature": nc.nature,
            "source_nc": nc.source_nc,
            "processus_concerne": nc.processus_concerne,
            "degre": nc.degre,
            "description": nc.description[:100] + "..." if len(nc.description) > 100 else nc.description,
            "statut": nc.statut.value,
            "declarant_id": nc.declarant_id,
            "responsable_id": nc.responsable_id,
            "date_echeance": nc.date_echeance,
            "created_at": nc.created_at,
        }
        for nc in ncs
        ],
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_nc(
    request: Request,
    data: NCCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    nc = NonConformite(
        type_nc=data.type_nc,
        nature=data.nature,
        source_nc=data.source_nc,
        processus_concerne=data.processus_concerne,
        degre=data.degre,
        document_sq=data.document_sq,
        description=data.description,
        impact=data.impact,
        traitement_immediat=data.traitement_immediat,
        effectue_par_id=data.effectue_par_id or current_user.id,
        date_traitement=data.date_traitement,
        date_echeance=data.date_echeance,
        responsable_id=data.responsable_id or current_user.id,
        declarant_id=current_user.id,
        processus_id=data.processus_id,
    )
    session.add(nc)
    await session.commit()
    await session.refresh(nc)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="non_conformite",
        resource_id=str(nc.id),
        details=f"NC type={nc.type_nc} source={nc.source_nc or 'N/A'}",
        ip_address=get_client_ip(request),
    )
    return {"id": nc.id, "uuid": nc.uuid, "statut": nc.statut.value}


@router.get("/{nc_id}")
async def get_nc(
    nc_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    nc = await session.get(NonConformite, nc_id)
    if not nc:
        raise HTTPException(status_code=404, detail="Non-conformité introuvable")
    return _nc_full(nc)


@router.put("/{nc_id}")
async def update_nc(
    request: Request,
    nc_id: int,
    data: NCUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    nc = await session.get(NonConformite, nc_id)
    if not nc:
        raise HTTPException(status_code=404, detail="Non-conformité introuvable")
    if nc.statut == NCStatus.CLOTUREE:
        raise HTTPException(status_code=400, detail="NC clôturée, modification impossible")
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(nc, key, value)
    nc.updated_at = datetime.utcnow()
    session.add(nc)
    await session.commit()
    await session.refresh(nc)
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="non_conformite",
        resource_id=str(nc.id),
        details=f"Mise à jour NC {nc.id}: {list(update_data.keys())}",
        ip_address=get_client_ip(request),
    )
    return _nc_full(nc)


@router.put("/{nc_id}/status")
async def change_nc_status(
    request: Request,
    nc_id: int,
    data: NCStatusChange,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    nc = await session.get(NonConformite, nc_id)
    if not nc:
        raise HTTPException(status_code=404, detail="Non-conformité introuvable")
    allowed = NC_STATUS_TRANSITIONS.get(nc.statut, [])
    if data.new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transition {nc.statut.value} -> {data.new_status.value} non autorisée",
        )
    old_status = nc.statut
    nc.statut = data.new_status
    if data.new_status == NCStatus.CLOTUREE:
        nc.date_cloture = datetime.utcnow()
    nc.updated_at = datetime.utcnow()
    session.add(nc)
    await session.commit()
    await session.refresh(nc)
    await log_action(
        session,
        user_id=current_user.id,
        action="STATUS_CHANGE",
        resource_type="non_conformite",
        resource_id=str(nc.id),
        details=f"NC {nc.id}: {old_status.value} -> {data.new_status.value}",
        ip_address=get_client_ip(request),
    )
    return {"id": nc.id, "statut": nc.statut.value}


@router.get("/{nc_id}/actions")
async def get_nc_actions(
    nc_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    nc = await session.get(NonConformite, nc_id)
    if not nc:
        raise HTTPException(status_code=404, detail="Non-conformité introuvable")
    result = await session.execute(
        select(Action).where(Action.nc_id == nc_id).order_by(Action.created_at)
    )
    actions = result.scalars().all()
    return [
        {
            "id": a.id,
            "type_action": a.type_action,
            "description": a.description,
            "responsable_id": a.responsable_id,
            "echeance": a.echeance,
            "statut": a.statut,
            "resultat": a.resultat,
            "created_at": a.created_at,
        }
        for a in actions
    ]
