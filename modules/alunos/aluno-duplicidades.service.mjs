import crypto from "node:crypto";
import {
  executarTransacaoJson,
  lerJsonDuravel,
  salvarJsonDuravel
} from "../core/persistence/durable-json.mjs";
import { lerColecao } from "../core/persistence/collection-store.mjs";

const COLECOES = {
  alunos: ["alunos.json", []],
  matriculas: ["matriculas.json", []],
  mensalidades: ["mensalidades.json", []],
  financeiro: ["financeiro.json", []],
  recebimentos: ["recebimentos.json", []],
  caixa: ["caixa.json", { caixas: [], movimentos: [] }],
  checkins: ["checkins.json", []],
  avaliacoes: ["avaliacoes.json", []],
  agendaAvaliacoes: ["agenda_avaliacoes.json", []],
  treinosLegados: ["treinos.json", []],
  treinosPrescritos: ["treinos_prescritos.json", []],
  treinosIntegrados: ["treinos_integrados.json", []],
  treinosExecucoes: ["treinos_execucoes.json", []],
  historicoPlanos: ["alunos_historico_planos.json", []],
  accessLogs: ["access_logs.json", []],
  accessPresentes: ["access_pessoas_presentes.json", []],
  accessEventos: ["access_eventos.json", []],
  pagamentosOnline: ["pagamentos_online.json", []]
};

const ROTULOS = {
  matriculas: "matrícula",
  mensalidades: "mensalidade",
  financeiro: "lançamento financeiro",
  recebimentos: "recebimento",
  caixa: "movimento de caixa",
  checkins: "check-in",
  avaliacoes: "avaliação",
  agendaAvaliacoes: "agendamento de avaliação",
  treinosLegados: "treino legado",
  treinosPrescritos: "treino prescrito",
  treinosIntegrados: "treino integrado",
  treinosExecucoes: "execução de treino",
  historicoPlanos: "histórico de plano",
  accessLogs: "log de acesso",
  accessPresentes: "presença de acesso",
  accessEventos: "evento de acesso",
  pagamentosOnline: "pagamento online"
};

function texto(valor = "") { return String(valor ?? "").trim(); }
function normalizar(valor = "") { return texto(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function digitos(valor = "") { return texto(valor).replace(/\D/g, ""); }
function idAluno(aluno = {}) { return texto(aluno.id || aluno._id || aluno.codigo); }
function cpfAluno(aluno = {}) { return digitos(aluno.cpf || aluno.documento); }
function nomeAluno(aluno = {}) { return texto(aluno.nome || aluno.nomeCompleto || aluno.aluno || aluno.name); }
function statusAluno(aluno = {}) { return normalizar(aluno.status || aluno.situacao || aluno.statusMatricula || aluno.matriculaStatus || ""); }
function lista(valor) { return Array.isArray(valor) ? valor : []; }

function cadastroInativoSeguro(aluno = {}) {
  const estados = [aluno.status, aluno.situacao, aluno.statusMatricula, aluno.matriculaStatus].map(normalizar).filter(Boolean);
  const possuiAtivo = aluno.ativo === true || estados.some((valor) => ["ativo", "ativa", "regular", "matriculado", "matriculada"].includes(valor));
  const possuiInativo = aluno.ativo === false || estados.some((valor) => ["inativo", "inativa", "cancelado", "cancelada", "desligado", "desligada", "encerrado", "encerrada", "sem matricula"].includes(valor));
  return !possuiAtivo && possuiInativo;
}

function sanitizarAluno(aluno = {}) {
  return {
    id: idAluno(aluno),
    nome: nomeAluno(aluno),
    cpf: cpfAluno(aluno),
    telefone: texto(aluno.telefone || aluno.whatsapp || aluno.celular),
    status: texto(aluno.status || aluno.situacao || aluno.statusMatricula || "não informado"),
    ativo: aluno.ativo === true,
    origem: texto(aluno.origem || aluno.fonte || aluno.importadoDe || aluno.importado_de || aluno.status_legado_access || ""),
    criadoEm: texto(aluno.criadoEm || aluno.criado_em || aluno.createdAt || aluno.created_at || "")
  };
}

async function carregarBase({ transacional = false } = {}) {
  const ler = transacional ? lerJsonDuravel : lerColecao;
  const entradas = await Promise.all(
    Object.entries(COLECOES).map(
      async ([chave, [arquivo, padrao]]) => [
        chave,
        await ler(arquivo, padrao)
      ]
    )
  );
  return Object.fromEntries(entradas);
}

function valorId(item = {}, nomes = []) {
  for (const nome of nomes) {
    const valor = texto(item?.[nome]);
    if (valor) return valor;
  }
  return "";
}

function referenciaDiretaAluno(item = {}, alunoId = "") {
  const direto = valorId(item, ["alunoId", "aluno_id", "idAluno", "alunoCodigo", "aluno_codigo"]);
  if (direto && direto === alunoId) return true;
  const target = item?.target;
  if (target && typeof target === "object") {
    const alvo = valorId(target, ["alunoId", "aluno_id", "idAluno"]);
    if (alvo && alvo === alunoId) return true;
  }
  return false;
}

function referenciaMatricula(item = {}, matriculaIds = new Set()) {
  const ids = [item?.matriculaId, item?.matricula_id, item?.idMatricula, item?.target?.matriculaId, item?.target?.matricula_id].map(texto).filter(Boolean);
  return ids.some((id) => matriculaIds.has(id));
}

function referenciaMensalidade(item = {}, mensalidadeIds = new Set()) {
  const ids = [item?.mensalidadeId, item?.mensalidade_id, item?.target?.mensalidadeId, item?.target?.mensalidade_id].map(texto).filter(Boolean);
  return ids.some((id) => mensalidadeIds.has(id));
}

function itensDaBase(base = {}, chave = "") {
  if (chave === "caixa") return lista(base.caixa?.movimentos);
  return lista(base[chave]);
}

function auditarVinculosNaBase(base = {}, aluno = {}) {
  const alunoId = idAluno(aluno);
  const matriculas = itensDaBase(base, "matriculas").filter((item) => referenciaDiretaAluno(item, alunoId));
  const matriculaIds = new Set(matriculas.map((item) => texto(item.id || item.matriculaId)).filter(Boolean));
  const mensalidades = itensDaBase(base, "mensalidades").filter((item) => referenciaDiretaAluno(item, alunoId) || referenciaMatricula(item, matriculaIds));
  const mensalidadeIds = new Set(mensalidades.map((item) => texto(item.id || item.mensalidadeId)).filter(Boolean));
  const contagens = { matriculas: matriculas.length, mensalidades: mensalidades.length };
  const demais = ["financeiro", "recebimentos", "caixa", "checkins", "avaliacoes", "agendaAvaliacoes", "treinosLegados", "treinosPrescritos", "treinosIntegrados", "treinosExecucoes", "historicoPlanos", "accessLogs", "accessPresentes", "accessEventos", "pagamentosOnline"];
  for (const chave of demais) {
    contagens[chave] = itensDaBase(base, chave).filter((item) => referenciaDiretaAluno(item, alunoId) || referenciaMatricula(item, matriculaIds) || referenciaMensalidade(item, mensalidadeIds)).length;
  }
  const total = Object.values(contagens).reduce((soma, valor) => soma + Math.max(0, Number(valor) || 0), 0);
  const detalhes = Object.entries(contagens).filter(([, quantidade]) => quantidade > 0).map(([chave, quantidade]) => ({ chave, rotulo: ROTULOS[chave] || chave, quantidade }));
  return { total, contagens, detalhes };
}

function pontuarPrincipal(cadastro = {}, vinculos = {}) {
  const status = statusAluno(cadastro);
  const ativo = cadastro.ativo === true || ["ativo", "ativa", "regular"].includes(status);
  return (ativo ? 1000000 : 0) + Math.min(999999, (vinculos.total || 0) * 1000) + (nomeAluno(cadastro) ? 10 : 0) + (texto(cadastro.foto || cadastro.foto_base64) ? 5 : 0);
}

function erroOperacao(mensagem, code, status = 409) {
  const erro = new Error(mensagem);
  erro.code = code;
  erro.status = status;
  return erro;
}

function resumoCadastro(cadastro, vinculos) {
  const inativoSeguro = cadastroInativoSeguro(cadastro);
  const bloqueiosLocal = [];
  if (!inativoSeguro) bloqueiosLocal.push("O cadastro não está claramente inativo.");
  if ((vinculos.total || 0) > 0) bloqueiosLocal.push("O cadastro possui vínculos e exige consolidação.");
  return {
    ...sanitizarAluno(cadastro),
    vinculos: { total: vinculos.total, contagens: vinculos.contagens, detalhes: vinculos.detalhes },
    inativoSeguro,
    podeRemoverLocal: inativoSeguro && (vinculos.total || 0) === 0,
    bloqueiosLocal
  };
}

export async function listarDuplicidadesAlunos() {
  // GET deve ser estritamente somente leitura: não usa a camada que
  // pode normalizar mensalidades durante a leitura.
  const base = await carregarBase({ transacional: false });
  const alunos = lista(base.alunos);
  const gruposCpf = new Map();
  for (const aluno of alunos) {
    const cpf = cpfAluno(aluno);
    if (cpf.length !== 11) continue;
    if (!gruposCpf.has(cpf)) gruposCpf.set(cpf, []);
    gruposCpf.get(cpf).push(aluno);
  }
  const grupos = [];
  for (const [cpf, cadastros] of gruposCpf) {
    if (cadastros.length < 2) continue;
    const resumos = cadastros.map((cadastro) => {
      const vinculos = auditarVinculosNaBase(base, cadastro);
      return { resumo: resumoCadastro(cadastro, vinculos), pontuacao: pontuarPrincipal(cadastro, vinculos) };
    });
    resumos.sort((a, b) => b.pontuacao - a.pontuacao || String(a.resumo.criadoEm || a.resumo.id).localeCompare(String(b.resumo.criadoEm || b.resumo.id)));
    grupos.push({ cpf, quantidade: resumos.length, principalRecomendadoId: resumos[0]?.resumo?.id || "", cadastros: resumos.map((item) => item.resumo) });
  }
  grupos.sort((a, b) => a.cadastros[0]?.nome?.localeCompare(b.cadastros[0]?.nome || "", "pt-BR", { sensitivity: "base" }) || a.cpf.localeCompare(b.cpf));
  return { ok: true, totalGrupos: grupos.length, totalCadastrosDuplicados: grupos.reduce((soma, grupo) => soma + grupo.quantidade, 0), grupos };
}

export async function resolverDuplicidadeAluno({ principalId = "", duplicadoId = "", usuario = "operador", confirmacoesExternas = {} } = {}) {
  const principalAlvo = texto(principalId);
  const duplicadoAlvo = texto(duplicadoId);
  if (!principalAlvo || !duplicadoAlvo || principalAlvo === duplicadoAlvo) throw erroOperacao("Informe o cadastro principal e o duplicado.", "DUPLICATE_INVALID_SELECTION", 400);
  if (confirmacoesExternas.fontesConfirmadas !== true || confirmacoesExternas.aplicativo !== false || confirmacoesExternas.biometria !== false) throw erroOperacao("Não é seguro remover o duplicado: App e biometria precisam estar confirmados como ausentes.", "DUPLICATE_EXTERNAL_LINKS_NOT_CLEARED");

  return executarTransacaoJson(async () => {
    const base = await carregarBase({ transacional: true });
    const alunos = lista(base.alunos);
    const principal = alunos.find((item) => idAluno(item) === principalAlvo);
    const duplicado = alunos.find((item) => idAluno(item) === duplicadoAlvo);
    if (!principal || !duplicado) throw erroOperacao("Um dos cadastros não existe mais. Atualize a análise.", "DUPLICATE_STALE_SELECTION", 409);
    const cpfPrincipal = cpfAluno(principal);
    const cpfDuplicado = cpfAluno(duplicado);
    if (cpfPrincipal.length !== 11 || cpfPrincipal !== cpfDuplicado) throw erroOperacao("Os dois cadastros não possuem o mesmo CPF.", "DUPLICATE_CPF_MISMATCH", 409);
    if (!cadastroInativoSeguro(duplicado)) throw erroOperacao("O cadastro escolhido para remoção não está claramente inativo.", "DUPLICATE_NOT_INACTIVE", 409);
    const vinculos = auditarVinculosNaBase(base, duplicado);
    if (vinculos.total > 0) throw erroOperacao("O cadastro duplicado possui vínculos. Use consolidação assistida; a remoção automática foi bloqueada.", "DUPLICATE_HAS_LINKS", 409);
    const restantes = alunos.filter((item) => idAluno(item) !== duplicadoAlvo);
    if (restantes.length !== alunos.length - 1) throw erroOperacao("Não foi possível isolar exatamente um cadastro duplicado.", "DUPLICATE_DELETE_CARDINALITY", 409);
    const auditoriaRaw = await lerJsonDuravel("auditoria_integridade.json", []);
    const auditoria = Array.isArray(auditoriaRaw) ? auditoriaRaw : [];
    const evento = {
      id: `aud_dup_${crypto.randomUUID()}`,
      tipo: "aluno_duplicidade_resolvida",
      acao: "remocao_fisica_duplicado_sem_vinculos",
      usuario: texto(usuario) || "operador",
      criadoEm: new Date().toISOString(),
      cpf: cpfPrincipal,
      principal: sanitizarAluno(principal),
      removido: sanitizarAluno(duplicado),
      verificacoes: { inativo: true, vinculosLocais: 0, aplicativo: false, biometria: false }
    };
    auditoria.unshift(evento);
    await salvarJsonDuravel("alunos.json", restantes);
    await salvarJsonDuravel("auditoria_integridade.json", auditoria.slice(0, 3000));
    const mesmoCpfRestante = restantes.filter((item) => cpfAluno(item) === cpfPrincipal).length;
    return {
      ok: true,
      resolvido: true,
      principal: sanitizarAluno(principal),
      removido: sanitizarAluno(duplicado),
      vinculosAlterados: 0,
      cpfAgoraUnico: mesmoCpfRestante === 1,
      cadastrosMesmoCpfRestantes: mesmoCpfRestante,
      auditoriaId: evento.id,
      mensagem: mesmoCpfRestante === 1 ? "Duplicidade resolvida. O cadastro principal foi preservado." : "Duplicado vazio removido. Ainda existem outros cadastros com este CPF para revisar."
    };
  }, { operacaoId: `resolver-duplicidade-aluno-${duplicadoAlvo}-${crypto.randomUUID()}` });
}
