@echo off
setlocal
cd /d "%~dp0"

set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if not exist "%CSC%" (
  echo ERRO: compilador .NET Framework x86 nao encontrado:
  echo %CSC%
  exit /b 1
)

if not exist "FusionBiometriaSdk.cs" (
  echo ERRO: FusionBiometriaSdk.cs nao encontrado.
  exit /b 1
)

if exist "FusionBiometriaSdk.exe" (
  copy /y "FusionBiometriaSdk.exe" "FusionBiometriaSdk.anterior.exe" >nul
)

"%CSC%" /nologo /platform:x86 /optimize+ /target:exe ^
  /out:"FusionBiometriaSdk.exe" ^
  /r:System.Web.Extensions.dll ^
  "FusionBiometriaSdk.cs"

if errorlevel 1 (
  echo ERRO NA COMPILACAO.
  exit /b 1
)

echo FusionBiometriaSdk.exe compilado com sucesso.
exit /b 0
