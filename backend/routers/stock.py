import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select
from datetime import datetime, date, timedelta
from typing import Optional, List
from pydantic import BaseModel

from database.engine import get_session
from database.models import User, UserRole, Article, Lot, LotStatus, Fournisseur, Commande
from auth.dependencies import get_current_user, require_role, log_action, get_client_ip

router = APIRouter()


class ArticleCreate(BaseModel):
    reference: str
    gs1_code: Optional[str] = None
    designation: str
    categorie: str
    unite: str
    seuil_alerte: float = 0
    fournisseur_id: Optional[int] = None


class LotReception(BaseModel):
    article_id: int
    numero_lot: str
    dlu: Optional[date] = None
    quantite_recue: float
    commande_id: Optional[int] = None
    notes: Optional[str] = None


class LotAccept(BaseModel):
    essai_acceptation: Optional[dict] = None
    notes: Optional[str] = None


class LotReject(BaseModel):
    motif: str
    nc_create: bool = True


class FournisseurCreate(BaseModel):
    nom: str
    code: str
    contact: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None


class CommandeCreate(BaseModel):
    fournisseur_id: int
    numero_commande: str
    lignes: List[dict]
    date_livraison_prevue: Optional[date] = None
    notes: Optional[str] = None


@router.get("/articles")
async def list_articles(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(select(Article).order_by(Article.designation))
    articles = result.scalars().all()
    return [
        {
            "id": a.id,
            "reference": a.reference,
            "gs1_code": a.gs1_code,
            "designation": a.designation,
            "categorie": a.categorie,
            "unite": a.unite,
            "seuil_alerte": a.seuil_alerte,
            "stock_actuel": a.stock_actuel,
            "alerte": a.stock_actuel <= a.seuil_alerte,
            "fournisseur_id": a.fournisseur_id,
        }
        for a in articles
    ]


@router.post("/articles", status_code=status.HTTP_201_CREATED)
async def create_article(
    request: Request,
    data: ArticleCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.RESP_TECHNIQUE, UserRole.QUALITICIEN)),
):
    existing = await session.execute(
        select(Article).where(Article.reference == data.reference)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Référence article déjà existante")
    article = Article(**data.dict())
    session.add(article)
    await session.commit()
    await session.refresh(article)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="article",
        resource_id=str(article.id),
        details=f"Création article {article.reference} - {article.designation}",
        ip_address=get_client_ip(request),
    )
    return {"id": article.id, "reference": article.reference}


@router.get("/lots")
async def list_lots(
    statut: Optional[LotStatus] = None,
    article_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Lot).order_by(Lot.date_reception.desc())
    if statut:
        query = query.where(Lot.statut == statut)
    if article_id:
        query = query.where(Lot.article_id == article_id)
    result = await session.execute(query)
    lots = result.scalars().all()
    return [
        {
            "id": l.id,
            "article_id": l.article_id,
            "numero_lot": l.numero_lot,
            "dlu": l.dlu,
            "quantite_recue": l.quantite_recue,
            "quantite_restante": l.quantite_restante,
            "statut": l.statut.value,
            "conformite": l.conformite,
            "date_reception": l.date_reception,
        }
        for l in lots
    ]


@router.post("/receipts", status_code=status.HTTP_201_CREATED)
async def receive_lot(
    request: Request,
    data: LotReception,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    article = await session.get(Article, data.article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article introuvable")
    lot = Lot(
        article_id=data.article_id,
        numero_lot=data.numero_lot,
        dlu=data.dlu,
        quantite_recue=data.quantite_recue,
        quantite_restante=data.quantite_recue,
        statut=LotStatus.QUARANTAINE,
        reception_par_id=current_user.id,
        commande_id=data.commande_id,
        notes=data.notes,
    )
    session.add(lot)
    await session.commit()
    await session.refresh(lot)
    await log_action(
        session,
        user_id=current_user.id,
        action="RECEIVE",
        resource_type="lot",
        resource_id=str(lot.id),
        details=f"Réception lot {lot.numero_lot} article {article.reference} qté={data.quantite_recue}",
        ip_address=get_client_ip(request),
    )
    return {"id": lot.id, "numero_lot": lot.numero_lot, "statut": lot.statut.value}


@router.put("/lots/{lot_id}/accept")
async def accept_lot(
    request: Request,
    lot_id: int,
    data: LotAccept,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    lot = await session.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot introuvable")
    lot.statut = LotStatus.ACCEPTE
    lot.conformite = True
    if data.essai_acceptation:
        lot.essai_acceptation = json.dumps(data.essai_acceptation)
    if data.notes:
        lot.notes = data.notes
    # Update stock
    article = await session.get(Article, lot.article_id)
    if article:
        article.stock_actuel += lot.quantite_recue
        session.add(article)
    session.add(lot)
    await session.commit()
    await log_action(
        session,
        user_id=current_user.id,
        action="ACCEPT_LOT",
        resource_type="lot",
        resource_id=str(lot.id),
        details=f"Acceptation lot {lot.numero_lot}",
        ip_address=get_client_ip(request),
    )
    return {"id": lot.id, "statut": lot.statut.value}


@router.put("/lots/{lot_id}/reject")
async def reject_lot(
    request: Request,
    lot_id: int,
    data: LotReject,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    lot = await session.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot introuvable")
    lot.statut = LotStatus.REFUSE
    lot.conformite = False
    lot.notes = (lot.notes or "") + f"\nRefus: {data.motif}"
    session.add(lot)
    await session.commit()
    await log_action(
        session,
        user_id=current_user.id,
        action="REJECT_LOT",
        resource_type="lot",
        resource_id=str(lot.id),
        details=f"Refus lot {lot.numero_lot}: {data.motif}",
        ip_address=get_client_ip(request),
    )
    return {"id": lot.id, "statut": lot.statut.value}


@router.get("/lots/expiring")
async def expiring_lots(
    days: int = 30,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    cutoff = date.today() + timedelta(days=days)
    result = await session.execute(
        select(Lot).where(
            Lot.dlu <= cutoff,
            Lot.statut == LotStatus.ACCEPTE,
        ).order_by(Lot.dlu)
    )
    lots = result.scalars().all()
    return [
        {
            "id": l.id,
            "article_id": l.article_id,
            "numero_lot": l.numero_lot,
            "dlu": l.dlu,
            "quantite_restante": l.quantite_restante,
            "jours_restants": (l.dlu - date.today()).days if l.dlu else None,
        }
        for l in lots
    ]


@router.get("/lots/{lot_id}")
async def get_lot(
    lot_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    lot = await session.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot introuvable")
    article, receptionnaire = await asyncio.gather(
        session.get(Article, lot.article_id),
        session.get(User, lot.reception_par_id),
    )
    return {
        "id": lot.id,
        "article_id": lot.article_id,
        "article_designation": article.designation if article else None,
        "article_reference": article.reference if article else None,
        "numero_lot": lot.numero_lot,
        "dlu": lot.dlu,
        "quantite_recue": lot.quantite_recue,
        "quantite_restante": lot.quantite_restante,
        "statut": lot.statut.value,
        "conformite": lot.conformite,
        "certificat_path": lot.certificat_path,
        "essai_acceptation": lot.essai_acceptation,
        "date_reception": lot.date_reception,
        "reception_par": f"{receptionnaire.prenom} {receptionnaire.nom}" if receptionnaire else None,
        "commande_id": lot.commande_id,
        "notes": lot.notes,
    }


@router.get("/articles/{article_id}")
async def get_article(
    article_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article introuvable")
    result = await session.execute(
        select(Lot).where(Lot.article_id == article_id).order_by(Lot.date_reception.desc())
    )
    lots = result.scalars().all()
    return {
        "id": article.id,
        "reference": article.reference,
        "gs1_code": article.gs1_code,
        "designation": article.designation,
        "categorie": article.categorie,
        "unite": article.unite,
        "seuil_alerte": article.seuil_alerte,
        "stock_actuel": article.stock_actuel,
        "fournisseur_id": article.fournisseur_id,
        "created_at": article.created_at,
        "lots": [
            {
                "id": l.id,
                "numero_lot": l.numero_lot,
                "statut": l.statut.value,
                "quantite_restante": l.quantite_restante,
                "dlu": l.dlu,
                "date_reception": l.date_reception,
            }
            for l in lots
        ],
    }


@router.get("/fournisseurs")
async def list_fournisseurs(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(select(Fournisseur).order_by(Fournisseur.nom))
    fournisseurs = result.scalars().all()
    return [
        {
            "id": f.id,
            "nom": f.nom,
            "code": f.code,
            "contact": f.contact,
            "email": f.email,
            "statut_qualification": f.statut_qualification,
            "derniere_evaluation": f.derniere_evaluation,
        }
        for f in fournisseurs
    ]


@router.post("/fournisseurs", status_code=status.HTTP_201_CREATED)
async def create_fournisseur(
    request: Request,
    data: FournisseurCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.QUALITICIEN)),
):
    existing = await session.execute(
        select(Fournisseur).where(Fournisseur.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Code fournisseur déjà utilisé")
    fournisseur = Fournisseur(**data.dict())
    session.add(fournisseur)
    await session.commit()
    await session.refresh(fournisseur)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="fournisseur",
        resource_id=str(fournisseur.id),
        details=f"Création fournisseur {fournisseur.nom} ({fournisseur.code})",
        ip_address=get_client_ip(request),
    )
    return {"id": fournisseur.id, "code": fournisseur.code}


@router.get("/commandes")
async def list_commandes(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(select(Commande).order_by(Commande.created_at.desc()))
    commandes = result.scalars().all()
    return [
        {
            "id": c.id,
            "numero_commande": c.numero_commande,
            "fournisseur_id": c.fournisseur_id,
            "statut": c.statut,
            "date_commande": c.date_commande,
            "date_livraison_prevue": c.date_livraison_prevue,
            "created_at": c.created_at,
        }
        for c in commandes
    ]


@router.post("/commandes", status_code=status.HTTP_201_CREATED)
async def create_commande(
    request: Request,
    data: CommandeCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    existing = await session.execute(
        select(Commande).where(Commande.numero_commande == data.numero_commande)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Numéro de commande déjà existant")
    commande = Commande(
        numero_commande=data.numero_commande,
        fournisseur_id=data.fournisseur_id,
        lignes=json.dumps(data.lignes),
        date_livraison_prevue=data.date_livraison_prevue,
        notes=data.notes,
        created_by_id=current_user.id,
    )
    session.add(commande)
    await session.commit()
    await session.refresh(commande)
    await log_action(
        session,
        user_id=current_user.id,
        action="CREATE",
        resource_type="commande",
        resource_id=str(commande.id),
        details=f"Création commande {commande.numero_commande}",
        ip_address=get_client_ip(request),
    )
    return {"id": commande.id, "numero_commande": commande.numero_commande, "statut": commande.statut}
