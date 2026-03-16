# ============================================================
# KaliLab - Reset complet + reinitialisation des mots de passe
# Usage : .\reset-and-restart.ps1
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KaliLab - Reset complet + mots de passe" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "ATTENTION : Cette operation va effacer la base de donnees !" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Confirmer ? (oui/non)"
if ($confirm -ne "oui") {
    Write-Host "Operation annulee." -ForegroundColor Red
    exit 0
}

# Aller dans le dossier du projet
$projectDir = $PSScriptRoot
Set-Location $projectDir

Write-Host ""
Write-Host "[1/5] Arret des containers et suppression des volumes..." -ForegroundColor Green
docker compose down -v
if ($LASTEXITCODE -ne 0) { Write-Host "Erreur docker compose down" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "[2/5] Reconstruction des images..." -ForegroundColor Green
docker compose build --no-cache
if ($LASTEXITCODE -ne 0) { Write-Host "Erreur docker compose build" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "[3/5] Demarrage des containers..." -ForegroundColor Green
docker compose up -d
if ($LASTEXITCODE -ne 0) { Write-Host "Erreur docker compose up" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "[4/5] Attente demarrage PostgreSQL (15 secondes)..." -ForegroundColor Green
for ($i = 15; $i -gt 0; $i--) {
    Write-Host "  $i..." -NoNewline
    Start-Sleep -Seconds 1
}
Write-Host ""

# Verifier que le backend est bien demarre
$maxTries = 10
$tries = 0
Write-Host "  Verification que le backend est pret..." -ForegroundColor Gray
while ($tries -lt $maxTries) {
    $result = docker exec kalilab-backend-dev echo "ok" 2>$null
    if ($result -eq "ok") { break }
    $tries++
    Start-Sleep -Seconds 2
}
if ($tries -eq $maxTries) {
    Write-Host "Le backend ne repond pas. Verifiez : docker compose logs backend" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[5/5] Lancement de la seed (donnees initiales)..." -ForegroundColor Green
docker exec kalilab-backend-dev python seed.py
if ($LASTEXITCODE -ne 0) { Write-Host "Erreur seed.py" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "[+] Reinitialisation des mots de passe..." -ForegroundColor Green
$pythonScript = @'
import asyncio, os, sys
sys.path.insert(0, '/app')
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select
from database.models import User
from auth.security import get_password_hash, verify_password

PWDS = {
    "admin@kalilab.be":           "Admin2024!",
    "sophie.renard@kalilab.be":   "Quali2024!",
    "marc.dubois@kalilab.be":     "Tech2024!",
    "claire.laurent@kalilab.be":  "Bio2024!",
    "jp.fontaine@kalilab.be":     "Tech2024!",
}

async def fix():
    engine = create_async_engine(os.getenv("DATABASE_URL"))
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as s:
        r = await s.execute(select(User))
        users = r.scalars().all()
        updated = 0
        for u in users:
            p = PWDS.get(u.email)
            if p:
                h = get_password_hash(p)
                u.hashed_password = h
                ok = verify_password(p, h)
                print(f"  {u.email} -> {'OK' if ok else 'ERREUR'}")
                updated += 1
        await s.commit()
        print(f"\n  {updated} mot(s) de passe reinitialise(s)")

asyncio.run(fix())
'@

docker exec kalilab-backend-dev python -c $pythonScript
if ($LASTEXITCODE -ne 0) { Write-Host "Erreur reinitialisation mots de passe" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Termine avec succes !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Application disponible sur : http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "  Comptes disponibles :" -ForegroundColor White
Write-Host "  admin@kalilab.be          / Admin2024!   (Administrateur)" -ForegroundColor Gray
Write-Host "  sophie.renard@kalilab.be  / Quali2024!   (Responsable qualite)" -ForegroundColor Gray
Write-Host "  marc.dubois@kalilab.be    / Tech2024!    (Technicien)" -ForegroundColor Gray
Write-Host "  claire.laurent@kalilab.be / Bio2024!     (Biologiste)" -ForegroundColor Gray
Write-Host "  jp.fontaine@kalilab.be    / Tech2024!    (Technicien)" -ForegroundColor Gray
Write-Host ""
