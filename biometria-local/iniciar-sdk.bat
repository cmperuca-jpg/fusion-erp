@echo off
cd /d "%~dp0"
if not exist FusionBiometriaSdk.exe call compilar-x86.bat
FusionBiometriaSdk.exe
pause
