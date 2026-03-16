"""
Audit service - WORM (Write Once Read Many) semantic.
AuditLog records can only be created, never updated or deleted.
"""
from datetime import datetime
from typing import Optional
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select

from database.models import AuditLog


async def log(
    session: AsyncSession,
    user_id: Optional[int],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Append-only write to the audit log.
    This is the only authorized operation on AuditLog.
    UPDATE and DELETE on audit_logs are prohibited at the application level.
    """
    entry = AuditLog(
        timestamp=datetime.utcnow(),
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        details=details,
        ip_address=ip_address,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


async def get_logs(
    session: AsyncSession,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list:
    """
    Read-only access to the audit trail.
    Returns logs sorted by timestamp descending.
    """
    query = select(AuditLog).order_by(AuditLog.timestamp.desc())
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    if action is not None:
        query = query.where(AuditLog.action == action)
    if resource_type is not None:
        query = query.where(AuditLog.resource_type == resource_type)
    if resource_id is not None:
        query = query.where(AuditLog.resource_id == resource_id)
    query = query.offset(offset).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()
