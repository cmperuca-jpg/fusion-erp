@echo off
setlocal
set "ATALHO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Fusion Biometria Local.lnk"
if exist "%ATALHO%" del /f /q "%ATALHO%"
echo Inicializacao automatica removida.
pause
