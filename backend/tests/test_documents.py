"""
Tests for document endpoints.
Covers CRUD, workflow state transitions, and signature.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_document(client: AsyncClient, quali_token):
    """Qualiticien can create a document."""
    resp = await client.post(
        "/documents/",
        json={
            "reference": "PROC-TEST-001",
            "titre": "Procédure test unitaire",
            "type_document": "procedure",
            "version": "1.0",
            "referentiel": "ISO 15189:2022 §5.4",
            "domaine": "Test",
            "contenu": "Contenu de test",
        },
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["reference"] == "PROC-TEST-001"
    assert body["statut"] == "brouillon"
    return body["id"]


@pytest.mark.asyncio
async def test_list_documents(client: AsyncClient, quali_token):
    """Documents list is accessible to qualiticien."""
    resp = await client.get(
        "/documents/",
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_get_document(client: AsyncClient, quali_token):
    """Can retrieve a single document by ID."""
    create = await client.post(
        "/documents/",
        json={
            "reference": "PROC-GET-001",
            "titre": "Doc à lire",
            "type_document": "procedure",
            "version": "1.0",
        },
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    doc_id = create.json()["id"]

    resp = await client.get(
        f"/documents/{doc_id}",
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == doc_id


@pytest.mark.asyncio
async def test_document_not_found(client: AsyncClient, quali_token):
    """Non-existent document returns 404."""
    resp = await client.get(
        "/documents/99999",
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_workflow_brouillon_to_relecture(client: AsyncClient, quali_token):
    """Document can transition from brouillon to relecture."""
    create = await client.post(
        "/documents/",
        json={
            "reference": "PROC-WF-001",
            "titre": "Doc workflow",
            "type_document": "procedure",
            "version": "1.0",
        },
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert create.status_code == 200
    doc_id = create.json()["id"]

    resp = await client.put(
        f"/documents/{doc_id}/status",
        json={"new_status": "relecture", "commentaire": "Prêt pour relecture"},
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["statut"] == "relecture"


@pytest.mark.asyncio
async def test_workflow_invalid_transition(client: AsyncClient, quali_token):
    """Invalid workflow transition returns 400."""
    create = await client.post(
        "/documents/",
        json={
            "reference": "PROC-WF-002",
            "titre": "Doc transition invalide",
            "type_document": "procedure",
            "version": "1.0",
        },
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    doc_id = create.json()["id"]

    # Cannot jump directly from brouillon to publie
    resp = await client.put(
        f"/documents/{doc_id}/status",
        json={"new_status": "publie"},
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_workflow_full_lifecycle(client: AsyncClient, quali_token, admin_token):
    """Full document lifecycle: brouillon -> relecture -> approbation -> publie."""
    create = await client.post(
        "/documents/",
        json={
            "reference": "PROC-LIFE-001",
            "titre": "Doc cycle complet",
            "type_document": "procedure",
            "version": "1.0",
        },
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    doc_id = create.json()["id"]

    # brouillon -> relecture
    r1 = await client.put(
        f"/documents/{doc_id}/status",
        json={"new_status": "relecture"},
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert r1.status_code == 200

    # relecture -> approbation
    r2 = await client.put(
        f"/documents/{doc_id}/status",
        json={"new_status": "approbation"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200

    # approbation -> publie
    r3 = await client.put(
        f"/documents/{doc_id}/status",
        json={"new_status": "publie"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r3.status_code == 200
    assert r3.json()["statut"] == "publie"


@pytest.mark.asyncio
async def test_create_new_version(client: AsyncClient, quali_token):
    """Can create a new version of an existing document."""
    create = await client.post(
        "/documents/",
        json={
            "reference": "PROC-VER-001",
            "titre": "Document versionné",
            "type_document": "procedure",
            "version": "1.0",
        },
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    doc_id = create.json()["id"]

    resp = await client.put(
        f"/documents/{doc_id}/version",
        json={"new_version": "2.0", "commentaire": "Mise à jour procédure"},
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["version"] == "2.0"


@pytest.mark.asyncio
async def test_sign_document(client: AsyncClient, quali_token):
    """Document can be electronically signed."""
    create = await client.post(
        "/documents/",
        json={
            "reference": "PROC-SIGN-001",
            "titre": "Document à signer",
            "type_document": "procedure",
            "version": "1.0",
        },
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    doc_id = create.json()["id"]

    resp = await client.post(
        f"/documents/{doc_id}/sign",
        json={"role": "qualiticien"},
        headers={"Authorization": f"Bearer {quali_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "hash_signature" in body
    assert len(body["hash_signature"]) == 64  # SHA256 hex digest


@pytest.mark.asyncio
async def test_technicien_cannot_create_document(client: AsyncClient, tech_token):
    """Technicien role cannot create documents (insufficient rights)."""
    resp = await client.post(
        "/documents/",
        json={
            "reference": "PROC-NOAUTH-001",
            "titre": "Doc non autorisé",
            "type_document": "procedure",
            "version": "1.0",
        },
        headers={"Authorization": f"Bearer {tech_token}"},
    )
    assert resp.status_code == 403
