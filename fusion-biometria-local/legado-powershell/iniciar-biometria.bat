@echo off
cd /d "%~dp0"
start "" wscript.exe "%~dp0iniciar-biometria-oculto.vbs"
exit /b 0
