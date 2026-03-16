#!/bin/bash
# Démarrage automatique au lancement du Codespace
REPO=/workspaces/Kalilab-2.0

echo "=== Démarrage du backend KaliLab ==="
cd "$REPO/backend"

# Créer les tables et seeder si la DB est vide
python3 -c "
import asyncio, os
os.chdir('$REPO/backend')
import sys; sys.path.insert(0, '.')
from database.engine import create_db_and_tables
asyncio.run(create_db_and_tables())
print('Tables OK')
" 2>/dev/null

# Seeder si pas d'utilisateurs
python3 -c "
import asyncio, os
os.chdir('$REPO/backend')
import sys; sys.path.insert(0, '.')
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
    print('DB seedée')
else:
    print('DB déjà initialisée')
" 2>/dev/null

# Démarrer le backend en arrière-plan
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
echo "Backend démarré (port 8000)"

echo "=== Démarrage du frontend KaliLab ==="
cd "$REPO/frontend"
nohup npm run dev -- --host 0.0.0.0 > /tmp/frontend.log 2>&1 &
echo "Frontend démarré (port 3000)"

echo "=== Application disponible ==="
echo "  Frontend : http://localhost:3000"
echo "  Backend  : http://localhost:8000"
echo "  Connexion: admin@kalilab.be / Admin2024!"
