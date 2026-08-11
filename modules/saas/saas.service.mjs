import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { executarComTenant, normalizarTenantId } from "../core/persistence/tenant-context.mjs";
import { selecionarAcademia } from "../auth/academy-access.service.mjs";
import {
  enviarCodigoAtivacaoAcademia,
  enviarAcademiaAtivada
} from "./signup-mail.service.mjs";

const BCRYPT_ROUNDS = Math.min(Math.max(Number(process.env.FUSION_BCRYPT_ROUNDS || 12), 10), 14);
const OTP_TTL_MIN = Math.min(Math.max(Number(process.env.FUSION_SIGNUP_OTP_MINUTES || 10), 5), 30);
const MAX_ATTEMPTS = 5;
const MAX_IP_15MIN = 6;
const MAX_EMAIL_15MIN = 3;
const CHALLENGE_TABLE = "fusion_tenant_signup_challenges";

function texto(v){ return String(v ?? "").trim(); }
function normalizarDocumento(v){ return texto(v).replace(/\D/g, ""); }
function emailNormalizado(v){ return texto(v).toLowerCase(); }
function slugBase(v){
  return normalizarTenantId(String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}
function erro(msg,status=400,codigo=""){
  return Object.assign(new Error(msg),{status,codigo});
}

function todosIguais(valor = "") {
  return valor && [...valor].every(c => c === valor[0]);
}

function cpfValido(valor = "") {
  const cpf = normalizarDocumento(valor);
  if (cpf.length !== 11 || todosIguais(cpf)) return false;

  const calcular = tamanho => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(cpf[i]) * (tamanho + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcular(9) === Number(cpf[9]) && calcular(10) === Number(cpf[10]);
}

function cnpjValido(valor = "") {
  const cnpj = normalizarDocumento(valor);
  if (cnpj.length !== 14 || todosIguais(cnpj)) return false;

  function digito(base, pesos) {
    const soma = base.reduce((total, n, i) => total + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  const nums = [...cnpj];
  const d1 = digito(nums.slice(0,12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const d2 = digito(nums.slice(0,12).concat(String(d1)), [6,5,4,3,2,9,8,7,6,5,4,3,2]);

  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

function validar(payload={}) {
  const nomeEmpresa = texto(payload.nomeEmpresa || payload.nome).replace(/\s+/g, " ");
  const razaoSocial = texto(payload.razaoSocial).replace(/\s+/g, " ");
  const documento = normalizarDocumento(payload.documento || payload.cnpj || payload.cpf);
  const responsavel = texto(payload.responsavel || payload.nomeResponsavel).replace(/\s+/g, " ");
  const email = emailNormalizado(payload.email);
  const telefone = texto(payload.telefone || payload.whatsapp);
  const senha = String(payload.senha || "");

  if (nomeEmpresa.length < 2) throw erro("Informe o nome da academia/empresa.");
  if (![11,14].includes(documento.length)) throw erro("Informe um CPF ou CNPJ válido.");
  if (documento.length === 11 && !cpfValido(documento)) throw erro("O CPF informado é inválido.");
  if (documento.length === 14 && !cnpjValido(documento)) throw erro("O CNPJ informado é inválido.");
  if (documento.length === 14 && razaoSocial.length < 2) {
    throw erro("Informe a razão social para cadastro com CNPJ.");
  }
  if (responsavel.length < 2) throw erro("Informe o nome do responsável.");
  if (!email.includes("@") || email.length < 5) throw erro("Informe um e-mail válido.");
  if (senha.length < 10) throw erro("A senha deve ter pelo menos 10 caracteres.");

  return { nomeEmpresa, razaoSocial, documento, responsavel, email, telefone, senha };
}

function mascararEmail(v = "") {
  const raw = emailNormalizado(v);
  const [local = "", domain = ""] = raw.split("@");
  if (!local || !domain) return "";
  const inicio = local.slice(0, Math.min(2, local.length));
  return `${inicio}${"*".repeat(Math.max(3, local.length - inicio.length))}@${domain}`;
}

function segredo() {
  const value = texto(
    process.env.FUSION_SIGNUP_SECRET ||
    process.env.FUSION_RECOVERY_SECRET ||
    process.env.JWT_SECRET ||
    process.env.FUSION_JWT_SECRET
  );
  if (value.length < 32) {
    throw erro("Servidor sem segredo seguro para ativação de novas academias.",503,"SIGNUP_SECRET_NOT_CONFIGURED");
  }
  return value;
}

function gerarOtp() {
  return String(crypto.randomInt(0,1_000_000)).padStart(6,"0");
}

function hashOtp(requestId,codigo) {
  return crypto
    .createHmac("sha256",segredo())
    .update(`${requestId}:${String(codigo || "")}`)
    .digest("hex");
}

function igualSeguro(a="",b="") {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa,bb);
}

async function tenantDisponivel(base) {
  const supabase = obterSupabaseAdmin({ obrigatorio:true });
  for (let i=0;i<20;i++) {
    const sufixo = i ? `-${i+1}` : "";
    const tenant = `${base}${sufixo}`.slice(0,80);
    const { data,error } = await supabase
      .from("fusion_tenants")
      .select("tenant_id")
      .eq("tenant_id",tenant)
      .maybeSingle();
    if (error) throw erro(`Falha ao validar identificação da empresa: ${error.message}`,500);
    if (!data) return tenant;
  }
  return `${base}-${crypto.randomBytes(3).toString("hex")}`.slice(0,80);
}

async function consultarDuplicidade(d) {
  const supabase = obterSupabaseAdmin({ obrigatorio:true });

  const consultas = [
    supabase.from("fusion_tenants").select("tenant_id").eq("document",d.documento).limit(1),
    supabase.from("fusion_tenants").select("tenant_id").ilike("name",d.nomeEmpresa).limit(1),
    supabase.from("fusion_tenants").select("tenant_id").ilike("responsible_email",d.email).limit(1),
    supabase.from("fusion_tenant_login_index").select("tenant_id").eq("email_normalized",d.email).limit(1)
  ];

  if (d.razaoSocial) {
    consultas.push(
      supabase.from("fusion_tenants").select("tenant_id").ilike("legal_name",d.razaoSocial).limit(1)
    );
  }

  const resultados = await Promise.all(consultas);
  for (const resultado of resultados) {
    if (resultado.error) {
      throw erro(`Falha ao verificar cadastro existente: ${resultado.error.message}`,500);
    }
    if (Array.isArray(resultado.data) && resultado.data.length) return true;
  }
  return false;
}

async function exigirDadosDisponiveis(d) {
  if (await consultarDuplicidade(d)) {
    throw erro(
      "Já existe uma academia ou usuário vinculado a estes dados. Use “Entrar na academia” ou a recuperação de acesso.",
      409,
      "SIGNUP_DUPLICATE"
    );
  }
}

async function marcarExpirados(supabase) {
  await supabase
    .from(CHALLENGE_TABLE)
    .update({status:"expired",updated_at:new Date().toISOString()})
    .eq("status","pending")
    .lt("expires_at",new Date().toISOString());
}

async function contarRecentes(supabase,filtros={}) {
  const desde = new Date(Date.now()-15*60_000).toISOString();
  let query = supabase
    .from(CHALLENGE_TABLE)
    .select("id",{count:"exact",head:true})
    .gte("created_at",desde);

  for (const [campo,valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && String(valor) !== "") {
      query = query.eq(campo,valor);
    }
  }

  const {count,error} = await query;
  if (error) throw erro(`Falha ao validar limite de cadastro: ${error.message}`,500);
  return Number(count || 0);
}

async function validarLimite(supabase,d,contexto={}) {
  const ip = texto(contexto.ip).slice(0,120);

  if (ip && await contarRecentes(supabase,{source_ip:ip}) >= MAX_IP_15MIN) {
    throw erro("Muitas solicitações de cadastro. Aguarde alguns minutos e tente novamente.",429);
  }

  if (await contarRecentes(supabase,{email_normalized:d.email}) >= MAX_EMAIL_15MIN) {
    throw erro("Aguarde alguns minutos antes de solicitar outro código para este e-mail.",429);
  }
}

async function cancelarPendentesAnteriores(supabase,d) {
  const agora = new Date().toISOString();

  await Promise.all([
    supabase.from(CHALLENGE_TABLE)
      .update({status:"cancelled",updated_at:agora})
      .eq("status","pending")
      .eq("email_normalized",d.email),

    supabase.from(CHALLENGE_TABLE)
      .update({status:"cancelled",updated_at:agora})
      .eq("status","pending")
      .eq("document_normalized",d.documento)
  ]);
}

export async function iniciarCadastroEmpresa(payload={},contexto={}) {
  const d = validar(payload);
  const supabase = obterSupabaseAdmin({ obrigatorio:true });

  await marcarExpirados(supabase);
  await exigirDadosDisponiveis(d);
  await validarLimite(supabase,d,contexto);
  await cancelarPendentesAnteriores(supabase,d);

  const requestId = `signup_${crypto.randomUUID()}`;
  const codigo = gerarOtp();
  const agora = new Date();
  const expira = new Date(agora.getTime()+OTP_TTL_MIN*60_000);
  const senhaHash = await bcrypt.hash(d.senha,BCRYPT_ROUNDS);
  const userId = `usr_${crypto.randomUUID()}`;

  const dadosSeguros = {
    nomeEmpresa:d.nomeEmpresa,
    razaoSocial:d.razaoSocial,
    documento:d.documento,
    responsavel:d.responsavel,
    email:d.email,
    telefone:d.telefone,
    senhaHash,
    userId
  };

  const registro = {
    id:requestId,
    email_normalized:d.email,
    document_normalized:d.documento,
    academy_name:d.nomeEmpresa,
    legal_name:d.razaoSocial,
    payload:dadosSeguros,
    code_hash:hashOtp(requestId,codigo),
    status:"pending",
    attempts:0,
    expires_at:expira.toISOString(),
    source_ip:texto(contexto.ip).slice(0,120),
    user_agent:texto(contexto.userAgent).slice(0,500),
    created_at:agora.toISOString(),
    updated_at:agora.toISOString()
  };

  const {error:insertError} = await supabase.from(CHALLENGE_TABLE).insert(registro);
  if (insertError) throw erro(`Não foi possível preparar a ativação: ${insertError.message}`,500);

  try {
    await enviarCodigoAtivacaoAcademia({
      destinatario:d.email,
      codigo,
      academia:d.nomeEmpresa,
      responsavel:d.responsavel,
      expiraMinutos:OTP_TTL_MIN
    });

    await supabase.from(CHALLENGE_TABLE).update({
      delivered_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).eq("id",requestId);
  } catch (deliveryError) {
    await supabase.from(CHALLENGE_TABLE).update({
      status:"delivery_failed",
      updated_at:new Date().toISOString()
    }).eq("id",requestId);
    throw deliveryError;
  }

  return {
    ok:true,
    etapa:"confirmar_email",
    requestId,
    destino:mascararEmail(d.email),
    expiraMinutos:OTP_TTL_MIN,
    mensagem:"Enviamos um código de 6 dígitos para confirmar o e-mail. A academia ainda não foi criada."
  };
}

export async function reenviarCodigoCadastroEmpresa(payload={},contexto={}) {
  const requestId = texto(payload.requestId || payload.id);
  if (!requestId) throw erro("Solicitação de cadastro inválida.");

  const supabase = obterSupabaseAdmin({ obrigatorio:true });
  await marcarExpirados(supabase);

  const {data:challenge,error} = await supabase
    .from(CHALLENGE_TABLE)
    .select("id,email_normalized,academy_name,payload,status,expires_at,source_ip")
    .eq("id",requestId)
    .maybeSingle();

  if (error) throw erro(`Falha ao localizar ativação: ${error.message}`,500);
  if (!challenge || !["pending","delivery_failed"].includes(challenge.status)) {
    throw erro("Esta solicitação não está mais disponível. Preencha o cadastro novamente.",400);
  }

  if (await contarRecentes(supabase,{email_normalized:challenge.email_normalized}) >= MAX_EMAIL_15MIN) {
    throw erro("Aguarde alguns minutos antes de solicitar outro código.",429);
  }

  const codigo = gerarOtp();
  const expira = new Date(Date.now()+OTP_TTL_MIN*60_000);

  const {error:updateError} = await supabase.from(CHALLENGE_TABLE).update({
    code_hash:hashOtp(requestId,codigo),
    attempts:0,
    status:"pending",
    expires_at:expira.toISOString(),
    source_ip:texto(contexto.ip).slice(0,120) || challenge.source_ip || "",
    user_agent:texto(contexto.userAgent).slice(0,500),
    updated_at:new Date().toISOString()
  }).eq("id",requestId);

  if (updateError) throw erro(`Falha ao renovar código: ${updateError.message}`,500);

  await enviarCodigoAtivacaoAcademia({
    destinatario:challenge.email_normalized,
    codigo,
    academia:challenge.academy_name,
    responsavel:challenge.payload?.responsavel || "",
    expiraMinutos:OTP_TTL_MIN
  });

  await supabase.from(CHALLENGE_TABLE).update({
    delivered_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  }).eq("id",requestId);

  return {
    ok:true,
    requestId,
    destino:mascararEmail(challenge.email_normalized),
    expiraMinutos:OTP_TTL_MIN,
    mensagem:"Novo código enviado."
  };
}

async function criarEmpresaConfirmada(d,contexto={}) {
  const base = slugBase(d.nomeEmpresa) || `empresa-${Date.now()}`;
  const tenantId = await tenantDisponivel(base);
  const agora = new Date().toISOString();

  const adminPayload = {
    id:d.userId,
    nome:d.responsavel,
    email:d.email,
    senhaHash:d.senhaHash,
    perfil:"Administrador",
    status:"ativo",
    permissoes:["*"],
    trocarSenhaNoPrimeiroAcesso:false,
    criadoEm:agora,
    atualizadoEm:agora
  };

  const supabase = obterSupabaseAdmin({ obrigatorio:true });
  const {data,error} = await supabase.rpc("fusion_create_tenant_v1",{
    p_tenant_id:tenantId,
    p_slug:tenantId,
    p_name:d.nomeEmpresa,
    p_legal_name:d.razaoSocial,
    p_document:d.documento,
    p_responsible_name:d.responsavel,
    p_responsible_email:d.email,
    p_responsible_phone:d.telefone,
    p_admin_payload:adminPayload
  });

  if (error) {
    const duplicado = /e-mail já cadastrado/i.test(error.message || "");
    throw erro(
      duplicado ? "Já existe uma empresa vinculada a estes dados." : `Não foi possível criar a empresa: ${error.message}`,
      duplicado ? 409 : 500
    );
  }

  const codigoAcesso = texto(data?.access_code || data?.codigo_acesso).toUpperCase();
  if (!codigoAcesso) throw erro("O banco não retornou o código interno da academia.",500);

  const selecao = await selecionarAcademia({academia:tenantId,codigoAcesso},contexto);

  enviarAcademiaAtivada({
    destinatario:d.email,
    academia:d.nomeEmpresa,
    codigoAcesso,
    responsavel:d.responsavel
  }).catch(error => {
    console.error("[SaaS] Academia criada, mas e-mail final não foi entregue:",error.message);
  });

  return executarComTenant(tenantId,async()=>({
    ok:true,
    tenantId,
    slug:tenantId,
    usuarioId:d.userId,
    empresa:{nome:d.nomeEmpresa,status:"trial",trialDias:14},
    selectionToken:selecao.selectionToken,
    selectionExpiraMinutos:selecao.expiraMinutos,
    deviceBindingToken:selecao.deviceBindingToken,
    bindingExpiraDias:selecao.bindingExpiraDias,
    academia:selecao.academia,
    mensagem:"E-mail confirmado. Academia criada e pronta para a configuração inicial."
  }));
}

export async function confirmarCadastroEmpresa(payload={},contexto={}) {
  const requestId = texto(payload.requestId || payload.id);
  const codigo = texto(payload.codigo).replace(/\D/g,"").slice(0,6);
  if (!requestId || codigo.length !== 6) throw erro("Informe o código de 6 dígitos.");

  const supabase = obterSupabaseAdmin({ obrigatorio:true });
  const {data:challenge,error} = await supabase
    .from(CHALLENGE_TABLE)
    .select("id,email_normalized,document_normalized,academy_name,legal_name,payload,code_hash,attempts,status,expires_at")
    .eq("id",requestId)
    .maybeSingle();

  if (error) throw erro(`Falha ao validar ativação: ${error.message}`,500);
  if (!challenge || challenge.status !== "pending") {
    throw erro("Código inválido ou solicitação expirada.",400);
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await supabase.from(CHALLENGE_TABLE).update({
      status:"expired",updated_at:new Date().toISOString()
    }).eq("id",requestId);
    throw erro("Código expirado. Solicite um novo.",400);
  }

  if (Number(challenge.attempts || 0) >= MAX_ATTEMPTS) {
    await supabase.from(CHALLENGE_TABLE).update({
      status:"expired",updated_at:new Date().toISOString()
    }).eq("id",requestId);
    throw erro("Número máximo de tentativas atingido. Solicite um novo código.",429);
  }

  const esperado = hashOtp(requestId,codigo);
  if (!igualSeguro(esperado,challenge.code_hash)) {
    const tentativas = Number(challenge.attempts || 0)+1;

    await supabase.from(CHALLENGE_TABLE).update({
      attempts:tentativas,
      status:tentativas >= MAX_ATTEMPTS ? "expired" : "pending",
      updated_at:new Date().toISOString()
    }).eq("id",requestId);

    throw erro(
      tentativas >= MAX_ATTEMPTS
        ? "Número máximo de tentativas atingido. Solicite um novo código."
        : "Código de verificação incorreto.",
      tentativas >= MAX_ATTEMPTS ? 429 : 400
    );
  }

  const d = challenge.payload || {};
  if (!d.nomeEmpresa || !d.documento || !d.email || !d.senhaHash || !d.userId) {
    throw erro("Dados do cadastro incompletos. Preencha o formulário novamente.",400);
  }

  await exigirDadosDisponiveis({
    nomeEmpresa:d.nomeEmpresa,
    razaoSocial:d.razaoSocial || "",
    documento:d.documento,
    email:d.email
  });

  const verificadoEm = new Date().toISOString();
  const {data:travado,error:lockError} = await supabase
    .from(CHALLENGE_TABLE)
    .update({
      status:"verified",
      verified_at:verificadoEm,
      updated_at:verificadoEm
    })
    .eq("id",requestId)
    .eq("status","pending")
    .select("id")
    .maybeSingle();

  if (lockError) throw erro(`Falha ao confirmar ativação: ${lockError.message}`,500);
  if (!travado) throw erro("Esta solicitação já foi utilizada.",409);

  try {
    const resultado = await criarEmpresaConfirmada(d,contexto);

    await supabase.from(CHALLENGE_TABLE).update({
      status:"completed",
      completed_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).eq("id",requestId);

    return resultado;
  } catch (creationError) {
    await supabase.from(CHALLENGE_TABLE).update({
      status:"cancelled",
      updated_at:new Date().toISOString()
    }).eq("id",requestId);
    throw creationError;
  }
}

// Compatibilidade interna: criação pública agora sempre inicia a validação por e-mail.
export async function criarEmpresa(payload={},contexto={}) {
  return iniciarCadastroEmpresa(payload,contexto);
}
