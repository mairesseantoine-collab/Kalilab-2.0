from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, UserRole, Plainte, ComplaintStatus
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip

router = APIRouter()


class PlainteCreate(BaseModel):
    source: str
    description: str
    responsable_id: Optional[int] = None


class PlainteUpdate(BaseModel):
    source: Optional[str] = None
    description: Optional[str] = None
    analyse: Optional[str] = None
    responsable_id: Optional[int] = None
    nc_id: Optional[int] = None


class PlainteClose(BaseModel):
    analyse: str
    conclusion: Optional[str] = None


@router.get("/")
async def list_complaints(
    statut: Optional[ComplaintStatus] = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Plainte).order_by(Plainte.created_at.desc())
    if statut:
        query = query.where(Plainte.statut == statut)
    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0
    result = await session.execute(query.offset(skip).limit(limit))
    plaintes = result.scalars().all()
    return {
        "total": total, "skip": skip, "limit": limit,
        "items": [
            {
                "id": p.id,
                "uuid": p.uuid,
                "source": p.source,
                "description": p.description[:100] + "..." if len(p.description) > 100 else p.description,
                "statut": p.statut.value,
                "declarant_id": p.declarant_id,
                "responsable_id": p.responsable_id,
                "nc_id": p.nc_id,
                "created_at": p.created_at,
            }
            for p in plaintes
        ],
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_complaint(
    request: Request,
    data: PlainteCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    plainte = Plainte(
        source=data.source,
        description=data.description,
        declarant_id=current_user.id,
        responsable_id=data.responsable_id or current_user.id,
    )
    session.add(plainte)
    await session.commit()
    await session.refresh(plainte)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="plainte",
        resource_id=str(plainte.id),
        details=f"Déclaration plainte source={plainte.source}",
        ip_address=get_client_ip(request),
    )
    return {"id": plainte.id, "uuid": plainte.uuid, "statut": plainte.statut.value}


@router.get("/{complaint_id}")
async def get_complaint(
    complaint_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    plainte = await session.get(Plainte, complaint_id)
    if not plainte:
        raise HTTPException(status_code=404, detail="Plainte introuvable")
    return {
        "id": plainte.id,
        "uuid": plainte.uuid,
        "source": plainte.source,
        "description": plainte.description,
        "analyse": plainte.analyse,
        "statut": plainte.statut.value,
        "declarant_id": plainte.declarant_id,
        "responsable_id": plainte.responsable_id,
        "nc_id": plainte.nc_id,
        "date_cloture": plainte.date_cloture,
        "created_at": plainte.created_at,
        "updated_at": plainte.updated_at,
    }


@router.put("/{complaint_id}")
async def update_complaint(
    request: Request,
    complaint_id: int,
    data: PlainteUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    plainte = await session.get(Plainte, complaint_id)
    if not plainte:
        raise HTTPException(status_code=404, detail="Plainte introuvable")
    if plainte.statut == ComplaintStatus.CLOTUREE:
        raise HTTPException(status_code=400, detail="Plainte clôturée")
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(plainte, key, value)
    plainte.statut = ComplaintStatus.EN_COURS
    plainte.updated_at = datetime.utcnow()
    session.add(plainte)
    await session.commit()
    await session.refresh(plainte)
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="plainte",
        resource_id=str(plainte.id),
        details=f"Mise à jour plainte {plainte.id}",
        ip_address=get_client_ip(request),
    )
    return {"id": plainte.id, "statut": plainte.statut.value}


@router.put("/{complaint_id}/close")
async def close_complaint(
    request: Request,
    complaint_id: int,
    data: PlainteClose,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    plainte = await session.get(Plainte, complaint_id)
    if not plainte:
        raise HTTPException(status_code=404, detail="Plainte introuvable")
    plainte.statut = ComplaintStatus.CLOTUREE
    plainte.analyse = data.analyse
    plainte.date_cloture = datetime.utcnow()
    plainte.updated_at = datetime.utcnow()
    session.add(plainte)
    await session.commit()
    await session.refresh(plainte)
    await log_action(
        session,
        user_id=current_user.id,
        action="CLOSE",
        resource_type="plainte",
        resource_id=str(plainte.id),
        details=f"Clôture plainte {plainte.id}: {data.analyse[:80]}",
        ip_address=get_client_ip(request),
    )
    return {"id": plainte.id, "statut": plainte.statut.value, "date_cloture": plainte.date_cloture}
