"""
Workflow service - business logic for document and NC status transitions.
All transitions create an AuditLog entry.
"""
from datetime import datetime, date
from typing import Optional
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select

from database.models import (
    DocumentQualite, DocumentStatus,
    NonConformite, NCStatus,
    Equipement, EquipmentStatus,
    MesureKPI, IndicateurQualite,
    User,
)
from services.audit_service import log as audit_log


DOCUMENT_TRANSITIONS = {
    DocumentStatus.BROUILLON: [DocumentStatus.RELECTURE],
    DocumentStatus.RELECTURE: [DocumentStatus.APPROBATION, DocumentStatus.BROUILLON],
    DocumentStatus.APPROBATION: [DocumentStatus.PUBLIE, DocumentStatus.RELECTURE],
    DocumentStatus.PUBLIE: [DocumentStatus.DIFFUSION, DocumentStatus.ARCHIVE],
    DocumentStatus.DIFFUSION: [DocumentStatus.ARCHIVE],
    DocumentStatus.ARCHIVE: [],
}

NC_TRANSITIONS = {
    NCStatus.OUVERTE: [NCStatus.EN_ANALYSE],
    NCStatus.EN_ANALYSE: [NCStatus.CAPA_EN_COURS, NCStatus.CLOTUREE],
    NCStatus.CAPA_EN_COURS: [NCStatus.VERIFICATION],
    NCStatus.VERIFICATION: [NCStatus.CLOTUREE, NCStatus.CAPA_EN_COURS],
    NCStatus.CLOTUREE: [],
}


async def advance_document_status(
    doc: DocumentQualite,
    new_status: DocumentStatus,
    user: User,
    session: AsyncSession,
    commentaire: Optional[str] = None,
) -> DocumentQualite:
    """
    Advance document through its workflow. Raises ValueError if transition is not allowed.
    """
    allowed = DOCUMENT_TRANSITIONS.get(doc.statut, [])
    if new_status not in allowed:
        raise ValueError(
            f"Transition document {doc.statut.value} -> {new_status.value} non autorisée"
        )
    old_status = doc.statut
    doc.statut = new_status
    doc.updated_at = datetime.utcnow()
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    await audit_log(
        session,
        user_id=user.id,
        action="STATUS_CHANGE",
        resource_type="document",
        resource_id=str(doc.id),
        details=f"Document {doc.titre}: {old_status.value} -> {new_status.value}. {commentaire or ''}",
    )
    return doc


async def advance_nc_status(
    nc: NonConformite,
    new_status: NCStatus,
    user: User,
    session: AsyncSession,
    commentaire: Optional[str] = None,
) -> NonConformite:
    """
    Advance NC through its workflow. Raises ValueError if transition is not allowed.
    """
    allowed = NC_TRANSITIONS.get(nc.statut, [])
    if new_status not in allowed:
        raise ValueError(
            f"Transition NC {nc.statut.value} -> {new_status.value} non autorisée"
        )
    old_status = nc.statut
    nc.statut = new_status
    if new_status == NCStatus.CLOTUREE:
        nc.date_cloture = datetime.utcnow()
    nc.updated_at = datetime.utcnow()
    session.add(nc)
    await session.commit()
    await session.refresh(nc)
    await audit_log(
        session,
        user_id=user.id,
        action="STATUS_CHANGE",
        resource_type="non_conformite",
        resource_id=str(nc.id),
        details=f"NC {nc.id}: {old_status.value} -> {new_status.value}. {commentaire or ''}",
    )
    return nc


async def check_equipment_calibration(session: AsyncSession) -> list:
    """
    Check all equipment for overdue calibration.
    Automatically sets status to CALIBRATION_ECHUEE for overdue equipment.
    Returns list of affected equipment IDs.
    """
    today = date.today()
    result = await session.execute(
        select(Equipement).where(
            Equipement.prochaine_calibration <= today,
            Equipement.statut == EquipmentStatus.OPERATIONNEL,
        )
    )
    overdue = result.scalars().all()
    affected = []
    for eq in overdue:
        eq.statut = EquipmentStatus.CALIBRATION_ECHUEE
        eq.updated_at = datetime.utcnow()
        session.add(eq)
        affected.append(eq.id)
        await audit_log(
            session,
            user_id=None,
            action="AUTO_BLOCK",
            resource_type="equipement",
            resource_id=str(eq.id),
            details=f"Blocage automatique équipement {eq.nom}: calibration échue le {eq.prochaine_calibration}",
        )
    if affected:
        await session.commit()
    return affected


async def update_kpi_from_nc(session: AsyncSession) -> None:
    """
    Update KPI related to NC count after a new NC is created.
    Looks for indicators with code TNC (taux non-conformites) and updates them.
    """
    from sqlalchemy import func
    from database.models import NonConformite, NCStatus as NCS

    # Count open NCs
    count_result = await session.execute(
        select(func.count(NonConformite.id)).where(
            NonConformite.statut != NCS.CLOTUREE
        )
    )
    open_nc_count = count_result.scalar_one()

    # Look for TNC indicator
    ind_result = await session.execute(
        select(IndicateurQualite).where(IndicateurQualite.code == "TNC")
    )
    tnc = ind_result.scalar_one_or_none()
    if tnc:
        mesure = MesureKPI(
            indicateur_id=tnc.id,
            valeur=float(open_nc_count),
            periode=datetime.utcnow().strftime("%Y-%m"),
            saisie_par_id=None,
            commentaire="Mise à jour automatique depuis flux NC",
        )
        session.add(mesure)
        await session.commit()
