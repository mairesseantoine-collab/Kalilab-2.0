import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database.engine import create_db_and_tables
from routers import (
    auth,
    users,
    documents,
    risks,
    nonconformities,
    actions,
    audits,
    kpi,
    equipment,
    hr,
    stock,
    complaints,
    redaction,
    audit_trail,
    dashboard,
    messagerie,
    services,
    pag,
)


logger = logging.getLogger("kalilab")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# ─── CORS ────────────────────────────────────────────────────────────────────
_raw = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw.split(",") if o.strip()]
# Fallback permissif seulement en développement local
if not ALLOWED_ORIGINS:
    ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
    logger.warning(
        "ALLOWED_ORIGINS non défini → CORS restreint au localhost. "
        "Définissez ALLOWED_ORIGINS en production (ex: https://kalilab.example.com)."
    )


async def auto_seed():
    """Seed la base de données si elle est vide (premier démarrage)."""
    try:
        from sqlalchemy import select
        from database.engine import async_session
        from database.models import User
        async with async_session() as session:
            result = await session.execute(select(User).limit(1))
            if result.scalar_one_or_none() is None:
                import seed as seed_module
                await seed_module.seed()
    except Exception as e:
        print(f"[WARN] Auto-seed ignoré : {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    await auto_seed()
    yield


app = FastAPI(
    title="KaliLab API",
    description="SMQ ISO 15189 - Système de Management de la Qualité pour Laboratoires",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Gestionnaire global : toute exception non capturée renvoie du JSON avec headers CORS.
    Sans ce handler, Starlette retourne du texte brut SANS headers CORS → le navigateur
    bloque la réponse et le frontend affiche "Erreur serveur." sans détail.
    """
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Erreur serveur : {type(exc).__name__}: {exc}"},
    )

app.include_router(auth.router, prefix="/auth", tags=["Authentification"])
app.include_router(users.router, prefix="/users", tags=["Utilisateurs"])
app.include_router(documents.router, prefix="/documents", tags=["Documents Qualité"])
app.include_router(risks.router, prefix="/risks", tags=["Gestion des Risques"])
app.include_router(nonconformities.router, prefix="/nonconformities", tags=["Non-Conformités"])
app.include_router(actions.router, prefix="/actions", tags=["Actions CAPA"])
app.include_router(audits.router, prefix="/audits", tags=["Audits"])
app.include_router(kpi.router, prefix="/kpi", tags=["KPI & Indicateurs"])
app.include_router(equipment.router, prefix="/equipments", tags=["Équipements"])
app.include_router(hr.router, prefix="/hr", tags=["Ressources Humaines"])
app.include_router(stock.router, prefix="/stock", tags=["Gestion des Stocks"])
app.include_router(complaints.router, prefix="/complaints", tags=["Plaintes"])
app.include_router(redaction.router, prefix="/redaction", tags=["Rédaction"])
app.include_router(audit_trail.router, prefix="/audit-trail", tags=["Piste d'Audit"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(messagerie.router, prefix="/messagerie", tags=["Messagerie"])
app.include_router(services.router, prefix="/services", tags=["Arborescence"])
app.include_router(pag.router, prefix="/pag", tags=["PAG Biologistes"])


@app.get("/", tags=["Racine"])
async def root():
    return {
        "application": "KaliLab",
        "version": "0.1.0",
        "description": "SMQ ISO 15189 - Système de Management de la Qualité pour Laboratoires",
        "status": "operational",
        "documentation": "/docs",
    }


@app.get("/health", tags=["Racine"])
async def health():
    return {"status": "ok"}
