# Migração segura para o Supabase — V4

## Ordem obrigatória do primeiro deploy

1. No painel administrativo, gere um backup manual e confirme que ele aparece na lista.
2. No SQL Editor do Supabase, execute primeiro `supabase/migrations/20260714_v3_persistence.sql`.
3. Depois execute `supabase/migrations/20260715_v4_transacoes_seguranca.sql`.
4. No Render, confirme `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `FUSION_TENANT_ID=academia-piloto`.
5. Faça o primeiro deploy com `FUSION_MIGRATE_JSON_ON_START=true`.
6. Confirme no log: `Migração inicial concluída` e teste login, aluno, matrícula, recebimento e caixa.
7. Depois do teste, altere `FUSION_MIGRATE_JSON_ON_START=false` e faça novo deploy.

A migração inicial usa o identificador fixo `bootstrap-json-v4`. Repetir o primeiro deploy não duplica nem sobrescreve a importação já concluída.

## Proteções ativas

- Supabase é a fonte principal em produção.
- O sistema não inicia se a tabela, a função transacional ou as credenciais estiverem ausentes.
- O fallback silencioso para JSON fica desativado em produção.
- Matrícula online e confirmação de recebimento são confirmadas como uma única transação.
- Cada academia usa `tenant_id` próprio.
- Operações possuem idempotência e auditoria no banco.

## Validação mínima antes da academia piloto

- Cadastrar um aluno de teste.
- Aprovar uma matrícula online.
- Confirmar o recebimento da matrícula.
- Verificar aluno ativo, matrícula ativa, mensalidade paga e movimento no caixa.
- Reiniciar o serviço e confirmar que todos os registros continuam visíveis.
- Gerar e listar um backup manual.
