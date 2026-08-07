# Fusion Sistema — Multiempresa Fase 1

Data: 07/08/2026

## Estado aplicado no Supabase de produção

A migration `saas_multiempresa_fase1` foi aplicada no projeto Fusion ERP.

Ela cria:
- `public.fusion_tenants`
- `public.fusion_tenant_login_index`
- `public.fusion_create_tenant_v1(...)`

O tenant legado `academia-piloto` foi preservado e registrado como empresa `legacy`.
O índice global de login foi preenchido com os usuários administrativos já existentes.

Nenhum registro de alunos, matrículas, mensalidades ou financeiro foi movido ou apagado.

## Alterações no código

### Contexto de tenant por requisição

Novo arquivo:
`modules/core/persistence/tenant-context.mjs`

A persistência deixa de depender apenas de `FUSION_TENANT_ID` e passa a aceitar um tenant por requisição usando `AsyncLocalStorage`. O `.env` continua como fallback para compatibilidade.

### Login administrativo multiempresa

`POST /api/auth/login` localiza primeiro a empresa pelo índice global de e-mail e só então lê a coleção `usuarios` daquele tenant.

O JWT do painel agora contém `tenantId`.

### Segurança de APIs

`apiSecurity` executa as rotas autenticadas dentro do tenant contido no token. Em rotas públicas, um tenant pode ser indicado por `X-Fusion-Tenant`, `tenantId` ou `tenant`, permitindo os portais e páginas públicas apontarem para a academia correta.

### Cadastro SaaS

Nova API:
`POST /api/saas/empresas`

Nova página:
`/pages/comecar/`

O cadastro cria atomicamente:
- empresa/tenant;
- administrador;
- índice de login;
- primeiro registro na coleção `usuarios`;
- auditoria da operação.

Após o cadastro a página efetua login e abre o Dashboard com `?onboarding=1`.

### Portal do Aluno e Portal do Professor

As páginas de login agora aceitam `?tenant=<slug>` e preservam o tenant no `localStorage`. O login envia `X-Fusion-Tenant` para que CPF/login iguais em academias diferentes sejam consultados no tenant correto.

## Próxima fase

1. Criar painel de onboarding (modalidades, planos, professores, horários, financeiro).
2. Gerar links públicos da academia com `tenant=<slug>`.
3. Tornar matrícula online/site/chat explicitamente tenant-aware na interface.
4. Configurar branding por tenant.
5. Criar administração SaaS do Fusion (empresas, trial, plano, suspensão).
6. Revisar jobs/background services que ainda usam tenant do `.env`.
7. Isolar backups e integrações físicas por tenant em todos os pontos.
