import { carregarBasePortalProfessor } from "./portal-professor.repository.mjs";

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function texto(v) { return String(v ?? "").trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function digitos(v) { return String(v ?? "").replace(/\D/g, ""); }
function ativo(item) { return !["cancelado","cancelada","encerrado","encerrada","inativo","inativa","bloqueado","bloqueada","removido","removida","excluido","excluído"].includes(normalizar(item?.status || "Ativo")); }
function idProfessor(p = {}) { return texto(p.id || p._id || p.professorId || p.professor_id || p.codigo); }
function nomeProfessor(p = {}) { return texto(p.nome || p.professor || p.professorNome || p.name || "Professor"); }
function idAluno(a = {}) { return texto(a.id || a._id || a.alunoId || a.aluno_id || a.codigo); }
function nomeAluno(a = {}) { return texto(a.nome || a.aluno || a.alunoNome || a.name || "Aluno"); }

function dataIgual(a, b) {
  const x = texto(a).slice(0, 10);
  const y = texto(b).slice(0, 10);
  if (!x || !y) return false;
  const xr = x.includes("/") ? x.split("/").reverse().join("-") : x;
  const yr = y.includes("/") ? y.split("/").reverse().join("-") : y;
  return xr === yr;
}

function telefoneIgual(a, b) {
  const x = digitos(a);
  const y = digitos(b);
  if (!x || !y) return false;
  return x === y || x.endsWith(y) || y.endsWith(x);
}

function professorSanitizado(p = {}) {
  const { senha, senhaHash, password, hash, ...limpo } = p;
  return {
    ...limpo,
    id: idProfessor(p),
    professorId: idProfessor(p),
    nome: nomeProfessor(p),
    professor: nomeProfessor(p)
  };
}

function localizarProfessorPorCpf(professores, cpf) {
  const alvo = digitos(cpf);
  if (!alvo) return null;
  return professores.find(p => digitos(p.cpf) === alvo) || null;
}

function credencialConfere(professor, dados = {}) {
  const nascimento = dados.dataNascimento || dados.nascimento || dados.data_nascimento || "";
  const telefone = dados.telefone || dados.whatsapp || dados.celular || "";
  const cref = dados.cref || dados.senha || dados.chave || "";

  const porNascimento = nascimento && dataIgual(professor.dataNascimento || professor.nascimento || professor.data_nascimento, nascimento);
  const porTelefone = telefone && [professor.telefone, professor.whatsapp, professor.celular, professor.fone].some(v => telefoneIgual(v, telefone));
  const porCref = cref && normalizar(professor.cref) && normalizar(professor.cref) === normalizar(cref);
  const porEmail = cref && normalizar(professor.email) && normalizar(professor.email) === normalizar(cref);

  return Boolean(porNascimento || porTelefone || porCref || porEmail);
}

function professorBate(item = {}, professor) {
  const pid = idProfessor(professor);
  const nome = normalizar(nomeProfessor(professor));
  const cref = normalizar(professor?.cref);
  const ids = [item.professorId, item.professor_id, item.professorResponsavelId, item.professor_responsavel_id, item.professor_id_responsavel, item.treinadorId, item.avaliadorId].map(v => texto(v));
  if (pid && ids.includes(pid)) return true;
  const nomes = [item.professor, item.professorNome, item.professor_nome, item.professor_responsavel, item.professorResponsavel, item.professor_responsavel_nome, item.nomeProfessor, item.avaliador, item.treinador].map(normalizar);
  return Boolean((nome && nomes.some(n => n === nome || n.includes(nome) || nome.includes(n))) || (cref && nomes.some(n => n.includes(cref))));
}

function alunosDoProfessor(base, professor) {
  const porCadastro = base.alunos.filter(a => professorBate(a, professor));
  const ids = new Set(porCadastro.map(idAluno).filter(Boolean));
  for (const s of base.servicosContratados || []) {
    if (ativo(s) && professorBate(s, professor) && s.alunoId) ids.add(String(s.alunoId));
  }
  const lista = base.alunos.filter(a => ids.has(idAluno(a)));
  return lista.map(a => ({ id: idAluno(a), alunoId: idAluno(a), nome: nomeAluno(a), status: a.status || a.situacao || "Ativo", plano: a.plano || a.planoNome || a.nomePlano || "", telefone: a.telefone || a.whatsapp || "" }));
}

function treinosProfessor(base, professor) {
  return (base.treinos || []).filter(t => professorBate(t, professor));
}

function avaliacoesProfessor(base, professor) {
  return (base.avaliacoes || []).filter(a => professorBate(a, professor));
}

export async function statusPortalProfessor() {
  return { ok: true, modulo: "portal-professor", versao: "Fusion ERP 2.6.1-L", status: "Online" };
}

export async function acessarPortalProfessor(dados = {}) {
  const base = await carregarBasePortalProfessor();
  const cpf = dados.cpf || dados.documento || "";
  if (!digitos(cpf)) throw Object.assign(new Error("Informe o CPF do professor."), { status: 400 });
  const professor = localizarProfessorPorCpf(base.professores, cpf);
  if (!professor || !ativo(professor)) throw Object.assign(new Error("Professor não encontrado ou inativo."), { status: 404 });
  if (!credencialConfere(professor, dados)) throw Object.assign(new Error("Dados não conferem com o professor cadastrado."), { status: 401 });
  const professorLimpo = professorSanitizado(professor);
  const alunos = alunosDoProfessor(base, professorLimpo);
  const treinos = treinosProfessor(base, professorLimpo);
  const avaliacoes = avaliacoesProfessor(base, professorLimpo);
  return {
    ok: true,
    token: `fusion-professor-${professorLimpo.id || Date.now()}`,
    professor: professorLimpo,
    resumo: {
      alunos: alunos.length,
      treinos: treinos.length,
      avaliacoes: avaliacoes.length
    },
    alunos: alunos.slice(0, 20)
  };
}

export async function obterPortalProfessor(professorId, filtros = {}) {
  const base = await carregarBasePortalProfessor();
  const professor = (base.professores || []).find(p => idProfessor(p) === texto(professorId));
  if (!professor) throw Object.assign(new Error("Professor não encontrado."), { status: 404 });
  const professorLimpo = professorSanitizado(professor);
  const alunos = alunosDoProfessor(base, professorLimpo);
  const treinos = treinosProfessor(base, professorLimpo);
  const avaliacoes = avaliacoesProfessor(base, professorLimpo);
  return {
    ok: true,
    data: filtros.data || hojeISO(),
    professor: professorLimpo,
    alunos,
    treinos,
    avaliacoes,
    resumo: { alunos: alunos.length, treinos: treinos.length, avaliacoes: avaliacoes.length }
  };
}
