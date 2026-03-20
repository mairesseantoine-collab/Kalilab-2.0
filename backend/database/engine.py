from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import event
import os
from dotenv import load_dotenv

load_dotenv()

# SQLite+aiosqlite par défaut — optimisé pour 20+ utilisateurs simultanés
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./kalilab.db",
)
# Render/Heroku fournissent postgres:// ou postgresql:// — asyncpg requiert postgresql+asyncpg://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False, "timeout": 30} if _sqlite else {}

engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    connect_args=connect_args,
    pool_pre_ping=True,
)

# ── Optimisations SQLite pour la concurrence (20+ utilisateurs) ───────────────
if _sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, connection_record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")       # lectures + écritures simultanées
        cur.execute("PRAGMA synchronous=NORMAL")     # équilibre perf / durabilité
        cur.execute("PRAGMA busy_timeout=5000")      # 5 s d'attente sur verrou
        cur.execute("PRAGMA cache_size=-65536")      # 64 Mo de cache page
        cur.execute("PRAGMA temp_store=MEMORY")      # tables temporaires en RAM
        cur.execute("PRAGMA mmap_size=134217728")    # 128 Mo mmap
        cur.execute("PRAGMA wal_autocheckpoint=1000")
        cur.close()

async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session


async def create_db_and_tables():
    import database.models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    await _apply_migrations()


async def _apply_migrations():
    """Ajoute les colonnes manquantes sur les tables existantes (PostgreSQL uniquement)."""
    if _sqlite:
        return  # SQLite recréé à chaque démarrage local — pas besoin

    from sqlalchemy import text
    migrations = [
        # documents_qualite : colonnes ajoutées après création initiale
        "ALTER TABLE documents_qualite ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id)",
        "ALTER TABLE documents_qualite ADD COLUMN IF NOT EXISTS localisation_id INTEGER REFERENCES localisations(id)",
        "ALTER TABLE documents_qualite ADD COLUMN IF NOT EXISTS type_document VARCHAR",
        "ALTER TABLE documents_qualite ADD COLUMN IF NOT EXISTS numero_document VARCHAR",
        "ALTER TABLE documents_qualite ADD COLUMN IF NOT EXISTS periodicite_revision INTEGER",
        "ALTER TABLE documents_qualite ADD COLUMN IF NOT EXISTS theme VARCHAR",
        "ALTER TABLE documents_qualite ADD COLUMN IF NOT EXISTS classification VARCHAR",
        "ALTER TABLE documents_qualite ADD COLUMN IF NOT EXISTS fichier_path VARCHAR",
        "ALTER TABLE documents_qualite ADD COLUMN IF NOT EXISTS liens_processus TEXT",
        "ALTER TABLE documents_qualite ADD COLUMN IF NOT EXISTS contenu TEXT",
        # equipements : colonnes pannes/MTBF
        "ALTER TABLE equipements ADD COLUMN IF NOT EXISTS nombre_pannes INTEGER DEFAULT 0",
        "ALTER TABLE equipements ADD COLUMN IF NOT EXISTS temps_arret_total FLOAT DEFAULT 0.0",
        "ALTER TABLE equipements ADD COLUMN IF NOT EXISTS mtbf FLOAT",
        "ALTER TABLE equipements ADD COLUMN IF NOT EXISTS pieces_rechange TEXT",
        # personnel_rh
        "ALTER TABLE personnel_rh ADD COLUMN IF NOT EXISTS telephone VARCHAR",
        "ALTER TABLE personnel_rh ADD COLUMN IF NOT EXISTS site VARCHAR DEFAULT 'STE'",
        # indicateurs_qualite : biologiste assigné
        "ALTER TABLE indicateurs_qualite ADD COLUMN IF NOT EXISTS biologiste_id INTEGER REFERENCES users(id)",
        "ALTER TABLE indicateurs_qualite ADD COLUMN IF NOT EXISTS fichier_excel_path VARCHAR",
        # actions_pag : num_pag ajouté après création initiale
        "ALTER TABLE actions_pag ADD COLUMN IF NOT EXISTS num_pag VARCHAR(20)",
    ]
    async with engine.begin() as conn:
        for stmt in migrations:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass  # colonne déjà présente ou table inexistante — ignorer
