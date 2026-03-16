from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, UserRole, Action
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip

router = APIRouter()


class ActionCreate(BaseModel):
    type_action: str
    description: str
    responsable_id: int
    echeance: date
    nc_id: Optional[int] = None
    risque_id: Optional[int] = None
    audit_id: Optional[int] = None


class ActionUpdate(BaseModel):
    type_action: Optional[str] = None
    description: Optional[str] = None
    responsable_id: Optional[int] = None
    echeance: Optional[date] = None
    statut: Optional[str] = None
    resultat: Optional[str] = None


class ActionComplete(BaseModel):
    resultat: str
    verification_efficacite: Optional[str] = None


@router.get("/")
async def list_actions(
    statut: Optional[str] = None,
    responsable_id: Optional[int] = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Action).order_by(Action.echeance)
    if statut:
        query = query.where(Action.statut == statut)
    if responsable_id:
        query = query.where(Action.responsable_id == responsable_id)
    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0
    result = await session.execute(query.offset(skip).limit(limit))
    actions = result.scalars().all()
    return {
        "total": total, "skip": skip, "limit": limit,
        "items": [
            {
                "id": a.id,
                "type_action": a.type_action,
                "description": a.description[:80] + "..." if len(a.description) > 80 else a.description,
                "responsable_id": a.responsable_id,
                "echeance": a.echeance,
                "statut": a.statut,
                "nc_id": a.nc_id,
                "risque_id": a.risque_id,
                "audit_id": a.audit_id,
                "created_at": a.created_at,
            }
            for a in actions
        ],
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_action(
    request: Request,
    data: ActionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    action = Action(
        type_action=data.type_action,
        description=data.description,
        responsable_id=data.responsable_id,
        echeance=data.echeance,
        nc_id=data.nc_id,
        risque_id=data.risque_id,
        audit_id=data.audit_id,
    )
    session.add(action)
    await session.commit()
    await session.refresh(action)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="action",
        resource_id=str(action.id),
        details=f"Création action {action.type_action} échéance {action.echeance}",
        ip_address=get_client_ip(request),
    )
    return {"id": action.id, "statut": action.statut}


@router.get("/{action_id}")
async def get_action(
    action_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    action = await session.get(Action, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action introuvable")
    return {
        "id": action.id,
        "type_action": action.type_action,
        "description": action.description,
        "responsable_id": action.responsable_id,
        "echeance": action.echeance,
        "statut": action.statut,
        "resultat": action.resultat,
        "nc_id": action.nc_id,
        "risque_id": action.risque_id,
        "audit_id": action.audit_id,
        "created_at": action.created_at,
        "updated_at": action.updated_at,
    }


@router.put("/{action_id}")
async def update_action(
    request: Request,
    action_id: int,
    data: ActionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    action = await session.get(Action, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action introuvable")
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(action, key, value)
    action.updated_at = datetime.utcnow()
    session.add(action)
    await session.commit()
    await session.refresh(action)
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="action",
        resource_id=str(action.id),
        details=f"Mise à jour action {action.id}",
        ip_address=get_client_ip(request),
    )
    return {"id": action.id, "statut": action.statut}


@router.put("/{action_id}/complete")
async def complete_action(
    request: Request,
    action_id: int,
    data: ActionComplete,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    action = await session.get(Action, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action introuvable")
    action.statut = "terminee"
    action.resultat = data.resultat
    action.updated_at = datetime.utcnow()
    session.add(action)
    await session.commit()
    await session.refresh(action)
    await log_action(
        session,
        user_id=current_user.id,
        action="COMPLETE",
        resource_type="action",
        resource_id=str(action.id),
        details=f"Action {action.id} terminée. Vérification efficacité: {data.verification_efficacite or 'N/A'}",
        ip_address=get_client_ip(request),
    )
    return {"id": action.id, "statut": action.statut, "resultat": action.resultat}
