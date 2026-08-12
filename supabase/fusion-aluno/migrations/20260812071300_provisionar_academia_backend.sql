-- Fusion Aluno - provisionamento idempotente de academia a partir do tenant ERP.
-- PROJETO ALVO: Supabase do Fusion Aluno (não o banco fusion_v3_records do ERP).
-- Não contém IDs gerados nem dados de uma academia específica.

create or replace function public.fusion_provisionar_academia_backend(
  p_erp_tenant_id text,
  p_nome text,
  p_slug text default null::text,
  p_timezone text default 'America/Sao_Paulo'::text
)
returns table(
  academia_id uuid,
  erp_tenant_id text,
  academia_nome text,
  academia_slug text,
  criado boolean,
  vinculo_criado boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'fusion_private', 'extensions', 'pg_temp'
as $function$
declare
  v_tenant text := lower(trim(coalesce(p_erp_tenant_id, '')));
  v_nome text := trim(coalesce(p_nome, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_timezone text := trim(coalesce(p_timezone, 'America/Sao_Paulo'));
  v_academia_id uuid;
  v_academia_nome text;
  v_academia_slug text;
  v_mapeada_outro text;
  v_criado boolean := false;
  v_vinculo_criado boolean := false;
begin
  if v_tenant !~ '^[a-z0-9][a-z0-9_-]{1,79}$' then
    raise exception 'Tenant ERP inválido.' using errcode = '22023';
  end if;

  if char_length(v_nome) < 2 or char_length(v_nome) > 120 then
    raise exception 'Nome da academia deve ter entre 2 e 120 caracteres.' using errcode = '22023';
  end if;

  if v_slug = '' then
    v_slug := replace(v_tenant, '_', '-');
  end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Slug da academia inválido.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = v_timezone
  ) then
    raise exception 'Timezone inválido.' using errcode = '22023';
  end if;

  select m.academia_id, a.nome, a.slug
    into v_academia_id, v_academia_nome, v_academia_slug
  from fusion_private.erp_tenant_app_map m
  join public.academias a on a.id = m.academia_id
  where m.erp_tenant_id = v_tenant;

  if v_academia_id is not null then
    if v_academia_slug <> v_slug then
      raise exception 'Tenant ERP já vinculado a academia com outro slug.' using errcode = '23505';
    end if;
    return query
      select v_academia_id, v_tenant, v_academia_nome, v_academia_slug, false, false;
    return;
  end if;

  select a.id, a.nome, a.slug
    into v_academia_id, v_academia_nome, v_academia_slug
  from public.academias a
  where a.slug = v_slug;

  if v_academia_id is not null then
    select m.erp_tenant_id
      into v_mapeada_outro
    from fusion_private.erp_tenant_app_map m
    where m.academia_id = v_academia_id;

    if v_mapeada_outro is not null and v_mapeada_outro <> v_tenant then
      raise exception 'Academia já vinculada a outro tenant ERP.' using errcode = '23505';
    end if;
  else
    insert into public.academias (
      nome,
      slug,
      status,
      timezone,
      configuracoes
    )
    values (
      v_nome,
      v_slug,
      'ativa',
      v_timezone,
      jsonb_build_object('fonte', 'fusion-erp-provisionamento')
    )
    returning id, nome, slug
      into v_academia_id, v_academia_nome, v_academia_slug;

    v_criado := true;
  end if;

  insert into fusion_private.erp_tenant_app_map (
    erp_tenant_id,
    academia_id,
    criado_em,
    atualizado_em
  )
  values (
    v_tenant,
    v_academia_id,
    now(),
    now()
  )
  on conflict on constraint erp_tenant_app_map_pkey do nothing;

  if found then
    v_vinculo_criado := true;
  end if;

  return query
    select
      v_academia_id,
      v_tenant,
      v_academia_nome,
      v_academia_slug,
      v_criado,
      v_vinculo_criado;
end;
$function$;

revoke all on function public.fusion_provisionar_academia_backend(text, text, text, text)
  from public;
revoke all on function public.fusion_provisionar_academia_backend(text, text, text, text)
  from anon;
revoke all on function public.fusion_provisionar_academia_backend(text, text, text, text)
  from authenticated;

grant execute on function public.fusion_provisionar_academia_backend(text, text, text, text)
  to service_role;
