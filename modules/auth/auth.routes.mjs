import express from "express";
import {
  selecionarAcademia,
  selecionarAcademiaComVinculo,
  validarTokenSelecaoAcademia,
  obterCodigoAcademia,
  regenerarCodigoAcademia
} from "./academy-access.service.mjs";
import {
  iniciarRecuperacao,
  confirmarRecuperacao,
  redefinirSenhaRecuperacao
} from "./recovery.service.mjs";
import {
  obterStatusImplantacao,
  concluirImplantacao,
  cancelarImplantacao
} from "../saas/onboarding-lifecycle.service.mjs";
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
    const { email, senha, tenant, tenantId, selectionToken } = req.body || {};
    const tenantEsperado = req.headers["x-fusion-tenant"] || tenant || tenantId || "";
    const tokenSelecao = req.headers["x-fusion-tenant-selection"] || selectionToken || "";

    if (!tenantEsperado) {
      return res.status(400).json({ ok: false, mensagem: "Selecione a academia antes de fazer login." });
    }

    validarTokenSelecaoAcademia(tokenSelecao, tenantEsperado);
    res.json(await autenticar(email, senha, tenantEsperado));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/vinculo-dispositivo/selecionar", async (req, res) => {
  try {
    res.json(await selecionarAcademiaComVinculo(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/login-empresa", async (_req, res) => {
  return res.status(410).json({
    ok: false,
    mensagem: "Fluxo antigo desativado. Selecione a academia e depois faça login com seu usuário."
  });
});

router.post("/selecionar-empresa", async (req, res) => {
  try {
    res.json(await selecionarAcademia(req.body || {}, {
      ip: req.ip || req.socket?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || ""
    }));
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
  try { res.json(await confirmarRecuperacao(req.body || {})); }
  catch (erro) { tratarErro(res, erro); }
});

router.post("/recuperacao/redefinir-senha", async (req, res) => {
  try { res.json(await redefinirSenhaRecuperacao(req.body || {})); }
  catch (erro) { tratarErro(res, erro); }
});

router.get("/me", autenticarRequisicao, async (req, res) => {
  res.json({ ok: true, usuario: req.usuario });
});


router.get("/onboarding/status", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try {
    if (req.usuario?.supportAccess === true) {
      return res.status(403).json({ ok: false, mensagem: "Sessão de suporte não pode alterar a implantação do cliente." });
    }
    res.json({
      ok: true,
      implantacao: await obterStatusImplantacao(req.usuario?.tenantId || "")
    });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/onboarding/concluir", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try {
    if (req.usuario?.supportAccess === true) {
      return res.status(403).json({ ok: false, mensagem: "Sessão de suporte não pode concluir a implantação do cliente." });
    }
    res.json({
      ok: true,
      resultado: await concluirImplantacao({
        tenantId: req.usuario?.tenantId || "",
        usuarioId: req.usuario?.id || ""
      })
    });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.delete("/onboarding/cancelar", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try {
    if (req.usuario?.supportAccess === true) {
      return res.status(403).json({ ok: false, mensagem: "Sessão de suporte não pode apagar a implantação do cliente." });
    }
    res.json({
      ok: true,
      resultado: await cancelarImplantacao({
        tenantId: req.usuario?.tenantId || "",
        usuarioId: req.usuario?.id || "",
        confirmacao: req.body?.confirmacao || ""
      })
    });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/codigo-acesso", autenticarRequisicao, async (req, res) => {
  try {
    res.json({ ok: true, ...(await obterCodigoAcademia(req.usuario?.tenantId || "")) });
  } catch (erro) { tratarErro(res, erro); }
});

router.post("/codigo-acesso/regenerar", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try {
    res.json({ ok: true, ...(await regenerarCodigoAcademia(req.usuario?.tenantId || "")) });
  } catch (erro) { tratarErro(res, erro); }
});

router.get("/usuarios", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try { res.json({ ok: true, usuarios: await listarUsuarios() }); }
  catch (erro) { tratarErro(res, erro); }
});

router.get("/usuarios/:id", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try { res.json({ ok: true, usuario: await obterUsuario(req.params.id) }); }
  catch (erro) { tratarErro(res, erro); }
});

router.post("/usuarios", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try { res.status(201).json({ ok: true, usuario: await criarUsuario(req.body || {}) }); }
  catch (erro) { tratarErro(res, erro); }
});

router.put("/usuarios/:id", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try { res.json({ ok: true, usuario: await atualizarUsuario(req.params.id, req.body || {}) }); }
  catch (erro) { tratarErro(res, erro); }
});

router.post("/usuarios/:id/status", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try { res.json({ ok: true, usuario: await alternarStatusUsuario(req.params.id) }); }
  catch (erro) { tratarErro(res, erro); }
});

router.delete("/usuarios/:id", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try { res.json({ ok: true, ...(await removerUsuario(req.params.id)) }); }
  catch (erro) { tratarErro(res, erro); }
});

router.get("/perfis", autenticarRequisicao, exigirAdministrador, async (req, res) => {
  try { res.json({ ok: true, perfis: await obterPerfis() }); }
  catch (erro) { tratarErro(res, erro); }
});

export default router;
