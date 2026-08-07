-- Aplicada no Supabase em 07/08/2026.
-- Adiciona código de acesso para o login geral das academias.

alter table public.fusion_tenant_login_index
  add column if not exists access_code text;

create unique index if not exists fusion_tenant_login_access_code_uidx
  on public.fusion_tenant_login_index(access_code)
  where access_code is not null;

-- A função fusion_generate_access_code_v1() e a versão atualizada de
-- fusion_create_tenant_v1(...) foram aplicadas no banco de produção.
-- Consulte o histórico de migrations do Supabase para o SQL completo.
