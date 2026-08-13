@echo off
setlocal
cd /d "%~dp0\.."
node --env-file=data\fusion-access-live-agent.env scripts\fusion-biometria-sidecar.mjs %*
