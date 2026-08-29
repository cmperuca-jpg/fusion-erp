import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { DATABASE_CONFIG } from "../../config/database.config.mjs";
import { obterPostgresPool } from "../../config/postgres.mjs";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { normalizarTenantId } from "../core/persistence/tenant-context.mjs";

const SELECTION_TTL_MIN = Math.min(Math.max(Number(process.env.FUSION_TENANT_SELECTION_MINUTES || 20), 5), 60);
const DEVICE_BINDING_DAYS = Math.min(Math.max(Number(process.env.FUSION_TENANT_DEVICE_DAYS || 180), 7), 365);
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 12;
const tentativas = new Map();

function texto(v = "") { return String(v ?? "").trim(); }
function normalizarAcademia(v = "") {
  return normalizarTenantId(texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}
function erro(message, status = 400) { return Object.assign(new Error(message), { status }); }
function usarPostgres() { return DATABASE_CONFIG.provider === "postgres"; }

function segredoSelecao() {
  const value = texto(
    process.env.FUSION_TENANT_SELECTION_SECRET ||
    process.env.JWT_SECRET ||
    process.env.FUSION_JWT_SECRET
  );
  if (value.length < 32) {
    throw erro("Servidor sem segredo seguro para selecionar a academia.", 503);
  }
  return value;
}

function chaveTentativa(contexto = {}) {
  return texto(contexto.ip || "unknown").slice(0, 120) || "unknown";
}

function consumirTentativa(contexto = {}) {
  const key = chaveTentativa(contexto);
  const now = Date.now();
  let item = tentativas.get(key);
  if (!item || now - item.startedAt > WINDOW_MS) item = { count: 0, startedAt: now };
  item.count += 1;
  tentativas.set(key, item);
  if (item.count > MAX_ATTEMPTS) {
    throw erro("Muitas tentativas de seleção de academia. Aguarde alguns minutos e tente novamente.", 429);
  }
}

function limparTentativas(contexto = {}) {
  tentativas.delete(chaveTentativa(contexto));
}

async function localizarAcademia(valor = "") {
  const original = texto(valor);
  const slug = normalizarAcademia(original);
  if (!original || !slug) return null;

  if (usarPostgres()) {
    const db = obterPostgresPool({ obrigatorio: true });
    const { rows: porSlug } = await db.query(
      `SELECT tenant_id,slug,name,status,access_code
         FROM public.fusion_tenants
        WHERE tenant_id = $1 OR slug = $1
        LIMIT 2`,
      [slug]
    );

    if (porSlug.length === 1) return porSlug[0];
    if (porSlug.length > 1) return null;

    const { rows: porNome } = await db.query(
      `SELECT tenant_id,slug,name,status,access_code
         FROM public.fusion_tenants
        WHERE lower(name) = lower($1)
        LIMIT 2`,
      [original]
    );

    return porNome.length === 1 ? porNome[0] : null;
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });

  const { data: porSlug, error: slugError } = await supabase
    .from("fusion_tenants")
    .select("tenant_id,slug,name,status,access_code")
    .or(`tenant_id.eq.${slug},slug.eq.${slug}`)
    .limit(2);

  if (slugError) throw erro(`Falha ao localizar academia: ${slugError.message}`, 500);
  if (Array.isArray(porSlug) && porSlug.length === 1) return porSlug[0];
  if (Array.isArray(porSlug) && porSlug.length > 1) return null;

  const { data: porNome, error: nomeError } = await supabase
    .from("fusion_tenants")
    .select("tenant_id,slug,name,status,access_code")
    .ilike("name", original)
    .limit(2);

  if (nomeError) throw erro(`Falha ao localizar academia: ${nomeError.message}`, 500);
  return Array.isArray(porNome) && porNome.length === 1 ? porNome[0] : null;
}

async function tenantPorId(tenantId) {
  const tenant = normalizarTenantId(tenantId);
  if (!tenant) return null;

  if (usarPostgres()) {
    const db = obterPostgresPool({ obrigatorio: true });
    const { rows } = await db.query(
      `SELECT tenant_id,slug,name,status,access_code
         FROM public.fusion_tenants
        WHERE tenant_id = $1
        LIMIT 1`,
      [tenant]
    );
    return rows[0] || null;
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from("fusion_tenants")
    .select("tenant_id,slug,name,status,access_code")
    .eq("tenant_id", tenant)
    .maybeSingle();

  if (error) throw erro(`Falha ao consultar academia: ${error.message}`, 500);
  return data || null;
}

async function gerarCodigoAcademiaPostgres(client) {
  for (let i = 0; i < 64; i += 1) {
    const codigo = crypto.randomBytes(4).toString("hex").toUpperCase();
    const { rows } = await client.query(
      `SELECT 1
         FROM (
           SELECT access_code FROM public.fusion_tenants
           UNION ALL
           SELECT access_code FROM public.fusion_tenant_login_index
         ) codigos
        WHERE upper(access_code) = $1
        LIMIT 1`,
      [codigo]
    );
    if (!rows.length) return codigo;
  }
  throw erro("Não foi possível gerar um novo código da academia.", 500);
}

function criarTokenSelecao(tenant = {}) {
  return jwt.sign(
    {
      purpose: "fusion_tenant_selection",
      tenantId: normalizarTenantId(tenant.tenant_id),
      academiaNome: texto(tenant.name),
      academiaSlug: texto(tenant.slug)
    },
    segredoSelecao(),
    { expiresIn: `${SELECTION_TTL_MIN}m` }
  );
}

function fingerprintVinculo(tenant = {}) {
  return crypto
    .createHmac("sha256", segredoSelecao())
    .update([
      "fusion-device-binding",
      normalizarTenantId(tenant.tenant_id),
      texto(tenant.access_code).toUpperCase()
    ].join("|"))
    .digest("hex");
}

function criarTokenVinculo(tenant = {}) {
  return jwt.sign(
    {
      purpose: "fusion_tenant_device_binding",
      tenantId: normalizarTenantId(tenant.tenant_id),
      academiaNome: texto(tenant.name),
      academiaSlug: texto(tenant.slug),
      accessFingerprint: fingerprintVinculo(tenant)
    },
    segredoSelecao(),
    { expiresIn: `${DEVICE_BINDING_DAYS}d` }
  );
}

function saidaSelecao(tenant = {}) {
  return {
    ok: true,
    tenantId: normalizarTenantId(tenant.tenant_id),
    selectionToken: criarTokenSelecao(tenant),
    expiraMinutos: SELECTION_TTL_MIN,
    deviceBindingToken: criarTokenVinculo(tenant),
    bindingExpiraDias: DEVICE_BINDING_DAYS,
    academia: {
      nome: tenant.name,
      slug: tenant.slug,
      status: tenant.status
    }
  };
}

export function validarTokenSelecaoAcademia(token = "", tenantEsperado = "") {
  let payload;
  try {
    payload = jwt.verify(texto(token), segredoSelecao());
  } catch {
    throw erro("A seleção da academia expirou. Volte e informe o código da academia novamente.", 401);
  }

  if (payload?.purpose !== "fusion_tenant_selection" || !payload?.tenantId) {
    throw erro("Seleção da academia inválida.", 401);
  }

  const tenant = normalizarTenantId(payload.tenantId);
  const esperado = normalizarTenantId(tenantEsperado);
  if (esperado && tenant !== esperado) {
    throw erro("A seleção pertence a outra academia. Volte e selecione a academia novamente.", 401);
  }

  return { ...payload, tenantId: tenant };
}

export async function validarTokenVinculoDispositivo(token = "", tenantEsperado = "") {
  let payload;
  try {
    payload = jwt.verify(texto(token), segredoSelecao());
  } catch {
    throw erro("O vínculo deste aparelho com a academia expirou.", 401);
  }

  if (
    payload?.purpose !== "fusion_tenant_device_binding" ||
    !payload?.tenantId ||
    !payload?.accessFingerprint
  ) {
    throw erro("Vínculo do aparelho inválido.", 401);
  }

  const tenantId = normalizarTenantId(payload.tenantId);
  const esperado = normalizarTenantId(tenantEsperado);
  if (esperado && tenantId !== esperado) {
    throw erro("Este aparelho está vinculado a outra academia.", 401);
  }

  const tenant = await tenantPorId(tenantId);
  const status = String(tenant?.status || "").toLowerCase();
  if (!tenant || !["active", "trial"].includes(status)) {
    throw erro("A academia deste aparelho não está disponível.", 401);
  }

  const esperadoFingerprint = fingerprintVinculo(tenant);
  const atual = Buffer.from(String(payload.accessFingerprint));
  const correto = Buffer.from(esperadoFingerprint);

  if (atual.length !== correto.length || !crypto.timingSafeEqual(atual, correto)) {
    throw erro("O vínculo deste aparelho foi revogado. Informe o código da academia novamente.", 401);
  }

  return { payload, tenant };
}

export async function selecionarAcademiaComVinculo(payload = {}) {
  const token = texto(payload.deviceBindingToken || payload.bindingToken || payload.token);
  const academia = texto(payload.tenant || payload.tenantId || payload.academia);

  if (!token || !academia) {
    throw erro("Vínculo do aparelho ou academia ausente.", 400);
  }

  const { tenant } = await validarTokenVinculoDispositivo(token, academia);
  return saidaSelecao(tenant);
}

export async function selecionarAcademia(payload = {}, contexto = {}) {
  consumirTentativa(contexto);

  const academia = texto(payload.academia || payload.empresa);
  const codigo = texto(payload.codigo || payload.codigoAcesso).toUpperCase();

  if (academia.length < 2 || !codigo) {
    throw erro("Informe a academia e o código da academia.");
  }

  const tenant = await localizarAcademia(academia);
  const status = String(tenant?.status || "").toLowerCase();

  if (
    !tenant ||
    !["active", "trial"].includes(status) ||
    texto(tenant.access_code).toUpperCase() !== codigo
  ) {
    throw erro("Academia ou código da academia inválidos.", 401);
  }

  limparTentativas(contexto);
  return saidaSelecao(tenant);
}

export async function obterCodigoAcademia(tenantId = "") {
  const tenantIdNormalizado = normalizarTenantId(tenantId);
  if (!tenantIdNormalizado) throw erro("Academia não identificada.", 400);

  const data = await tenantPorId(tenantIdNormalizado);
  if (!data) throw erro("Academia não encontrada.", 404);

  return {
    tenantId: tenantIdNormalizado,
    academia: { nome: data.name, slug: data.slug, status: data.status },
    codigoAcesso: texto(data.access_code).toUpperCase()
  };
}

export async function regenerarCodigoAcademia(tenantId = "") {
  const tenant = normalizarTenantId(tenantId);
  if (!tenant) throw erro("Academia não identificada.", 400);

  if (usarPostgres()) {
    const db = obterPostgresPool({ obrigatorio: true });
    const client = await db.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`tenant-code:${tenant}`]);

      const codigo = await gerarCodigoAcademiaPostgres(client);
      const { rowCount } = await client.query(
        `UPDATE public.fusion_tenants
            SET access_code = $1,
                updated_at = now()
          WHERE tenant_id = $2`,
        [codigo, tenant]
      );

      if (!rowCount) throw erro("Academia não encontrada.", 404);
      await client.query("COMMIT");
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }

    return obterCodigoAcademia(tenant);
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data: novoCodigo, error: codigoError } = await supabase.rpc(
    "fusion_generate_tenant_access_code_v1"
  );

  if (codigoError) {
    throw erro(`Falha ao gerar novo código da academia: ${codigoError.message}`, 500);
  }

  const codigo = texto(novoCodigo).toUpperCase();
  if (!codigo) throw erro("O banco não retornou um novo código da academia.", 500);

  const { error } = await supabase
    .from("fusion_tenants")
    .update({ access_code: codigo, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenant);

  if (error) throw erro(`Falha ao atualizar código da academia: ${error.message}`, 500);

  return obterCodigoAcademia(tenant);
}
