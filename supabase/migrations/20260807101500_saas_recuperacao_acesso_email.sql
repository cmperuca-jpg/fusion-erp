begin;

create table if not exists public.fusion_access_recovery_challenges (
  id text primary key,
  tenant_id text not null references public.fusion_tenants(tenant_id) on delete cascade,
  user_id text not null,
  email_normalized text not null,
  code_hash text not null,
  attempts integer not null default 0 check (attempts between 0 and 10),
  status text not null default 'pending' check (status in ('pending','verified','completed','delivery_failed','expired')),
  expires_at timestamptz not null,
  verified_at timestamptz,
  completed_at timestamptz,
  source_ip text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fusion_access_recovery_email_idx
  on public.fusion_access_recovery_challenges(email_normalized, created_at desc);
create index if not exists fusion_access_recovery_tenant_user_idx
  on public.fusion_access_recovery_challenges(tenant_id, user_id, created_at desc);
create index if not exists fusion_access_recovery_ip_idx
  on public.fusion_access_recovery_challenges(source_ip, created_at desc);
create index if not exists fusion_access_recovery_expires_idx
  on public.fusion_access_recovery_challenges(expires_at)
  where status in ('pending','verified');

alter table public.fusion_access_recovery_challenges enable row level security;
revoke all on table public.fusion_access_recovery_challenges from public, anon, authenticated;
grant select, insert, update, delete on table public.fusion_access_recovery_challenges to service_role;

commit;
