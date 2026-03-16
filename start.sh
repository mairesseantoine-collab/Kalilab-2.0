#!/bin/bash
# Lancement rapide de KaliLab dans GitHub Codespaces
set -e

REPO="$(cd "$(dirname "$0")" && pwd)"

echo "=== KaliLab — Démarrage ==="

# ── Backend ──────────────────────────────────────────────────────────────────
echo "→ Installation dépendances backend..."
cd "$REPO/backend"
pip install cffi cryptography --quiet 2>/dev/null
pip install -r requirements.txt --quiet 2>/dev/null

echo "→ Initialisation base de données..."
DATABASE_URL="sqlite+aiosqlite:///./kalilab.db" python3 -c "
import asyncio, sys
sys.path.insert(0, '.')
from database.engine import create_db_and_tables
asyncio.run(create_db_and_tables())
" 2>/dev/null

# Seeder si vide
python3 -c "
import asyncio, sys, os
sys.path.insert(0, '.')
from database.engine import async_session
from sqlalchemy import select
from database.models import User
async def check():
    async with async_session() as s:
        r = await s.execute(select(User).limit(1))
        return r.scalar_one_or_none()
u = asyncio.run(check())
if not u:
    import subprocess
    subprocess.run(['python3', 'seed.py'], env={**os.environ, 'DATABASE_URL': 'sqlite+aiosqlite:///./kalilab.db'})
    print('Base de données initialisée avec les données de démonstration')
else:
    print('Base de données déjà initialisée')
" 2>/dev/null

# Arrêter un éventuel backend déjà lancé
pkill -f "uvicorn main:app" 2>/dev/null || true
sleep 1

echo "→ Démarrage backend (port 8000)..."
nohup uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/kalilab-backend.log 2>&1 &
BACKEND_PID=$!

# Attendre que le backend réponde
for i in {1..15}; do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "  Backend opérationnel ✓"
    break
  fi
  sleep 1
done

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "→ Installation dépendances frontend..."
cd "$REPO/frontend"
npm install --silent 2>/dev/null

# Arrêter un éventuel frontend déjà lancé
pkill -f "vite" 2>/dev/null || true
sleep 1

echo "→ Démarrage frontend (port 3000)..."
nohup npm run dev -- --host 0.0.0.0 > /tmp/kalilab-frontend.log 2>&1 &

echo ""
echo "=============================================="
echo "  KaliLab est lancé !"
echo "  Ouvre le port 3000 dans l'onglet PORTS"
echo ""
echo "  Login : admin@kalilab.be"
echo "  Mot de passe : Admin2024!"
echo "=============================================="
echo ""
echo "  Logs backend  : tail -f /tmp/kalilab-backend.log"
echo "  Logs frontend : tail -f /tmp/kalilab-frontend.log"
