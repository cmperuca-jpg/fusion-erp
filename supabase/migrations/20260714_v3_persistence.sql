create table if not exists public.fusion_v3_records (
  collection text not null,
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, record_id)
);
create index if not exists fusion_v3_records_collection_idx on public.fusion_v3_records(collection);
alter table public.fusion_v3_records enable row level security;
comment on table public.fusion_v3_records is 'Persistência JSONB compatível da transição Fusion ERP 3.0. Acesso exclusivo pelo backend com service_role.';
