@echo off
echo Chargement des donnees de demonstration...
cd /d "%~dp0backend"
call venv\Scripts\activate.bat
python seed.py
echo.
echo ✓ Donnees chargees !
echo   Admin    : admin@kalilab.com / Admin1234!
echo   Qualite  : qualiticien@kalilab.com / Quali1234!
echo   Technicien: tech@kalilab.com / Tech1234!
pause
