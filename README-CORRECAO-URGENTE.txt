CORREÇÃO URGENTE — ACESSO DA CATRACA

Causa do problema:
O patch anterior substituiu o middleware de segurança sem manter as três rotas públicas usadas pelo Fusion Access Agent. Com isso, o agente passou a receber HTTP 401 e deixou de buscar/executar comandos da catraca.

Rotas restauradas:
- POST /api/access-bridge/agent/heartbeat
- GET  /api/access-bridge/agent/next
- POST /api/access-bridge/agent/commands/*

Instalação recomendada:
1. Substitua apenas este arquivo no projeto:
   modules/security/api-security.middleware.mjs
2. Faça novo deploy/reinicie o servidor.
3. Confirme nos logs do Agent que heartbeat e next não retornam mais 401.

Os demais arquivos do recurso PIX permanecem iguais ao patch anterior.
