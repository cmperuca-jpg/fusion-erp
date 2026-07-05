# Fusion ERP 2.7.4 — ZIP 7 Otimização para Render

## Objetivo

Preparar o projeto para rodar online no Render com inicialização estável, health check e persistência básica para `data/` e `uploads/`.

## Arquivos incluídos

- `server.mjs`
- `package.json`
- `render.yaml`
- `.env.example`
- `scripts/render-smoke-test.mjs`
- `docs/FUSION_ERP_2_7_4_ZIP7_RENDER.md`

## O que foi ajustado

1. Criado endpoint `GET /api/health` para o Render validar se o servidor está online.
2. Atualizado `render.yaml` com:
   - `healthCheckPath: /api/health`;
   - `buildCommand` mais adequado para produção;
   - `startCommand: npm start`;
   - `HOST=0.0.0.0`;
   - disco persistente em `/var/data`;
   - variável `FUSION_PERSISTENT_DIR=/var/data/fusion`.
3. Adicionada preparação automática de persistência no `server.mjs`:
   - em ambiente Render, `data/` passa a apontar para `/var/data/fusion/data`;
   - `uploads/` passa a apontar para `/var/data/fusion/uploads`;
   - seeds iniciais são copiadas se o disco estiver vazio.
4. Atualizado `.env.example` com variáveis importantes para produção.
5. Criado `npm run render:check` para validação simples antes do deploy.

## Como aplicar

Extraia este ZIP na raiz do projeto e substitua os arquivos.

Depois rode localmente:

```bash
npm run check
npm start
```

Teste no navegador:

```text
http://localhost:3000/api/health
```

No Render, depois do deploy, teste:

```text
https://SEU-SITE.onrender.com/api/health
```

## Observação importante

O Render Free pode suspender o serviço quando fica sem uso. Isso não é bug do sistema. O primeiro acesso depois de um período parado pode demorar mais.

