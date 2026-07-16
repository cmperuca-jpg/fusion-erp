import fs from 'fs/promises';
import path from 'path';
import { professorSchema, professorUpdateSchema } from './professores.schema.mjs';
import { listarProfessores, buscarProfessorPorId, buscarProfessorPorCpf, buscarProfessorPorEmail, buscarProfessorPorIdentificador, criarProfessor, atualizarProfessor, excluirProfessor, alterarStatusProfessor, verificarSenha, limparCpf } from './professores.repository.mjs';
import { gerarTokenPortal, validarTokenPortal } from '../auth/auth.service.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
async function lerJson(nome, padrao = []) {
  const arquivo = path.join(DATA_DIR, nome);
  try { const raw = await fs.readFile(arquivo, 'utf-8'); return raw.trim() ? JSON.parse(raw) : padrao; }
  catch { return padrao; }
}
function erroValidacao(r) { return r.error.issues.map(i => i.message).join(', '); }
function normalizar(v) { return String(v || '').trim().toLowerCase(); }
function idProfessor(p = {}) { return String(p.id || p.professorId || p.professor_id || ''); }
function nomeProfessor(p = {}) { return String(p.nome || p.professor || p.name || '').trim(); }
function ehResponsavelTecnico(p = {}) {
  const perfil = normalizar(p.perfil || p.tipoPerfil || p.funcao || '');
  const login = normalizar(p.login || '');
  const nome = normalizar(nomeProfessor(p));
  return p.acessoTodosAlunos === true ||
    perfil === 'responsavel_tecnico' ||
    perfil === 'responsavel-tecnico' ||
    login === 'responsavel-tecnico' ||
    nome === 'responsavel-tecnico';
}
function contemProfessor(item = {}, professor) {
  const id = idProfessor(professor);
  const nome = normalizar(nomeProfessor(professor));
  const cref = normalizar(professor?.cref);

  const ids = [
    item.professorId, item.professor_id, item.idProfessor, item.professorResponsavelId,
    item.professor_responsavel_id, item.professor_id_responsavel, item.professorResponsavel,
    item.professor_responsavel, item.treinadorId, item.avaliadorId
  ].filter(v => v !== undefined && v !== null).map(v => String(v));
  if (id && ids.some(v => v === id)) return true;

  const nomes = [
    item.professor, item.professorNome, item.professor_nome, item.nomeProfessor,
    item.professorResponsavel, item.professor_responsavel, item.professor_responsavel_nome,
    item.avaliador, item.avaliadorNome, item.treinador, item.treinadorNome
  ].map(normalizar).filter(Boolean);
  if (nome && nomes.some(v => v === nome || v.includes(nome) || nome.includes(v))) return true;
  if (cref && nomes.some(v => v.includes(cref))) return true;

  return false;
}

export async function listar(filtros = {}) {
  let lista = await listarProfessores();
  const q = normalizar(filtros.q || filtros.busca || '');
  const status = normalizar(filtros.status || '');
  if (q) lista = lista.filter(p => normalizar([p.nome, p.cpf, p.cref, p.email, p.telefone, p.especialidade, ...(p.especialidades || []), ...(p.modalidades || [])].join(' ')).includes(q));
  if (status) lista = lista.filter(p => normalizar(p.status) === status);
  return lista.sort((a,b) => nomeProfessor(a).localeCompare(nomeProfessor(b), 'pt-BR'));
}

export async function buscar(id) { return await buscarProfessorPorId(id); }

export async function criar(dados) {
  const r = professorSchema.safeParse(dados);
  if (!r.success) throw new Error(erroValidacao(r));
  return await criarProfessor(r.data);
}

export async function atualizar(id, dados) {
  const r = professorUpdateSchema.safeParse(dados);
  if (!r.success) throw new Error(erroValidacao(r));
  return await atualizarProfessor(id, r.data);
}

export async function excluir(id) { return await excluirProfessor(id); }

export async function prontuario(id) {
  const professor = await buscarProfessorPorId(id);
  if (!professor) return null;

  const [agenda, turmas, alunos, avaliacoes, treinosPrescritos, treinosLegado] = await Promise.all([
    lerJson('agenda.json', []),
    lerJson('turmas.json', []),
    lerJson('alunos.json', []),
    lerJson('avaliacoes.json', []),
    lerJson('treinos_prescritos.json', []),
    lerJson('treinos.json', [])
  ]);

  const treinosBase = [
    ...(Array.isArray(treinosPrescritos) ? treinosPrescritos : []),
    ...(Array.isArray(treinosLegado) ? treinosLegado : [])
  ];

  const turmasVinculadas = Array.isArray(turmas) ? turmas.filter(t => contemProfessor(t, professor)) : [];
  const agendaVinculada = Array.isArray(agenda) ? agenda.filter(a => contemProfessor(a, professor)) : [];
  const acessoGlobal = ehResponsavelTecnico(professor);
  const alunosVinculados = Array.isArray(alunos)
    ? (acessoGlobal ? alunos : alunos.filter(a => contemProfessor(a, professor)))
    : [];
  const avaliacoesVinculadas = Array.isArray(avaliacoes)
    ? (acessoGlobal ? avaliacoes : avaliacoes.filter(a => contemProfessor(a, professor)))
    : [];
  const treinosVinculados = acessoGlobal
    ? treinosBase
    : treinosBase.filter(t => contemProfessor(t, professor));

  const linhaTempo = [
    ...agendaVinculada.map(a => ({ tipo:'agenda', data:a.data || a.inicio || a.criadoEm || '', descricao:a.titulo || a.turma || a.nome || 'Agenda vinculada' })),
    ...turmasVinculadas.map(t => ({ tipo:'turma', data:t.criadoEm || t.atualizadoEm || '', descricao:t.nome || t.turma || 'Turma vinculada' })),
    ...avaliacoesVinculadas.map(a => ({ tipo:'avaliacao', data:a.data || a.criadoEm || a.criado_em || '', descricao:`Avaliação ${a.aluno || a.alunoNome || ''}`.trim() })),
    ...treinosVinculados.map(t => ({ tipo:'treino', data:t.dataPrescricao || t.criadoEm || t.criado_em || '', descricao:`Treino ${t.alunoNome || t.aluno || ''}`.trim() || t.nome || 'Treino prescrito' }))
  ].sort((a,b) => String(b.data).localeCompare(String(a.data))).slice(0, 80);

  return {
    ok:true,
    professor,
    resumo:{
      turmas: turmasVinculadas.length,
      agenda: agendaVinculada.length,
      alunos: alunosVinculados.length,
      avaliacoes: avaliacoesVinculadas.length,
      treinos: treinosVinculados.length,
      documentos: Array.isArray(professor.documentos) ? professor.documentos.length : 0
    },
    turmas: turmasVinculadas,
    agenda: agendaVinculada,
    alunos: alunosVinculados,
    avaliacoes: avaliacoesVinculadas,
    treinos: treinosVinculados,
    documentos: Array.isArray(professor.documentos) ? professor.documentos : [],
    linhaTempo
  };
}


function apenasDigitos(v) { return String(v || '').replace(/\D/g, ''); }
function dataCompat(a, b) {
  const x = String(a || '').slice(0, 10);
  const y = String(b || '').slice(0, 10);
  if (!x || !y) return false;
  return x === y || x.split('-').reverse().join('/') === y || y.split('-').reverse().join('/') === x;
}
function telefoneCompat(a, b) {
  const x = apenasDigitos(a), y = apenasDigitos(b);
  if (!x || !y) return false;
  return x === y || x.endsWith(y) || y.endsWith(x);
}
function textoCompat(a, b) {
  const x = normalizar(a), y = normalizar(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}
function sanitizarProfessorSessao(p = {}) {
  const { senha, senhaHash, documentos, ...limpo } = p;
  return {
    ...limpo,
    perfil: ehResponsavelTecnico(p) ? 'responsavel_tecnico' : (p.perfil || 'professor'),
    acessoTodosAlunos: ehResponsavelTecnico(p)
  };
}
function professorAtivo(p = {}) {
  return !['inativo','inativa','cancelado','cancelada','excluido','excluído','removido','bloqueado','bloqueada'].includes(normalizar(p.status || 'Ativo')) && p.bloqueado !== true;
}
function credencialLegadaConfere(p = {}, credencial = '') {
  const c = String(credencial || '').trim();
  if (!c) return false;
  const digitos = apenasDigitos(c);
  const cpfProfessor = apenasDigitos(p.cpf);
  return dataCompat(p.dataNascimento || p.nascimento || p.data_nascimento, c)
    || telefoneCompat(p.telefone, c)
    || telefoneCompat(p.whatsapp, c)
    || telefoneCompat(p.celular, c)
    || textoCompat(p.cref, c)
    || textoCompat(p.email, c)
    || textoCompat(p.nome, c)
    || Boolean(digitos && cpfProfessor && digitos === cpfProfessor);
}


export async function alterarStatus(id, status, solicitante = {}) {
  if (!ehResponsavelTecnico(solicitante)) {
    throw Object.assign(new Error('Somente o responsável técnico pode bloquear ou desbloquear professores.'), { status: 403 });
  }
  if (String(solicitante.id || solicitante.professorId || '') === String(id)) {
    throw Object.assign(new Error('O responsável técnico não pode bloquear o próprio acesso.'), { status: 400 });
  }
  const professor = await alterarStatusProfessor(id, status);
  if (!professor) return null;
  return sanitizarProfessorSessao(professor);
}

export async function login(dados = {}) {
  const identificador = String(
    dados.login || dados.cpf || dados.email || dados.identificador || ''
  ).trim();
  const credencial = String(
    dados.senha || dados.credencial || dados.acesso || dados.dataNascimento ||
    dados.telefone || dados.cref || ''
  ).trim();

  if (!identificador) {
    throw Object.assign(new Error('Informe login, CPF, e-mail, CREF, telefone ou nome.'), { status: 400 });
  }
  if (!credencial) {
    throw Object.assign(new Error('Informe a senha do professor.'), { status: 400 });
  }

  const professor = await buscarProfessorPorIdentificador(identificador);

  if (!professor) throw Object.assign(new Error('Professor não encontrado no cadastro.'), { status: 401 });
  if (!professorAtivo(professor)) throw Object.assign(new Error('Professor inativo ou bloqueado.'), { status: 403 });

  const senhaOk = professor.senhaHash ? verificarSenha(credencial, professor.senhaHash) : false;
  const senhaTextoOk = professor.senha ? String(professor.senha) === String(credencial) : false;
  const legadoOk = !professor.senhaHash && credencialLegadaConfere(professor, credencial);

  if (!senhaOk && !senhaTextoOk && !legadoOk) {
    throw Object.assign(new Error('Senha inválida.'), { status: 401 });
  }

  const prof = sanitizarProfessorSessao(professor);
  return {
    ok: true,
    token: gerarTokenPortal({
      sub: prof.id,
      tipo: 'professor',
      perfil: prof.perfil,
      permissoes: prof.acessoTodosAlunos === true ? ['professores', 'avaliacoes', 'treinos'] : ['avaliacoes', 'treinos']
    }),
    professor: prof,
    usuario: {
      ...prof,
      perfil: prof.perfil,
      professorId: prof.id,
      acessoTodosAlunos: prof.acessoTodosAlunos === true,
      permissoes: prof.acessoTodosAlunos === true
        ? ['alunos_visualizar_todos', 'alunos_ativos', 'alunos_inativos', 'avaliacoes_visualizar_todas', 'avaliacoes_criar', 'avaliacoes_editar', 'avaliacoes_excluir', 'treinos_visualizar_todos', 'treinos_criar', 'treinos_editar', 'treinos_excluir', 'professores_visualizar', 'professores_bloquear', 'professores_desbloquear']
        : ['alunos_visualizar_vinculados', 'avaliacoes_criar', 'avaliacoes_editar_proprias', 'treinos_criar', 'treinos_editar_proprios']
    },
    mensagem: 'Professor autenticado com sucesso.'
  };
}

export async function validarSessao(tokenOuAuthorization = '') {
  const payload = validarTokenPortal(tokenOuAuthorization, 'professor');
  const professor = await buscarProfessorPorId(payload.sub);
  if (!professor || !professorAtivo(professor)) {
    throw Object.assign(new Error('Professor não encontrado, inativo ou bloqueado.'), { status: 401 });
  }
  return sanitizarProfessorSessao(professor);
}
