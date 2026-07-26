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
import * as alunosService from "../alunos/alunos.service.mjs";

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
