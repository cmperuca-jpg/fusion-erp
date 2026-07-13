create table if not exists public.access_bridge_commands (
  id text primary key,
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
create table if not exists public.access_bridge_agents (
  agent_id text primary key,
  last_seen_at timestamptz not null default now(),
  status text not null default 'online',
  details jsonb not null default '{}'::jsonb
);
alter table public.access_bridge_commands enable row level security;
alter table public.access_bridge_agents enable row level security;
-- Não crie políticas públicas. O backend usa exclusivamente SUPABASE_SERVICE_ROLE_KEY.
