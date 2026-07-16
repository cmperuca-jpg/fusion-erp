@echo off
setlocal
cd /d "%~dp0"

echo Removendo somente a antiga pagina comercial corporativa...
if exist "public\pages\comercial\index.html" del /q "public\pages\comercial\index.html"
if exist "public\pages\comercial\index.js" del /q "public\pages\comercial\index.js"
if exist "public\pages\comercial\style.css" del /q "public\pages\comercial\style.css"
if exist "public\pages\comercial\contrato.html" del /q "public\pages\comercial\contrato.html"
if exist "public\pages\comercial" rmdir "public\pages\comercial" 2>nul

echo.
echo Correcao aplicada. A pagina da empresa foi retirada desta instalacao.
echo Agora envie os arquivos para o Git e aguarde o novo deploy no Render.
pause

