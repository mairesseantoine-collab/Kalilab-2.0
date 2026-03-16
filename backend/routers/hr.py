from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select
from datetime import datetime, date, timedelta
from typing import Optional, List
from pydantic import BaseModel
import json as _json

from database.engine import get_session
from database.models import (
    User, UserRole, Competence, Formation, PlanningRH, Qualification,
    PersonnelRH, HabilitationPersonnel,
)
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip

router = APIRouter()


# ── Competences ───────────────────────────────────────────────────────────────

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


# ── Formations ────────────────────────────────────────────────────────────────

@router.get("/formations")
async def list_formations(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(select(Formation).order_by(Formation.date_debut.desc()))
    formations = result.scalars().all()
    return [
        {
            "id": f.id,
            "titre": f.titre,
            "date_debut": f.date_debut,
            "date_fin": f.date_fin,
            "formateur": f.formateur,
            "statut": f.statut,
            "participants": _json.loads(f.participants or "[]"),
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
    formation = Formation(
        titre=data.titre,
        description=data.description,
        date_debut=data.date_debut,
        date_fin=data.date_fin,
        formateur=data.formateur,
        participants=_json.dumps(data.participants or []),
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
    formation = await session.get(Formation, formation_id)
    if not formation:
        raise HTTPException(status_code=404, detail="Formation introuvable")
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        if key == "evaluations" and value is not None:
            setattr(formation, key, _json.dumps(value))
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


# ── Planning ──────────────────────────────────────────────────────────────────

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


# ── Competence matrix ─────────────────────────────────────────────────────────

@router.get("/matrix")
async def competence_matrix(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    users_result = await session.execute(select(User).where(User.is_active == True).order_by(User.nom))
    users = users_result.scalars().all()
    comps_result = await session.execute(select(Competence))
    comps = comps_result.scalars().all()

    today = date.today()
    soon = today + timedelta(days=60)

    comp_by_user: dict = {}
    for c in comps:
        if c.user_id not in comp_by_user:
            comp_by_user[c.user_id] = []
        expired = c.date_validite is not None and c.date_validite < today
        expiring_soon = c.date_validite is not None and not expired and c.date_validite <= soon
        comp_by_user[c.user_id].append({
            "id": c.id,
            "intitule": c.intitule,
            "niveau": c.niveau,
            "date_validite": c.date_validite,
            "expired": expired,
            "expiring_soon": expiring_soon,
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


# ── Habilitation matrix ───────────────────────────────────────────────────────

@router.get("/matrix/habilitations")
async def habilitation_matrix(
    site: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Matrice croisée Personnel × Qualifications avec statuts d'habilitation."""
    # Load personnel
    p_query = select(PersonnelRH).where(PersonnelRH.actif == True).order_by(PersonnelRH.nom)
    if site:
        p_query = p_query.where(PersonnelRH.site.in_([site, "both"]))
    p_result = await session.execute(p_query)
    personnel = p_result.scalars().all()

    # Load qualifications
    q_result = await session.execute(select(Qualification).order_by(Qualification.libelle))
    qualifications = q_result.scalars().all()

    # Filter qualifications by site
    if site:
        qualifications = [q for q in qualifications if site in _json.loads(q.sites or "[]")]

    # Load all habilitations
    h_result = await session.execute(select(HabilitationPersonnel))
    habilitations = h_result.scalars().all()

    today = date.today()
    soon = today + timedelta(days=60)

    # Build lookup: (personnel_id, qualification_id) → habilitation
    hab_map: dict = {}
    for h in habilitations:
        hab_map[(h.personnel_id, h.qualification_id)] = h

    # Build qual validity map
    qual_validity: dict = {q.id: q.validite_mois for q in qualifications}

    # Build habilitation status list
    hab_status = []
    for p in personnel:
        for q in qualifications:
            # Only include if person is in personnel_concerne
            pc = _json.loads(q.personnel_concerne or "[]")
            if p.id not in pc:
                continue
            h = hab_map.get((p.id, q.id))
            if h:
                expired = h.date_echeance is not None and h.date_echeance < today
                expiring_soon = h.date_echeance is not None and not expired and h.date_echeance <= soon
                if expired:
                    st = "expired"
                elif expiring_soon:
                    st = "expiring_soon"
                else:
                    st = "valid"
                hab_status.append({
                    "personnel_id": p.id,
                    "qualification_id": q.id,
                    "habilitation_id": h.id,
                    "date_habilitation": h.date_habilitation,
                    "date_echeance": h.date_echeance,
                    "status": st,
                })
            else:
                hab_status.append({
                    "personnel_id": p.id,
                    "qualification_id": q.id,
                    "habilitation_id": None,
                    "date_habilitation": None,
                    "date_echeance": None,
                    "status": "not_habilitated",
                })

    return {
        "personnel": [
            {"id": p.id, "nom": p.nom, "prenom": p.prenom, "fonction": p.fonction, "site": p.site}
            for p in personnel
        ],
        "qualifications": [
            {"id": q.id, "libelle": q.libelle, "validite_mois": q.validite_mois, "reevaluation": q.reevaluation}
            for q in qualifications
        ],
        "habilitations": hab_status,
    }


# ── Biologistes (for responsable selector) ────────────────────────────────────

@router.get("/biologistes")
async def list_biologistes(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(User)
        .where(User.role == UserRole.BIOLOGISTE, User.is_active == True)
        .order_by(User.nom)
    )
    users = result.scalars().all()
    return [{"id": u.id, "label": f"{u.prenom} {u.nom}"} for u in users]


# ── PersonnelRH CRUD ──────────────────────────────────────────────────────────

class PersonnelRHCreate(BaseModel):
    nom: str
    prenom: str
    telephone: Optional[str] = None
    site: str = "STE"
    fonction: str


class PersonnelRHUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    telephone: Optional[str] = None
    site: Optional[str] = None
    fonction: Optional[str] = None
    actif: Optional[bool] = None


def _p_to_dict(p: PersonnelRH) -> dict:
    return {
        "id": p.id,
        "nom": p.nom,
        "prenom": p.prenom,
        "telephone": p.telephone,
        "site": p.site,
        "fonction": p.fonction,
        "actif": p.actif,
        "label": f"{p.prenom} {p.nom}",
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


@router.get("/personnel-rh")
async def list_personnel_rh(
    site: Optional[str] = None,
    actif: Optional[bool] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(PersonnelRH).order_by(PersonnelRH.nom, PersonnelRH.prenom)
    if site:
        query = query.where(PersonnelRH.site.in_([site, "both"]))
    if actif is not None:
        query = query.where(PersonnelRH.actif == actif)
    result = await session.execute(query)
    return [_p_to_dict(p) for p in result.scalars().all()]


@router.post("/personnel-rh", status_code=status.HTTP_201_CREATED)
async def create_personnel_rh(
    request: Request,
    data: PersonnelRHCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    p = PersonnelRH(
        nom=data.nom,
        prenom=data.prenom,
        telephone=data.telephone,
        site=data.site,
        fonction=data.fonction,
    )
    session.add(p)
    await session.commit()
    await session.refresh(p)
    await log_action(session, user_id=current_user.id, action="CREATE",
                     resource_type="personnel_rh", resource_id=str(p.id),
                     details=f"Personnel créé: {p.prenom} {p.nom}",
                     ip_address=get_client_ip(request))
    return _p_to_dict(p)


@router.put("/personnel-rh/{personnel_id}")
async def update_personnel_rh(
    request: Request,
    personnel_id: int,
    data: PersonnelRHUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    p = await session.get(PersonnelRH, personnel_id)
    if not p:
        raise HTTPException(status_code=404, detail="Personnel introuvable")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(p, key, value)
    p.updated_at = datetime.utcnow()
    session.add(p)
    await session.commit()
    await session.refresh(p)
    await log_action(session, user_id=current_user.id, action="UPDATE",
                     resource_type="personnel_rh", resource_id=str(p.id),
                     details=f"Personnel mis à jour: {p.prenom} {p.nom}",
                     ip_address=get_client_ip(request))
    return _p_to_dict(p)


@router.delete("/personnel-rh/{personnel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_personnel_rh(
    request: Request,
    personnel_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    p = await session.get(PersonnelRH, personnel_id)
    if not p:
        raise HTTPException(status_code=404, detail="Personnel introuvable")
    await session.delete(p)
    await session.commit()
    await log_action(session, user_id=current_user.id, action="DELETE",
                     resource_type="personnel_rh", resource_id=str(personnel_id),
                     details=f"Personnel supprimé: {p.prenom} {p.nom}",
                     ip_address=get_client_ip(request))


# ── HabilitationPersonnel CRUD ────────────────────────────────────────────────

class HabilitationCreate(BaseModel):
    personnel_id: int
    qualification_id: int
    date_habilitation: date
    date_echeance: Optional[date] = None


@router.post("/habilitations", status_code=status.HTTP_201_CREATED)
async def create_habilitation(
    request: Request,
    data: HabilitationCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    # Upsert: remove existing habilitation for same (personnel, qualification)
    existing = await session.execute(
        select(HabilitationPersonnel)
        .where(HabilitationPersonnel.personnel_id == data.personnel_id)
        .where(HabilitationPersonnel.qualification_id == data.qualification_id)
    )
    existing_row = existing.scalar_one_or_none()
    if existing_row:
        await session.delete(existing_row)

    # Auto-calculate date_echeance from qualification.validite_mois if not provided
    date_echeance = data.date_echeance
    if date_echeance is None:
        qual = await session.get(Qualification, data.qualification_id)
        if qual and qual.validite_mois:
            from dateutil.relativedelta import relativedelta
            try:
                date_echeance = data.date_habilitation + relativedelta(months=qual.validite_mois)
            except Exception:
                pass

    h = HabilitationPersonnel(
        personnel_id=data.personnel_id,
        qualification_id=data.qualification_id,
        date_habilitation=data.date_habilitation,
        date_echeance=date_echeance,
    )
    session.add(h)
    await session.commit()
    await session.refresh(h)
    await log_action(session, user_id=current_user.id, action="CREATE",
                     resource_type="habilitation", resource_id=str(h.id),
                     details=f"Habilitation créée: personnel {data.personnel_id} × qual {data.qualification_id}",
                     ip_address=get_client_ip(request))
    return {
        "id": h.id,
        "personnel_id": h.personnel_id,
        "qualification_id": h.qualification_id,
        "date_habilitation": h.date_habilitation,
        "date_echeance": h.date_echeance,
    }


@router.delete("/habilitations/{hab_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habilitation(
    request: Request,
    hab_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    h = await session.get(HabilitationPersonnel, hab_id)
    if not h:
        raise HTTPException(status_code=404, detail="Habilitation introuvable")
    await session.delete(h)
    await session.commit()
    await log_action(session, user_id=current_user.id, action="DELETE",
                     resource_type="habilitation", resource_id=str(hab_id),
                     details=f"Habilitation supprimée",
                     ip_address=get_client_ip(request))


# ── Qualifications ────────────────────────────────────────────────────────────

class QualificationCreate(BaseModel):
    libelle: str
    duree_heures: Optional[float] = None
    description: Optional[str] = None
    reevaluation: bool = False
    validite_mois: Optional[int] = None
    responsable_id: Optional[int] = None
    sites: Optional[List[str]] = None
    fonctions_concernees: Optional[List[str]] = None
    personnel_concerne: Optional[List[int]] = None
    criteres_evaluation: Optional[List[dict]] = None


class QualificationUpdate(BaseModel):
    libelle: Optional[str] = None
    duree_heures: Optional[float] = None
    description: Optional[str] = None
    reevaluation: Optional[bool] = None
    validite_mois: Optional[int] = None
    responsable_id: Optional[int] = None
    sites: Optional[List[str]] = None
    fonctions_concernees: Optional[List[str]] = None
    personnel_concerne: Optional[List[int]] = None
    criteres_evaluation: Optional[List[dict]] = None
    docs_admin: Optional[List[int]] = None
    docs_user: Optional[List[int]] = None


def _q_to_dict(q: Qualification, responsable: Optional[User] = None,
               personnel_noms: Optional[dict] = None) -> dict:
    pc_ids = _json.loads(q.personnel_concerne or "[]")
    if personnel_noms:
        pc_noms = [personnel_noms.get(pid, f"#{pid}") for pid in pc_ids]
    else:
        pc_noms = [str(pid) for pid in pc_ids]
    return {
        "id": q.id,
        "libelle": q.libelle,
        "duree_heures": q.duree_heures,
        "description": q.description,
        "reevaluation": q.reevaluation,
        "validite_mois": q.validite_mois,
        "responsable_id": q.responsable_id,
        "responsable_nom": f"{responsable.prenom} {responsable.nom}" if responsable else None,
        "sites": _json.loads(q.sites or "[]"),
        "fonctions_concernees": _json.loads(q.fonctions_concernees or "[]"),
        "personnel_concerne": pc_ids,
        "personnel_concerne_noms": pc_noms,
        "criteres_evaluation": _json.loads(q.criteres_evaluation or "[]"),
        "docs_admin": _json.loads(q.docs_admin or "[]"),
        "fichiers_admin": _json.loads(q.fichiers_admin or "[]"),
        "docs_user": _json.loads(q.docs_user or "[]"),
        "fichiers_user": _json.loads(q.fichiers_user or "[]"),
        "created_at": q.created_at,
        "updated_at": q.updated_at,
    }


@router.get("/qualifications")
async def list_qualifications(
    site: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Qualification).order_by(Qualification.libelle)
    result = await session.execute(query)
    quals = result.scalars().all()

    # Load responsables
    resp_ids = list({q.responsable_id for q in quals if q.responsable_id})
    responsables: dict = {}
    if resp_ids:
        r2 = await session.execute(select(User).where(User.id.in_(resp_ids)))
        for u in r2.scalars().all():
            responsables[u.id] = u

    # Load personnel names
    all_pc_ids: set = set()
    for q in quals:
        for pid in _json.loads(q.personnel_concerne or "[]"):
            all_pc_ids.add(pid)
    personnel_noms: dict = {}
    if all_pc_ids:
        p_result = await session.execute(
            select(PersonnelRH).where(PersonnelRH.id.in_(list(all_pc_ids)))
        )
        for p in p_result.scalars().all():
            personnel_noms[p.id] = f"{p.prenom} {p.nom}"

    out = [_q_to_dict(q, responsables.get(q.responsable_id), personnel_noms) for q in quals]
    if site:
        out = [q for q in out if site in q["sites"]]
    return out


@router.post("/qualifications", status_code=status.HTTP_201_CREATED)
async def create_qualification(
    request: Request,
    data: QualificationCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    qual = Qualification(
        libelle=data.libelle,
        duree_heures=data.duree_heures,
        description=data.description,
        reevaluation=data.reevaluation,
        validite_mois=data.validite_mois,
        responsable_id=data.responsable_id,
        sites=_json.dumps(data.sites or []),
        fonctions_concernees=_json.dumps(data.fonctions_concernees or []),
        personnel_concerne=_json.dumps(data.personnel_concerne or []),
        criteres_evaluation=_json.dumps(data.criteres_evaluation or []),
    )
    session.add(qual)
    await session.commit()
    await session.refresh(qual)
    await log_action(session, user_id=current_user.id, action="CREATE",
                     resource_type="qualification", resource_id=str(qual.id),
                     details=f"Qualification créée: {qual.libelle}",
                     ip_address=get_client_ip(request))
    return _q_to_dict(qual)


@router.put("/qualifications/{qual_id}")
async def update_qualification(
    request: Request,
    qual_id: int,
    data: QualificationUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN, UserRole.RESP_TECHNIQUE)),
):
    qual = await session.get(Qualification, qual_id)
    if not qual:
        raise HTTPException(status_code=404, detail="Qualification introuvable")
    update_data = data.dict(exclude_unset=True)
    json_fields = {"sites", "fonctions_concernees", "personnel_concerne",
                   "docs_admin", "docs_user", "criteres_evaluation"}
    for key, value in update_data.items():
        if key in json_fields and value is not None:
            setattr(qual, key, _json.dumps(value))
        else:
            setattr(qual, key, value)
    qual.updated_at = datetime.utcnow()
    session.add(qual)
    await session.commit()
    await session.refresh(qual)
    await log_action(session, user_id=current_user.id, action="UPDATE",
                     resource_type="qualification", resource_id=str(qual.id),
                     details=f"Qualification mise à jour: {qual.libelle}",
                     ip_address=get_client_ip(request))
    responsable = await session.get(User, qual.responsable_id) if qual.responsable_id else None
    return _q_to_dict(qual, responsable)


@router.delete("/qualifications/{qual_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_qualification(
    request: Request,
    qual_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    qual = await session.get(Qualification, qual_id)
    if not qual:
        raise HTTPException(status_code=404, detail="Qualification introuvable")
    await session.delete(qual)
    await session.commit()
    await log_action(session, user_id=current_user.id, action="DELETE",
                     resource_type="qualification", resource_id=str(qual_id),
                     details=f"Qualification supprimée: {qual.libelle}",
                     ip_address=get_client_ip(request))


@router.post("/qualifications/seed", status_code=status.HTTP_201_CREATED)
async def seed_qualifications(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Pré-charge la liste standard des qualifications du laboratoire."""
    QUALIFICATIONS_STE = [
        "[E] - Accueil", "[E] - Anoxomat - niveau 3", "[E] - Antibiogramme - Niveau 1",
        "[E] - Antibiogramme - Niveau 3", "[E] - Auditeur interne : Niveau 3",
        "[E] - Balances - Niveau 1", "[E] - Banque de sang - Immuno-Hémato - Niveau 1",
        "[E] - Banque de sang - Immuno-Hémato - Niveau 3",
        "[E] - Biologie moléculaire (GeneXpert) - Niveau 1",
        "[E] - Biologie moléculaire (GeneXpert) - Niveau 3",
        "[E] - Biologie moléculaire (Qiastat) - Niveau 3",
        "[E] - Biologie moléculaire (Seegene) - niveau 2",
        "[E] - Biologie moléculaire (Seegene) - niveau 3",
        "[E] - Biologie moléculaire (magLEAD / CFX96) - Niveau 3",
        "[E] - Biologiste de garde : niveau 3",
        "[E] - Capillarys 3 Octa + Hydrasis 2 Scan+ Assist: niveau 3",
        "[E] - Centrifugeuses / Cytocentrifugeuses Niveau 1",
        "[E] - Coagulation (CN tests spéciaux) - Niveau 3",
        "[E] - Coagulation (CN) - Niveau 1", "[E] - Coagulation (CN) - Niveau 2",
        "[E] - Cobas CE Niveau 1", "[E] - Cobas CE Niveau 2",
        "[E] - Flux laminaires Niveau 1", "[E] - Flux laminaires Niveau 3",
        "[E] - Formule microscopique - Niveau 3", "[E] - Hotte chimique - Niveau 3",
        "[E] - Hématologie manuelle - Niveau 1", "[E] - Hématologie manuelle - Niveau 3",
        "[E] - Immunophénotypage - Cytométrie en flux", "[E] - Informatique - Niveau 3",
        "[E] - Liaison XL", "[E] - Logistique - niveau 1", "[E] - Logistique - niveau 2",
        "[E] - Logistique - niveau 3", "[E] - Microbiologie - Pré-analytique - Niveau 1",
        "[E] - Microbiologie - Pré-analytique - Niveau 2",
        "[E] - Microbiologie - Pré-analytique - Niveau 3",
        "[E] - Micropipettes Niveau 1", "[E] - Micropipettes Niveau 2",
        "[E] - Microscopes Niveau 1", "[E] - Microscopie IFA niveau 2",
        "[E] - Nal Von Minden (C1 Reader) Niveau 1", "[E] - Nal Von Minden (C1 Reader) Niveau 2",
        "[E] - Optilite - Niveau 3", "[E] - Osmométrie Niveau 1", "[E] - Osmométrie Niveau 2",
        "[E] - POCT : Afinion2 CRP niveau 2", "[E] - POCT : Afinion2 CRP niveau 3",
        "[E] - POCT : GEM 5000 Niveau 1", "[E] - POCT : GEM 5000 Niveau 2",
        "[E] - POCT : GEM5000 Niveau 3", "[E] - POCT : Glucomètre Statstrip niveau 1",
        "[E] - POCT : Glucomètre Statstrip niveau 2", "[E] - POCT : Glucomètre Statstrip niveau 3",
        "[E] - Phadia250 Niveau 2", "[E] - Post-analytique - Niveau 1",
        "[E] - Post-analytique - Niveau 2", "[E] - Post-analytique - Niveau 3",
        "[E] - Prélèvements", "[E] - Qualité - Niveau 1", "[E] - Qualité - Niveau 2",
        "[E] - Qualité - Niveau 3", "[E] - RH - Niveau 1",
        "[E] - Réception et encodage - Niveau 1", "[E] - Réception et encodage - Niveau 3",
        "[E] - Selles - Niveau 3", "[E] - Sous-traitance - Niveau 1",
        "[E] - Sous-traitance - Niveau 3", "[E] - Spermiologie",
        "[E] - Testo / 174T - Niveau 1", "[E] - Testo / Enceintes thermiques - Niveau 1",
        "[E] - Testo / Enceintes thermiques - Niveau 3",
        "[E] - Traitement pré-analytique STE (niveau 1)",
        "[E] - Traitement pré-analytique STE (niveau 3)",
        "[E] - Urines - Niveau 1", "[E] - Urines - Niveau 2", "[E] - Urines - Niveau 3",
        "[E] - Vidas", "[E] - XN - Niveau 1", "[E] - XN - Niveau 3",
    ]
    QUALIFICATIONS_STM = [
        "[M] - Accueil", "[M] - Auditeur interne : Niveau 3", "[M] - Balances - Niveau 1",
        "[M] - Banque de sang - Immuno-Hémato - Niveau 1",
        "[M] - Banque de sang - Immuno-Hémato - Niveau 3",
        "[M] - Biologie moléculaire (GeneXpert) - Niveau 1",
        "[M] - Biologie moléculaire (GeneXpert) - Niveau 3",
        "[M] - Biologiste de garde : niveau 3",
        "[M] - Centrifugeuses / Cytocentrifugeuses Niveau 1",
        "[M] - Coagulation (CN) - Niveau 1", "[M] - Coagulation (CN) - Niveau 2",
        "[M] - Flux laminaires Niveau 1", "[M] - Formule microscopique - Niveau 3",
        "[M] - Hématologie manuelle - Niveau 1", "[M] - Hématologie manuelle - Niveau 3",
        "[M] - Informatique - Niveau 3", "[M] - Logistique - niveau 1",
        "[M] - Logistique - niveau 2", "[M] - Logistique - niveau 3",
        "[M] - Microbiologie - Pré-analytique - Niveau 1",
        "[M] - Micropipettes Niveau 1", "[M] - Micropipettes Niveau 2",
        "[M] - Microscopes Niveau 1", "[M] - Microscopie IFA niveau 2",
        "[M] - Nal Von Minden (C1 Reader) Niveau 1", "[M] - Nal Von Minden (C1 Reader) Niveau 2",
        "[M] - Osmométrie Niveau 1", "[M] - Osmométrie Niveau 2",
        "[M] - POCT : Afinion2 CRP niveau 2", "[M] - POCT : Afinion2 CRP niveau 3",
        "[M] - POCT : GEM 5000 Niveau 1", "[M] - POCT : GEM 5000 Niveau 2",
        "[M] - POCT : GEM5000 Niveau 3", "[M] - POCT : Glucomètre Statstrip niveau 1",
        "[M] - POCT : Glucomètre Statstrip niveau 2", "[M] - POCT : Glucomètre Statstrip niveau 3",
        "[M] - Phadia250 Niveau 2", "[M] - Post-analytique - Niveau 1",
        "[M] - Post-analytique - Niveau 2", "[M] - Post-analytique - Niveau 3",
        "[M] - Prélèvements", "[M] - Qualité - Niveau 1", "[M] - Qualité - Niveau 2",
        "[M] - Qualité - Niveau 3", "[M] - RH - Niveau 1",
        "[M] - Réception et encodage - Niveau 1", "[M] - Réception et encodage - Niveau 3",
        "[M] - Sous-traitance - Niveau 1", "[M] - Sous-traitance - Niveau 3",
        "[M] - Sprinter Niveau 2", "[M] - Testo / 174T - Niveau 1",
        "[M] - Testo / Enceintes thermiques - Niveau 1",
        "[M] - Testo / Enceintes thermiques - Niveau 3",
        "[M] - Traitement pré-analytique STM (niveau 1)",
        "[M] - Traitement pré-analytique STM (niveau 3)",
        "[M] - Urines - Niveau 1", "[M] - Urines - Niveau 2", "[M] - Urines - Niveau 3",
        "[M] - XN - Niveau 1", "[M] - XN - Niveau 3",
    ]
    existing_result = await session.execute(select(Qualification.libelle))
    existing = {row[0] for row in existing_result.all()}
    created = 0
    for libelle in QUALIFICATIONS_STE:
        if libelle not in existing:
            session.add(Qualification(libelle=libelle, sites=_json.dumps(["STE"])))
            created += 1
    for libelle in QUALIFICATIONS_STM:
        if libelle not in existing:
            session.add(Qualification(libelle=libelle, sites=_json.dumps(["STM"])))
            created += 1
    await session.commit()
    return {"created": created, "skipped": len(QUALIFICATIONS_STE) + len(QUALIFICATIONS_STM) - created}
