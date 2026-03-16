from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, UserRole, Competence, Formation, PlanningRH
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip

router = APIRouter()


class CompetenceCreate(BaseModel):
    user_id: int
    intitule: str
    niveau: int = 1
    date_acquisition: Optional[date] = None
    date_validite: Optional[date] = None
    document_proof_id: Optional[int] = None


class FormationCreate(BaseModel):
    titre: str
    description: Optional[str] = None
    date_debut: date
    date_fin: Optional[date] = None
    formateur: Optional[str] = None
    participants: Optional[List[int]] = None
    validite_mois: Optional[int] = None


class FormationUpdate(BaseModel):
    statut: Optional[str] = None
    date_fin: Optional[date] = None
    evaluations: Optional[dict] = None
    formateur: Optional[str] = None


class PlanningCreate(BaseModel):
    user_id: int
    type_evenement: str
    date_debut: date
    date_fin: Optional[date] = None
    motif: Optional[str] = None


@router.get("/competences")
async def list_competences(
    user_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Competence).order_by(Competence.user_id, Competence.intitule)
    if user_id:
        query = query.where(Competence.user_id == user_id)
    result = await session.execute(query)
    comps = result.scalars().all()
    return [
        {
            "id": c.id,
            "user_id": c.user_id,
            "intitule": c.intitule,
            "niveau": c.niveau,
            "date_acquisition": c.date_acquisition,
            "date_validite": c.date_validite,
            "document_proof_id": c.document_proof_id,
            "created_at": c.created_at,
        }
        for c in comps
    ]


@router.post("/competences", status_code=status.HTTP_201_CREATED)
async def create_competence(
    request: Request,
    data: CompetenceCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    comp = Competence(
        user_id=data.user_id,
        intitule=data.intitule,
        niveau=data.niveau,
        date_acquisition=data.date_acquisition,
        date_validite=data.date_validite,
        document_proof_id=data.document_proof_id,
    )
    session.add(comp)
    await session.commit()
    await session.refresh(comp)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="competence",
        resource_id=str(comp.id),
        details=f"Compétence {comp.intitule} niveau {comp.niveau} pour user {comp.user_id}",
        ip_address=get_client_ip(request),
    )
    return {"id": comp.id, "intitule": comp.intitule, "niveau": comp.niveau}


@router.get("/formations")
async def list_formations(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(select(Formation).order_by(Formation.date_debut.desc()))
    formations = result.scalars().all()
    import json
    return [
        {
            "id": f.id,
            "titre": f.titre,
            "date_debut": f.date_debut,
            "date_fin": f.date_fin,
            "formateur": f.formateur,
            "statut": f.statut,
            "participants": json.loads(f.participants or "[]"),
            "validite_mois": f.validite_mois,
            "created_at": f.created_at,
        }
        for f in formations
    ]


@router.post("/formations", status_code=status.HTTP_201_CREATED)
async def create_formation(
    request: Request,
    data: FormationCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    import json
    formation = Formation(
        titre=data.titre,
        description=data.description,
        date_debut=data.date_debut,
        date_fin=data.date_fin,
        formateur=data.formateur,
        participants=json.dumps(data.participants or []),
        validite_mois=data.validite_mois,
    )
    session.add(formation)
    await session.commit()
    await session.refresh(formation)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="formation",
        resource_id=str(formation.id),
        details=f"Création formation {formation.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": formation.id, "titre": formation.titre, "statut": formation.statut}


@router.put("/formations/{formation_id}")
async def update_formation(
    request: Request,
    formation_id: int,
    data: FormationUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    import json
    formation = await session.get(Formation, formation_id)
    if not formation:
        raise HTTPException(status_code=404, detail="Formation introuvable")
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        if key == "evaluations" and value is not None:
            setattr(formation, key, json.dumps(value))
        else:
            setattr(formation, key, value)
    session.add(formation)
    await session.commit()
    await session.refresh(formation)
    await log_action(
        session,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="formation",
        resource_id=str(formation.id),
        details=f"Mise à jour formation {formation.titre}",
        ip_address=get_client_ip(request),
    )
    return {"id": formation.id, "statut": formation.statut}


@router.get("/planning")
async def get_planning(
    user_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(PlanningRH).order_by(PlanningRH.date_debut)
    if user_id:
        query = query.where(PlanningRH.user_id == user_id)
    result = await session.execute(query)
    plannings = result.scalars().all()
    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "type_evenement": p.type_evenement,
            "date_debut": p.date_debut,
            "date_fin": p.date_fin,
            "motif": p.motif,
            "statut": p.statut,
        }
        for p in plannings
    ]


@router.post("/planning", status_code=status.HTTP_201_CREATED)
async def create_planning(
    request: Request,
    data: PlanningCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    planning = PlanningRH(
        user_id=data.user_id,
        type_evenement=data.type_evenement,
        date_debut=data.date_debut,
        date_fin=data.date_fin,
        motif=data.motif,
    )
    session.add(planning)
    await session.commit()
    await session.refresh(planning)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="planning_rh",
        resource_id=str(planning.id),
        details=f"Événement {planning.type_evenement} pour user {planning.user_id}",
        ip_address=get_client_ip(request),
    )
    return {"id": planning.id}


@router.get("/matrix")
async def competence_matrix(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    users_result = await session.execute(select(User).where(User.is_active == True))
    users = users_result.scalars().all()
    comps_result = await session.execute(select(Competence))
    comps = comps_result.scalars().all()

    # Group competences by user
    comp_by_user = {}
    for c in comps:
        if c.user_id not in comp_by_user:
            comp_by_user[c.user_id] = []
        comp_by_user[c.user_id].append({
            "intitule": c.intitule,
            "niveau": c.niveau,
            "date_validite": c.date_validite,
            "expired": c.date_validite is not None and c.date_validite < date.today(),
        })

    return {
        "matrix": [
            {
                "user_id": u.id,
                "nom": f"{u.prenom} {u.nom}",
                "role": u.role.value,
                "competences": comp_by_user.get(u.id, []),
            }
            for u in users
        ]
    }
