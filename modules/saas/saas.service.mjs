import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { executarComTenant, normalizarTenantId } from "../core/persistence/tenant-context.mjs";

const BCRYPT_ROUNDS = Math.min(Math.max(Number(process.env.FUSION_BCRYPT_ROUNDS || 12), 10), 14);

function texto(v){ return String(v ?? "").trim(); }
function normalizarDocumento(v){ return texto(v).replace(/\D/g, ""); }
function slugBase(v){ return normalizarTenantId(String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")); }
function erro(msg,status=400){ return Object.assign(new Error(msg),{status}); }

function validar(payload={}){
  const nomeEmpresa = texto(payload.nomeEmpresa || payload.nome);
  const razaoSocial = texto(payload.razaoSocial);
  const documento = normalizarDocumento(payload.documento || payload.cnpj || payload.cpf);
  const responsavel = texto(payload.responsavel || payload.nomeResponsavel);
  const email = texto(payload.email).toLowerCase();
  const telefone = texto(payload.telefone || payload.whatsapp);
  const senha = String(payload.senha || "");
  if (nomeEmpresa.length < 2) throw erro("Informe o nome da academia/empresa.");
  if (![11,14].includes(documento.length)) throw erro("Informe um CPF ou CNPJ válido.");
  if (responsavel.length < 2) throw erro("Informe o nome do responsável.");
  if (!email.includes("@")) throw erro("Informe um e-mail válido.");
  if (senha.length < 10) throw erro("A senha deve ter pelo menos 10 caracteres.");
  return {nomeEmpresa,razaoSocial,documento,responsavel,email,telefone,senha};
}

async function tenantDisponivel(base){
  const supabase = obterSupabaseAdmin({ obrigatorio:true });
  for (let i=0;i<20;i++) {
    const sufixo = i ? `-${i+1}` : "";
    const tenant = `${base}${sufixo}`.slice(0,80);
    const { data, error } = await supabase.from("fusion_tenants").select("tenant_id").eq("tenant_id",tenant).maybeSingle();
    if (error) throw erro(`Falha ao validar identificação da empresa: ${error.message}`,500);
    if (!data) return tenant;
  }
  return `${base}-${crypto.randomBytes(3).toString("hex")}`.slice(0,80);
}

export async function criarEmpresa(payload={}){
  const d = validar(payload);
  const base = slugBase(d.nomeEmpresa) || `empresa-${Date.now()}`;
  const tenantId = await tenantDisponivel(base);
  const userId = `usr_${crypto.randomUUID()}`;
  const agora = new Date().toISOString();
  const senhaHash = await bcrypt.hash(d.senha, BCRYPT_ROUNDS);
  const adminPayload = {
    id:userId,
    nome:d.responsavel,
    email:d.email,
    senhaHash,
    perfil:"Administrador",
    status:"ativo",
    permissoes:["*"],
    trocarSenhaNoPrimeiroAcesso:false,
    criadoEm:agora,
    atualizadoEm:agora
  };

  const supabase = obterSupabaseAdmin({ obrigatorio:true });
  const { data, error } = await supabase.rpc("fusion_create_tenant_v1", {
    p_tenant_id: tenantId,
    p_slug: tenantId,
    p_name: d.nomeEmpresa,
    p_legal_name: d.razaoSocial,
    p_document: d.documento,
    p_responsible_name: d.responsavel,
    p_responsible_email: d.email,
    p_responsible_phone: d.telefone,
    p_admin_payload: adminPayload
  });
  if (error) {
    const duplicado = /e-mail já cadastrado/i.test(error.message || "");
    throw erro(duplicado ? "Este e-mail já está vinculado a uma empresa." : `Não foi possível criar a empresa: ${error.message}`, duplicado ? 409 : 500);
  }

  return executarComTenant(tenantId, async () => ({
    ok:true,
    tenantId,
    slug:tenantId,
    usuarioId:userId,
    empresa:{nome:d.nomeEmpresa,status:"trial",trialDias:14},
    resultado:data
  }));
}
