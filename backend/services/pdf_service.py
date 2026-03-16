"""
PDF generation service using ReportLab.
Generates audit reports, NC reports, KPI reports, and audit trail exports.
"""
import io
import json
from datetime import datetime
from typing import Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select

from database.models import Audit, AuditLog, NonConformite, MesureKPI, IndicateurQualite, User

PAGE_WIDTH, PAGE_HEIGHT = A4

KALILAB_BLUE = colors.HexColor("#1E40AF")
KALILAB_LIGHT = colors.HexColor("#DBEAFE")
KALILAB_GRAY = colors.HexColor("#6B7280")


def _base_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        "KaliTitle",
        parent=styles["Title"],
        textColor=KALILAB_BLUE,
        fontSize=18,
        spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        "KaliH2",
        parent=styles["Heading2"],
        textColor=KALILAB_BLUE,
        fontSize=13,
        spaceBefore=10,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "KaliBody",
        parent=styles["Normal"],
        fontSize=9,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "KaliSmall",
        parent=styles["Normal"],
        fontSize=8,
        textColor=KALILAB_GRAY,
    ))
    return styles


def _header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(KALILAB_BLUE)
    canvas.drawString(2 * cm, PAGE_HEIGHT - 1.5 * cm, "KaliLab - SMQ ISO 15189")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(KALILAB_GRAY)
    canvas.drawRightString(PAGE_WIDTH - 2 * cm, PAGE_HEIGHT - 1.5 * cm,
                           f"Généré le {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC")
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(PAGE_WIDTH / 2, 1 * cm, f"Page {doc.page}")
    canvas.restoreState()


async def generate_audit_report(audit: Audit, session: AsyncSession) -> bytes:
    """Generate PDF report for an audit."""
    styles = _base_styles()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2.5*cm, bottomMargin=2*cm,
    )
    story = []

    # Header
    story.append(Paragraph("RAPPORT D'AUDIT QUALITE", styles["KaliTitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=KALILAB_BLUE))
    story.append(Spacer(1, 0.3*cm))

    # Metadata table
    auditeur_result = await session.execute(
        select(User).where(User.id == audit.auditeur_id)
    )
    auditeur = auditeur_result.scalar_one_or_none()
    auditeur_name = f"{auditeur.prenom} {auditeur.nom}" if auditeur else "Inconnu"

    meta_data = [
        ["Référence", audit.uuid],
        ["Titre", audit.titre],
        ["Type", audit.type_audit.value.upper()],
        ["Référentiel", audit.referentiel],
        ["Date planifiée", str(audit.date_planifiee)],
        ["Date réalisation", str(audit.date_realisation) if audit.date_realisation else "N/A"],
        ["Auditeur", auditeur_name],
        ["Statut", audit.statut.upper()],
    ]
    t = Table(meta_data, colWidths=[5*cm, 12*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), KALILAB_LIGHT),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5*cm))

    # Constats
    constats = json.loads(audit.constats or "[]")
    if constats:
        story.append(Paragraph("CONSTATS D'AUDIT", styles["KaliH2"]))
        constat_data = [["#", "Référence", "Description", "Gravité", "Processus"]]
        for i, c in enumerate(constats, 1):
            constat_data.append([
                str(i),
                c.get("reference", ""),
                c.get("description", "")[:80],
                c.get("gravite", ""),
                c.get("processus", "") or "",
            ])
        ct = Table(constat_data, colWidths=[0.8*cm, 2.5*cm, 8*cm, 2.5*cm, 3.2*cm])
        ct.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), KALILAB_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, KALILAB_LIGHT]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(ct)
        story.append(Spacer(1, 0.3*cm))

    # Ecarts
    ecarts = json.loads(audit.ecarts or "[]")
    if ecarts:
        story.append(Paragraph("ECARTS IDENTIFIES", styles["KaliH2"]))
        ecart_data = [["Référence", "Description", "Gravité"]]
        for e in ecarts:
            ecart_data.append([
                e.get("reference", ""),
                e.get("description", "")[:100],
                e.get("gravite", ""),
            ])
        et = Table(ecart_data, colWidths=[3*cm, 11*cm, 3*cm])
        et.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DC2626")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        story.append(et)

    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        f"Rapport généré le {datetime.utcnow().strftime('%d/%m/%Y à %H:%M')} UTC - KaliLab SMQ ISO 15189",
        styles["KaliSmall"],
    ))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buffer.getvalue()


async def generate_nc_report(nc_id: int, session: AsyncSession) -> bytes:
    """Generate PDF report for a non-conformity."""
    nc = await session.get(NonConformite, nc_id)
    if not nc:
        raise ValueError(f"NC {nc_id} introuvable")

    styles = _base_styles()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2.5*cm, bottomMargin=2*cm,
    )
    story = []

    story.append(Paragraph("RAPPORT DE NON-CONFORMITE", styles["KaliTitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=KALILAB_BLUE))
    story.append(Spacer(1, 0.3*cm))

    meta = [
        ["Référence", nc.uuid],
        ["Type", nc.type_nc],
        ["Statut", nc.statut.value.upper()],
        ["Date détection", str(nc.date_detection.date())],
        ["Déclarant", str(nc.declarant_id)],
        ["Responsable", str(nc.responsable_id) if nc.responsable_id else "N/A"],
        ["Echéance", str(nc.date_echeance) if nc.date_echeance else "N/A"],
    ]
    t = Table(meta, colWidths=[5*cm, 12*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), KALILAB_LIGHT),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3*cm))

    for label, value in [
        ("Description", nc.description),
        ("Impact", nc.impact),
        ("Traitement immédiat", nc.traitement_immediat),
        ("Analyse des causes (RCA)", nc.analyse_causes),
        ("Plan CAPA", nc.capa),
        ("Vérification efficacité", nc.verification_efficacite),
    ]:
        if value:
            story.append(Paragraph(label.upper(), styles["KaliH2"]))
            story.append(Paragraph(value, styles["KaliBody"]))
            story.append(Spacer(1, 0.2*cm))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buffer.getvalue()


async def generate_kpi_report(periode: str, session: AsyncSession) -> bytes:
    """Generate KPI dashboard PDF for a given period."""
    styles = _base_styles()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2.5*cm, bottomMargin=2*cm,
    )
    story = []

    story.append(Paragraph(f"RAPPORT KPI - PERIODE {periode}", styles["KaliTitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=KALILAB_BLUE))
    story.append(Spacer(1, 0.3*cm))

    inds_result = await session.execute(select(IndicateurQualite).order_by(IndicateurQualite.code))
    indicators = inds_result.scalars().all()

    kpi_data = [["Code", "Indicateur", "Cible", "Valeur", "Unité", "Statut"]]
    for ind in indicators:
        mesure_result = await session.execute(
            select(MesureKPI)
            .where(MesureKPI.indicateur_id == ind.id, MesureKPI.periode == periode)
            .order_by(MesureKPI.date_mesure.desc())
            .limit(1)
        )
        mesure = mesure_result.scalar_one_or_none()
        valeur = str(mesure.valeur) if mesure else "N/M"
        statut = ""
        if mesure and ind.cible is not None:
            statut = "OK" if mesure.valeur >= ind.cible else "NOK"
        kpi_data.append([
            ind.code,
            ind.nom,
            str(ind.cible) if ind.cible is not None else "-",
            valeur,
            ind.unite or "",
            statut,
        ])

    t = Table(kpi_data, colWidths=[2.5*cm, 6*cm, 2*cm, 2*cm, 2*cm, 2.5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), KALILAB_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, KALILAB_LIGHT]),
        ("ALIGN", (2, 1), (-1, -1), "CENTER"),
    ]))
    story.append(t)

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buffer.getvalue()


async def generate_audit_trail_export(filters: dict, session: AsyncSession) -> bytes:
    """Generate PDF of the audit trail."""
    styles = _base_styles()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2.5*cm, bottomMargin=2*cm,
    )
    story = []

    story.append(Paragraph("EXPORT PISTE D'AUDIT", styles["KaliTitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=KALILAB_BLUE))
    story.append(Spacer(1, 0.3*cm))

    query = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(500)
    result = await session.execute(query)
    logs = result.scalars().all()

    trail_data = [["Timestamp", "User", "Action", "Ressource", "ID"]]
    for log in logs:
        trail_data.append([
            log.timestamp.strftime("%d/%m/%Y %H:%M:%S") if log.timestamp else "",
            str(log.user_id) if log.user_id else "system",
            log.action,
            log.resource_type,
            log.resource_id or "",
        ])

    t = Table(trail_data, colWidths=[4*cm, 2*cm, 3*cm, 4*cm, 4*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), KALILAB_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, KALILAB_LIGHT]),
    ]))
    story.append(t)

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buffer.getvalue()
