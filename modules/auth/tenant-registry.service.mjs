import crypto from "node:crypto";
import { DATABASE_CONFIG } from "../../config/database.config.mjs";
import { obterPostgresPool } from "../../config/postgres.mjs";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { normalizarTenantId } from "../core/persistence/tenant-context.mjs";

function texto(valor) { return String(valor ?? "").trim(); }
function emailNormalizado(valor) { return texto(valor).toLowerCase(); }
function usarPostgres() { return DATABASE_CONFIG.provider === "postgres"; }

async function gerarCodigoAcessoSupabase(supabase) {
  const { data, error } = await supabase.rpc("fusion_generate_access_code_v1");
  if (error) throw new Error(`Falha ao gerar código de acesso: ${error.message}`);
  const codigo = texto(data).toUpperCase();
  if (!codigo) throw new Error("O banco não retornou um código de acesso.");
  return codigo;
}

async function gerarCodigoAcessoPostgres(client) {
  for (let i = 0; i < 64; i += 1) {
    const codigo = crypto.randomBytes(4).toString("hex").toUpperCase();
    const { rows } = await client.query(
      `SELECT 1
         FROM (
           SELECT access_code FROM public.fusion_tenant_login_index
           UNION ALL
           SELECT access_code FROM public.fusion_tenants
         ) codigos
        WHERE upper(access_code) = $1
        LIMIT 1`,
      [codigo]
    );
    if (!rows.length) return codigo;
  }
  throw new Error("Não foi possível gerar um código de acesso único.");
}

export async function localizarTenantPorEmail(email) {
  const normalizado = emailNormalizado(email);
  if (!normalizado) return null;

  if (usarPostgres()) {
    const db = obterPostgresPool({ obrigatorio: true });
    const { rows } = await db.query(
      `SELECT tenant_id,user_id,profile,status
         FROM public.fusion_tenant_login_index
        WHERE email_normalized = $1
        LIMIT 1`,
      [normalizado]
    );
    const data = rows[0] || null;
    return data ? { ...data, tenant_id: normalizarTenantId(data.tenant_id) } : null;
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from("fusion_tenant_login_index")
    .select("tenant_id,user_id,profile,status")
    .eq("email_normalized", normalizado)
    .maybeSingle();

  if (error) throw new Error(`Falha ao localizar empresa do usuário: ${error.message}`);
  return data ? { ...data, tenant_id: normalizarTenantId(data.tenant_id) } : null;
}

export async function validarEmailDisponivel(
  email,
  { tenantId = "", userId = "" } = {}
) {
  const normalizado = emailNormalizado(email);
  if (!normalizado) return true;

  let data = null;

  if (usarPostgres()) {
    const db = obterPostgresPool({ obrigatorio: true });
    const { rows } = await db.query(
      `SELECT tenant_id,user_id
         FROM public.fusion_tenant_login_index
        WHERE email_normalized = $1
        LIMIT 1`,
      [normalizado]
    );
    data = rows[0] || null;
  } else {
    const supabase = obterSupabaseAdmin({ obrigatorio: true });
    const resultado = await supabase
      .from("fusion_tenant_login_index")
      .select("tenant_id,user_id")
      .eq("email_normalized", normalizado)
      .maybeSingle();

    if (resultado.error) {
      throw new Error(`Falha ao validar disponibilidade do e-mail: ${resultado.error.message}`);
    }
    data = resultado.data || null;
  }

  if (!data) return true;

  const mesmoUsuario =
    normalizarTenantId(data.tenant_id) === normalizarTenantId(tenantId) &&
    String(data.user_id) === String(userId || "");

  if (mesmoUsuario) return true;

  throw Object.assign(
    new Error("Este e-mail já está vinculado a outro usuário ou empresa."),
    { status: 409 }
  );
}

export async function sincronizarIndiceUsuario(usuario = {}, tenantId = "") {
  const email = emailNormalizado(usuario.email);
  const tenant = normalizarTenantId(tenantId);
  if (!email || !tenant || !usuario.id) return null;

  if (usarPostgres()) {
    const db = obterPostgresPool({ obrigatorio: true });
    const client = await db.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`login:${email}`]);

      const existenteResult = await client.query(
        `SELECT tenant_id,user_id,access_code
           FROM public.fusion_tenant_login_index
          WHERE email_normalized = $1
          LIMIT 1`,
        [email]
      );

      const existente = existenteResult.rows[0] || null;

      if (
        existente &&
        (
          String(existente.tenant_id) !== tenant ||
          String(existente.user_id) !== String(usuario.id)
        )
      ) {
        throw Object.assign(
          new Error("Este e-mail já está vinculado a outro usuário ou empresa."),
          { status: 409 }
        );
      }

      const accessCode =
        texto(existente?.access_code).toUpperCase() ||
        await gerarCodigoAcessoPostgres(client);

      const { rows } = await client.query(
        `INSERT INTO public.fusion_tenant_login_index
          (email_normalized,tenant_id,user_id,profile,status,access_code,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,now())
         ON CONFLICT (email_normalized)
         DO UPDATE SET
           tenant_id = EXCLUDED.tenant_id,
           user_id = EXCLUDED.user_id,
           profile = EXCLUDED.profile,
           status = EXCLUDED.status,
           access_code = EXCLUDED.access_code,
           updated_at = now()
         RETURNING tenant_id,user_id,profile,status,access_code`,
        [
          email,
          tenant,
          String(usuario.id),
          texto(usuario.perfil),
          texto(usuario.status || "ativo").toLowerCase(),
          accessCode
        ]
      );

      await client.query("COMMIT");
      return rows[0];
    } catch (erro) {
      try { await client.query("ROLLBACK"); } catch {}
      throw erro;
    } finally {
      client.release();
    }
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data: existente, error: consultaErro } = await supabase
    .from("fusion_tenant_login_index")
    .select("tenant_id,user_id,access_code")
    .eq("email_normalized", email)
    .maybeSingle();

  if (consultaErro) throw new Error(`Falha ao validar índice de login: ${consultaErro.message}`);

  if (
    existente &&
    (
      String(existente.tenant_id) !== tenant ||
      String(existente.user_id) !== String(usuario.id)
    )
  ) {
    throw Object.assign(
      new Error("Este e-mail já está vinculado a outro usuário ou empresa."),
      { status: 409 }
    );
  }

  const accessCode =
    texto(existente?.access_code).toUpperCase() ||
    await gerarCodigoAcessoSupabase(supabase);

  const registro = {
    email_normalized: email,
    tenant_id: tenant,
    user_id: String(usuario.id),
    profile: texto(usuario.perfil),
    status: texto(usuario.status || "ativo").toLowerCase(),
    access_code: accessCode,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("fusion_tenant_login_index")
    .upsert(registro, { onConflict: "email_normalized" })
    .select("tenant_id,user_id,profile,status,access_code")
    .single();

  if (error) throw new Error(`Falha ao atualizar índice de login: ${error.message}`);
  return data || registro;
}

export async function removerIndiceUsuario(usuario = {}) {
  const email = emailNormalizado(usuario.email);
  if (!email) return;

  if (usarPostgres()) {
    const db = obterPostgresPool({ obrigatorio: true });
    await db.query(
      "DELETE FROM public.fusion_tenant_login_index WHERE email_normalized = $1",
      [email]
    );
    return;
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { error } = await supabase
    .from("fusion_tenant_login_index")
    .delete()
    .eq("email_normalized", email);

  if (error) throw new Error(`Falha ao remover índice de login: ${error.message}`);
}

export async function obterCodigoAcessoUsuario(usuario = {}, tenantId = "") {
  const tenant = normalizarTenantId(tenantId);
  const userId = texto(usuario.id || usuario.userId);
  const mail = emailNormalizado(usuario.email);
  if (!tenant || (!userId && !mail)) return null;

  if (usarPostgres()) {
    const db = obterPostgresPool({ obrigatorio: true });
    const params = [tenant, userId || mail];
    const filtro = userId ? "i.user_id = $2" : "i.email_normalized = $2";

    const { rows } = await db.query(
      `SELECT
         i.tenant_id,i.user_id,i.profile,i.status,i.access_code,
         t.slug,t.name,t.status AS tenant_status
       FROM public.fusion_tenant_login_index i
       LEFT JOIN public.fusion_tenants t ON t.tenant_id = i.tenant_id
       WHERE i.tenant_id = $1 AND ${filtro}
       LIMIT 1`,
      params
    );

    const data = rows[0];
    if (!data) return null;

    return {
      tenantId: tenant,
      academia: {
        nome: data.name || tenant,
        slug: data.slug || tenant,
        status: data.tenant_status || ""
      },
      usuarioId: data.user_id,
      perfil: data.profile,
      status: data.status,
      codigoAcesso: texto(data.access_code).toUpperCase()
    };
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  let query = supabase
    .from("fusion_tenant_login_index")
    .select("tenant_id,user_id,profile,status,access_code")
    .eq("tenant_id", tenant);

  query = userId ? query.eq("user_id", userId) : query.eq("email_normalized", mail);

  const { data: indice, error } = await query.maybeSingle();
  if (error) throw new Error(`Falha ao consultar código de acesso: ${error.message}`);
  if (!indice) return null;

  const { data: empresa, error: empresaErro } = await supabase
    .from("fusion_tenants")
    .select("tenant_id,slug,name,status")
    .eq("tenant_id", tenant)
    .maybeSingle();

  if (empresaErro) throw new Error(`Falha ao consultar academia: ${empresaErro.message}`);

  return {
    tenantId: tenant,
    academia: {
      nome: empresa?.name || tenant,
      slug: empresa?.slug || tenant,
      status: empresa?.status || ""
    },
    usuarioId: indice.user_id,
    perfil: indice.profile,
    status: indice.status,
    codigoAcesso: texto(indice.access_code).toUpperCase()
  };
}

export async function regenerarCodigoAcessoUsuario(usuario = {}, tenantId = "") {
  const tenant = normalizarTenantId(tenantId);
  const userId = texto(usuario.id || usuario.userId);

  if (!tenant || !userId) {
    throw Object.assign(new Error("Usuário ou academia não identificados."), { status: 400 });
  }

  if (usarPostgres()) {
    const db = obterPostgresPool({ obrigatorio: true });
    const client = await db.connect();

    try {
      await client.query("BEGIN");
      const novoCodigo = await gerarCodigoAcessoPostgres(client);
      const { rows } = await client.query(
        `UPDATE public.fusion_tenant_login_index
            SET access_code = $1,
                updated_at = now()
          WHERE tenant_id = $2
            AND user_id = $3
        RETURNING tenant_id,user_id,profile,status,access_code`,
        [novoCodigo, tenant, userId]
      );

      if (!rows.length) {
        throw Object.assign(new Error("Código de acesso do usuário não encontrado."), { status: 404 });
      }

      await client.query("COMMIT");
    } catch (erro) {
      try { await client.query("ROLLBACK"); } catch {}
      throw erro;
    } finally {
      client.release();
    }

    return obterCodigoAcessoUsuario({ id: userId }, tenant);
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const novoCodigo = await gerarCodigoAcessoSupabase(supabase);

  const { data, error } = await supabase
    .from("fusion_tenant_login_index")
    .update({ access_code: novoCodigo, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenant)
    .eq("user_id", userId)
    .select("tenant_id,user_id,profile,status,access_code")
    .maybeSingle();

  if (error) throw new Error(`Falha ao regenerar código de acesso: ${error.message}`);
  if (!data) {
    throw Object.assign(new Error("Código de acesso do usuário não encontrado."), { status: 404 });
  }

  return obterCodigoAcessoUsuario({ id: userId }, tenant);
}

export async function localizarAcessoPorEmpresaCodigo(empresa = "", codigo = "") {
  const empresaTexto = texto(empresa);
  const codigoTexto = texto(codigo).toUpperCase();
  if (!empresaTexto || !codigoTexto) return null;

  const slug = normalizarTenantId(
    empresaTexto.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );

  if (usarPostgres()) {
    const db = obterPostgresPool({ obrigatorio: true });
    let tenant = null;

    if (slug) {
      const { rows } = await db.query(
        `SELECT tenant_id,slug,name,status
           FROM public.fusion_tenants
          WHERE tenant_id = $1 OR slug = $1
          LIMIT 2`,
        [slug]
      );
      if (rows.length === 1) tenant = rows[0];
    }

    if (!tenant) {
      const { rows } = await db.query(
        `SELECT tenant_id,slug,name,status
           FROM public.fusion_tenants
          WHERE lower(name) = lower($1)
          LIMIT 2`,
        [empresaTexto]
      );
      if (rows.length === 1) tenant = rows[0];
    }

    if (!tenant?.tenant_id) return null;
    if (!["active", "trial"].includes(String(tenant.status || "").toLowerCase())) return null;

    const { rows } = await db.query(
      `SELECT tenant_id,user_id,profile,status,access_code
         FROM public.fusion_tenant_login_index
        WHERE tenant_id = $1
          AND upper(access_code) = $2
        LIMIT 1`,
      [tenant.tenant_id, codigoTexto]
    );

    const indice = rows[0];
    if (!indice) return null;

    return {
      ...indice,
      tenant_id: normalizarTenantId(indice.tenant_id),
      tenant_name: tenant.name,
      tenant_slug: tenant.slug
    };
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  let tenant = null;

  if (slug) {
    const { data, error } = await supabase
      .from("fusion_tenants")
      .select("tenant_id,slug,name,status")
      .or(`tenant_id.eq.${slug},slug.eq.${slug}`)
      .maybeSingle();

    if (error) throw new Error(`Falha ao localizar academia: ${error.message}`);
    tenant = data || null;
  }

  if (!tenant) {
    const { data, error } = await supabase
      .from("fusion_tenants")
      .select("tenant_id,slug,name,status")
      .ilike("name", empresaTexto)
      .limit(2);

    if (error) throw new Error(`Falha ao localizar academia: ${error.message}`);
    if (Array.isArray(data) && data.length === 1) tenant = data[0];
  }

  if (!tenant?.tenant_id) return null;
  if (!["active", "trial"].includes(String(tenant.status || "").toLowerCase())) return null;

  const { data: indice, error: indiceErro } = await supabase
    .from("fusion_tenant_login_index")
    .select("tenant_id,user_id,profile,status,access_code")
    .eq("tenant_id", tenant.tenant_id)
    .eq("access_code", codigoTexto)
    .maybeSingle();

  if (indiceErro) throw new Error(`Falha ao validar código de acesso: ${indiceErro.message}`);
  if (!indice) return null;

  return {
    ...indice,
    tenant_id: normalizarTenantId(indice.tenant_id),
    tenant_name: tenant.name,
    tenant_slug: tenant.slug
  };
}
