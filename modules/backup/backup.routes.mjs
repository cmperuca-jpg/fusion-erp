import { Router } from "express";
import * as service from "./backup.service.mjs";
import { validarToken } from "../auth/auth.service.mjs";
import { normalizarTenantId } from "../core/persistence/tenant-context.mjs";

const router = Router();

function erro(res, error, status = 500) {
  res.status(status).json({ ok: false, erro: error.message, mensagem: error.message });
}

async function exigirAdministrador(req, res, next) {
  try {
    const usuario = await validarToken(req.headers.authorization || "");
    const perfil = String(usuario?.perfil || "").toLowerCase();
    const permissoes = Array.isArray(usuario?.permissoes) ? usuario.permissoes : [];
    const tenantId = normalizarTenantId(usuario?.tenantId || "");

    if (!["admin", "administrador"].includes(perfil) && !permissoes.includes("*")) {
      return res.status(403).json({ ok: false, mensagem: "Apenas administradores podem gerenciar backups." });
    }
    if (!tenantId) {
      return res.status(401).json({ ok: false, mensagem: "Sessão sem academia vinculada." });
    }

    req.usuario = { ...usuario, tenantId };
    next();
  } catch (error) {
    erro(res, error, error.status || 401);
  }
}

router.use(exigirAdministrador);

router.get("/status", async (req, res) => {
  try { res.json(await service.statusBackup(req.usuario.tenantId)); }
  catch (error) { erro(res, error, error.status || 500); }
});

router.get("/config", async (req, res) => {
  try { res.json({ ok: true, config: await service.lerConfiguracaoBackup(req.usuario.tenantId) }); }
  catch (error) { erro(res, error, error.status || 500); }
});

router.post("/config", async (req, res) => {
  try { res.json(await service.salvarConfiguracaoBackup(req.body || {}, req.usuario.tenantId)); }
  catch (error) { erro(res, error, error.status || 400); }
});

router.put("/config", async (req, res) => {
  try { res.json(await service.salvarConfiguracaoBackup(req.body || {}, req.usuario.tenantId)); }
  catch (error) { erro(res, error, error.status || 400); }
});

router.post("/local", async (req, res) => {
  try { res.json(await service.criarBackupLocal(req.usuario.tenantId)); }
  catch (error) { erro(res, error, error.status || 500); }
});

router.post("/supabase", async (req, res) => {
  try { res.json(await service.enviarBackupSupabase({}, req.usuario.tenantId)); }
  catch (error) { erro(res, error, error.status || 500); }
});

router.post("/", async (req, res) => {
  try { res.json(await service.enviarBackupSupabase({}, req.usuario.tenantId)); }
  catch (error) { erro(res, error, error.status || 500); }
});

router.get("/listar", async (req, res) => {
  try { res.json(await service.listarBackupsSupabase(req.usuario.tenantId)); }
  catch (error) { erro(res, error, error.status || 500); }
});

router.post("/restaurar", async (req, res) => {
  try {
    res.json(await service.restaurarBackupSupabase(
      req.body?.caminho,
      req.body?.confirmacao,
      req.usuario.tenantId
    ));
  } catch (error) {
    erro(res, error, error.status || 500);
  }
});

router.get("/automatico/status", async (req, res) => {
  try {
    res.json({
      ok: true,
      tenantId: req.usuario.tenantId,
      automatico: service.statusBackupAutomatico()
    });
  } catch (error) {
    erro(res, error);
  }
});

export default router;
