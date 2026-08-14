@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo FUSION ERP - CORRECAO BIOMETRIA MULTITENANT
echo ============================================================
echo.

if not exist "server.mjs" (
  echo [ERRO] Extraia este ZIP na raiz do repositorio fusion-erp.
  pause
  exit /b 2
)

set "BACKUP=data\backup-fix-biometria-equipment"
if not exist "%BACKUP%" mkdir "%BACKUP%" >nul 2>&1

copy /Y "modules\access-bridge\access-bridge.repository.mjs" "%BACKUP%\access-bridge.repository.mjs" >nul
copy /Y "modules\access-bridge\access-bridge.routes.mjs" "%BACKUP%\access-bridge.routes.mjs" >nul
copy /Y "modules\biometria\biometria-bridge.service.mjs" "%BACKUP%\biometria-bridge.service.mjs" >nul

copy /Y "_patch\modules\access-bridge\access-bridge.repository.mjs" "modules\access-bridge\access-bridge.repository.mjs" >nul
copy /Y "_patch\modules\access-bridge\access-bridge.routes.mjs" "modules\access-bridge\access-bridge.routes.mjs" >nul
copy /Y "_patch\modules\biometria\biometria-bridge.service.mjs" "modules\biometria\biometria-bridge.service.mjs" >nul

echo [1/3] Validando...
node --check "modules\access-bridge\access-bridge.repository.mjs" || goto :erro
node --check "modules\access-bridge\access-bridge.routes.mjs" || goto :erro
node --check "modules\biometria\biometria-bridge.service.mjs" || goto :erro
echo [OK] Sintaxe valida.

echo.
echo [2/3] Criando commit...
git add -- "modules/access-bridge/access-bridge.repository.mjs" "modules/access-bridge/access-bridge.routes.mjs" "modules/biometria/biometria-bridge.service.mjs"
git diff --cached --check || goto :erro
git commit -m "fix: resolve equipamento biometrico pelo tenant" || goto :erro

echo.
echo [3/3] Enviando ao GitHub...
git push || goto :erro

echo.
echo ============================================================
echo CORRECAO_BIOMETRIA_ENVIADA_OK
echo Aguarde o deploy automatico terminar.
echo ============================================================
rmdir /S /Q "_patch" >nul 2>&1
pause
exit /b 0

:erro
echo.
echo [ERRO] A correcao nao foi concluida.
echo O backup local esta em: %BACKUP%
pause
exit /b 1
