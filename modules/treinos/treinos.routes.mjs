import { Router } from "express";
import {
  obterBiblioteca,
  obterTreinos,
  criarTreino,
  atualizarTreino,
  removerTreino,
  autenticarAlunoTreino,
  validarSessaoAlunoTreino,
  liberarCatracaPortalAluno,
  obterContadorCatracaPortalAluno
} from "./treinos.service.mjs";
import {
  ativarAlunoApp,
  statusAlunoApp,
  loginAlunoApp,
  primeiroAcessoAlunoApp,
  gravarSessaoAluno,
  limparSessaoAluno,
  obterHomeAlunoApp
} from "./aluno-app.service.mjs";
import * as alunosService from "../alunos/alunos.service.mjs";
import {
  atualizarFotoAlunoApp,
  contadorCatracaAlunoApp,
  frequenciaAlunoApp,
  liberarCatracaAlunoApp
} from "./aluno-app-actions.service.mjs";

const router = Router();

function texto(valor) {
  return String(valor || "").trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mesmo(a, b) {
  return texto(a) && texto(a) === texto(b);
}

function usuarioPortalProfessor(req) {
  return req.usuario?.portal === true && req.usuario?.portalTipo === "professor";
}

function responsavelTecnico(req) {
  const usuario = req.usuario || {};
  const perfil = normalizar(usuario.perfil);
  const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
  return usuario.acessoTodosAlunos === true ||
    perfil === "responsavel_tecnico" ||
    perfil === "responsavel-tecnico" ||
    perfil === "responsavel tecnico" ||
    permissoes.includes("professores") ||
    permissoes.includes("*");
}

function alunoPertenceAoProfessor(aluno = {}, usuario = {}) {
  const professorId = texto(usuario.id);
  const professorNome = normalizar(usuario.nome);
  const ids = [
    aluno.professorId,
    aluno.professor_id,
    aluno.idProfessor,
    aluno.professorResponsavelId,
    aluno.professor_responsavel_id,
    aluno.professor_responsavel
  ];
  if (ids.some(id => mesmo(id, professorId))) return true;

  const nomes = [
    aluno.professorNome,
    aluno.professor_nome,
    aluno.professor,
    aluno.professorResponsavel,
    aluno.professor_responsavel_nome,
    aluno.nomeProfessor
  ].map(normalizar).filter(Boolean);
  return Boolean(professorNome && nomes.some(nome => nome === professorNome || nome.includes(professorNome) || professorNome.includes(nome)));
}

async function alunoPermitidoParaProfessor(req, alunoId = "") {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return true;
  if (!alunoId) return false;
  const aluno = await alunosService.buscar(alunoId);
  return alunoPertenceAoProfessor(aluno, req.usuario);
}

function filtrosTreino(req) {
  const filtros = { ...req.query };
  if (usuarioPortalProfessor(req) && !responsavelTecnico(req)) {
    filtros.professorId = req.usuario.id;
    filtros.professorNome = req.usuario.nome;
  }
  return filtros;
}

function payloadProfessor(req, payload = {}) {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return payload;
  return {
    ...payload,
    professorId: texto(req.usuario.id),
    professor_id: texto(req.usuario.id),
    professorNome: texto(req.usuario.nome) || payload.professorNome || payload.professor_nome || ""
  };
}

async function treinoPermitidoParaProfessor(req, treinoId = "") {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return true;
  const treinos = await obterTreinos({ professorId: req.usuario.id, professorNome: req.usuario.nome });
  return treinos.some(treino => mesmo(treino.id, treinoId));
}

const tentativasAlunoApp = new Map();
function limitarAlunoApp(req, res, next) {
  const janelaMs = 10 * 60 * 1000;
  const limite = 12;
  const agora = Date.now();
  const chave = String(req.ip || req.socket?.remoteAddress || "desconhecido");
  const atual = tentativasAlunoApp.get(chave);
  if (!atual || atual.resetAt <= agora) {
    tentativasAlunoApp.set(chave, { count: 1, resetAt: agora + janelaMs });
    return next();
  }
  atual.count += 1;
  if (atual.count > limite) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((atual.resetAt - agora) / 1000))));
    return res.status(429).json({ ok: false, code: "RATE_LIMIT", mensagem: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
  }
  return next();
}

function origemDoProprioSistema(req) {
  const origin = String(req.headers.origin || "").trim();
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.host === req.get("host");
  } catch {
    return false;
  }
}

function somenteMesmoSistema(req, res, next) {
  if (!origemDoProprioSistema(req)) {
    return res.status(403).json({ ok: false, code: "ORIGIN_NOT_ALLOWED", mensagem: "Origem não permitida." });
  }
  return next();
}

function responderErroAlunoApp(res, erro, fallback = "Erro no aplicativo do aluno.") {
  const status = Number(erro?.statusCode || erro?.status || 500);
  const code = String(erro?.code || "");
  return res.status(status).json({ ok: false, code, mensagem: erro?.message || fallback });
}

router.get("/biblioteca", async (_req, res) => {
  try {
    res.json({ ok: true, dados: await obterBiblioteca() });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: "Erro ao carregar biblioteca de exercicios", erro: erro.message });
  }
});

router.post("/aluno-login", async (req, res) => {
  try {
    res.json({ ok: true, dados: await autenticarAlunoTreino(req.body || {}) });
  } catch (erro) {
    res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao autenticar aluno" });
  }
});

router.post("/aluno-app/ativar", somenteMesmoSistema, limitarAlunoApp, async (req, res) => {
  try {
    res.json({ ok: true, dados: await ativarAlunoApp(req.body || {}) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Erro ao ativar o aplicativo.");
  }
});

router.post("/aluno-app/status", somenteMesmoSistema, async (req, res) => {
  try {
    res.json({ ok: true, dados: await statusAlunoApp(req.body?.device_token || req.body?.deviceToken) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Dispositivo não ativado.");
  }
});

router.post("/aluno-app/login", somenteMesmoSistema, limitarAlunoApp, async (req, res) => {
  try {
    const dados = await loginAlunoApp(req.body || {});
    gravarSessaoAluno(res, dados);
    res.json({ ok: true });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "CPF ou senha inválidos.");
  }
});

router.post("/aluno-app/primeiro-acesso", somenteMesmoSistema, limitarAlunoApp, async (req, res) => {
  try {
    const dados = await primeiroAcessoAlunoApp(req.body || {});
    gravarSessaoAluno(res, dados);
    res.json({ ok: true });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível criar sua senha.");
  }
});

router.get("/aluno-app/me", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.json({ ok: true, dados: await obterHomeAlunoApp(req, res, deviceToken) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível carregar seus dados.");
  }
});

router.put("/aluno-app/foto", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.json({ ok: true, dados: await atualizarFotoAlunoApp(req, res, deviceToken, req.body || {}) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível atualizar sua foto.");
  }
});

router.post("/aluno-app/catraca", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.json({ ok: true, dados: await liberarCatracaAlunoApp(req, res, deviceToken, req.body || {}) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível liberar a catraca.");
  }
});

router.get("/aluno-app/catraca-contador", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.json({ ok: true, dados: await contadorCatracaAlunoApp(req, res, deviceToken) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível consultar seus acessos.");
  }
});

router.get("/aluno-app/frequencia", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.json({ ok: true, dados: await frequenciaAlunoApp(req, res, deviceToken) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível carregar sua frequência.");
  }
});

router.post("/aluno-app/logout", somenteMesmoSistema, async (_req, res) => {
  limparSessaoAluno(res);
  res.json({ ok: true });
});

router.get("/aluno-sessao", async (req, res) => {
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "") || req.query.token;
    res.json({ ok: true, dados: await validarSessaoAlunoTreino({ alunoId: req.query.alunoId, token }) });
  } catch (erro) {
    res.status(erro.statusCode || 401).json({ ok: false, mensagem: erro.message || "Sessao do aluno invalida" });
  }
});

router.post("/aluno-liberar-catraca", async (req, res) => {
  try {
    res.json({ ok: true, dados: await liberarCatracaPortalAluno(req.body || {}) });
  } catch (erro) {
    res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao liberar catraca" });
  }
});

router.get("/aluno-catraca-contador", async (req, res) => {
  try {
    res.json({ ok: true, dados: await obterContadorCatracaPortalAluno(req.query || {}) });
  } catch (erro) {
    res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao consultar acessos da catraca" });
  }
});

router.get("/", async (req, res) => {
  try {
    res.json({ ok: true, dados: await obterTreinos(filtrosTreino(req)) });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: "Erro ao carregar treinos", erro: erro.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = payloadProfessor(req, req.body || {});
    if (!await alunoPermitidoParaProfessor(req, payload.alunoId || payload.aluno_id)) {
      return res.status(403).json({ ok: false, mensagem: "Professor sem acesso a este aluno." });
    }
    res.status(201).json({ ok: true, dados: await criarTreino(payload) });
  } catch (erro) {
    res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao salvar treino" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!await treinoPermitidoParaProfessor(req, req.params.id)) {
      return res.status(403).json({ ok: false, mensagem: "Professor sem acesso a este treino." });
    }

    const payload = payloadProfessor(req, req.body || {});
    if (!await alunoPermitidoParaProfessor(req, payload.alunoId || payload.aluno_id)) {
      return res.status(403).json({ ok: false, mensagem: "Professor sem acesso a este aluno." });
    }

    const treino = await atualizarTreino(req.params.id, payload);
    if (!treino) return res.status(404).json({ ok: false, mensagem: "Treino nao encontrado" });
    res.json({ ok: true, dados: treino, mensagem: "Treino atualizado com sucesso" });
  } catch (erro) {
    res.status(erro.statusCode || 400).json({ ok: false, mensagem: erro.message || "Erro ao atualizar treino" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    res.json({ ok: true, dados: await removerTreino(req.params.id) });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: "Erro ao remover treino", erro: erro.message });
  }
});

export default router;
