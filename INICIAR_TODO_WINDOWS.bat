@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ================================================
echo FACTURACION CR - INICIAR JSON SERVER + N8N
 echo ================================================
where node >nul 2>&1 || (echo ERROR: instala Node.js 20 o superior. & pause & exit /b 1)
where npm >nul 2>&1 || (echo ERROR: falta npm. & pause & exit /b 1)
if not exist "node_modules\json-server" (
  echo Instalando JSON Server (primera ejecucion)...
  call npm install
  if errorlevel 1 (echo Error al instalar dependencias. & pause & exit /b 1)
)
echo Iniciando JSON Server en puerto 3000...
start "JSON SERVER Facturacion CR" cmd /k "cd /d ""%~dp0"" && npm run db"
echo Iniciando n8n en puerto 5678...
echo Si n8n no esta instalado, npx lo descargara (requiere internet).
start "n8n Facturacion CR" cmd /k "cd /d ""%~dp0"" && npx --yes n8n start"
timeout /t 5 >nul
start "" "http://localhost:5678"
echo.
echo SIGUIENTE: Importar workflow/FacturaHabiles_CR_n8n_WINDOWS_IMPORTAR.json en n8n.
echo Para pruebas: Listen for Test Event; Postman solicitud 01.
echo Para uso repetido: Publicar workflow; Postman solicitud 02.
pause
