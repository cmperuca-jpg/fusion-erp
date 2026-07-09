import fs from 'fs/promises';
import path from 'path';
import { professorSchema, professorUpdateSchema } from './professores.schema.mjs';
import { listarProfessores, buscarProfessorPorId, buscarProfessorPorCpf, buscarProfessorPorEmail, criarProfessor, atualizarProfessor, excluirProfessor, verificarSenha, limparCpf } from './professores.repository.mjs';

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
  const alunosVinculados = Array.isArray(alunos) ? alunos.filter(a => contemProfessor(a, professor)) : [];
  const avaliacoesVinculadas = Array.isArray(avaliacoes) ? avaliacoes.filter(a => contemProfessor(a, professor)) : [];
  const treinosVinculados = treinosBase.filter(t => contemProfessor(t, professor));

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
  return limpo;
}
function professorAtivo(p = {}) {
  return !['inativo','inativa','cancelado','cancelada','excluido','excluído','removido'].includes(normalizar(p.status || 'Ativo'));
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

export async function login(dados = {}) {
  const identificador = String(dados.cpf || dados.email || dados.identificador || '').trim();
  const credencial = String(dados.senha || dados.credencial || dados.acesso || dados.dataNascimento || dados.telefone || dados.cref || '').trim();
  if (!identificador) throw Object.assign(new Error('Informe CPF ou e-mail do professor.'), { status: 400 });
  if (!credencial) throw Object.assign(new Error('Informe a senha ou dado de acesso do professor.'), { status: 400 });

  const professor = identificador.includes('@')
    ? await buscarProfessorPorEmail(identificador)
    : await buscarProfessorPorCpf(identificador);

  if (!professor) throw Object.assign(new Error('Professor não encontrado no cadastro.'), { status: 401 });
  if (!professorAtivo(professor)) throw Object.assign(new Error('Professor inativo ou bloqueado.'), { status: 403 });

  const senhaOk = professor.senhaHash ? verificarSenha(credencial, professor.senhaHash) : false;
  const senhaTextoOk = professor.senha ? String(professor.senha) === String(credencial) : false;
  // Compatibilidade total com professores já cadastrados antes da autenticação real.
  // Mesmo que já exista senhaHash, também aceita os dados cadastrais do professor
  // para não bloquear registros antigos ou editados sem senha conhecida.
  const legadoOk = credencialLegadaConfere(professor, credencial);
  if (!senhaOk && !senhaTextoOk && !legadoOk) throw Object.assign(new Error('Dados de acesso do professor inválidos. Use CPF + data de nascimento, telefone/WhatsApp, CREF, e-mail, nome ou senha cadastrada.'), { status: 401 });

  const prof = sanitizarProfessorSessao(professor);
  return {
    ok: true,
    token: `fusion-professor-${prof.id}-${Date.now()}`,
    professor: prof,
    usuario: { ...prof, perfil: 'professor', professorId: prof.id },
    mensagem: 'Professor autenticado com sucesso.'
  };
}
