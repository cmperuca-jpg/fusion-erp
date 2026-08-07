begin;

create table if not exists public.fusion_tenants (
  tenant_id text primary key,
  slug text not null unique,
  name text not null,
  legal_name text not null default '',
  document text not null default '',
  responsible_name text not null default '',
  responsible_email text not null default '',
  responsible_phone text not null default '',
  status text not null default 'trial' check (status in ('trial','active','suspended','cancelled')),
  plan_code text not null default 'trial',
  trial_ends_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fusion_tenants_id_format check (tenant_id ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  constraint fusion_tenants_slug_format check (slug ~ '^[a-z0-9][a-z0-9_-]{1,79}$')
);

create table if not exists public.fusion_tenant_login_index (
  email_normalized text primary key,
  tenant_id text not null references public.fusion_tenants(tenant_id) on delete cascade,
  user_id text not null,
  profile text not null default '',
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists fusion_tenants_status_idx on public.fusion_tenants(status, created_at desc);
create index if not exists fusion_tenant_login_tenant_idx on public.fusion_tenant_login_index(tenant_id, status);

alter table public.fusion_tenants enable row level security;
alter table public.fusion_tenant_login_index enable row level security;
revoke all on table public.fusion_tenants from public, anon, authenticated;
revoke all on table public.fusion_tenant_login_index from public, anon, authenticated;
grant select, insert, update, delete on table public.fusion_tenants to service_role;
grant select, insert, update, delete on table public.fusion_tenant_login_index to service_role;

insert into public.fusion_tenants (tenant_id, slug, name, status, plan_code, settings)
values ('academia-piloto','academia-piloto','Academia atual','active','legacy',jsonb_build_object('migrated_from_single_tenant', true))
on conflict (tenant_id) do nothing;

insert into public.fusion_tenant_login_index (email_normalized, tenant_id, user_id, profile, status)
select lower(trim(payload->>'email')), tenant_id,
       coalesce(nullif(payload->>'id',''), record_id),
       coalesce(payload->>'perfil',''),
       lower(coalesce(nullif(payload->>'status',''),'ativo'))
from public.fusion_v3_records
where collection='usuarios' and coalesce(trim(payload->>'email'),'') <> ''
on conflict (email_normalized) do nothing;

create or replace function public.fusion_create_tenant_v1(
  p_tenant_id text,
  p_slug text,
  p_name text,
  p_legal_name text,
  p_document text,
  p_responsible_name text,
  p_responsible_email text,
  p_responsible_phone text,
  p_admin_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_responsible_email,'')));
  v_user_id text := coalesce(nullif(p_admin_payload->>'id',''), 'usr_' || md5(random()::text || clock_timestamp()::text));
  v_operation_id text := 'tenant-bootstrap-' || p_tenant_id || '-' || extract(epoch from clock_timestamp())::bigint;
begin
  if coalesce(trim(p_tenant_id),'') = '' or p_tenant_id !~ '^[a-z0-9][a-z0-9_-]{1,79}$' then raise exception 'tenant_id inválido'; end if;
  if coalesce(trim(p_slug),'') = '' or p_slug !~ '^[a-z0-9][a-z0-9_-]{1,79}$' then raise exception 'slug inválido'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'nome da empresa obrigatório'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'e-mail do responsável inválido'; end if;
  if jsonb_typeof(p_admin_payload) <> 'object' then raise exception 'admin_payload inválido'; end if;

  perform pg_advisory_xact_lock(hashtext('fusion:tenant-create:' || v_email));
  if exists (select 1 from public.fusion_tenant_login_index where email_normalized = v_email) then raise exception 'e-mail já cadastrado'; end if;

  insert into public.fusion_tenants (
    tenant_id, slug, name, legal_name, document, responsible_name, responsible_email,
    responsible_phone, status, plan_code, trial_ends_at, settings
  ) values (
    p_tenant_id, p_slug, trim(p_name), coalesce(trim(p_legal_name),''), coalesce(trim(p_document),''),
    coalesce(trim(p_responsible_name),''), v_email, coalesce(trim(p_responsible_phone),''),
    'trial','trial',now()+interval '14 days',jsonb_build_object('onboarding_version',1)
  );

  insert into public.fusion_tenant_login_index (email_normalized, tenant_id, user_id, profile, status)
  values (v_email,p_tenant_id,v_user_id,coalesce(p_admin_payload->>'perfil','Administrador'),lower(coalesce(nullif(p_admin_payload->>'status',''),'ativo')));

  insert into public.fusion_v3_records (tenant_id, collection, record_id, payload, updated_at)
  values (p_tenant_id,'usuarios',v_user_id,p_admin_payload || jsonb_build_object('id',v_user_id,'tenantId',p_tenant_id),now());

  insert into public.fusion_v4_operations(tenant_id, operation_id, collections)
  values (p_tenant_id,v_operation_id,'["usuarios"]'::jsonb) on conflict do nothing;

  insert into public.fusion_v4_audit(tenant_id, operation_id, collection, record_count)
  values (p_tenant_id,v_operation_id,'usuarios',1);

  return jsonb_build_object('ok',true,'tenant_id',p_tenant_id,'slug',p_slug,'user_id',v_user_id,'operation_id',v_operation_id);
end;
$$;

revoke all on function public.fusion_create_tenant_v1(text,text,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.fusion_create_tenant_v1(text,text,text,text,text,text,text,text,jsonb) to service_role;

commit;
