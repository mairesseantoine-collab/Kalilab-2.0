"""Router messagerie interne KaliLab.

Endpoints:
  GET  /messagerie/inbox           — Boîte de réception (messages reçus)
  GET  /messagerie/sent            — Messages envoyés
  GET  /messagerie/unread-count    — Nombre de messages non lus (badge nav)
  GET  /messagerie/{id}            — Détail + marque comme lu
  POST /messagerie                 — Envoyer un message (+ email Outlook)
  POST /messagerie/{id}/reply      — Répondre à un message
  PUT  /messagerie/{id}/read       — Marquer comme lu manuellement
  DELETE /messagerie/{id}          — Archiver (soft-delete côté utilisateur)
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select, func, or_, and_
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, Message
from auth.dependencies import get_current_user, log_action, get_client_ip
from services.email_service import send_notification_email

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    destinataire_id: int
    sujet: str
    corps: str
    parent_id: Optional[int] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _serialize(msg: Message, expediteur: User, destinataire: User) -> dict:
    return {
        "id": msg.id,
        "sujet": msg.sujet,
        "corps": msg.corps,
        "parent_id": msg.parent_id,
        "lu": msg.lu,
        "email_envoye": msg.email_envoye,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "expediteur": {
            "id": expediteur.id,
            "nom": expediteur.nom,
            "prenom": expediteur.prenom,
            "email": expediteur.email,
            "initiales": f"{expediteur.prenom[0]}{expediteur.nom[0]}" if expediteur.prenom and expediteur.nom else "??",
        },
        "destinataire": {
            "id": destinataire.id,
            "nom": destinataire.nom,
            "prenom": destinataire.prenom,
            "email": destinataire.email,
            "initiales": f"{destinataire.prenom[0]}{destinataire.nom[0]}" if destinataire.prenom and destinataire.nom else "??",
        },
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/unread-count")
async def get_unread_count(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Nombre de messages non lus — utilisé pour le badge dans la nav."""
    result = await session.execute(
        select(func.count()).select_from(Message).where(
            and_(
                Message.destinataire_id == current_user.id,
                Message.lu == False,  # noqa: E712
                Message.supprime_destinataire == False,  # noqa: E712
            )
        )
    )
    return {"unread_count": result.scalar() or 0}


@router.get("/inbox")
async def get_inbox(
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    non_lus_seulement: bool = False,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Boîte de réception — messages reçus, du plus récent au plus ancien."""
    # Messages racines reçus (exclut les réponses dans le fil)
    where = and_(
        Message.destinataire_id == current_user.id,
        Message.supprime_destinataire == False,  # noqa: E712
    )
    if non_lus_seulement:
        where = and_(where, Message.lu == False)  # noqa: E712

    count_result = await session.execute(
        select(func.count()).select_from(Message).where(where)
    )
    total = count_result.scalar() or 0

    result = await session.execute(
        select(Message)
        .where(where)
        .order_by(Message.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    messages = result.scalars().all()

    # Charger expéditeurs en batch
    exp_ids = list({m.expediteur_id for m in messages})
    exps_result = await session.execute(select(User).where(User.id.in_(exp_ids)))
    exps = {u.id: u for u in exps_result.scalars().all()}

    dest_result = await session.execute(
        select(User).where(User.id == current_user.id)
    )
    dest_user = dest_result.scalar_one()

    items = [
        _serialize(m, exps.get(m.expediteur_id, dest_user), dest_user)
        for m in messages
    ]
    return {"total": total, "skip": skip, "limit": limit, "items": items}


@router.get("/sent")
async def get_sent(
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Messages envoyés."""
    where = and_(
        Message.expediteur_id == current_user.id,
        Message.supprime_expediteur == False,  # noqa: E712
    )
    count_result = await session.execute(
        select(func.count()).select_from(Message).where(where)
    )
    total = count_result.scalar() or 0

    result = await session.execute(
        select(Message)
        .where(where)
        .order_by(Message.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    messages = result.scalars().all()

    dest_ids = list({m.destinataire_id for m in messages})
    dests_result = await session.execute(select(User).where(User.id.in_(dest_ids)))
    dests = {u.id: u for u in dests_result.scalars().all()}

    exp_result = await session.execute(
        select(User).where(User.id == current_user.id)
    )
    exp_user = exp_result.scalar_one()

    items = [
        _serialize(m, exp_user, dests.get(m.destinataire_id, exp_user))
        for m in messages
    ]
    return {"total": total, "skip": skip, "limit": limit, "items": items}


@router.get("/{message_id}")
async def get_message(
    message_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Détail d'un message + fil de réponses.
    Marque automatiquement le message comme lu si on est le destinataire."""
    msg = await session.get(Message, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable")

    # Vérifier que l'utilisateur est expéditeur ou destinataire
    if msg.expediteur_id != current_user.id and msg.destinataire_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # Marquer comme lu automatiquement
    if msg.destinataire_id == current_user.id and not msg.lu:
        msg.lu = True
        session.add(msg)
        await session.commit()
        await session.refresh(msg)

    # Charger les participants
    exp = await session.get(User, msg.expediteur_id)
    dest = await session.get(User, msg.destinataire_id)

    data = _serialize(msg, exp, dest)

    # Charger le fil de réponses (messages avec parent_id = ce message)
    replies_result = await session.execute(
        select(Message)
        .where(Message.parent_id == message_id)
        .order_by(Message.created_at.asc())
    )
    replies = replies_result.scalars().all()

    reply_items = []
    for r in replies:
        r_exp = await session.get(User, r.expediteur_id)
        r_dest = await session.get(User, r.destinataire_id)
        reply_items.append(_serialize(r, r_exp, r_dest))

    data["replies"] = reply_items
    return data


@router.post("/", status_code=status.HTTP_201_CREATED)
async def send_message(
    request: Request,
    data: MessageCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Envoyer un message interne + déclencher notification email Outlook."""
    # Vérifier le destinataire
    destinataire = await session.get(User, data.destinataire_id)
    if not destinataire:
        raise HTTPException(status_code=404, detail="Destinataire introuvable")
    if not destinataire.is_active:
        raise HTTPException(status_code=400, detail="Ce compte n'est pas actif")
    if data.destinataire_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous envoyer un message")

    # Si c'est une réponse, vérifier que le parent existe
    if data.parent_id:
        parent = await session.get(Message, data.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Message parent introuvable")
        # Cohérence : la réponse doit impliquer les mêmes utilisateurs
        if parent.expediteur_id not in (current_user.id, data.destinataire_id) or \
           parent.destinataire_id not in (current_user.id, data.destinataire_id):
            raise HTTPException(status_code=400, detail="Réponse incohérente avec le fil de discussion")

    # Créer le message
    msg = Message(
        expediteur_id=current_user.id,
        destinataire_id=data.destinataire_id,
        sujet=data.sujet,
        corps=data.corps,
        parent_id=data.parent_id,
    )
    session.add(msg)
    await session.commit()
    await session.refresh(msg)

    # Envoyer notification email (dégradation silencieuse si SMTP non configuré)
    expediteur_nom = f"{current_user.prenom} {current_user.nom}"
    email_ok = await send_notification_email(
        to_email=destinataire.email,
        expediteur_nom=expediteur_nom,
        sujet=data.sujet,
        corps_preview=data.corps,
    )

    if email_ok:
        msg.email_envoye = True
        session.add(msg)
        await session.commit()

    # Audit log
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="message",
        resource_id=str(msg.id),
        details=f"Message envoyé à {destinataire.email} — sujet: {data.sujet[:80]}",
        ip_address=get_client_ip(request),
    )

    return {
        "id": msg.id,
        "sujet": msg.sujet,
        "created_at": msg.created_at.isoformat(),
        "email_envoye": msg.email_envoye,
        "destinataire": {
            "id": destinataire.id,
            "nom": destinataire.nom,
            "prenom": destinataire.prenom,
            "email": destinataire.email,
        },
    }


@router.post("/{message_id}/reply", status_code=status.HTTP_201_CREATED)
async def reply_to_message(
    request: Request,
    message_id: int,
    data: MessageCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Raccourci pour répondre à un message — injecte automatiquement parent_id."""
    parent = await session.get(Message, message_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Message introuvable")

    # Déterminer le destinataire de la réponse (l'autre participant)
    reply_dest_id = (
        parent.expediteur_id
        if parent.destinataire_id == current_user.id
        else parent.destinataire_id
    )

    reply_data = MessageCreate(
        destinataire_id=data.destinataire_id or reply_dest_id,
        sujet=data.sujet or f"Re: {parent.sujet}",
        corps=data.corps,
        parent_id=message_id,
    )
    return await send_message(request, reply_data, session, current_user)


@router.put("/{message_id}/read")
async def mark_as_read(
    message_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Marquer un message comme lu manuellement."""
    msg = await session.get(Message, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable")
    if msg.destinataire_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    msg.lu = True
    session.add(msg)
    await session.commit()
    return {"detail": "Marqué comme lu"}


@router.delete("/{message_id}")
async def delete_message(
    request: Request,
    message_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Suppression douce (soft-delete) — le message disparaît pour l'utilisateur courant
    mais reste visible pour l'autre participant."""
    msg = await session.get(Message, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable")

    if msg.expediteur_id == current_user.id:
        msg.supprime_expediteur = True
    elif msg.destinataire_id == current_user.id:
        msg.supprime_destinataire = True
    else:
        raise HTTPException(status_code=403, detail="Accès refusé")

    session.add(msg)
    await session.commit()
    await log_action(
        session,
        user_id=current_user.id,
        action="DELETE",
        resource_type="message",
        resource_id=str(message_id),
        details="Message archivé (soft-delete)",
        ip_address=get_client_ip(request),
    )
    return {"detail": "Message supprimé"}
