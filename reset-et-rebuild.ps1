# ============================================================
# KaliLab - Reset mot de passe + Rebuild complet
# Usage : cd "C:\...\kalilab" ; .\reset-et-rebuild.ps1
# ============================================================

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KaliLab - Reset & Rebuild complet" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Etape 1 : Arreter et nettoyer ──────────────────────────
Write-Host "[1/5] Arret des conteneurs et suppression des volumes..." -ForegroundColor Yellow
docker compose down -v *>$null
Write-Host "      Purge du cache Docker builder (evite les corruptions)..." -ForegroundColor Gray
docker builder prune -f *>$null
Write-Host "      OK" -ForegroundColor Green

# ── Etape 2 : Rebuild images ───────────────────────────────
Write-Host "[2/5] Build des images Docker (patience ~3-5 min)..." -ForegroundColor Yellow
docker compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : docker compose build a echoue." -ForegroundColor Red
    Write-Host ""
    Write-Host "Tentative avec nettoyage complet Docker..." -ForegroundColor Yellow
    docker system prune -f *>$null
    docker compose build --no-cache
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERREUR persistante. Verifiez les logs ci-dessus." -ForegroundColor Red
        exit 1
    }
}
Write-Host "      Build OK" -ForegroundColor Green

# ── Etape 3 : Demarrer les conteneurs ──────────────────────
Write-Host "[3/5] Demarrage des conteneurs..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : docker compose up a echoue." -ForegroundColor Red
    exit 1
}
Write-Host "      Attente PostgreSQL (20s)..." -ForegroundColor Gray
Start-Sleep -Seconds 20

# ── Etape 4 : Seed de la base de donnees ───────────────────
Write-Host "[4/5] Seed de la base de donnees..." -ForegroundColor Yellow
docker exec kalilab-backend python seed.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Retry apres 20s..." -ForegroundColor Gray
    Start-Sleep -Seconds 20
    docker exec kalilab-backend python seed.py
}
Write-Host "      Seed OK" -ForegroundColor Green

# ── Etape 5 : Reset des mots de passe ──────────────────────
Write-Host "[5/5] Reset des mots de passe..." -ForegroundColor Yellow

$py = @"
import asyncio, os, sys
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
CREDS = {
    'admin@kalilab.be': 'Admin2024!',
    'sophie.renard@kalilab.be': 'Quali2024!',
    'marc.dubois@kalilab.be': 'Tech2024!',
    'claire.laurent@kalilab.be': 'Bio2024!',
    'jp.fontaine@kalilab.be': 'Tech2024!',
}
async def reset():
    url = os.getenv('DATABASE_URL','')
    if not url: print('ERREUR: DATABASE_URL vide'); sys.exit(1)
    engine = create_async_engine(url, echo=False)
    async with engine.begin() as conn:
        rows = await conn.execute(text('SELECT id, email FROM users'))
        users = rows.fetchall()
        if not users: print('Aucun user - seed non execute?'); return
        for uid, email in users:
            pw = CREDS.get(email)
            if not pw: print(f'  {email} -> ignore'); continue
            h = pwd.hash(pw)
            await conn.execute(text('UPDATE users SET hashed_password=:h WHERE id=:i'), {'h':h,'i':uid})
            print(f'  [OK] {email}  =>  {pw}  verify={pwd.verify(pw,h)}')
    await engine.dispose()
asyncio.run(reset())
"@

docker exec kalilab-backend python -c "$py"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR reset mdp." -ForegroundColor Red
} else {
    Write-Host "      Mots de passe OK" -ForegroundColor Green
}

# ── Resume ──────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TERMINE ! -> http://localhost:3000" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  admin@kalilab.be          /  Admin2024!" -ForegroundColor White
Write-Host "  sophie.renard@kalilab.be  /  Quali2024!" -ForegroundColor White
Write-Host "  marc.dubois@kalilab.be    /  Tech2024!" -ForegroundColor White
Write-Host "  claire.laurent@kalilab.be /  Bio2024!" -ForegroundColor White
Write-Host "  jp.fontaine@kalilab.be    /  Tech2024!" -ForegroundColor White
Write-Host ""
