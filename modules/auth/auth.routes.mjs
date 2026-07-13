import express from "express";
import {
  autenticar,
  listarUsuarios,
  obterUsuario,
  criarUsuario,
  atualizarUsuario,
  alternarStatusUsuario,
  removerUsuario,
  obterPerfis,
  validarToken
} from "./auth.service.mjs";

const router = express.Router();

function tratarErro(res, erro) {
  res.status(erro.status || 500).json({
    ok: false,
    mensagem: erro.message || "Erro interno de autenticação."
  });
}

async function autenticarRequisicao(req, res, next) {
  try {
    req.usuario = await validarToken(req.headers.authorization || "");
    next();
  } catch (erro) {
    tratarErro(res, erro);
  }
}

function exigirAdministrador(req, res, next) {
  const perfil = String(req.usuario?.perfil || "").toLowerCase();
  const permissoes = Array.isArray(req.usuario?.permissoes) ? req.usuario.permissoes : [];
  if (perfil === "administrador" || perfil === "admin" || permissoes.includes("*")) return next();
  return res.status(403).json({ ok: false, mensagem: "Acesso permitido apenas para administrador." });
}

router.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    res.json(await autenticar(email, senha));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/me", autenticarRequisicao, async (req, res) => {
  res.json({ ok: true, usuario: req.usuario });
});

router.get("/usuarios", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try {
    res.json({ ok: true, usuarios: await listarUsuarios() });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/usuarios/:id", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try {
    res.json({ ok: true, usuario: await obterUsuario(req.params.id) });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/usuarios", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try {
    res.status(201).json({ ok: true, usuario: await criarUsuario(req.body || {}) });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.put("/usuarios/:id", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try {
    res.json({ ok: true, usuario: await atualizarUsuario(req.params.id, req.body || {}) });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/usuarios/:id/status", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try {
    res.json({ ok: true, usuario: await alternarStatusUsuario(req.params.id) });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.delete("/usuarios/:id", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try {
    res.json({ ok: true, ...(await removerUsuario(req.params.id)) });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/perfis", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try {
    res.json({ ok: true, perfis: await obterPerfis() });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

export default router;
