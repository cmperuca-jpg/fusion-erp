import { Router } from "express";
import * as avaliacoesService from "./avaliacoes.service.mjs";
import * as alunosService from "../alunos/alunos.service.mjs";

const router = Router();

function erro(res, error, status = 500) {
  return res.status(error.status || status).json({ ok: false, erro: error.message, mensagem: error.message });
}

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

function responsavelTecnicoEstrito(req) {
  const perfil = normalizar(req.usuario?.perfil);
  return perfil === "responsavel_tecnico" ||
    perfil === "responsavel-tecnico" ||
    perfil === "responsavel tecnico";
}

function exigirResponsavelTecnico(req, res) {
  if (responsavelTecnicoEstrito(req)) return true;
  res.status(403).json({
    ok: false,
    mensagem: "Somente o Responsavel Tecnico pode criar, editar ou excluir avaliacoes fisicas."
  });
  return false;
}

function registroDoProfessor(item = {}, usuario = {}) {
  const professorId = texto(usuario.id);
  const professorNome = normalizar(usuario.nome);
  const ids = [item.professorId, item.professor_id, item.avaliadorId, item.avaliador_id];
  if (ids.some(id => mesmo(id, professorId))) return true;

  const nomes = [item.professorNome, item.professor_nome, item.professor, item.avaliador]
    .map(normalizar)
    .filter(Boolean);
  return Boolean(professorNome && nomes.some(nome => nome === professorNome || nome.includes(professorNome) || professorNome.includes(nome)));
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

async function filtrarAvaliacoesPorPortal(req, avaliacoes = []) {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return avaliacoes;
  const alunos = await alunosService.listar();
  const alunosPermitidos = new Set(
    alunos
      .filter(aluno => alunoPertenceAoProfessor(aluno, req.usuario))
      .flatMap(aluno => [aluno.id, aluno._id, aluno.codigo, aluno.alunoId, aluno.aluno_id].map(texto).filter(Boolean))
  );
  return avaliacoes.filter((avaliacao) => {
    const alunoId = texto(avaliacao.alunoId || avaliacao.aluno_id);
    return registroDoProfessor(avaliacao, req.usuario) || (alunoId && alunosPermitidos.has(alunoId));
  });
}

function payloadProfessor(req, payload = {}) {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return payload;
  return {
    ...payload,
    professor_id: texto(req.usuario.id),
    professorId: texto(req.usuario.id),
    professorNome: texto(req.usuario.nome) || payload.professorNome || payload.professor_nome || ""
  };
}

async function exigirAcessoAvaliacao(req, res, avaliacao = {}) {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return true;
  const alunoId = avaliacao.alunoId || avaliacao.aluno_id;
  if (registroDoProfessor(avaliacao, req.usuario) || await alunoPermitidoParaProfessor(req, alunoId)) return true;
  res.status(403).json({ ok: false, mensagem: "Professor sem acesso a esta avaliacao." });
  return false;
}

router.get("/", async (req, res) => {
  try {
    const avaliacoes = await avaliacoesService.listar(req.query.aluno_id || req.query.alunoId);
    res.json(await filtrarAvaliacoesPorPortal(req, avaliacoes));
  } catch (error) {
    erro(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const avaliacao = await avaliacoesService.buscar(req.params.id);
    if (!avaliacao) return res.status(404).json({ ok: false, erro: "Avaliacao nao encontrada", mensagem: "Avaliacao nao encontrada" });
    if (!await exigirAcessoAvaliacao(req, res, avaliacao)) return;
    res.json(avaliacao);
  } catch (error) {
    erro(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    if (!exigirResponsavelTecnico(req, res)) return;
    const dados = payloadProfessor(req, req.body || {});
    if (!await alunoPermitidoParaProfessor(req, dados.alunoId || dados.aluno_id)) {
      return res.status(403).json({ ok: false, mensagem: "Professor sem acesso a este aluno." });
    }
    const avaliacao = await avaliacoesService.criar(dados);
    res.status(201).json({ ok: true, avaliacao, mensagem: "Avaliacao cadastrada com sucesso" });
  } catch (error) {
    erro(res, error, 400);
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!exigirResponsavelTecnico(req, res)) return;
    const existente = await avaliacoesService.buscar(req.params.id);
    if (!existente) return res.status(404).json({ ok: false, erro: "Avaliacao nao encontrada", mensagem: "Avaliacao nao encontrada" });
    if (!await exigirAcessoAvaliacao(req, res, existente)) return;

    const dados = payloadProfessor(req, req.body || {});
    if (!await alunoPermitidoParaProfessor(req, dados.alunoId || dados.aluno_id || existente.alunoId || existente.aluno_id)) {
      return res.status(403).json({ ok: false, mensagem: "Professor sem acesso a este aluno." });
    }

    const avaliacao = await avaliacoesService.atualizar(req.params.id, dados);
    if (!avaliacao) return res.status(404).json({ ok: false, erro: "Avaliacao nao encontrada", mensagem: "Avaliacao nao encontrada" });
    res.json({ ok: true, avaliacao, mensagem: "Avaliacao atualizada com sucesso" });
  } catch (error) {
    erro(res, error, 400);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!exigirResponsavelTecnico(req, res)) return;
    const avaliacao = await avaliacoesService.buscar(req.params.id);
    if (!avaliacao) return res.status(404).json({ ok: false, erro: "Avaliacao nao encontrada", mensagem: "Avaliacao nao encontrada" });
    if (!await exigirAcessoAvaliacao(req, res, avaliacao)) return;

    const excluido = await avaliacoesService.excluir(req.params.id);
    if (!excluido) return res.status(404).json({ ok: false, erro: "Avaliacao nao encontrada", mensagem: "Avaliacao nao encontrada" });
    res.json({ ok: true, sucesso: true, mensagem: "Avaliacao excluida com sucesso" });
  } catch (error) {
    erro(res, error);
  }
});

export default router;
