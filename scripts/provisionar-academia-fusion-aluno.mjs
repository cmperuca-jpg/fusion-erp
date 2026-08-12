import fs from "node:fs";
import path from "node:path";

function carregarEnvLocal() {
  const arquivo = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(arquivo)) return;
  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(arquivo);
      return;
    } catch {}
  }
}

carregarEnvLocal();

function argumento(nome) {
  const prefixo = `--${nome}=`;
  const item = process.argv.find((arg) => arg.startsWith(prefixo));
  return item ? item.slice(prefixo.length).trim() : "";
}

function flag(nome) {
  return process.argv.includes(`--${nome}`);
}

function erro(mensagem, codigo = 1) {
  console.error(`[Provisionamento] ${mensagem}`);
  process.exitCode = codigo;
}

function normalizarTenant(valor) {
  const tenant = String(valor || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(tenant)) {
    throw new Error("Tenant inválido. Use 2 a 80 caracteres: letras minúsculas, números, _ ou -.");
  }
  return tenant;
}

function normalizarSlug(valor, tenant) {
  const slug = String(valor || tenant.replace(/_/g, "-")).trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Slug inválido. Use letras minúsculas, números e hífen.");
  }
  return slug;
}

function normalizarNome(valor) {
  const nome = String(valor || "").trim();
  if (nome.length < 2 || nome.length > 120) {
    throw new Error("Nome da academia deve ter entre 2 e 120 caracteres.");
  }
  return nome;
}

function normalizarTimezone(valor) {
  const timezone = String(valor || "America/Sao_Paulo").trim();
  if (!timezone || timezone.length > 100 || !/^[A-Za-z0-9_+\-/]+$/.test(timezone)) {
    throw new Error("Timezone inválido.");
  }
  return timezone;
}

function configAppSupabase() {
  const url = String(process.env.FUSION_APP_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const serviceKey = String(
    process.env.FUSION_APP_SUPABASE_SECRET_KEY ||
    process.env.FUSION_APP_SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();

  if (!url || !serviceKey) {
    throw new Error(
      "Configure FUSION_APP_SUPABASE_URL e FUSION_APP_SUPABASE_SECRET_KEY (ou SERVICE_ROLE_KEY)."
    );
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("FUSION_APP_SUPABASE_URL inválida.");
  }

  const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new Error("A URL do Fusion Aluno precisa usar HTTPS (HTTP é aceito apenas em localhost).");
  }

  return { url, serviceKey };
}

async function chamarProvisionamento(payload) {
  const { url, serviceKey } = configAppSupabase();
  const headers = {
    apikey: serviceKey,
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  // Chaves service_role JWT legadas também usam Bearer.
  // Chaves sb_secret_* autenticam pelo apikey e não devem ser tratadas como JWT.
  if (serviceKey.split(".").length === 3) {
    headers.Authorization = `Bearer ${serviceKey}`;
  }

  let response;
  try {
    response = await fetch(
      `${url}/rest/v1/rpc/fusion_provisionar_academia_backend`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      }
    );
  } catch {
    throw new Error("Não foi possível conectar ao Supabase do Fusion Aluno.");
  }

  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = raw; }
  }

  if (!response.ok) {
    const mensagem =
      (data && typeof data === "object" && (data.message || data.error || data.hint)) ||
      (typeof data === "string" && data) ||
      `HTTP ${response.status}`;
    throw new Error(`Provisionamento recusado: ${mensagem}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.academia_id || !row?.erp_tenant_id) {
    throw new Error("O Supabase não retornou um vínculo de academia válido.");
  }
  return row;
}

async function main() {
  try {
    const tenant = normalizarTenant(argumento("tenant"));
    const nome = normalizarNome(argumento("nome"));
    const slug = normalizarSlug(argumento("slug"), tenant);
    const timezone = normalizarTimezone(argumento("timezone"));
    const aplicar = flag("apply");
    const confirmacao = argumento("confirmar");

    const plano = {
      tenant,
      nome,
      slug,
      timezone,
      app: "Fusion Aluno",
      operacao: aplicar ? "provisionar" : "dry-run"
    };

    if (!aplicar) {
      console.log(JSON.stringify({
        ok: true,
        modo: "dry-run",
        alteracoes: 0,
        plano,
        proximoPasso:
          "Revise os dados. Para aplicar: adicione --apply --confirmar=PROVISIONAR-ACADEMIA."
      }, null, 2));
      return;
    }

    if (confirmacao !== "PROVISIONAR-ACADEMIA") {
      throw new Error(
        "Aplicação bloqueada. Use --confirmar=PROVISIONAR-ACADEMIA junto com --apply."
      );
    }

    const resultado = await chamarProvisionamento({
      p_erp_tenant_id: tenant,
      p_nome: nome,
      p_slug: slug,
      p_timezone: timezone
    });

    console.log(JSON.stringify({
      ok: true,
      modo: "apply",
      tenant: resultado.erp_tenant_id,
      academia: {
        id: resultado.academia_id,
        nome: resultado.academia_nome,
        slug: resultado.academia_slug
      },
      criado: resultado.criado === true,
      vinculoCriado: resultado.vinculo_criado === true,
      idempotente:
        resultado.criado !== true && resultado.vinculo_criado !== true
    }, null, 2));
  } catch (e) {
    erro(e?.message || "Falha no provisionamento.");
  }
}

await main();
