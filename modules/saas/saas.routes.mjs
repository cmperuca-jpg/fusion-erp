import express from "express";
import {
  iniciarCadastroEmpresa,
  confirmarCadastroEmpresa,
  reenviarCodigoCadastroEmpresa
} from "./saas.service.mjs";
import {
  formalizarContratacaoFusion,
  listarPlanosFusion,
  marcarInadimplenciaFusion,
  obterBillingFusion,
  processarBillingFusion,
  reativarAssinaturaFusion,
  registrarPagamentoFusion,
  renovarAssinaturaFusion,
  suspenderAssinaturaFusion
} from "./billing.service.mjs";
import {
  iniciarAgendadorBillingFusion,
  statusAgendadorBillingFusion
} from "./billing.scheduler.mjs";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { normalizarTenantId } from "../core/persistence/tenant-context.mjs";

const router = express.Router();

function contexto(req) {
  return {
    ip:req.ip || req.socket?.remoteAddress || "",
    userAgent:req.headers["user-agent"] || ""
  };
}

function podeGerenciarBilling(usuario = {}) {
  const perfil = String(usuario.perfil || "").toLowerCase();
  const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
  return ["administrador", "admin"].includes(perfil) || permissoes.includes("*");
}

function exigirAdmin(req, res, next) {
  if (podeGerenciarBilling(req.usuario || {})) return next();
  return res.status(403).json({
    ok:false,
    mensagem:"Esta operacao exige administrador da academia."
  });
}

function tratarErro(res, error, fallback = "Nao foi possivel processar a operacao.") {
  return res.status(error.status || 500).json({
    ok:false,
    codigo:error.codigo || "",
    mensagem:error.message || fallback
  });
}

router.get("/publico/:slug", async (req, res) => {
  try {
    const slug = normalizarTenantId(
      String(req.params.slug || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    );

    if (!slug) {
      return res.status(400).json({ ok:false,mensagem:"Endereço da academia inválido." });
    }

    const supabase = obterSupabaseAdmin({ obrigatorio:true });
    const {data,error} = await supabase
      .from("fusion_tenants")
      .select("tenant_id,slug,name,status")
      .or(`tenant_id.eq.${slug},slug.eq.${slug}`)
      .limit(2);

    if (error) throw error;

    const ativos = (data || []).filter(item =>
      ["active","trial"].includes(String(item.status || "").toLowerCase())
    );

    if (ativos.length !== 1) {
      return res.status(404).json({ok:false,mensagem:"Academia não encontrada."});
    }

    const tenant = ativos[0];

    return res.json({
      ok:true,
      tenantId:normalizarTenantId(tenant.tenant_id),
      academia:{
        nome:tenant.name,
        slug:tenant.slug || slug,
        status:tenant.status
      }
    });
  } catch {
    return res.status(500).json({
      ok:false,
      mensagem:"Não foi possível localizar a academia."
    });
  }
});

router.get("/planos", (req, res) => {
  res.json({
    ok:true,
    planos:listarPlanosFusion()
  });
});

router.post("/empresas", async (req,res) => {
  try {
    const acao = String(req.body?.acao || "iniciar").trim().toLowerCase();

    if (acao === "confirmar") {
      return res.status(201).json(
        await confirmarCadastroEmpresa(req.body || {},contexto(req))
      );
    }

    if (acao === "reenviar") {
      return res.json(
        await reenviarCodigoCadastroEmpresa(req.body || {},contexto(req))
      );
    }

    return res.status(202).json(
      await iniciarCadastroEmpresa(req.body || {},contexto(req))
    );
  } catch (error) {
    return res.status(error.status || 500).json({
      ok:false,
      codigo:error.codigo || "",
      mensagem:error.message || "Não foi possível processar o cadastro."
    });
  }
});

router.get("/billing/fusion", exigirAdmin, async (req, res) => {
  try {
    res.json(await obterBillingFusion());
  } catch (error) {
    tratarErro(res, error, "Nao foi possivel consultar o billing Fusion.");
  }
});

router.get("/billing/fusion/planos", exigirAdmin, async (req, res) => {
  res.json({
    ok:true,
    planos:listarPlanosFusion()
  });
});

router.get("/billing/fusion/agendador", exigirAdmin, async (req, res) => {
  res.json({ ok: true, ...statusAgendadorBillingFusion() });
});

router.post("/billing/fusion/contratacao", exigirAdmin, async (req, res) => {
  try {
    res.status(201).json(await formalizarContratacaoFusion(req.body || {}, req.usuario || {}));
  } catch (error) {
    tratarErro(res, error, "Nao foi possivel formalizar a contratacao.");
  }
});

router.post("/billing/fusion/pagamentos", exigirAdmin, async (req, res) => {
  try {
    res.status(201).json(await registrarPagamentoFusion(req.body || {}, req.usuario || {}));
  } catch (error) {
    tratarErro(res, error, "Nao foi possivel registrar o pagamento.");
  }
});

router.post("/billing/fusion/processar", exigirAdmin, async (req, res) => {
  try {
    res.json(await processarBillingFusion(req.body || {}, req.usuario || {}));
  } catch (error) {
    tratarErro(res, error, "Nao foi possivel processar o billing Fusion.");
  }
});

router.post("/billing/fusion/renovar", exigirAdmin, async (req, res) => {
  try {
    res.json(await renovarAssinaturaFusion(req.body || {}, req.usuario || {}));
  } catch (error) {
    tratarErro(res, error, "Nao foi possivel renovar a assinatura.");
  }
});

router.post("/billing/fusion/inadimplencia", exigirAdmin, async (req, res) => {
  try {
    res.json(await marcarInadimplenciaFusion(req.body || {}, req.usuario || {}));
  } catch (error) {
    tratarErro(res, error, "Nao foi possivel marcar inadimplencia.");
  }
});

router.post("/billing/fusion/suspender", exigirAdmin, async (req, res) => {
  try {
    res.json(await suspenderAssinaturaFusion(req.body || {}, req.usuario || {}));
  } catch (error) {
    tratarErro(res, error, "Nao foi possivel suspender a assinatura.");
  }
});

router.post("/billing/fusion/reativar", exigirAdmin, async (req, res) => {
  try {
    res.json(await reativarAssinaturaFusion(req.body || {}, req.usuario || {}));
  } catch (error) {
    tratarErro(res, error, "Nao foi possivel reativar a assinatura.");
  }
});

const agendadorBilling = iniciarAgendadorBillingFusion({
  ativo: ["1", "true", "sim", "yes", "on"].includes(String(process.env.FUSION_BILLING_AUTO || "").trim().toLowerCase()),
  intervaloMs: process.env.FUSION_BILLING_INTERVAL_MS
});
if (agendadorBilling.ativo) {
  console.log(`Billing SaaS automatico: ativo a cada ${agendadorBilling.intervaloMs} ms.`);
}

export default router;
