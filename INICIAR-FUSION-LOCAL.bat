@echo off
setlocal

cd /d "%~dp0"

if "%PORT%"=="" set PORT=3000
if "%HOST%"=="" set HOST=127.0.0.1
set FUSION_DATABASE_PROVIDER=json
set FUSION_SYNC_DATA_ON_LOCAL=false

if not exist "node_modules" (
  echo Instalando dependencias locais do Fusion ERP...
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

echo.
echo Fusion ERP Local iniciado em:
echo http://%HOST%:%PORT%
echo.
start "" "http://%HOST%:%PORT%"

node server.mjs

endlocal
