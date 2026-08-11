-- JÁ APLICADA NO SUPABASE Fusion ERP em 2026-08-11.
-- Mantida neste pacote apenas para histórico/versionamento.

create table if not exists public.fusion_tenant_signup_challenges (
  id text primary key,
  email_normalized text not null,
  document_normalized text not null,
  academy_name text not null,
  legal_name text not null default '',
  payload jsonb not null,
  code_hash text not null,
  status text not null default 'pending'
    check (status in ('pending','verified','completed','expired','delivery_failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  source_ip text not null default '',
  user_agent text not null default '',
  delivered_at timestamptz,
  verified_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fusion_tenant_signup_challenges_email_idx
  on public.fusion_tenant_signup_challenges (email_normalized, created_at desc);
create index if not exists fusion_tenant_signup_challenges_document_idx
  on public.fusion_tenant_signup_challenges (document_normalized, created_at desc);
create index if not exists fusion_tenant_signup_challenges_status_exp_idx
  on public.fusion_tenant_signup_challenges (status, expires_at);

alter table public.fusion_tenant_signup_challenges enable row level security;
revoke all on table public.fusion_tenant_signup_challenges from anon, authenticated;
grant select, insert, update, delete on table public.fusion_tenant_signup_challenges to service_role;
