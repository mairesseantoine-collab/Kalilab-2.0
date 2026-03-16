Write-Host "=== Rebuild KaliLab ===" -ForegroundColor Cyan
docker compose build --no-cache
Write-Host "=== Demarrage des containers ===" -ForegroundColor Cyan
docker compose up -d
Write-Host "=== Termine ! http://localhost:3000 ===" -ForegroundColor Green
