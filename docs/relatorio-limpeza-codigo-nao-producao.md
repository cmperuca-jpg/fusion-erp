# Fusion ERP v2.0 — Etapa 5.2: Limpeza de código fora de produção

Objetivo: retirar do projeto ativo código legado, backups e cópias que não fazem parte da execução atual do ERP.

Esta etapa não apaga permanentemente os arquivos. O script move tudo para uma pasta de segurança chamada `_arquivados_fora_producao_<data>`.

## Itens tratados como fora de produção

- `backups/`
- `backup_layout_global_componentizado_.../`
- `data/backups/`
- `data - Copia/`
- `backend/`, quando não montado pelo `server.mjs`
- `frontend/`, quando não servido pelo `server.mjs`
- `routes/`, quando não importado pelo `server.mjs`
- arquivos `.bak` e `.backup`
- ZIPs soltos de entrega antiga
- READMEs antigos de etapas anteriores

## Itens mantidos no projeto ativo

- `server.mjs`
- `package.json`
- `package-lock.json`
- `public/`
- `modules/`
- `data/`
- `lib/`
- `config/`
- `core/`
- `scripts/`
- `docs/`

## Como aplicar

Extraia este ZIP na raiz do projeto atual e execute:

```bash
node scripts/limpar-codigo-nao-producao.mjs
```

Depois teste:

```bash
npm start
```

Páginas mínimas para validar:

- `/pages/dashboard/`
- `/pages/alunos/`
- `/pages/matriculas/`
- `/pages/financeiro/`
- `/pages/caixa/`
- `/pages/relatorios-caixa/`
- `/pages/bi-financeiro/`
- `/pages/bi-academia/`
- `/pages/bi-academia-operacional/`

Se algo falhar, a pasta `_arquivados_fora_producao_<data>` permite restaurar qualquer item movido.
