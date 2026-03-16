from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    yield


app = FastAPI(
    title="KaliLab API",
    description="SMQ ISO 15189 - Système de Management de la Qualité pour Laboratoires",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
