@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo FUSION ERP - FINALIZAR CADASTRO BIOMETRICO FS80
echo ============================================================
echo.

if not exist "server.mjs" (
  echo [ERRO] Coloque este arquivo na raiz do repositorio fusion-erp.
  exit /b 2
)

if not exist "modules\biometria\biometria-bridge.service.mjs" (
  echo [ERRO] biometria-bridge.service.mjs nao encontrado.
  exit /b 3
)

if not exist "scripts\fusion-biometria-sidecar.mjs" (
  echo [ERRO] fusion-biometria-sidecar.mjs nao encontrado.
  exit /b 4
)

rem Limpeza idempotente dos componentes biometricos antigos.
if exist "modules\biometria\biometria.repository.mjs" del /Q "modules\biometria\biometria.repository.mjs"
if exist "modules\biometria\biometria.service.mjs" del /Q "modules\biometria\biometria.service.mjs"
if exist "modules\biometria\biometria-protocol.mjs" del /Q "modules\biometria\biometria-protocol.mjs"
if exist "scripts\biometria\FusionBiometriaCli.cs" del /Q "scripts\biometria\FusionBiometriaCli.cs"
if exist "scripts\biometria\biometria-template-crypto.mjs" del /Q "scripts\biometria\biometria-template-crypto.mjs"
if exist "scripts\biometria\compilar-futronic-x86.bat" del /Q "scripts\biometria\compilar-futronic-x86.bat"
if exist "scripts\test-biometria-protocolo.mjs" del /Q "scripts\test-biometria-protocolo.mjs"

echo [1/4] Validando JavaScript...
node --check server.mjs || exit /b 10
node --check modules\access-bridge\access-bridge.repository.mjs || exit /b 11
node --check modules\access-bridge\access-bridge.routes.mjs || exit /b 12
node --check modules\biometria\biometria.routes.mjs || exit /b 13
node --check modules\biometria\biometria-bridge.service.mjs || exit /b 14
node --check public\pages\alunos\index.js || exit /b 15
node --check scripts\fusion-biometria-sidecar.mjs || exit /b 16
echo [OK] Sintaxe valida.

echo.
echo [2/4] Preparando somente os arquivos da biometria...
git add -- ".gitignore"
git add -- "modules/access-bridge/access-bridge.repository.mjs"
git add -- "modules/access-bridge/access-bridge.routes.mjs"
git add -A -- "modules/biometria/biometria.repository.mjs"
git add -- "modules/biometria/biometria.routes.mjs"
git add -A -- "modules/biometria/biometria.service.mjs"
git add -- "modules/biometria/biometria-bridge.service.mjs"
git add -- "public/pages/alunos/index.js"
git add -- "scripts/biometria/FusionBiometriaFs80.cs"
git add -- "scripts/fusion-biometria-sidecar.mjs"
if exist "scripts\INICIAR-BIOMETRIA-SIDECAR.bat" git add -- "scripts/INICIAR-BIOMETRIA-SIDECAR.bat"
git add -- "server.mjs"

echo.
echo [3/4] Verificando o que sera commitado...
git diff --cached --check || (
  echo [ERRO] O Git encontrou problema no patch preparado.
  exit /b 20
)
git diff --cached --stat

echo.
echo [4/4] Criando commit local...
git diff --cached --quiet
if not errorlevel 1 (
  echo [ERRO] Nenhuma alteracao biometrica preparada para commit.
  exit /b 21
)

git commit -m "feat: integra cadastro biometrico Futronic via Access Bridge"
if errorlevel 1 (
  echo [ERRO] Falha ao criar commit. Nada foi enviado ao GitHub.
  exit /b 22
)

echo.
echo ============================================================
echo FINALIZACAO_LOCAL_OK
echo O commit foi criado LOCALMENTE. Nenhum push foi executado.
echo Arquivos de billing, LEIA-ME.txt, qgit e o VBS local ficaram fora.
echo ============================================================
echo.
git log -1 --oneline
echo.
git status --short

endlocal
