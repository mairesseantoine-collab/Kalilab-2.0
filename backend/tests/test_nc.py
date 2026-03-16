"""
Tests for non-conformity (NC) endpoints.
Covers CRUD, workflow state machine, and access control.
"""
import pytest
from httpx import AsyncClient


async def _create_nc(client: AsyncClient, token: str, overrides: dict = None) -> dict:
    """Helper to create a test NC."""
    payload = {
        "type_nc": "interne",
        "source": "constat_interne",
        "description": "Tube sans bouchon détecté à la réception",
        "impact": "Risque contamination réactif",
        "gravite": "majeure",
    }
    if overrides:
        payload.update(overrides)
    resp = await client.post(
        "/nonconformities/",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp


@pytest.mark.asyncio
async def test_create_nc(client: AsyncClient, quali_token):
    """Qualiticien can declare a new NC."""
    resp = await _create_nc(client, quali_token)
    assert resp.status_code == 200
    body = resp.json()
    assert body["statut"] == "ouverte"
    assert body["type_nc"] == "interne"


@pytest.mark.asyncio
async def test_list_nc(client: AsyncClient, quali_token):
    """Can list NCs."""
    await _create_nc(client, quali_token)
    resp = await client.get(
        "/nonconformities/",
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_get_nc(client: AsyncClient, quali_token):
    """Can retrieve a single NC by ID."""
    create = await _create_nc(client, quali_token)
    nc_id = create.json()["id"]

    resp = await client.get(
        f"/nonconformities/{nc_id}",
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == nc_id


@pytest.mark.asyncio
async def test_nc_not_found(client: AsyncClient, quali_token):
    """Non-existent NC returns 404."""
    resp = await client.get(
        "/nonconformities/99999",
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_nc_workflow_ouverte_to_en_analyse(client: AsyncClient, quali_token):
    """NC transitions from ouverte to en_analyse."""
    create = await _create_nc(client, quali_token)
    nc_id = create.json()["id"]

    resp = await client.put(
        f"/nonconformities/{nc_id}/status",
        json={"new_status": "en_analyse", "commentaire": "Analyse en cours"},
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["statut"] == "en_analyse"


@pytest.mark.asyncio
async def test_nc_workflow_full_lifecycle(client: AsyncClient, quali_token):
    """Full NC lifecycle: ouverte -> en_analyse -> capa_en_cours -> verification -> cloturee."""
    create = await _create_nc(client, quali_token)
    nc_id = create.json()["id"]

    transitions = [
        "en_analyse",
        "capa_en_cours",
        "verification",
        "cloturee",
    ]

    for status in transitions:
        resp = await client.put(
            f"/nonconformities/{nc_id}/status",
            json={"new_status": status, "commentaire": f"Passage en {status}"},
            headers={"Authorization": f"Bearer {quali_token}"},
        )
        assert resp.status_code == 200, f"Failed on transition to {status}: {resp.json()}"
        assert resp.json()["statut"] == status

    # Closed NC should not be modifiable
    resp = await client.get(
        f"/nonconformities/{nc_id}",
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.json()["statut"] == "cloturee"


@pytest.mark.asyncio
async def test_nc_invalid_transition(client: AsyncClient, quali_token):
    """Cannot jump directly from ouverte to cloturee."""
    create = await _create_nc(client, quali_token)
    nc_id = create.json()["id"]

    resp = await client.put(
        f"/nonconformities/{nc_id}/status",
        json={"new_status": "cloturee"},
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_nc_capa_can_revert_to_en_analyse(client: AsyncClient, quali_token):
    """From verification, NC can go back to capa_en_cours."""
    create = await _create_nc(client, quali_token)
    nc_id = create.json()["id"]

    for status in ["en_analyse", "capa_en_cours", "verification"]:
        await client.put(
            f"/nonconformities/{nc_id}/status",
            json={"new_status": status},
            headers={"Authorization": f"Bearer {quali_token}"},
        )

    # Revert to capa_en_cours from verification
    resp = await client.put(
        f"/nonconformities/{nc_id}/status",
        json={"new_status": "capa_en_cours", "commentaire": "CAPA insuffisante, retour en traitement"},
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["statut"] == "capa_en_cours"


@pytest.mark.asyncio
async def test_update_nc_fields(client: AsyncClient, quali_token):
    """Can update NC description and CAPA fields."""
    create = await _create_nc(client, quali_token)
    nc_id = create.json()["id"]

    resp = await client.put(
        f"/nonconformities/{nc_id}",
        json={
            "analyse_causes": "Défaut de procédure à la réception",
            "capa": "1. Mise à jour procédure\n2. Formation personnel",
        },
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    assert "Défaut de procédure" in resp.json()["analyse_causes"]


@pytest.mark.asyncio
async def test_technicien_can_declare_nc(client: AsyncClient, tech_token):
    """Technicien can declare an NC (observation role)."""
    resp = await _create_nc(client, tech_token)
    assert resp.status_code == 200
    assert resp.json()["statut"] == "ouverte"


@pytest.mark.asyncio
async def test_nc_with_severity_levels(client: AsyncClient, quali_token):
    """NCs can be created with different severity levels."""
    for gravite in ["mineure", "majeure", "critique"]:
        resp = await _create_nc(client, quali_token, {"gravite": gravite, "description": f"NC {gravite}"})
        assert resp.status_code == 200
        assert resp.json()["gravite"] == gravite


@pytest.mark.asyncio
async def test_nc_report_pdf(client: AsyncClient, quali_token):
    """NC PDF report can be generated."""
    create = await _create_nc(client, quali_token)
    nc_id = create.json()["id"]

    resp = await client.get(
        f"/nonconformities/{nc_id}/report",
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    assert resp.headers.get("content-type", "").startswith("application/pdf")
