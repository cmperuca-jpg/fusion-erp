@echo off
setlocal
cd /d "%~dp0"
set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist "%CSC%" (
  echo ERRO: compilador .NET Framework x86 nao encontrado.
  pause
  exit /b 1
)
"%CSC%" /nologo /platform:x86 /optimize+ /target:exe /out:FusionBiometriaSdk.exe /r:System.Web.Extensions.dll FusionBiometriaSdk.cs
if errorlevel 1 (
  echo ERRO NA COMPILACAO.
  pause
  exit /b 1
)
echo Compilado: FusionBiometriaSdk.exe
pause
