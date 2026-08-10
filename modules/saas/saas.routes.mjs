import express from "express";
import { criarEmpresa } from "./saas.service.mjs";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { normalizarTenantId } from "../core/persistence/tenant-context.mjs";

const router = express.Router();

router.get("/publico/:slug", async (req, res) => {
  try {
    const slug = normalizarTenantId(
      String(req.params.slug || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    );

    if (!slug) {
      return res.status(400).json({ ok: false, mensagem: "Endereço da academia inválido." });
    }

    const supabase = obterSupabaseAdmin({ obrigatorio: true });
    const { data, error } = await supabase
      .from("fusion_tenants")
      .select("tenant_id,slug,name,status")
      .or(`tenant_id.eq.${slug},slug.eq.${slug}`)
      .limit(2);

    if (error) throw error;

    const ativos = (data || []).filter(item =>
      ["active", "trial"].includes(String(item.status || "").toLowerCase())
    );

    if (ativos.length !== 1) {
      return res.status(404).json({ ok: false, mensagem: "Academia não encontrada." });
    }

    const tenant = ativos[0];

    return res.json({
      ok: true,
      tenantId: normalizarTenantId(tenant.tenant_id),
      academia: {
        nome: tenant.name,
        slug: tenant.slug || slug,
        status: tenant.status
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      mensagem: "Não foi possível localizar a academia."
    });
  }
});

router.post("/empresas", async (req,res) => {
  try {
    const resultado = await criarEmpresa(req.body || {});
    res.status(201).json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({
      ok:false,
      mensagem:error.message || "Não foi possível criar a empresa."
    });
  }
});

export default router;
