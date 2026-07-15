begin;

alter table public.fusion_v3_records add column if not exists tenant_id text;
update public.fusion_v3_records set tenant_id = 'academia-piloto' where tenant_id is null or tenant_id = '';
alter table public.fusion_v3_records alter column tenant_id set default 'academia-piloto';
alter table public.fusion_v3_records alter column tenant_id set not null;
alter table public.fusion_v3_records drop constraint if exists fusion_v3_records_pkey;
alter table public.fusion_v3_records add primary key (tenant_id, collection, record_id);
create index if not exists fusion_v3_records_tenant_collection_idx on public.fusion_v3_records(tenant_id, collection);

create table if not exists public.fusion_v4_operations (
  tenant_id text not null,
  operation_id text not null,
  collections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, operation_id)
);

create table if not exists public.fusion_v4_audit (
  id bigint generated always as identity primary key,
  tenant_id text not null,
  operation_id text not null,
  collection text not null,
  record_count integer not null,
  created_at timestamptz not null default now()
);
create index if not exists fusion_v4_audit_tenant_created_idx on public.fusion_v4_audit(tenant_id, created_at desc);

alter table public.fusion_v4_operations enable row level security;
alter table public.fusion_v4_audit enable row level security;

create or replace function public.fusion_replace_collections(
  p_tenant_id text,
  p_collections jsonb,
  p_operation_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  registro jsonb;
  registro_id text;
  total integer := 0;
  inseriu integer := 0;
begin
  if coalesce(trim(p_tenant_id), '') = '' then raise exception 'tenant_id obrigatório'; end if;
  if coalesce(trim(p_operation_id), '') = '' then raise exception 'operation_id obrigatório'; end if;
  if jsonb_typeof(p_collections) <> 'object' then raise exception 'collections deve ser um objeto JSON'; end if;

  perform pg_advisory_xact_lock(hashtext('fusion:' || p_tenant_id));
  insert into public.fusion_v4_operations(tenant_id, operation_id, collections)
  values (p_tenant_id, p_operation_id, coalesce((select jsonb_agg(key) from jsonb_each(p_collections)), '[]'::jsonb))
  on conflict do nothing;
  get diagnostics inseriu = row_count;
  if inseriu = 0 then
    return jsonb_build_object('ok', true, 'duplicada', true, 'operation_id', p_operation_id);
  end if;

  for item in select key, value from jsonb_each(p_collections) loop
    if item.key !~ '^[a-z0-9_-]+$' then raise exception 'coleção inválida: %', item.key; end if;
    if jsonb_typeof(item.value) <> 'array' then raise exception 'coleção % deve ser uma lista', item.key; end if;
    delete from public.fusion_v3_records where tenant_id = p_tenant_id and collection = item.key;
    for registro in select value from jsonb_array_elements(item.value) loop
      registro_id := coalesce(nullif(registro->>'id',''), nullif(registro->>'uuid',''), nullif(registro->>'codigo',''), md5(registro::text));
      insert into public.fusion_v3_records(tenant_id, collection, record_id, payload, updated_at)
      values (p_tenant_id, item.key, registro_id, registro || jsonb_build_object('id', registro_id), now());
      total := total + 1;
    end loop;
    insert into public.fusion_v4_audit(tenant_id, operation_id, collection, record_count)
    values (p_tenant_id, p_operation_id, item.key, jsonb_array_length(item.value));
  end loop;
  return jsonb_build_object('ok', true, 'duplicada', false, 'operation_id', p_operation_id, 'registros', total);
end;
$$;

revoke all on function public.fusion_replace_collections(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.fusion_replace_collections(text, jsonb, text) to service_role;

commit;
