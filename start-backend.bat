@echo off
echo ╔══════════════════════════════════════╗
echo ║   KaliLab - Lancement Backend        ║
echo ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0backend"

:: Creer le venv si absent
if not exist venv (
    echo Creation de l environnement Python...
    python -m venv venv
)

:: Activer le venv
call venv\Scripts\activate.bat

:: Installer les dependances
echo Installation des dependances Python...
pip install -r requirements.txt -q

:: Lancer le serveur
echo.
echo ✓ Backend demarre sur http://localhost:8000
echo ✓ Documentation API : http://localhost:8000/docs
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
