import express from "express";
import {
  iniciarCadastroEmpresa,
  confirmarCadastroEmpresa,
  reenviarCodigoCadastroEmpresa
} from "./saas.service.mjs";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { normalizarTenantId } from "../core/persistence/tenant-context.mjs";

const router = express.Router();

function contexto(req) {
  return {
    ip:req.ip || req.socket?.remoteAddress || "",
    userAgent:req.headers["user-agent"] || ""
  };
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

export default router;
