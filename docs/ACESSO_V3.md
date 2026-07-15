# Fusion ERP 3.0 — Controle de acesso consolidado

A API canônica de diagnóstico e operação é `/api/v3/access`.

Responsabilidades:

- `access-engine`: decisão de acesso, regras e fila de comandos.
- `fusion-access-agent`: execução física local junto à catraca.
- `biometria`: comunicação com o SDK Futronic local na porta 3041.
- `henry7x`: protocolo e operação direta mantidos por compatibilidade e diagnóstico.

Rotas canônicas:

- `GET /api/v3/access/status`
- `GET /api/v3/access/dispositivos`
- `POST /api/v3/access/biometria/iniciar`
- `POST /api/v3/access/biometria/parar`
- `POST /api/v3/access/catraca/liberar`
- `GET /api/v3/access/comandos/:id`

Todas exigem administrador. A liberação padrão é enviada ao agente local. O modo direto Henry 7X permanece disponível apenas quando `modo: "direto"` for informado explicitamente.
