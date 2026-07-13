@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo Fusion ERP - Biometria -> Sistema -> Henry
echo ============================================

taskkill /F /IM FusionBiometriaSdk.exe >nul 2>&1
timeout /t 1 /nobreak >nul

set "SDK=%CD%\fusion-biometria-local\sdk-futronic"
set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if not exist "%CSC%" (
  echo ERRO: compilador C# nao encontrado.
  pause
  exit /b 1
)

echo Compilando servico Futronic x86...
"%CSC%" /nologo /platform:x86 /optimize+ /target:exe ^
  /out:"%SDK%\FusionBiometriaSdk.exe" ^
  /r:System.Web.Extensions.dll ^
  "%SDK%\FusionBiometriaSdk.cs"

if errorlevel 1 (
  echo ERRO: falha ao compilar o servico biometrico.
  pause
  exit /b 1
)

echo Servico compilado. Iniciando Fusion ERP...
npm start
