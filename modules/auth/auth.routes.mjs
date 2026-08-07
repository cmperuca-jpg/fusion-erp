import express from "express";
import {
  iniciarRecuperacao,
  confirmarRecuperacao,
  redefinirSenhaRecuperacao
} from "./recovery.service.mjs";
import {
  autenticar,
  autenticarPorEmpresaCodigo,
  listarUsuarios,
  obterUsuario,
  criarUsuario,
  atualizarUsuario,
  alternarStatusUsuario,
  removerUsuario,
  obterPerfis,
  validarToken,
  obterMeuCodigoAcesso,
  regenerarMeuCodigoAcesso
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
    const { email, senha, tenant, tenantId } = req.body || {};
    const tenantEsperado = req.headers["x-fusion-tenant"] || tenant || tenantId || "";
    res.json(await autenticar(email, senha, tenantEsperado));
  } catch (erro) {
    tratarErro(res, erro);
  }
});


router.post("/login-empresa", async (req, res) => {
  try {
    const { empresa, academia, codigo, codigoAcesso, senha } = req.body || {};
    res.json(await autenticarPorEmpresaCodigo(empresa || academia, codigo || codigoAcesso, senha));
  } catch (erro) {
    tratarErro(res, erro);
  }
});


router.post("/recuperacao/iniciar", async (req, res) => {
  try {
    res.json(await iniciarRecuperacao(req.body || {}, {
      ip: req.ip || req.socket?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || ""
    }));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/recuperacao/confirmar", async (req, res) => {
  try {
    res.json(await confirmarRecuperacao(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/recuperacao/redefinir-senha", async (req, res) => {
  try {
    res.json(await redefinirSenhaRecuperacao(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/me", autenticarRequisicao, async (req, res) => {
  res.json({ ok: true, usuario: req.usuario });
});

router.get("/codigo-acesso", autenticarRequisicao, async (req, res) => {
  try {
    res.json({ ok: true, ...(await obterMeuCodigoAcesso(req.usuario || {})) });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/codigo-acesso/regenerar", autenticarRequisicao, async (req, res) => {
  try {
    res.json({ ok: true, ...(await regenerarMeuCodigoAcesso(req.usuario || {})) });
  } catch (erro) {
    tratarErro(res, erro);
  }
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
