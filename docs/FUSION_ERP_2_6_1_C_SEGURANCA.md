# Fusion ERP 2.6.1-C — Segurança

## Incluído
- Endpoint `/api/sistema/seguranca`.
- Script `npm run security:261c`.
- Homologação atualizada: check + auditoria + performance + segurança.
- Relatório em `logs/seguranca-261c.json`.

## Teste
```cmd
npm run homologacao
npm start
```

## Endpoint
```text
http://localhost:3000/api/sistema/seguranca
```

## Observação
Aprovado para piloto local. Para produção externa, restringir CORS e substituir login fixo por autenticação persistida.
