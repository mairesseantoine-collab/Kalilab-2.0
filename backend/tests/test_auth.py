"""
Tests for authentication endpoints.
Covers login, logout, /me, invalid credentials.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, admin_user):
    """Admin can log in with correct credentials."""
    resp = await client.post("/auth/login", data={
        "username": "admin_test",
        "password": "AdminTest123!",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, admin_user):
    """Login fails with wrong password."""
    resp = await client.post("/auth/login", data={
        "username": "admin_test",
        "password": "WrongPassword!",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_user(client: AsyncClient):
    """Login fails for unknown user."""
    resp = await client.post("/auth/login", data={
        "username": "ghost",
        "password": "Whatever123!",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient, admin_token):
    """Authenticated user can retrieve their own profile."""
    resp = await client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["login"] == "admin_test"
    assert body["role"] == "admin"
    assert "hashed_password" not in body


@pytest.mark.asyncio
async def test_get_me_no_token(client: AsyncClient):
    """Unauthenticated request to /me returns 403."""
    resp = await client.get("/auth/me")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    """Invalid token returns 401."""
    resp = await client.get(
        "/auth/me",
        headers={"Authorization": "Bearer this.is.fake"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout(client: AsyncClient, admin_token):
    """Logout endpoint returns success."""
    resp = await client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json().get("message") is not None


@pytest.mark.asyncio
async def test_login_inactive_user(client: AsyncClient, test_session):
    """Inactive user cannot log in."""
    from database.models import User, UserRole
    from passlib.context import CryptContext
    ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    inactive = User(
        login="inactive_user",
        email="inactive@test.be",
        prenom="Old",
        nom="User",
        hashed_password=ctx.hash("OldUser123!"),
        role=UserRole.TECHNICIEN,
        is_active=False,
    )
    test_session.add(inactive)
    await test_session.commit()

    resp = await client.post("/auth/login", data={
        "username": "inactive_user",
        "password": "OldUser123!",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_qualiticien_can_login(client: AsyncClient, qualiticien_user):
    """Qualiticien role can also log in."""
    resp = await client.post("/auth/login", data={
        "username": "quali_test",
        "password": "Quali123!",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()
