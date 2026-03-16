@echo off
echo ╔══════════════════════════════════════╗
echo ║   KaliLab - Lancement Frontend       ║
echo ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0frontend"

:: Installer les dependances npm si absent
if not exist node_modules (
    echo Installation des dependances Node.js...
    npm install
)

:: Creer le .env local si absent
if not exist .env.local (
    echo VITE_API_BASE_URL=http://localhost:8000 > .env.local
)

echo.
echo ✓ Frontend demarre sur http://localhost:3000
echo.
npm run dev -- --port 3000
