# Fusion ERP 2.6.1-A — Auditoria Geral

## Mudanças

- Adicionado endpoint `/api/sistema/diagnostico` no `server.mjs`.
- Atualizado `package.json` para versão `2.6.1-a`.
- Adicionado script `npm run audit:261a`.
- Adicionado script `npm run homologacao`.
- Criado relatório automático em `logs/auditoria-261a.json`.

## Teste

```cmd
cd C:\Users\academia01\Desktop\site erp
npm run check
npm run audit:261a
npm start
```

## Teste API

```cmd
curl http://localhost:3000/api/sistema/diagnostico
```

## Objetivo

Validar a base do Fusion ERP antes do projeto piloto, sem adicionar funcionalidades novas.
