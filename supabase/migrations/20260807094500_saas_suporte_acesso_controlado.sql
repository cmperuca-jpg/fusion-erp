begin;

create table if not exists public.fusion_support_operators (
  email_normalized text primary key,
  name text not null default '',
  role text not null default 'support_agent' check (role in ('support_admin','support_agent')),
  status text not null default 'active' check (status in ('active','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fusion_support_sessions (
  session_id text primary key,
  operator_email text not null references public.fusion_support_operators(email_normalized),
  operator_user_id text not null,
  home_tenant_id text not null,
  target_tenant_id text not null references public.fusion_tenants(tenant_id),
  reason text not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  source_ip text not null default '',
  user_agent text not null default ''
);

create table if not exists public.fusion_support_audit (
  id bigint generated always as identity primary key,
  session_id text not null references public.fusion_support_sessions(session_id) on delete cascade,
  operator_email text not null,
  target_tenant_id text not null,
  method text not null,
  path text not null,
  status_code integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fusion_support_sessions_operator_idx
  on public.fusion_support_sessions(operator_email, started_at desc);
create index if not exists fusion_support_sessions_target_idx
  on public.fusion_support_sessions(target_tenant_id, started_at desc);
create index if not exists fusion_support_sessions_active_idx
  on public.fusion_support_sessions(expires_at desc)
  where ended_at is null;
create index if not exists fusion_support_audit_session_idx
  on public.fusion_support_audit(session_id, created_at desc);
create index if not exists fusion_support_audit_target_idx
  on public.fusion_support_audit(target_tenant_id, created_at desc);

alter table public.fusion_support_operators enable row level security;
alter table public.fusion_support_sessions enable row level security;
alter table public.fusion_support_audit enable row level security;

revoke all on table public.fusion_support_operators from public, anon, authenticated;
revoke all on table public.fusion_support_sessions from public, anon, authenticated;
revoke all on table public.fusion_support_audit from public, anon, authenticated;

grant select, insert, update, delete on table public.fusion_support_operators to service_role;
grant select, insert, update, delete on table public.fusion_support_sessions to service_role;
grant select, insert, update, delete on table public.fusion_support_audit to service_role;

commit;
