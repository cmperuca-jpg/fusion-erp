@echo off
setlocal
cd /d "%~dp0"

set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if not exist "%CSC%" (
  echo ERRO: compilador C# x86 nao encontrado em:
  echo %CSC%
  exit /b 1
)

if not exist "%~dp0FTRAPI.dll" (
  echo ERRO: FTRAPI.dll nao encontrada em %~dp0
  echo Copie para esta pasta a MESMA FTRAPI.dll 4.2.2029.176 ja validada no laboratorio.
  exit /b 1
)

if not exist "%~dp0ftrScanAPI.dll" (
  echo ERRO: ftrScanAPI.dll nao encontrada em %~dp0
  echo Copie para esta pasta a ftrScanAPI.dll correspondente ao SDK Futronic validado.
  exit /b 1
)

"%CSC%" /nologo /platform:x86 /optimize+ /target:exe ^
  /out:"%~dp0FusionBiometriaFs80.exe" ^
  /r:System.Web.Extensions.dll ^
  /r:System.Security.dll ^
  "%~dp0FusionBiometriaFs80.cs"

if errorlevel 1 (
  echo ERRO: falha ao compilar FusionBiometriaFs80.
  exit /b 1
)

echo OK: FusionBiometriaFs80.exe compilado.
