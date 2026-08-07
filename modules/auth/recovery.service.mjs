import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { executarComTenant, normalizarTenantId } from "../core/persistence/tenant-context.mjs";
import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";
import { enviarCodigoRecuperacao } from "./recovery-mail.service.mjs";

const BCRYPT_ROUNDS = Math.min(Math.max(Number(process.env.FUSION_BCRYPT_ROUNDS || 12), 10), 14);
const OTP_TTL_MIN = Math.min(Math.max(Number(process.env.FUSION_RECOVERY_OTP_MINUTES || 10), 5), 30);
const TOKEN_TTL_MIN = Math.min(Math.max(Number(process.env.FUSION_RECOVERY_TOKEN_MINUTES || 15), 5), 30);
const MAX_ATTEMPTS = 5;
const MAX_IP_15MIN = 5;
const MAX_USER_15MIN = 3;

function texto(v = "") { return String(v ?? "").trim(); }
function email(v = "") { return texto(v).toLowerCase(); }
function erro(message, status = 400, code = "") {
  return Object.assign(new Error(message), { status, code });
}

function segredo() {
  const value = texto(
    process.env.FUSION_RECOVERY_SECRET ||
    process.env.JWT_SECRET ||
    process.env.FUSION_JWT_SECRET
  );
  if (value.length < 32) {
    throw erro("Servidor sem segredo seguro para recuperação de acesso.", 503, "RECOVERY_SECRET_NOT_CONFIGURED");
  }
  return value;
}

function normalizarAcademia(v = "") {
  return normalizarTenantId(
    texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );
}

function mascararEmail(v = "") {
  const raw = email(v);
  const [local = "", domain = ""] = raw.split("@");
  if (!local || !domain) return "";
  const inicio = local.slice(0, Math.min(2, local.length));
  return `${inicio}${"*".repeat(Math.max(3, local.length - inicio.length))}@${domain}`;
}

function hashOtp(challengeId, codigo) {
  return crypto
    .createHmac("sha256", segredo())
    .update(`${challengeId}:${String(codigo || "")}`)
    .digest("hex");
}

function igualSeguro(a = "", b = "") {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

function gerarOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

async function localizarAcademia(supabase, valor = "") {
  const original = texto(valor);
  const slug = normalizarAcademia(original);
  if (!original || !slug) return null;

  const { data: porSlug, error: slugError } = await supabase
    .from("fusion_tenants")
    .select("tenant_id,slug,name,status")
    .or(`tenant_id.eq.${slug},slug.eq.${slug}`)
    .limit(2);

  if (slugError) throw erro(`Falha ao localizar academia: ${slugError.message}`, 500);
  if (Array.isArray(porSlug) && porSlug.length === 1) return porSlug[0];
  if (Array.isArray(porSlug) && porSlug.length > 1) return null;

  const { data: porNome, error: nomeError } = await supabase
    .from("fusion_tenants")
    .select("tenant_id,slug,name,status")
    .ilike("name", original)
    .limit(2);

  if (nomeError) throw erro(`Falha ao localizar academia: ${nomeError.message}`, 500);
  return Array.isArray(porNome) && porNome.length === 1 ? porNome[0] : null;
}

async function localizarIdentidade(academia, enderecoEmail) {
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const tenant = await localizarAcademia(supabase, academia);
  if (!tenant || !["active", "trial"].includes(String(tenant.status || "").toLowerCase())) {
    return null;
  }

  const mail = email(enderecoEmail);
  const { data: indice, error } = await supabase
    .from("fusion_tenant_login_index")
    .select("tenant_id,user_id,profile,status,access_code")
    .eq("tenant_id", tenant.tenant_id)
    .eq("email_normalized", mail)
    .maybeSingle();

  if (error) throw erro(`Falha ao localizar usuário: ${error.message}`, 500);
  if (!indice || String(indice.status || "").toLowerCase() !== "ativo") return null;

  return { tenant, indice, email: mail };
}

async function contarRecentes(supabase, filtros = {}) {
  const desde = new Date(Date.now() - 15 * 60_000).toISOString();
  let query = supabase
    .from("fusion_access_recovery_challenges")
    .select("id", { count: "exact", head: true })
    .gte("created_at", desde);

  for (const [campo, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && String(valor) !== "") query = query.eq(campo, valor);
  }

  const { count, error } = await query;
  if (error) throw erro(`Falha ao validar limite de recuperação: ${error.message}`, 500);
  return Number(count || 0);
}

async function marcarExpirados(supabase) {
  await supabase
    .from("fusion_access_recovery_challenges")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .in("status", ["pending", "verified"])
    .lt("expires_at", new Date().toISOString());
}

export async function iniciarRecuperacao(payload = {}, contexto = {}) {
  const academia = texto(payload.academia || payload.empresa);
  const enderecoEmail = email(payload.email);
  if (academia.length < 2) throw erro("Informe o nome da academia.");
  if (!enderecoEmail || !enderecoEmail.includes("@")) throw erro("Informe o e-mail cadastrado.");

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  await marcarExpirados(supabase);

  const ip = texto(contexto.ip).slice(0, 120);
  if (ip && await contarRecentes(supabase, { source_ip: ip }) >= MAX_IP_15MIN) {
    throw erro("Muitas solicitações de recuperação. Aguarde alguns minutos e tente novamente.", 429);
  }

  const identidade = await localizarIdentidade(academia, enderecoEmail);

  /*
   * Resposta genérica para não revelar se academia/e-mail existem.
   * Se não houver identidade, retorna um requestId falso e não envia mensagem.
   */
  if (!identidade) {
    return {
      ok: true,
      enviado: true,
      requestId: `rec_${crypto.randomUUID()}`,
      destino: mascararEmail(enderecoEmail),
      expiraMinutos: OTP_TTL_MIN,
      mensagem: "Se os dados estiverem corretos, enviaremos um código de verificação para o e-mail cadastrado."
    };
  }

  const recentesUsuario = await contarRecentes(supabase, {
    tenant_id: identidade.tenant.tenant_id,
    user_id: identidade.indice.user_id
  });
  if (recentesUsuario >= MAX_USER_15MIN) {
    throw erro("Aguarde alguns minutos antes de solicitar outro código.", 429);
  }

  const challengeId = `rec_${crypto.randomUUID()}`;
  const codigo = gerarOtp();
  const agora = new Date();
  const expira = new Date(agora.getTime() + OTP_TTL_MIN * 60_000);

  const registro = {
    id: challengeId,
    tenant_id: identidade.tenant.tenant_id,
    user_id: String(identidade.indice.user_id),
    email_normalized: identidade.email,
    code_hash: hashOtp(challengeId, codigo),
    attempts: 0,
    status: "pending",
    expires_at: expira.toISOString(),
    source_ip: ip,
    user_agent: texto(contexto.userAgent).slice(0, 500),
    created_at: agora.toISOString(),
    updated_at: agora.toISOString()
  };

  const { error: insertError } = await supabase
    .from("fusion_access_recovery_challenges")
    .insert(registro);

  if (insertError) throw erro(`Falha ao criar recuperação: ${insertError.message}`, 500);

  try {
    await enviarCodigoRecuperacao({
      destinatario: identidade.email,
      codigo,
      academia: identidade.tenant.name,
      expiraMinutos: OTP_TTL_MIN
    });
  } catch (deliveryError) {
    await supabase
      .from("fusion_access_recovery_challenges")
      .update({
        status: "delivery_failed",
        updated_at: new Date().toISOString()
      })
      .eq("id", challengeId);
    throw deliveryError;
  }

  return {
    ok: true,
    enviado: true,
    requestId: challengeId,
    destino: mascararEmail(identidade.email),
    expiraMinutos: OTP_TTL_MIN,
    mensagem: "Código de verificação enviado."
  };
}

function gerarTokenRecuperacao(challenge = {}) {
  return jwt.sign(
    {
      purpose: "fusion_access_recovery",
      challengeId: challenge.id,
      tenantId: challenge.tenant_id,
      userId: challenge.user_id,
      email: challenge.email_normalized
    },
    segredo(),
    { expiresIn: `${TOKEN_TTL_MIN}m` }
  );
}

function verificarTokenRecuperacao(token = "") {
  try {
    const payload = jwt.verify(texto(token), segredo());
    if (payload?.purpose !== "fusion_access_recovery") throw new Error("purpose");
    return payload;
  } catch {
    throw erro("A autorização de recuperação expirou. Solicite um novo código.", 401);
  }
}

export async function confirmarRecuperacao(payload = {}) {
  const requestId = texto(payload.requestId || payload.id);
  const codigo = texto(payload.codigo).replace(/\D/g, "").slice(0, 6);
  if (!requestId || codigo.length !== 6) throw erro("Informe o código de 6 dígitos.");

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data: challenge, error } = await supabase
    .from("fusion_access_recovery_challenges")
    .select("id,tenant_id,user_id,email_normalized,code_hash,attempts,status,expires_at")
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw erro(`Falha ao validar recuperação: ${error.message}`, 500);
  if (!challenge || challenge.status !== "pending") {
    throw erro("Código inválido ou expirado.", 400);
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await supabase
      .from("fusion_access_recovery_challenges")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", requestId);
    throw erro("Código expirado. Solicite um novo.", 400);
  }

  if (Number(challenge.attempts || 0) >= MAX_ATTEMPTS) {
    await supabase
      .from("fusion_access_recovery_challenges")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", requestId);
    throw erro("Número máximo de tentativas atingido. Solicite um novo código.", 429);
  }

  const esperado = hashOtp(requestId, codigo);
  if (!igualSeguro(esperado, challenge.code_hash)) {
    const novasTentativas = Number(challenge.attempts || 0) + 1;
    await supabase
      .from("fusion_access_recovery_challenges")
      .update({
        attempts: novasTentativas,
        status: novasTentativas >= MAX_ATTEMPTS ? "expired" : "pending",
        updated_at: new Date().toISOString()
      })
      .eq("id", requestId);
    throw erro(
      novasTentativas >= MAX_ATTEMPTS
        ? "Número máximo de tentativas atingido. Solicite um novo código."
        : "Código de verificação incorreto.",
      novasTentativas >= MAX_ATTEMPTS ? 429 : 400
    );
  }

  const verificadoEm = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("fusion_access_recovery_challenges")
    .update({
      status: "verified",
      verified_at: verificadoEm,
      updated_at: verificadoEm
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (updateError) throw erro(`Falha ao confirmar recuperação: ${updateError.message}`, 500);

  const [{ data: indice, error: indiceError }, { data: tenant, error: tenantError }] = await Promise.all([
    supabase
      .from("fusion_tenant_login_index")
      .select("tenant_id,user_id,profile,status,access_code")
      .eq("tenant_id", challenge.tenant_id)
      .eq("user_id", challenge.user_id)
      .maybeSingle(),
    supabase
      .from("fusion_tenants")
      .select("tenant_id,slug,name,status")
      .eq("tenant_id", challenge.tenant_id)
      .maybeSingle()
  ]);

  if (indiceError) throw erro(`Falha ao consultar acesso: ${indiceError.message}`, 500);
  if (tenantError) throw erro(`Falha ao consultar academia: ${tenantError.message}`, 500);
  if (!indice?.access_code || !tenant) throw erro("Acesso não encontrado.", 404);

  return {
    ok: true,
    recoveryToken: gerarTokenRecuperacao(challenge),
    tenantId: challenge.tenant_id,
    academia: { nome: tenant.name, slug: tenant.slug },
    perfil: indice.profile,
    codigoAcesso: String(indice.access_code).toUpperCase(),
    mensagem: "Identidade confirmada."
  };
}

export async function redefinirSenhaRecuperacao(payload = {}) {
  const token = texto(payload.recoveryToken || payload.token);
  const senha = String(payload.senha || payload.novaSenha || "");
  if (senha.length < 10) throw erro("A nova senha deve ter pelo menos 10 caracteres.");

  const auth = verificarTokenRecuperacao(token);
  const supabase = obterSupabaseAdmin({ obrigatorio: true });

  const { data: challenge, error } = await supabase
    .from("fusion_access_recovery_challenges")
    .select("id,tenant_id,user_id,email_normalized,status,expires_at,verified_at,completed_at")
    .eq("id", auth.challengeId)
    .maybeSingle();

  if (error) throw erro(`Falha ao validar autorização: ${error.message}`, 500);
  if (
    !challenge ||
    challenge.status !== "verified" ||
    challenge.completed_at ||
    String(challenge.tenant_id) !== String(auth.tenantId) ||
    String(challenge.user_id) !== String(auth.userId)
  ) {
    throw erro("Esta recuperação não está mais disponível.", 401);
  }

  const senhaHash = await bcrypt.hash(senha, BCRYPT_ROUNDS);

  await executarComTenant(challenge.tenant_id, async () => {
    const usuarios = await lerJsonDuravel("usuarios.json", []);
    const lista = Array.isArray(usuarios) ? usuarios : [];
    const idx = lista.findIndex(u => String(u.id) === String(challenge.user_id));
    if (idx < 0) throw erro("Usuário não encontrado na academia.", 404);

    lista[idx] = {
      ...lista[idx],
      senhaHash,
      trocarSenhaNoPrimeiroAcesso: false,
      atualizadoEm: new Date().toISOString()
    };
    delete lista[idx].senhaAcesso;
    delete lista[idx].senhaPortal;
    delete lista[idx].senhaBcrypt;
    delete lista[idx].senhaHashLegado;

    await salvarJsonDuravel("usuarios.json", lista);
  });

  const concluidoEm = new Date().toISOString();
  const { error: finishError } = await supabase
    .from("fusion_access_recovery_challenges")
    .update({
      status: "completed",
      completed_at: concluidoEm,
      updated_at: concluidoEm
    })
    .eq("id", challenge.id)
    .eq("status", "verified");

  if (finishError) throw erro(`Senha alterada, mas houve falha ao concluir a recuperação: ${finishError.message}`, 500);

  return {
    ok: true,
    tenantId: challenge.tenant_id,
    mensagem: "Senha alterada com sucesso."
  };
}
