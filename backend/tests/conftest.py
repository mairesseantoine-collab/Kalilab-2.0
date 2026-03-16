"""
Test fixtures shared across all test modules.
Uses SQLite in-memory database via aiosqlite.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from passlib.context import CryptContext

from main import app
from database.engine import get_session
from database.models import User, UserRole

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def test_session(test_engine):
    async_session = sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(test_session):
    """HTTP test client with overridden DB session."""
    async def _get_test_session():
        yield test_session

    app.dependency_overrides[get_session] = _get_test_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def admin_user(test_session):
    user = User(
        login="admin_test",
        email="admin@test.be",
        prenom="Admin",
        nom="Test",
        hashed_password=pwd_context.hash("AdminTest123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def qualiticien_user(test_session):
    user = User(
        login="quali_test",
        email="quali@test.be",
        prenom="Sophie",
        nom="Quali",
        hashed_password=pwd_context.hash("Quali123!"),
        role=UserRole.QUALITICIEN,
        is_active=True,
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def technicien_user(test_session):
    user = User(
        login="tech_test",
        email="tech@test.be",
        prenom="Jean",
        nom="Tech",
        hashed_password=pwd_context.hash("Tech123!"),
        role=UserRole.TECHNICIEN,
        is_active=True,
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def admin_token(client, admin_user):
    """JWT token for admin user."""
    resp = await client.post("/auth/login", data={
        "username": admin_user.login,
        "password": "AdminTest123!",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest_asyncio.fixture(scope="function")
async def quali_token(client, qualiticien_user):
    """JWT token for qualiticien user."""
    resp = await client.post("/auth/login", data={
        "username": qualiticien_user.login,
        "password": "Quali123!",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest_asyncio.fixture(scope="function")
async def tech_token(client, technicien_user):
    """JWT token for technicien user."""
    resp = await client.post("/auth/login", data={
        "username": technicien_user.login,
        "password": "Tech123!",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]
