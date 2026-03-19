"""
Router PAG — Plan d'Actions et de Gestion (ISO 15189 biologistes).
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from database.engine import get_session
from database.models import ActionPAG, User
from auth.dependencies import get_current_user

router = APIRouter()

# ── Constantes référentiels ────────────────────────────────────────────────────

PRIORITES = [
    "1- Imp + Urg",
    "2- Non imp - Urg",
    "3- Imp - Non Urg",
    "4- Non Imp - Non Urg",
]

GROUPES = [
    "Accueil et encodage",
    "Action préventive",
    "Action corrective",
    "Banque de sang",
    "Biologistes",
    "Chimie 1 STE",
    "Chimie 1 STM",
    "Chimie 2 STE",
    "Chimie 2 STM",
    "Coagulation",
    "Cytométrie flux",
    "Encodage et réception",
    "Enquête de satisfaction",
    "Gestion de risques",
    "Hémato",
    "Hygiène/Sécurité",
    "Indicateurs qualité",
    "ImmunoChimie",
    "Informatique",
    "Management",
    "Métrologie",
    "Microbio",
    "Multi-sites",
    "Phase analytique",
    "Plaintes/NCONF",
    "POCT",
    "Polyvalent STM",
    "Post-analytique",
    "Pré-analytique",
    "Prélèvements",
    "QCI / QCE",
    "Qualité",
    "RH",
    "Secrétariat",
    "Sérologie",
    "Sous-traitance",
    "Spermiologie",
    "Stock",
    "Techn. Man. Hémato",
    "Technique",
    "TLM Nuit",
    "Transport",
]

ANNEXES = [
    "Audit interne",
    "Audit externe",
    "Comité qualité",
    "CQ",
    "Disparition de la plainte/NCONF",
    "Documentaire",
    "Enquête de satisfaction",
    "Evaluation fournisseur",
    "Gestion de risques",
    "Indicateur",
    "Réunion",
    "Revue de direction",
    "Suivi dossier",
]

FAMILLES = [
    # ISO 15189:2022 — Management
    "Management (4.1 et 4.2)",
    "4.1 Impartialité",
    "4.2 Confidentialité",
    "4.2.1 Gestion de l'information",
    "4.2.2 Communication des informations",
    "4.2.3 Responsabilités du personnel",
    "4.3 Exigences relatives aux patients",
    # Document et enregistrements
    "Document et enregistrements (4.3 et 4.13)",
    # Gestion de contrats
    "Gestion de Contrats (4.4)",
    # Sous-traitance
    "Sous-traitance (4.5)",
    # Services externes
    "Services externe et approvisionnements (4.6)",
    # Prestations
    "Prestations de Conseils (4.7)",
    # Réclamations
    "Réclamations et NC (4.8 , 4.9 , 4.10, 4.11 et 4.12)",
    # Audit
    "Audit et revue de direction (4.14 et 4.15)",
    # 5. Exigences structurelles
    "5. Exigences structurelles et de gouvernance",
    "5.1 Entité légale",
    "5.2 Directeur de laboratoire",
    "5.2.1 Compétences du directeur de laboratoire",
    "5.2.2 Responsabilités du directeur de laboratoire",
    "5.2.3 Délégation des missions et/ou responsabilités",
    "5.3 Activités du laboratoire",
    "5.3.1 Généralités",
    "5.3.2 Conformité aux exigences",
    "5.3.3 Prestations de conseils",
    "5.4 Structure et autorité",
    "5.4.1 Généralités",
    "5.4.2 Management de la qualité",
    "5.5 Objectifs et politiques",
    "5.6 Gestion des risques",
    # RH
    "RH (5.1)",
    # Locaux
    "Locaux et environnement (5.2)",
    # Matériel
    "Matériel de laboratoire (5.3)",
    # Préanalytique
    "Préanalytique (5.4)",
    # Analytique
    "Analytique (5.5)",
    # 6. Ressources
    "6. Exigences relatives aux ressources",
    "6.1 Généralités",
    "6.2 Personnel",
    "6.2.1 Généralités",
    "6.2.2 Exigences relatives aux compétences",
    "6.2.3 Autorisation",
    "6.2.4 Formation continue et développement professionnel",
    "6.2.5 Enregistrements relatifs au personnel",
    "6.3 Installations et conditions environnementales",
    "6.3.1 Généralités",
    "6.3.2 Maîtrise des installations",
    "6.3.3 Installations de stockage",
    "6.3.4 Installations destinées au personnel",
    "6.3.5 Installations destinées au prélèvement des échantillons",
    "6.4 Équipements",
    "6.4.1 Généralités",
    "6.4.2 Exigences relatives aux équipements",
    "6.4.3 Procédure d'acceptation des équipements",
    "6.4.4 Équipements — Mode d'emploi",
    "6.4.5 Maintenance et réparations des équipements",
    "6.4.6 Signalement des événements indésirables relatifs aux équipements",
    "6.4.7 Enregistrements relatifs aux équipements",
    "6.5 Étalonnage des équipements et traçabilité métrologique",
    "6.5.1 Généralités",
    "6.5.2 Étalonnage des équipements",
    "6.5.3 Traçabilité métrologique des résultats de mesure",
    "6.6 Réactifs et consommables",
    "6.6.1 Généralités",
    "6.6.2 Réactifs et consommables — Réception et stockage",
    "6.6.3 Réactifs et consommables — Essais d'acceptation",
    "6.6.4 Réactifs et consommables — Gestion des stocks",
    "6.6.5 Réactifs et consommables — Mode d'emploi",
    "6.6.6 Réactifs et consommables — Signalement des événements indésirables",
    "6.6.7 Réactifs et consommables — Enregistrements",
    "6.7 Contrats de prestations",
    "6.7.1 Contrats avec les utilisateurs du laboratoire",
    "6.7.2 Contrats avec les opérateurs d'EBMD",
    "6.8 Produits et services fournis par des prestataires externes",
    "6.8.1 Généralités",
    "6.8.2 Laboratoires sous-traitants et consultants",
    "6.8.3 Revue et approbation des produits et services fournis par des prestataires externes",
    # 7. Processus
    "7. Exigences relatives aux processus",
    "7.1 Généralités",
    "7.2 Processus préanalytiques",
    "7.2.1 Généralités",
    "7.2.2 Informations du laboratoire à destination des patients et utilisateurs",
    "7.2.3 Demandes d'examens auprès du laboratoire médical",
    "7.2.4 Prélèvement et manipulation des échantillons primaires",
    "7.2.5 Transport des échantillons",
    "7.2.6 Réception des échantillons",
    "7.2.7 Manipulation préanalytique, préparation et stockage",
    "7.3 Processus analytiques",
    "7.3.1 Généralités",
    "7.3.2 Vérification des méthodes d'analyse",
    "7.3.3 Validation des méthodes d'analyse",
    "7.3.4 Évaluation de l'incertitude de mesure (IM)",
    "7.3.5 Intervalles de référence biologiques et limites de décision clinique",
    "7.3.6 Documentation des procédures analytiques",
    "7.3.7 Garantie de la validité des résultats d'examen(s)",
    "7.4 Processus postanalytiques",
    "7.4.1 Compte rendu des résultats",
    "7.4.2 Traitement postanalytique des échantillons",
    "7.5 Travaux non conformes",
    "7.6 Maîtrise des données et gestion de l'information",
    "7.6.1 Généralités",
    "7.6.2 Autorités et responsabilités concernant la gestion de l'information",
    "7.6.3 Gestion des systèmes d'information",
    "7.6.4 Plans en cas de panne",
    "7.6.5 Gestion hors site",
    "7.7 Réclamations",
    "7.7.1 Processus",
    "7.7.2 Réception des réclamations",
    "7.7.3 Traitement des réclamations",
    "7.8 Plan de continuité des activités et de préparation aux situations d'urgence",
    # Gestion des contrôles
    "Gestion des contrôles QCI ET QCE (5.6)",
    # Post analytique
    "Post analytique (5.7)",
    # Résultats
    "Résultats (5.8 et 5.9)",
    # Informatique
    "Gestion de l'informatique (5.10)",
    # 8. Système de management
    "8 Exigences relatives au système de management",
    "8.1 Exigences générales",
    "8.1.1 Généralités",
    "8.1.2 Respect des exigences relatives au système de management",
    "8.1.3 Sensibilisation au système de management",
    "8.2 Documentation du système de management",
    "8.2.1 Généralités",
    "8.2.2 Compétence et qualité",
    "8.2.3 Preuves d'engagement",
    "8.2.4 Documentation",
    "8.2.5 Accessibilité pour le personnel",
    "8.3 Maîtrise de la documentation du système de management",
    "8.3.1 Généralités",
    "8.3.2 Maîtrise des documents",
    "8.4 Maîtrise des enregistrements",
    "8.4.1 Création des enregistrements",
    "8.4.2 Modification des enregistrements",
    "8.4.3 Conservation des enregistrements",
    "8.5 Actions à mettre en oeuvre face aux risques et opportunités d'amélioration",
    "8.5.1 Identification des risques et opportunités d'amélioration",
    "8.5.2 Actions sur les risques et opportunités d'amélioration",
    "8.6 Amélioration",
    "8.6.1 Amélioration continue",
    "8.6.2 Retour d'information des patients, des utilisateurs et du personnel",
    "8.7 Non-conformités et actions correctives",
    "8.7.1 Actions en cas de non-conformité",
    "8.7.2 Efficacité des actions correctives",
    "8.7.3 Enregistrements des non-conformités et actions correctives",
    "8.8 Évaluations",
    "8.8.1 Généralités",
    "8.8.2 Indicateurs qualité",
    "8.8.3 Audits internes",
    "8.9 Revues de direction",
    "8.9.1 Généralités",
    "8.9.2 Éléments d'entrée de la revue",
    "8.9.3 Éléments de sortie de la revue",
    # Annexe EBMD
    "Annexe A (normative) - Exigences supplémentaires relatives aux examens de biologie médicale délocalisée (EBMD)",
    "A.1 Généralités",
    "A.2 Gouvernance des EBMD",
    "A.3 Programme d'assurance qualité",
    "A.4 Programme de formation",
    # Document BELAC
    "Document BELAC",
]


# ── Schemas Pydantic ───────────────────────────────────────────────────────────

class ActionPAGCreate(BaseModel):
    num_pag: Optional[str] = None
    tache: str
    attribution: Optional[str] = None
    avancement_notes: Optional[str] = None
    avancement_pct: int = 0
    priorite: str = "3- Imp - Non Urg"
    date_fin_prevue: Optional[str] = None
    cloture: bool = False
    verification_efficacite: Optional[bool] = None
    groupe: Optional[str] = None
    annexe: Optional[str] = None
    famille: Optional[str] = None
    responsable_pag: Optional[str] = None


class ActionPAGUpdate(BaseModel):
    num_pag: Optional[str] = None
    tache: Optional[str] = None
    attribution: Optional[str] = None
    avancement_notes: Optional[str] = None
    avancement_pct: Optional[int] = None
    priorite: Optional[str] = None
    date_fin_prevue: Optional[str] = None
    cloture: Optional[bool] = None
    verification_efficacite: Optional[bool] = None
    groupe: Optional[str] = None
    annexe: Optional[str] = None
    famille: Optional[str] = None
    responsable_pag: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _action_dict(a: ActionPAG) -> dict:
    return {
        "id": a.id,
        "num_pag": a.num_pag,
        "tache": a.tache,
        "attribution": a.attribution,
        "avancement_notes": a.avancement_notes,
        "avancement_pct": a.avancement_pct,
        "priorite": a.priorite,
        "date_fin_prevue": a.date_fin_prevue.isoformat() if a.date_fin_prevue else None,
        "cloture": a.cloture,
        "verification_efficacite": a.verification_efficacite,
        "groupe": a.groupe,
        "annexe": a.annexe,
        "famille": a.famille,
        "responsable_pag": a.responsable_pag,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/referentiels")
async def get_referentiels():
    """Retourne les listes de référence pour les dropdowns PAG."""
    return {
        "priorites": PRIORITES,
        "groupes": GROUPES,
        "annexes": ANNEXES,
        "familles": FAMILLES,
    }


@router.get("/", response_model=List[dict])
async def list_actions(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    attribution: Optional[str] = Query(default=None),
    priorite: Optional[str] = Query(default=None),
    groupe: Optional[str] = Query(default=None),
    annexe: Optional[str] = Query(default=None),
    cloture: Optional[bool] = Query(default=None),
    responsable_pag: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, le=500),
):
    query = select(ActionPAG)
    if attribution:
        query = query.where(ActionPAG.attribution == attribution)
    if priorite:
        query = query.where(ActionPAG.priorite == priorite)
    if groupe:
        query = query.where(ActionPAG.groupe == groupe)
    if annexe:
        query = query.where(ActionPAG.annexe == annexe)
    if cloture is not None:
        query = query.where(ActionPAG.cloture == cloture)
    if responsable_pag:
        query = query.where(ActionPAG.responsable_pag == responsable_pag)

    query = query.order_by(ActionPAG.priorite, ActionPAG.id).offset(skip).limit(limit)
    result = await session.execute(query)
    actions = result.scalars().all()
    return [_action_dict(a) for a in actions]


@router.get("/{action_id}", response_model=dict)
async def get_action(
    action_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    action = await session.get(ActionPAG, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action PAG introuvable")
    return _action_dict(action)


@router.post("/", response_model=dict, status_code=201)
async def create_action(
    data: ActionPAGCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as date_type
    date_fin = None
    if data.date_fin_prevue:
        try:
            date_fin = date_type.fromisoformat(data.date_fin_prevue)
        except ValueError:
            raise HTTPException(status_code=422, detail="date_fin_prevue invalide (format YYYY-MM-DD)")

    action = ActionPAG(
        num_pag=data.num_pag,
        tache=data.tache,
        attribution=data.attribution,
        avancement_notes=data.avancement_notes,
        avancement_pct=data.avancement_pct,
        priorite=data.priorite,
        date_fin_prevue=date_fin,
        cloture=data.cloture,
        verification_efficacite=data.verification_efficacite,
        groupe=data.groupe,
        annexe=data.annexe,
        famille=data.famille,
        responsable_pag=data.responsable_pag,
        created_by_id=current_user.id,
    )
    session.add(action)
    await session.commit()
    await session.refresh(action)
    return _action_dict(action)


@router.patch("/{action_id}", response_model=dict)
async def update_action(
    action_id: int,
    data: ActionPAGUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as date_type
    action = await session.get(ActionPAG, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action PAG introuvable")

    for field, value in data.model_dump(exclude_none=True).items():
        if field == "date_fin_prevue" and value:
            try:
                value = date_type.fromisoformat(value)
            except ValueError:
                raise HTTPException(status_code=422, detail="date_fin_prevue invalide")
        setattr(action, field, value)

    action.updated_at = datetime.utcnow()
    session.add(action)
    await session.commit()
    await session.refresh(action)
    return _action_dict(action)


@router.delete("/{action_id}", status_code=204)
async def delete_action(
    action_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    action = await session.get(ActionPAG, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action PAG introuvable")
    await session.delete(action)
    await session.commit()
