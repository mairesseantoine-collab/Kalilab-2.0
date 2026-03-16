import csv
import io
import json
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import Optional

from database.engine import get_session
from database.models import User, UserRole, AuditLog
from auth.dependencies import get_current_user, require_role

router = APIRouter()


@router.get("/")
async def get_audit_trail(
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    date_debut: Optional[datetime] = None,
    date_fin: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    """
    Lecture immuable de la piste d'audit. WORM: aucune modification ou suppression possible.
    """
    query = select(AuditLog).order_by(AuditLog.timestamp.desc())
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if date_debut:
        query = query.where(AuditLog.timestamp >= date_debut)
    if date_fin:
        query = query.where(AuditLog.timestamp <= date_fin)
    query = query.offset(offset).limit(limit)
    result = await session.execute(query)
    logs = result.scalars().all()
    return {
        "total": len(logs),
        "offset": offset,
        "limit": limit,
        "logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp,
                "user_id": log.user_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "details": log.details,
                "ip_address": log.ip_address,
            }
            for log in logs
        ],
    }


@router.get("/export")
async def export_audit_trail(
    format: str = "json",
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    date_debut: Optional[datetime] = None,
    date_fin: Optional[datetime] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    """
    Export de la piste d'audit en CSV ou JSON.
    """
    query = select(AuditLog).order_by(AuditLog.timestamp.asc())
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if date_debut:
        query = query.where(AuditLog.timestamp >= date_debut)
    if date_fin:
        query = query.where(AuditLog.timestamp <= date_fin)
    result = await session.execute(query)
    logs = result.scalars().all()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "timestamp", "user_id", "action", "resource_type", "resource_id", "details", "ip_address"])
        for log in logs:
            writer.writerow([
                log.id,
                log.timestamp.isoformat() if log.timestamp else "",
                log.user_id,
                log.action,
                log.resource_type,
                log.resource_id or "",
                log.details or "",
                log.ip_address or "",
            ])
        content = output.getvalue()
        filename = f"audit_trail_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    else:
        data = [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "user_id": log.user_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "details": log.details,
                "ip_address": log.ip_address,
            }
            for log in logs
        ]
        filename = f"audit_trail_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        return Response(
            content=json.dumps(data, ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
