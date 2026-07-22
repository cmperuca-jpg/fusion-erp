import express from "express";
import { validarToken } from "../auth/auth.service.mjs";
import { visualizarReset, executarReset } from "./reset-dados.service.mjs";

const router = express.Router();
async function proteger(req, res, next) {
  try {
    req.usuario = await validarToken(req.headers.authorization || "");
    const perfil = String(req.usuario?.perfil || "").toLowerCase();
    const permissoes = Array.isArray(req.usuario?.permissoes) ? req.usuario.permissoes : [];
    if (perfil !== "administrador" && perfil !== "admin" && !permissoes.includes("*")) return res.status(403).json({ ok: false, mensagem: "Apenas administrador pode executar o reset." });
    next();
  } catch (erro) { res.status(erro.status || 401).json({ ok: false, mensagem: erro.message }); }
}
router.get("/visualizar", proteger, async (req, res) => {
  try { res.json(await visualizarReset(req.usuario)); }
  catch (erro) { res.status(erro.status || 500).json({ ok: false, mensagem: erro.message }); }
});
router.post("/executar", proteger, async (req, res) => {
  try { res.json(await executarReset({ usuarioAtual: req.usuario, senha: req.body?.senha, confirmacao: req.body?.confirmacao })); }
  catch (erro) { res.status(erro.status || 500).json({ ok: false, mensagem: erro.message }); }
});
export default router;
