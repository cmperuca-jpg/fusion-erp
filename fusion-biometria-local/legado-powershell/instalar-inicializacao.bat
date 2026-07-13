@echo off
setlocal
cd /d "%~dp0"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "ATALHO=%STARTUP%\Fusion Biometria Local.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$w=New-Object -ComObject WScript.Shell;" ^
  "$s=$w.CreateShortcut('%ATALHO%');" ^
  "$s.TargetPath='$env:WINDIR\System32\wscript.exe';" ^
  "$s.Arguments='""%~dp0iniciar-biometria-oculto.vbs""';" ^
  "$s.WorkingDirectory='%~dp0';" ^
  "$s.WindowStyle=7;" ^
  "$s.Description='Fusion Biometria Local - inicialização automática';" ^
  "$s.Save()"

start "" wscript.exe "%~dp0iniciar-biometria-oculto.vbs"
echo.
echo Fusion Biometria instalada na inicializacao do Windows e iniciada em segundo plano.
echo Atalho criado em: %ATALHO%
pause
