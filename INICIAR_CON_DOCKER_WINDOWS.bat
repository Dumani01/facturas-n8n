@echo off
chcp 65001 >nul
cd /d "%~dp0"
where docker >nul 2>&1 || (echo Falta instalar Docker Desktop. & pause & exit /b 1)
docker compose up -d --build
if errorlevel 1 (echo Error al iniciar contenedores. Verifica Docker Desktop y los puertos 3000 y 5678. & pause & exit /b 1)
start "" "http://localhost:5678"
echo Importa workflow/FacturaHabiles_CR_n8n_DOCKER_IMPORTAR.json (NO el Windows).
echo Postman: importa postman/FacturaHabiles_CR_POSTMAN_IMPORTAR.json
pause
