@echo off
cd /d "%~dp0"
node --check server.mjs && node --check modules/comercial/matricula-online/matricula-online.service.mjs && node scripts/verificar-chat-v3.mjs
pause
