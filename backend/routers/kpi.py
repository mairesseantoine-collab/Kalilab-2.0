from fastapi import APIRouter, Depends, HTTPException, Request, status, Query, UploadFile, File
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, UserRole, IndicateurQualite, MesureKPI
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip
from services.storage_service import upload_file as storage_upload

router = APIRouter()


class IndicateurCreate(BaseModel):
    nom: str
    code: str
    periodicite: str
    formule: Optional[str] = None
    cible: Optional[float] = None
    unite: Optional[str] = None
    processus_id: Optional[int] = None
    biologiste_id: Optional[int] = None


class MesureCreate(BaseModel):
    indicateur_id: int
    valeur: float
    periode: str
    commentaire: Optional[str] = None


def _indicator_dict(i: IndicateurQualite, biologiste: Optional[User] = None) -> dict:
    return {
        "id": i.id,
        "nom": i.nom,
        "code": i.code,
        "periodicite": i.periodicite,
        "formule": i.formule,
        "cible": i.cible,
        "unite": i.unite,
        "processus_id": i.processus_id,
        "biologiste_id": i.biologiste_id,
        "biologiste": {"id": biologiste.id, "prenom": biologiste.prenom, "nom": biologiste.nom} if biologiste else None,
        "fichier_excel": i.fichier_excel,
        "created_at": i.created_at,
    }


@router.get("/indicators")
async def list_indicators(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(select(IndicateurQualite).order_by(IndicateurQualite.code))
    indicators = result.scalars().all()
    # Load biologists in one pass
    bio_ids = list({i.biologiste_id for i in indicators if i.biologiste_id})
    bios: dict = {}
    if bio_ids:
        bio_result = await session.execute(select(User).where(User.id.in_(bio_ids)))
        for u in bio_result.scalars().all():
            bios[u.id] = u
    return [_indicator_dict(i, bios.get(i.biologiste_id) if i.biologiste_id else None) for i in indicators]


@router.get("/indicators/{indicator_id}")
async def get_indicator(
    indicator_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    ind = await session.get(IndicateurQualite, indicator_id)
    if not ind:
        raise HTTPException(status_code=404, detail="Indicateur introuvable")
    biologiste = await session.get(User, ind.biologiste_id) if ind.biologiste_id else None
    return _indicator_dict(ind, biologiste)


@router.put("/indicators/{indicator_id}")
async def update_indicator(
    request: Request,
    indicator_id: int,
    data: IndicateurCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    ind = await session.get(IndicateurQualite, indicator_id)
    if not ind:
        raise HTTPException(status_code=404, detail="Indicateur introuvable")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(ind, key, value)
    session.add(ind)
    await session.commit()
    await session.refresh(ind)
    await log_action(
        session, user_id=current_user.id, action="UPDATE",
        resource_type="indicateur", resource_id=str(ind.id),
        details=f"Mise à jour indicateur {ind.code}", ip_address=get_client_ip(request),
    )
    biologiste = await session.get(User, ind.biologiste_id) if ind.biologiste_id else None
    return _indicator_dict(ind, biologiste)


@router.post("/indicators/{indicator_id}/upload-excel", status_code=status.HTTP_200_OK)
async def upload_excel(
    request: Request,
    indicator_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Attacher un fichier Excel à un indicateur pour l'analyse des données."""
    ind = await session.get(IndicateurQualite, indicator_id)
    if not ind:
        raise HTTPException(status_code=404, detail="Indicateur introuvable")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 20 Mo)")

    safe_filename = file.filename or "analyse.xlsx"
    content_type = file.content_type or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    storage_path = f"kpi/{indicator_id}/{safe_filename}"

    try:
        await storage_upload(file_bytes, storage_path, content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur stockage: {str(e)}")

    ind.fichier_excel = storage_path
    session.add(ind)
    await session.commit()
    await session.refresh(ind)
    await log_action(
        session, user_id=current_user.id, action="UPLOAD_EXCEL",
        resource_type="indicateur", resource_id=str(ind.id),
        details=f"Excel attaché: {safe_filename} — {ind.code}",
        ip_address=get_client_ip(request),
    )
    return {"fichier_excel": storage_path, "nom_fichier": safe_filename}


@router.get("/mesures")
async def list_mesures_alias(
    indicateur_id: Optional[int] = None,
    periode: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Alias de GET / pour compatibilité frontend."""
    return await list_kpi_mesures(indicateur_id, periode, skip, limit, session, current_user)


@router.post("/indicators", status_code=status.HTTP_201_CREATED)
async def create_indicator(
    request: Request,
    data: IndicateurCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    existing = await session.execute(
        select(IndicateurQualite).where(IndicateurQualite.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Code indicateur {data.code} déjà existant")
    indicator = IndicateurQualite(
        nom=data.nom,
        code=data.code,
        periodicite=data.periodicite,
        formule=data.formule,
        cible=data.cible,
        unite=data.unite,
        processus_id=data.processus_id,
        biologiste_id=data.biologiste_id,
    )
    session.add(indicator)
    await session.commit()
    await session.refresh(indicator)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="indicateur",
        resource_id=str(indicator.id),
        details=f"Création indicateur {indicator.code}",
        ip_address=get_client_ip(request),
    )
    return {"id": indicator.id, "code": indicator.code}


@router.get("/")
async def list_kpi_mesures(
    indicateur_id: Optional[int] = None,
    periode: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(MesureKPI).order_by(MesureKPI.date_mesure.desc())
    if indicateur_id:
        query = query.where(MesureKPI.indicateur_id == indicateur_id)
    if periode:
        query = query.where(MesureKPI.periode == periode)
    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0
    result = await session.execute(query.offset(skip).limit(limit))
    mesures = result.scalars().all()
    return {
        "total": total, "skip": skip, "limit": limit,
        "items": [
            {
                "id": m.id,
                "indicateur_id": m.indicateur_id,
                "valeur": m.valeur,
                "periode": m.periode,
                "date_mesure": m.date_mesure,
                "saisie_par_id": m.saisie_par_id,
                "commentaire": m.commentaire,
            }
            for m in mesures
        ],
    }


@router.post("/mesures", status_code=status.HTTP_201_CREATED)
async def create_mesure(
    request: Request,
    data: MesureCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    indicator = await session.get(IndicateurQualite, data.indicateur_id)
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicateur introuvable")
    mesure = MesureKPI(
        indicateur_id=data.indicateur_id,
        valeur=data.valeur,
        periode=data.periode,
        saisie_par_id=current_user.id,
        commentaire=data.commentaire,
    )
    session.add(mesure)
    await session.commit()
    await session.refresh(mesure)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="mesure_kpi",
        resource_id=str(mesure.id),
        details=f"Saisie KPI {indicator.code}={data.valeur} pour {data.periode}",
        ip_address=get_client_ip(request),
    )
    return {"id": mesure.id, "indicateur_code": indicator.code, "valeur": mesure.valeur}


@router.get("/dashboard")
async def kpi_dashboard(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    indicators_result = await session.execute(select(IndicateurQualite))
    indicators = indicators_result.scalars().all()
    dashboard = []
    for ind in indicators:
        mesures_result = await session.execute(
            select(MesureKPI)
            .where(MesureKPI.indicateur_id == ind.id)
            .order_by(MesureKPI.date_mesure.desc())
            .limit(6)
        )
        mesures = mesures_result.scalars().all()
        last_value = mesures[0].valeur if mesures else None
        trend = None
        if len(mesures) >= 2:
            diff = mesures[0].valeur - mesures[1].valeur
            trend = "hausse" if diff > 0 else "baisse" if diff < 0 else "stable"
        status_kpi = "ok"
        if ind.cible is not None and last_value is not None:
            status_kpi = "ok" if last_value >= ind.cible else "nok"
        dashboard.append({
            "indicateur_id": ind.id,
            "code": ind.code,
            "nom": ind.nom,
            "cible": ind.cible,
            "unite": ind.unite,
            "last_value": last_value,
            "trend": trend,
            "status": status_kpi,
            "history": [{"periode": m.periode, "valeur": m.valeur} for m in reversed(mesures)],
        })
    return {"dashboard": dashboard, "generated_at": datetime.utcnow()}
