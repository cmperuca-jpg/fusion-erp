@echo off
setlocal
cd /d "%~dp0"

echo Iniciando Fusion Biometria Futronic...
start "Fusion Biometria SDK" cmd /k "cd /d ""%~dp0fusion-biometria-local\sdk-futronic"" && iniciar-sdk.bat"

timeout /t 3 /nobreak >nul

echo Iniciando Fusion ERP...
start "Fusion ERP" cmd /k "cd /d ""%~dp0"" && npm start"

timeout /t 4 /nobreak >nul
start "" "http://localhost:3000/pages/biometria/"

endlocal
