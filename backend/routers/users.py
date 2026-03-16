from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

from database.engine import get_session
from database.models import User, UserRole
from auth.security import get_password_hash
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip

router = APIRouter()


class UserCreate(BaseModel):
    nom: str
    prenom: str
    email: str
    password: str
    role: UserRole = UserRole.TECHNICIEN


class UserUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserRead(BaseModel):
    id: int
    uuid: str
    nom: str
    prenom: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


@router.get("/personnel", dependencies=[Depends(get_current_user)])
async def list_personnel(session: AsyncSession = Depends(get_session)):
    """Liste des utilisateurs actifs pour les dropdowns (accessible à tous les authentifiés)."""
    result = await session.execute(
        select(User).where(User.is_active == True).order_by(User.nom, User.prenom)
    )
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "nom": u.nom,
            "prenom": u.prenom,
            "role": u.role.value,
            "label": f"{u.prenom} {u.nom}",
        }
        for u in users
    ]


@router.get("/", dependencies=[Depends(require_role(UserRole.ADMIN))])
async def list_users(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "uuid": u.uuid,
            "nom": u.nom,
            "prenom": u.prenom,
            "email": u.email,
            "role": u.role.value,
            "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_user(
    request: Request,
    data: UserCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    existing = await session.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = User(
        nom=data.nom,
        prenom=data.prenom,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        role=data.role,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="user",
        resource_id=str(user.id),
        details=f"Création utilisateur {user.email}",
        ip_address=get_client_ip(request),
    )
    return {"id": user.id, "uuid": user.uuid, "email": user.email}


@router.get("/{user_id}")
async def get_user(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return {
        "id": user.id,
        "uuid": user.uuid,
        "nom": user.nom,
        "prenom": user.prenom,
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


@router.put("/{user_id}")
async def update_user(
    request: Request,
    user_id: int,
    data: UserUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    await session.refresh(user)
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="user",
        resource_id=str(user.id),
        details=f"Mise à jour utilisateur {user.email}: {list(update_data.keys())}",
        ip_address=get_client_ip(request),
    )
    return {"id": user.id, "email": user.email, "role": user.role.value}


@router.delete("/{user_id}", dependencies=[Depends(require_role(UserRole.ADMIN))])
async def delete_user(
    request: Request,
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Impossible de supprimer votre propre compte")
    user.is_active = False
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    await log_action(
        session,
        user_id=current_user.id,
        action="DEACTIVATE",
        resource_type="user",
        resource_id=str(user.id),
        details=f"Désactivation utilisateur {user.email}",
        ip_address=get_client_ip(request),
    )
    return {"detail": "Utilisateur désactivé"}
