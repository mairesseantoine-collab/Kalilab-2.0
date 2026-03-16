from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, UserRole, Risque, RiskLevel
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip

router = APIRouter()


class RisqueCreate(BaseModel):
    description: str
    probabilite: int = 3
    impact: int = 3
    processus_id: Optional[int] = None
    controles: Optional[str] = None
    plan_action: Optional[str] = None
    echeance: Optional[date] = None
    responsable_id: Optional[int] = None


class RisqueUpdate(BaseModel):
    description: Optional[str] = None
    probabilite: Optional[int] = None
    impact: Optional[int] = None
    processus_id: Optional[int] = None
    controles: Optional[str] = None
    plan_action: Optional[str] = None
    echeance: Optional[date] = None
    statut: Optional[str] = None
    responsable_id: Optional[int] = None


def compute_risk_level(score: int) -> RiskLevel:
    if score <= 4:
        return RiskLevel.FAIBLE
    elif score <= 9:
        return RiskLevel.MODERE
    elif score <= 16:
        return RiskLevel.ELEVE
    else:
        return RiskLevel.CRITIQUE


@router.get("/")
async def list_risks(
    criticite: Optional[str] = None,
    statut: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Risque).order_by(Risque.score_risque.desc())
    if criticite:
        query = query.where(Risque.criticite == criticite)
    if statut:
        query = query.where(Risque.statut == statut)
    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0
    result = await session.execute(query.offset(skip).limit(limit))
    risks = result.scalars().all()
    return {
        "total": total, "skip": skip, "limit": limit,
        "items": [
            {
                "id": r.id,
                "description": r.description,
                "criticite": r.criticite.value,
                "probabilite": r.probabilite,
                "impact": r.impact,
                "score_risque": r.score_risque,
                "statut": r.statut,
                "processus_id": r.processus_id,
                "responsable_id": r.responsable_id,
                "echeance": r.echeance,
                "created_at": r.created_at,
            }
            for r in risks
        ],
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_risk(
    request: Request,
    data: RisqueCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    score = data.probabilite * data.impact
    risk = Risque(
        description=data.description,
        probabilite=data.probabilite,
        impact=data.impact,
        score_risque=score,
        criticite=compute_risk_level(score),
        processus_id=data.processus_id,
        controles=data.controles,
        plan_action=data.plan_action,
        echeance=data.echeance,
        responsable_id=data.responsable_id,
    )
    session.add(risk)
    await session.commit()
    await session.refresh(risk)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="risque",
        resource_id=str(risk.id),
        details=f"Création risque score {risk.score_risque} ({risk.criticite.value})",
        ip_address=get_client_ip(request),
    )
    return {"id": risk.id, "score_risque": risk.score_risque, "criticite": risk.criticite.value}


@router.get("/{risk_id}")
async def get_risk(
    risk_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    risk = await session.get(Risque, risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail="Risque introuvable")
    return {
        "id": risk.id,
        "description": risk.description,
        "criticite": risk.criticite.value,
        "probabilite": risk.probabilite,
        "impact": risk.impact,
        "score_risque": risk.score_risque,
        "controles": risk.controles,
        "plan_action": risk.plan_action,
        "echeance": risk.echeance,
        "statut": risk.statut,
        "processus_id": risk.processus_id,
        "responsable_id": risk.responsable_id,
        "created_at": risk.created_at,
        "updated_at": risk.updated_at,
    }


@router.put("/{risk_id}")
async def update_risk(
    request: Request,
    risk_id: int,
    data: RisqueUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    risk = await session.get(Risque, risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail="Risque introuvable")
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(risk, key, value)
    # Recalculate score if probabilite or impact changed
    risk.score_risque = risk.probabilite * risk.impact
    risk.criticite = compute_risk_level(risk.score_risque)
    risk.updated_at = datetime.utcnow()
    session.add(risk)
    await session.commit()
    await session.refresh(risk)
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="risque",
        resource_id=str(risk.id),
        details=f"Mise à jour risque {risk.id}",
        ip_address=get_client_ip(request),
    )
    return {"id": risk.id, "score_risque": risk.score_risque, "criticite": risk.criticite.value}


@router.delete("/{risk_id}", dependencies=[Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN))])
async def delete_risk(
    request: Request,
    risk_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    risk = await session.get(Risque, risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail="Risque introuvable")
    risk.statut = "clos"
    risk.updated_at = datetime.utcnow()
    session.add(risk)
    await session.commit()
    await log_action(
        session,
        user_id=current_user.id,
        action="CLOSE",
        resource_type="risque",
        resource_id=str(risk.id),
        details=f"Clôture risque {risk.id}",
        ip_address=get_client_ip(request),
    )
    return {"detail": "Risque clos"}
