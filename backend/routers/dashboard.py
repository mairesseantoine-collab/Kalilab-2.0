from fastapi import APIRouter, Depends, Request
import asyncio
import json as _json
from fastapi.responses import StreamingResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select, func
from datetime import date, datetime, timedelta

from database.engine import get_session
from database.models import (
    User, NonConformite, NCStatus, Action, Audit,
    Equipement, EquipmentStatus, DocumentQualite, DocumentStatus,
    Lot, LotStatus, Plainte, ComplaintStatus, Risque, RiskLevel,
    MesureKPI, IndicateurQualite, Message,
)
from sqlalchemy import and_
from auth.dependencies import get_current_user

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    in_30_days = today + timedelta(days=30)

    # ── NCs ouvertes ──────────────────────────────────────────────────────
    open_nc_result = await session.execute(
        select(func.count()).select_from(NonConformite).where(
            NonConformite.statut != NCStatus.CLOTUREE
        )
    )
    open_nc = open_nc_result.scalar() or 0

    # ── Actions en retard ─────────────────────────────────────────────────
    overdue_actions_result = await session.execute(
        select(func.count()).select_from(Action).where(
            Action.statut != "cloturee",
            Action.echeance < today,
        )
    )
    overdue_actions = overdue_actions_result.scalar() or 0

    # ── Actions ouvertes (toutes) ─────────────────────────────────────────
    open_actions_result = await session.execute(
        select(func.count()).select_from(Action).where(
            Action.statut.in_(["ouverte", "en_cours"])
        )
    )
    open_actions = open_actions_result.scalar() or 0

    # ── Audits actifs ─────────────────────────────────────────────────────
    active_audits_result = await session.execute(
        select(func.count()).select_from(Audit).where(
            Audit.statut.in_(["planifie", "en_cours"])
        )
    )
    active_audits = active_audits_result.scalar() or 0

    # ── Équipements calibration en retard ─────────────────────────────────
    overdue_cal_result = await session.execute(
        select(func.count()).select_from(Equipement).where(
            Equipement.prochaine_calibration < today,
            Equipement.statut != EquipmentStatus.HORS_SERVICE,
        )
    )
    overdue_calibrations = overdue_cal_result.scalar() or 0

    # ── Équipements calibration dans 30j ──────────────────────────────────
    upcoming_cal_result = await session.execute(
        select(func.count()).select_from(Equipement).where(
            Equipement.prochaine_calibration >= today,
            Equipement.prochaine_calibration <= in_30_days,
            Equipement.statut != EquipmentStatus.HORS_SERVICE,
        )
    )
    upcoming_calibrations = upcoming_cal_result.scalar() or 0

    # ── Documents en attente de validation ────────────────────────────────
    pending_docs_result = await session.execute(
        select(func.count()).select_from(DocumentQualite).where(
            DocumentQualite.statut.in_([
                DocumentStatus.RELECTURE,
                DocumentStatus.APPROBATION,
            ])
        )
    )
    pending_docs = pending_docs_result.scalar() or 0

    # ── Plaintes ouvertes ─────────────────────────────────────────────────
    open_complaints_result = await session.execute(
        select(func.count()).select_from(Plainte).where(
            Plainte.statut != ComplaintStatus.CLOTUREE
        )
    )
    open_complaints = open_complaints_result.scalar() or 0

    # ── Lots expirant dans 30j ────────────────────────────────────────────
    expiring_lots_result = await session.execute(
        select(func.count()).select_from(Lot).where(
            Lot.dlu >= today,
            Lot.dlu <= in_30_days,
            Lot.statut == LotStatus.ACCEPTE,
        )
    )
    expiring_lots = expiring_lots_result.scalar() or 0

    # ── Risques critiques ouverts ─────────────────────────────────────────
    critical_risks_result = await session.execute(
        select(func.count()).select_from(Risque).where(
            Risque.criticite == RiskLevel.CRITIQUE,
            Risque.statut == "ouvert",
        )
    )
    critical_risks = critical_risks_result.scalar() or 0

    # ── NCs par statut ────────────────────────────────────────────────────
    nc_by_status_result = await session.execute(
        select(NonConformite.statut, func.count()).group_by(NonConformite.statut)
    )
    nc_by_status = [
        {"statut": row[0].value if hasattr(row[0], 'value') else row[0], "count": row[1]}
        for row in nc_by_status_result.fetchall()
    ]

    # ── NCs par type ──────────────────────────────────────────────────────
    nc_by_type_result = await session.execute(
        select(NonConformite.type_nc, func.count()).group_by(NonConformite.type_nc)
    )
    nc_by_type = [
        {"type": row[0], "count": row[1]}
        for row in nc_by_type_result.fetchall()
    ]

    # ── NCs des 6 derniers mois (compatible SQLite + PostgreSQL) ─────────────
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    nc_trend_result = await session.execute(
        select(NonConformite.created_at)
        .where(NonConformite.created_at >= six_months_ago)
        .order_by(NonConformite.created_at)
    )
    nc_dates = nc_trend_result.scalars().all()
    nc_month_counts: dict = {}
    for d in nc_dates:
        key = d.strftime('%Y-%m') if hasattr(d, 'strftime') else str(d)[:7]
        nc_month_counts[key] = nc_month_counts.get(key, 0) + 1
    nc_by_month = [{"month": k, "count": v} for k, v in sorted(nc_month_counts.items())]

    # ── Actions en cours (liste) ──────────────────────────────────────────
    ongoing_actions_result = await session.execute(
        select(Action)
        .where(Action.statut.in_(["ouverte", "en_cours"]))
        .order_by(Action.echeance)
        .limit(5)
    )
    ongoing_actions = [
        {
            "id": a.id,
            "type_action": a.type_action,
            "description": a.description[:80] + "..." if len(a.description) > 80 else a.description,
            "echeance": a.echeance,
            "statut": a.statut,
            "responsable_id": a.responsable_id,
            "en_retard": a.echeance < today,
        }
        for a in ongoing_actions_result.scalars().all()
    ]

    # ── Équipements en retard de calibration (liste) ──────────────────────
    overdue_equip_result = await session.execute(
        select(Equipement)
        .where(
            Equipement.prochaine_calibration < today,
            Equipement.statut != EquipmentStatus.HORS_SERVICE,
        )
        .order_by(Equipement.prochaine_calibration)
        .limit(5)
    )
    overdue_equipment_list = [
        {
            "id": e.id,
            "nom": e.nom,
            "numero_inventaire": e.numero_inventaire,
            "prochaine_calibration": e.prochaine_calibration,
            "statut": e.statut.value,
            "jours_retard": (today - e.prochaine_calibration).days,
        }
        for e in overdue_equip_result.scalars().all()
    ]

    # ── Documents à réviser (liste) ───────────────────────────────────────
    docs_to_review_result = await session.execute(
        select(DocumentQualite)
        .where(
            DocumentQualite.statut.in_([
                DocumentStatus.RELECTURE,
                DocumentStatus.APPROBATION,
            ])
        )
        .order_by(DocumentQualite.updated_at.desc())
        .limit(5)
    )
    docs_to_review = [
        {
            "id": d.id,
            "titre": d.titre,
            "statut": d.statut.value,
            "version": d.version,
            "auteur_id": d.auteur_id,
            "updated_at": d.updated_at,
        }
        for d in docs_to_review_result.scalars().all()
    ]

    # ── NC par responsable ────────────────────────────────────────────────────
    nc_resp_result = await session.execute(
        select(User.prenom, User.nom, func.count(NonConformite.id).label("count"))
        .join(NonConformite, NonConformite.responsable_id == User.id)
        .where(NonConformite.statut != NCStatus.CLOTUREE)
        .group_by(User.id, User.prenom, User.nom)
        .order_by(func.count(NonConformite.id).desc())
        .limit(8)
    )
    nc_by_responsible = [
        {"name": f"{row[0]} {row[1]}", "count": row[2]}
        for row in nc_resp_result.fetchall()
    ]

    # ── Documents expirant dans 30 jours ──────────────────────────────────────
    docs_expiring_result = await session.execute(
        select(DocumentQualite)
        .where(
            DocumentQualite.date_validite >= today,
            DocumentQualite.date_validite <= in_30_days,
            DocumentQualite.statut == DocumentStatus.APPROUVE,
        )
        .order_by(DocumentQualite.date_validite)
        .limit(8)
    )
    docs_expiring_soon = [
        {
            "id": d.id,
            "titre": d.titre,
            "date_validite": d.date_validite,
            "jours_restants": (d.date_validite - today).days,
        }
        for d in docs_expiring_result.scalars().all()
    ]

    # ── Messages non lus ─────────────────────────────────────────────────────
    unread_msgs_result = await session.execute(
        select(func.count()).select_from(Message).where(
            and_(
                Message.destinataire_id == current_user.id,
                Message.lu == False,  # noqa: E712
                Message.supprime_destinataire == False,  # noqa: E712
            )
        )
    )
    unread_messages_count = unread_msgs_result.scalar() or 0

    return {
        # Compteurs principaux (utilisés dans le badge notifications)
        "open_nc": open_nc,
        "open_nc_count": open_nc,           # alias pour AppLayout
        "overdue_calibrations": overdue_calibrations,
        "overdue_equipment": overdue_calibrations,  # alias
        "upcoming_calibrations": upcoming_calibrations,
        "pending_docs": pending_docs,
        "active_audits": active_audits,
        "expiring_lots": expiring_lots,
        "open_complaints": open_complaints,
        "critical_risks": critical_risks,
        "overdue_actions": overdue_actions,
        "open_actions": open_actions,
        # Tendances
        "nc_by_month": nc_by_month,
        "nc_by_type": nc_by_type,
        "nc_by_status": nc_by_status,
        # Messagerie
        "unread_messages_count": unread_messages_count,
        # Listes d'alertes
        "ongoing_actions": ongoing_actions,
        "overdue_equipment_list": overdue_equipment_list,
        "docs_to_review": docs_to_review,
        # Nouveaux indicateurs
        "nc_by_responsible": nc_by_responsible,
        "docs_expiring_soon": docs_expiring_soon,
    }


@router.get("/stats/n1")
async def get_dashboard_stats_n1(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Retourne les mêmes KPI compteurs pour N-1 (même jour l'an dernier)."""
    from datetime import date, timedelta
    today = date.today()
    today_n1 = today.replace(year=today.year - 1)
    in_30_n1 = today_n1 + timedelta(days=30)

    open_nc_n1 = (await session.execute(
        select(func.count()).select_from(NonConformite).where(
            NonConformite.statut != NCStatus.CLOTUREE,
            NonConformite.created_at <= datetime.combine(today_n1, datetime.min.time()),
        )
    )).scalar() or 0

    overdue_cal_n1 = (await session.execute(
        select(func.count()).select_from(Equipement).where(
            Equipement.prochaine_calibration < today_n1,
            Equipement.statut != EquipmentStatus.HORS_SERVICE,
        )
    )).scalar() or 0

    pending_docs_n1 = (await session.execute(
        select(func.count()).select_from(DocumentQualite).where(
            DocumentQualite.statut.in_([
                DocumentStatus.RELECTURE, DocumentStatus.APPROBATION
            ]),
            DocumentQualite.created_at <= datetime.combine(today_n1, datetime.min.time()),
        )
    )).scalar() or 0

    open_complaints_n1 = (await session.execute(
        select(func.count()).select_from(Plainte).where(
            Plainte.statut.in_([ComplaintStatus.OUVERTE, ComplaintStatus.EN_COURS]),
            Plainte.created_at <= datetime.combine(today_n1, datetime.min.time()),
        )
    )).scalar() or 0

    return {
        "open_nc": open_nc_n1,
        "overdue_calibrations": overdue_cal_n1,
        "pending_docs": pending_docs_n1,
        "open_complaints": open_complaints_n1,
    }


@router.get("/stream")
async def alerts_stream(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """SSE endpoint — envoie les alertes actives toutes les 30 secondes."""
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            try:
                today = date.today()
                in_30 = today + timedelta(days=30)

                open_nc = (await session.execute(
                    select(func.count()).select_from(NonConformite).where(
                        NonConformite.statut != NCStatus.CLOTUREE
                    )
                )).scalar() or 0

                overdue_cal = (await session.execute(
                    select(func.count()).select_from(Equipement).where(
                        Equipement.prochaine_calibration < today,
                        Equipement.statut != EquipmentStatus.HORS_SERVICE,
                    )
                )).scalar() or 0

                upcoming_cal = (await session.execute(
                    select(func.count()).select_from(Equipement).where(
                        Equipement.prochaine_calibration >= today,
                        Equipement.prochaine_calibration <= in_30,
                        Equipement.statut != EquipmentStatus.HORS_SERVICE,
                    )
                )).scalar() or 0

                overdue_actions = (await session.execute(
                    select(func.count()).select_from(Action).where(
                        Action.statut != "cloturee",
                        Action.echeance < today,
                    )
                )).scalar() or 0

                alerts = []
                if open_nc > 0:
                    alerts.append({"type": "nc", "severity": "error", "count": open_nc,
                                   "message": f"{open_nc} non-conformité(s) ouverte(s)"})
                if overdue_cal > 0:
                    alerts.append({"type": "calibration", "severity": "error", "count": overdue_cal,
                                   "message": f"{overdue_cal} étalonnage(s) en retard"})
                if upcoming_cal > 0:
                    alerts.append({"type": "calibration_soon", "severity": "warning", "count": upcoming_cal,
                                   "message": f"{upcoming_cal} étalonnage(s) dans 30j"})
                if overdue_actions > 0:
                    alerts.append({"type": "action", "severity": "warning", "count": overdue_actions,
                                   "message": f"{overdue_actions} action(s) en retard"})

                payload = _json.dumps({"alerts": alerts, "ts": datetime.utcnow().isoformat()})
                yield f"data: {payload}\n\n"
            except Exception:
                pass
            await asyncio.sleep(30)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/alerts")
async def get_alerts(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Alertes rapides pour le badge de notifications."""
    today = date.today()
    in_7_days = today + timedelta(days=7)
    alerts = []

    # NCs ouvertes
    r = await session.execute(
        select(func.count()).select_from(NonConformite)
        .where(NonConformite.statut != NCStatus.CLOTUREE)
    )
    n = r.scalar() or 0
    if n > 0:
        alerts.append({"type": "nc", "message": f"{n} non-conformité(s) ouverte(s)", "count": n, "severity": "warning", "link": "/nonconformities"})

    # Actions en retard
    r = await session.execute(
        select(func.count()).select_from(Action)
        .where(Action.statut != "cloturee", Action.echeance < today)
    )
    n = r.scalar() or 0
    if n > 0:
        alerts.append({"type": "action", "message": f"{n} action(s) en retard", "count": n, "severity": "error", "link": "/nonconformities"})

    # Calibrations en retard
    r = await session.execute(
        select(func.count()).select_from(Equipement)
        .where(Equipement.prochaine_calibration < today, Equipement.statut != EquipmentStatus.HORS_SERVICE)
    )
    n = r.scalar() or 0
    if n > 0:
        alerts.append({"type": "calibration", "message": f"{n} calibration(s) en retard", "count": n, "severity": "error", "link": "/equipment"})

    # Calibrations dans 7j
    r = await session.execute(
        select(func.count()).select_from(Equipement)
        .where(
            Equipement.prochaine_calibration >= today,
            Equipement.prochaine_calibration <= in_7_days,
            Equipement.statut != EquipmentStatus.HORS_SERVICE,
        )
    )
    n = r.scalar() or 0
    if n > 0:
        alerts.append({"type": "calibration_upcoming", "message": f"{n} calibration(s) dans 7 jours", "count": n, "severity": "warning", "link": "/equipment"})

    # Documents en attente
    r = await session.execute(
        select(func.count()).select_from(DocumentQualite)
        .where(DocumentQualite.statut.in_([DocumentStatus.RELECTURE, DocumentStatus.APPROBATION]))
    )
    n = r.scalar() or 0
    if n > 0:
        alerts.append({"type": "document", "message": f"{n} document(s) à valider", "count": n, "severity": "info", "link": "/documents"})

    # Plaintes ouvertes
    r = await session.execute(
        select(func.count()).select_from(Plainte)
        .where(Plainte.statut != ComplaintStatus.CLOTUREE)
    )
    n = r.scalar() or 0
    if n > 0:
        alerts.append({"type": "complaint", "message": f"{n} plainte(s) ouverte(s)", "count": n, "severity": "warning", "link": "/complaints"})

    total = sum(a["count"] for a in alerts if a["severity"] in ("error", "warning"))
    return {"total": total, "alerts": alerts}


@router.get("/my-tasks")
async def get_my_tasks(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Retourne les tâches et éléments assignés à l'utilisateur courant
    à travers tous les modules (NCs, plaintes, actions, documents).
    """
    today = date.today()
    uid = current_user.id

    # NCs dont l'utilisateur est responsable
    my_ncs_result = await session.execute(
        select(NonConformite)
        .where(
            NonConformite.responsable_id == uid,
            NonConformite.statut != NCStatus.CLOTUREE,
        )
        .order_by(NonConformite.created_at.desc())
        .limit(5)
    )
    my_ncs = [
        {
            "id": nc.id,
            "titre": nc.description[:60] + "..." if len(nc.description) > 60 else nc.description,
            "statut": nc.statut.value if hasattr(nc.statut, 'value') else nc.statut,
            "type": "nc",
            "link": f"/nonconformities/{nc.id}",
            "urgent": False,
        }
        for nc in my_ncs_result.scalars().all()
    ]

    # Plaintes dont l'utilisateur est responsable
    my_complaints_result = await session.execute(
        select(Plainte)
        .where(
            Plainte.responsable_id == uid,
            Plainte.statut != ComplaintStatus.CLOTUREE,
        )
        .order_by(Plainte.created_at.desc())
        .limit(5)
    )
    my_complaints = [
        {
            "id": p.id,
            "titre": (p.description or p.objet or "Plainte")[:60],
            "statut": p.statut.value if hasattr(p.statut, 'value') else p.statut,
            "type": "plainte",
            "link": f"/complaints/{p.id}",
            "urgent": False,
        }
        for p in my_complaints_result.scalars().all()
    ]

    # Actions dont l'utilisateur est responsable
    my_actions_result = await session.execute(
        select(Action)
        .where(
            Action.responsable_id == uid,
            Action.statut.in_(["ouverte", "en_cours"]),
        )
        .order_by(Action.echeance)
        .limit(5)
    )
    my_actions = [
        {
            "id": a.id,
            "titre": a.description[:60] + "..." if len(a.description) > 60 else a.description,
            "statut": a.statut,
            "type": "action",
            "link": "/nonconformities",
            "urgent": a.echeance is not None and a.echeance < today,
            "echeance": a.echeance.isoformat() if a.echeance else None,
        }
        for a in my_actions_result.scalars().all()
    ]

    # Documents que l'utilisateur a créés et qui nécessitent une action
    my_docs_result = await session.execute(
        select(DocumentQualite)
        .where(
            DocumentQualite.auteur_id == uid,
            DocumentQualite.statut.in_([
                DocumentStatus.RELECTURE,
                DocumentStatus.APPROBATION,
            ])
        )
        .order_by(DocumentQualite.updated_at.desc())
        .limit(5)
    )
    my_docs = [
        {
            "id": d.id,
            "titre": d.titre[:60],
            "statut": d.statut.value,
            "type": "document",
            "link": f"/documents/{d.id}",
            "urgent": False,
        }
        for d in my_docs_result.scalars().all()
    ]

    all_tasks = my_ncs + my_complaints + my_actions + my_docs
    urgent_count = sum(1 for t in all_tasks if t.get("urgent"))

    return {
        "total": len(all_tasks),
        "urgent": urgent_count,
        "tasks": all_tasks,
        "by_type": {
            "nc": len(my_ncs),
            "plainte": len(my_complaints),
            "action": len(my_actions),
            "document": len(my_docs),
        },
    }
