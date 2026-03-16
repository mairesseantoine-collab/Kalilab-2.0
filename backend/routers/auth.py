from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from pydantic import BaseModel

from database.engine import get_session
from database.models import User
from auth.security import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from auth.dependencies import get_current_user, log_action, get_client_ip

router = APIRouter()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    role: str
    nom: str
    prenom: str


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(User).where(User.email == form_data.username)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )
    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    await log_action(
        session,
        user_id=user.id,
        action="LOGIN",
        resource_type="user",
        resource_id=str(user.id),
        details=f"Connexion réussie pour {user.email}",
        ip_address=get_client_ip(request),
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role.value,
        nom=user.nom,
        prenom=user.prenom,
    )


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await log_action(
        session,
        user_id=current_user.id,
        action="LOGOUT",
        resource_type="user",
        resource_id=str(current_user.id),
        details=f"Déconnexion de {current_user.email}",
        ip_address=get_client_ip(request),
    )
    return {"detail": "Déconnexion réussie"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "uuid": current_user.uuid,
        "nom": current_user.nom,
        "prenom": current_user.prenom,
        "email": current_user.email,
        "role": current_user.role.value,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
    }
