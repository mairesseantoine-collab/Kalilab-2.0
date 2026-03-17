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
        await _run_migrations(conn)


async def _run_migrations(conn):
    """Migrations manuelles : ajoute les colonnes manquantes sans perdre les données."""
    migrations = [
        # Qualifications — colonnes ajoutées v2
        "ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS criteres_evaluation TEXT",
        "ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS docs_admin TEXT",
        "ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS fichiers_admin TEXT",
        "ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS docs_user TEXT",
        "ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS fichiers_user TEXT",
    ]
    if _sqlite:
        # SQLite ne supporte pas IF NOT EXISTS sur ALTER TABLE — on ignore les erreurs
        for sql in migrations:
            try:
                await conn.execute(__import__("sqlalchemy").text(sql.replace(" IF NOT EXISTS", "")))
            except Exception:
                pass
    else:
        from sqlalchemy import text
        for sql in migrations:
            await conn.execute(text(sql))
