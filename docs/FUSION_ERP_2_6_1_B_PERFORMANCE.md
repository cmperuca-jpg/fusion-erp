# Fusion ERP 2.6.1-B — Performance

## Objetivo
Hotfix de performance sem alteração de regra de negócio.

## Incluído
- Endpoint `/api/sistema/performance`.
- Script `npm run perf:261b`.
- Homologação atualizada para executar check, auditoria 2.6.1-A e performance 2.6.1-B.
- Relatório em `logs/performance-261b.json`.

## Teste
```cmd
npm run homologacao
npm start
```

## Endpoint
```text
http://localhost:3000/api/sistema/performance
```
