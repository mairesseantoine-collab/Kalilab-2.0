# KaliLab — Système de Management de la Qualité ISO 15189

Application web de gestion de la qualité pour laboratoires médicaux accrédités ISO 15189, ISO 9001 et ISO 17025.

## Modules

- **Gestion documentaire** : versioning, workflow multi-signatures, archivage
- **Qualité** : risques, non-conformités, audits, KPI
- **Matériel** : fiche signalétique, calibration, maintenance, blocage automatique
- **Ressources humaines** : compétences, formations, planning
- **Stock & commandes** : réception GS1, lots, essai d'acceptation, DLU
- **Plaintes** : déclaration, analyse, clôture
- **Rédaction documentaire** : dossiers de vérification, procédures mammouth
- **Piste d'audit** : journal WORM immuable, export CSV/JSON

## Architecture technique

- **Backend** : Python 3.11 + FastAPI + SQLModel + PostgreSQL + Alembic
- **Frontend** : React 18 + TypeScript + Vite + Material UI v5
- **Stockage** : MinIO (S3-compatible) pour documents et certificats
- **Auth** : JWT (RS256), RBAC 5 rôles
- **PDF** : ReportLab (rapports audit, NC, KPI, piste d'audit)

## Prérequis

- Docker & Docker Compose (recommandé)
- OU : Python 3.11+ et Node.js 20+ (développement local)

## Démarrage rapide (Docker)

```bash
# 1. Cloner le projet
git clone <repo> kalilab
cd kalilab

# 2. Démarrer les services
docker-compose up -d

# 3. Initialiser la base de données
docker-compose exec backend python seed.py

# 4. Accéder à l'application
# Frontend : http://localhost:3000
# API Swagger : http://localhost:8000/docs
# MinIO Console : http://localhost:9001
```

## Démarrage local (développement)

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Editer .env avec vos paramètres
alembic upgrade head
python seed.py
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# Editer VITE_API_URL=http://localhost:8000
npm run dev
```

## Comptes par défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Administrateur | admin@kalilab.be | Admin2024! |
| Qualiticien | qualiticien@kalilab.be | Quali2024! |
| Responsable Technique | resp.tech@kalilab.be | Tech2024! |
| Biologiste | biologiste@kalilab.be | Bio2024! |
| Technicien | technicien@kalilab.be | Tech2024! |

## Rôles et permissions

| Module | Admin | Qualiticien | Resp. Tech | Biologiste | Technicien |
|--------|-------|-------------|------------|------------|------------|
| Gestion documentaire | RW | RW | R | R | R |
| Risques | RW | RW | RW | R | — |
| Non-conformités | RW | RW | RW | R | W (décl.) |
| Audits | RW | RW | R | — | — |
| KPI | RW | RW | R | — | — |
| Matériel | RW | R | RW | R | R |
| RH | RW | RW | R | — | — |
| Stock | RW | R | RW | R | W (réc.) |
| Plaintes | RW | RW | R | R | W (décl.) |
| Piste d'audit | R | R | — | — | — |

## Workflows

### Gestion documentaire
`Brouillon → Relecture → Approbation (multi-signatures) → Publié → Diffusion → Archivé`

### Non-conformité
`Ouverte → En analyse → CAPA en cours → Vérification → Clôturée`

### Equipement
`Opérationnel → [Calibration échue → Bloqué] → En maintenance → Opérationnel`

### Lot de stock
`Réception → Quarantaine → [Essai acceptation] → Accepté / Refusé`

## Tests

```bash
# Backend
cd backend
pytest tests/ -v --asyncio-mode=auto

# Tests spécifiques
pytest tests/test_auth.py -v
pytest tests/test_documents.py -v
pytest tests/test_nc.py -v
```

## API Documentation

L'API REST est documentée via Swagger UI :
- Swagger UI : http://localhost:8000/docs
- ReDoc : http://localhost:8000/redoc
- OpenAPI JSON : http://localhost:8000/openapi.json

## Structure du projet

```
kalilab/
├── backend/
│   ├── main.py              # Point d'entrée FastAPI
│   ├── database/
│   │   ├── engine.py        # Configuration DB async
│   │   └── models.py        # 24 modèles SQLModel
│   ├── auth/
│   │   ├── security.py      # JWT, hash, signatures SHA256
│   │   └── dependencies.py  # get_current_user, require_role
│   ├── routers/             # 14 routers REST
│   ├── services/
│   │   ├── audit_service.py     # Journal WORM
│   │   ├── workflow_service.py  # State machines métier
│   │   ├── storage_service.py   # S3/MinIO
│   │   └── pdf_service.py       # Génération PDF (ReportLab)
│   ├── alembic/             # Migrations DB
│   ├── tests/               # Tests pytest-asyncio
│   └── seed.py              # Données de démonstration
├── frontend/
│   ├── src/
│   │   ├── api/             # 13 modules Axios
│   │   ├── components/      # Composants réutilisables
│   │   ├── contexts/        # AuthContext
│   │   ├── i18n/            # Traductions FR/EN
│   │   ├── pages/           # 30+ pages React
│   │   └── types/           # Types TypeScript
│   └── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
└── README.md
```

## Conformité & Sécurité

- **ISO 15189** : workflows documentaires, gestion NC, audits, KPI
- **Piste d'audit WORM** : journal append-only, non modifiable, non supprimable
- **Signatures électroniques** : SHA256 avec identifiant utilisateur et horodatage
- **RBAC** : 5 rôles avec permissions granulaires par module
- **Chiffrement transit** : HTTPS (configurer via reverse proxy en production)
- **Sessions JWT** : expiration 8h, révocables

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| DATABASE_URL | URL PostgreSQL async | postgresql+asyncpg://... |
| SECRET_KEY | Clé secrète JWT | (changer en production) |
| ACCESS_TOKEN_EXPIRE_MINUTES | Durée session | 480 |
| S3_ENDPOINT | URL MinIO/S3 | http://localhost:9000 |
| S3_BUCKET | Bucket documents | kalilab-docs |
| S3_ACCESS_KEY | Clé accès S3 | — |
| S3_SECRET_KEY | Clé secrète S3 | — |
