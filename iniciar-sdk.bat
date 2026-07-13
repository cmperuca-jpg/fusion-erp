@echo off
setlocal
cd /d "%~dp0fusion-biometria-local\sdk-futronic"
if not exist "FusionBiometriaSdk.exe" call "compilar-x86.bat"
if not exist "FusionBiometriaSdk.exe" (
  echo ERRO: nao foi possivel compilar o SDK Futronic.
  pause
  exit /b 1
)
start "Fusion Biometria SDK" "FusionBiometriaSdk.exe"
echo SDK Futronic iniciado em http://127.0.0.1:3041/
endlocal
