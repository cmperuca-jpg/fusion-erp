create table if not exists public.access_bridge_commands (
  id text primary key,
  tenant_id text not null,
  agent_id text not null,
  equipment_id text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending','processing','completed','failed','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  error text
);
create index if not exists access_bridge_commands_agent_status_idx on public.access_bridge_commands(agent_id,status,created_at);
create index if not exists access_bridge_commands_tenant_agent_status_idx on public.access_bridge_commands(tenant_id, agent_id, status, created_at);
create table if not exists public.access_bridge_agents (
  agent_id text primary key,
  tenant_id text,
  equipment_ids text[] not null default array[]::text[],
  token_hash text,
  token_expires_at timestamptz,
  token_rotated_at timestamptz,
  disabled_at timestamptz,
  last_seen_at timestamptz not null default now(),
  status text not null default 'online',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_bridge_agents_token_hash_format check (token_hash is null or token_hash ~ '^[a-f0-9]{64}$'),
  constraint access_bridge_agents_tenant_format check (tenant_id is null or tenant_id ~ '^[a-z0-9][a-z0-9_-]{1,79}$')
);
alter table public.access_bridge_commands add column if not exists tenant_id text;
update public.access_bridge_commands set tenant_id = 'academia-piloto' where tenant_id is null or tenant_id = '';
alter table public.access_bridge_commands alter column tenant_id set not null;
alter table public.access_bridge_agents add column if not exists tenant_id text;
alter table public.access_bridge_agents add column if not exists equipment_ids text[] not null default array[]::text[];
alter table public.access_bridge_agents add column if not exists token_hash text;
alter table public.access_bridge_agents add column if not exists token_expires_at timestamptz;
alter table public.access_bridge_agents add column if not exists token_rotated_at timestamptz;
alter table public.access_bridge_agents add column if not exists disabled_at timestamptz;
alter table public.access_bridge_agents add column if not exists created_at timestamptz not null default now();
alter table public.access_bridge_agents add column if not exists updated_at timestamptz not null default now();
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'access_bridge_commands_tenant_format') then
    alter table public.access_bridge_commands
      add constraint access_bridge_commands_tenant_format check (tenant_id ~ '^[a-z0-9][a-z0-9_-]{1,79}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'access_bridge_agents_token_hash_format') then
    alter table public.access_bridge_agents
      add constraint access_bridge_agents_token_hash_format check (token_hash is null or token_hash ~ '^[a-f0-9]{64}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'access_bridge_agents_tenant_format') then
    alter table public.access_bridge_agents
      add constraint access_bridge_agents_tenant_format check (tenant_id is null or tenant_id ~ '^[a-z0-9][a-z0-9_-]{1,79}$');
  end if;
end $$;
create index if not exists access_bridge_agents_tenant_idx on public.access_bridge_agents(tenant_id, agent_id);
alter table public.access_bridge_commands enable row level security;
alter table public.access_bridge_agents enable row level security;
revoke all on table public.access_bridge_commands from public, anon, authenticated;
revoke all on table public.access_bridge_agents from public, anon, authenticated;
grant select, insert, update, delete on table public.access_bridge_commands to service_role;
grant select, insert, update, delete on table public.access_bridge_agents to service_role;

insert into public.access_bridge_agents (agent_id, tenant_id, equipment_ids, status, details)
values (
  'academia-piloto-agent-01',
  'academia-piloto',
  array['catraca-piloto-01']::text[],
  'offline',
  jsonb_build_object(
    'equipmentId', 'catraca-piloto-01',
    'isolatedTurnstile', true,
    'requiresTokenHashOrEnvToken', true
  )
)
on conflict (agent_id) do update
set tenant_id = excluded.tenant_id,
    equipment_ids = excluded.equipment_ids,
    details = coalesce(public.access_bridge_agents.details, '{}'::jsonb) || excluded.details,
    updated_at = now();
-- Nao crie politicas publicas. O backend usa exclusivamente SUPABASE_SERVICE_ROLE_KEY.
-- token_hash deve ser SHA-256 hexadecimal do token do agente, nunca o token claro.
