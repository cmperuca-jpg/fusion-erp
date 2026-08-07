begin;

alter table public.fusion_tenants
  add column if not exists access_code text;

create or replace function public.fusion_generate_tenant_access_code_v1()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := 'FS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' || upper(substr(md5(clock_timestamp()::text || random()::text), 1, 4));
    exit when not exists (
      select 1 from public.fusion_tenants where access_code = v_code
    ) and not exists (
      select 1 from public.fusion_tenant_login_index where access_code = v_code
    );
  end loop;
  return v_code;
end;
$$;

revoke all on function public.fusion_generate_tenant_access_code_v1() from public, anon, authenticated;
grant execute on function public.fusion_generate_tenant_access_code_v1() to service_role;

update public.fusion_tenants
set access_code = public.fusion_generate_tenant_access_code_v1(),
    updated_at = now()
where access_code is null or trim(access_code) = '';

alter table public.fusion_tenants
  alter column access_code set not null;

create unique index if not exists fusion_tenants_access_code_uidx
  on public.fusion_tenants(access_code);

create index if not exists fusion_tenants_name_lower_idx
  on public.fusion_tenants(lower(name));

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
  v_tenant_access_code text := public.fusion_generate_tenant_access_code_v1();
  v_user_legacy_code text := public.fusion_generate_access_code_v1();
begin
  if coalesce(trim(p_tenant_id),'') = '' or p_tenant_id !~ '^[a-z0-9][a-z0-9_-]{1,79}$' then
    raise exception 'tenant_id inválido';
  end if;
  if coalesce(trim(p_slug),'') = '' or p_slug !~ '^[a-z0-9][a-z0-9_-]{1,79}$' then
    raise exception 'slug inválido';
  end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'nome da empresa obrigatório'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'e-mail do responsável inválido'; end if;
  if jsonb_typeof(p_admin_payload) <> 'object' then raise exception 'admin_payload inválido'; end if;

  perform pg_advisory_xact_lock(hashtext('fusion:tenant-create:' || v_email));

  if exists (select 1 from public.fusion_tenant_login_index where email_normalized = v_email) then
    raise exception 'e-mail já cadastrado';
  end if;

  insert into public.fusion_tenants (
    tenant_id, slug, name, legal_name, document,
    responsible_name, responsible_email, responsible_phone,
    status, plan_code, trial_ends_at, settings, access_code
  ) values (
    p_tenant_id, p_slug, trim(p_name), coalesce(trim(p_legal_name),''), coalesce(trim(p_document),''),
    coalesce(trim(p_responsible_name),''), v_email, coalesce(trim(p_responsible_phone),''),
    'trial', 'trial', now() + interval '14 days', jsonb_build_object('onboarding_version', 1), v_tenant_access_code
  );

  insert into public.fusion_tenant_login_index (
    email_normalized, tenant_id, user_id, profile, status, access_code
  ) values (
    v_email, p_tenant_id, v_user_id,
    coalesce(p_admin_payload->>'perfil','Administrador'),
    lower(coalesce(nullif(p_admin_payload->>'status',''),'ativo')),
    v_user_legacy_code
  );

  insert into public.fusion_v3_records (
    tenant_id, collection, record_id, payload, updated_at
  ) values (
    p_tenant_id,
    'usuarios',
    v_user_id,
    (p_admin_payload - 'codigoAcesso') || jsonb_build_object('id', v_user_id, 'tenantId', p_tenant_id, 'codigoAcademia', v_tenant_access_code),
    now()
  );

  insert into public.fusion_v4_operations(tenant_id, operation_id, collections)
  values (p_tenant_id, v_operation_id, '["usuarios"]'::jsonb)
  on conflict do nothing;

  insert into public.fusion_v4_audit(tenant_id, operation_id, collection, record_count)
  values (p_tenant_id, v_operation_id, 'usuarios', 1);

  return jsonb_build_object(
    'ok', true,
    'tenant_id', p_tenant_id,
    'slug', p_slug,
    'user_id', v_user_id,
    'access_code', v_tenant_access_code,
    'academy_access_code', v_tenant_access_code,
    'operation_id', v_operation_id
  );
end;
$$;

revoke all on function public.fusion_create_tenant_v1(text,text,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.fusion_create_tenant_v1(text,text,text,text,text,text,text,text,jsonb) to service_role;

commit;
