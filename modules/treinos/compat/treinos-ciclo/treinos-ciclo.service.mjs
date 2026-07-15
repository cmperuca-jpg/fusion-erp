import { carregarBaseCiclo, salvarCiclos, salvarTreinos } from "./treinos-ciclo.repository.mjs";

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function agoraISO() { return new Date().toISOString(); }
function gerarId(prefixo = "ciclo") { return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`; }
function texto(v) { return String(v ?? "").trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function numero(v, padrao = 0) { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : padrao; }
function ativo(item) { return !["cancelado","cancelada","encerrado","encerrada","inativo","inativa","arquivado","removido","removida","vencido"].includes(normalizar(item?.status || "Ativo")); }

function addDias(dataISO, dias) {
  const d = new Date(`${dataISO}T12:00:00`);
  d.setDate(d.getDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
}

function alunoNome(a = {}) {
  return texto(a.nome || a.aluno || a.name || a.nomeCompleto || "Aluno");
}

function localizarAluno(alunos, alunoId) {
  return alunos.find((a) => String(a.id || a._id || a.alunoId) === String(alunoId)) || null;
}

function treinosAluno(treinos, alunoId) {
  return treinos.filter((t) => String(t.alunoId) === String(alunoId));
}

function execucoesAluno(execucoes, alunoId) {
  return execucoes.filter((e) => String(e.alunoId) === String(alunoId));
}

function avaliacoesAluno(avaliacoes, alunoId) {
  return avaliacoes.filter((a) => String(a.alunoId || a.aluno_id) === String(alunoId))
    .sort((a,b) => String(b.data || b.criadoEm || "").localeCompare(String(a.data || a.criadoEm || "")));
}

function frequenciasAluno(frequencia, alunoId) {
  return frequencia.filter((f) => String(f.alunoId) === String(alunoId));
}

function percentualExecucao(execucao = {}) {
  const total = Array.isArray(execucao.exercicios) ? execucao.exercicios.length : 0;
  const concluidos = total ? execucao.exercicios.filter((x) => x.concluido).length : 0;
  return total ? Math.round((concluidos / total) * 100) : 0;
}

function resumoTreinos(treinos = [], execucoes = []) {
  const ativos = treinos.filter(ativo);
  const vencidos = treinos.filter((t) => texto(t.dataValidade) && texto(t.dataValidade) < hojeISO());
  const totalExecucoes = execucoes.length;
  const concluidas = execucoes.filter((e) => normalizar(e.status) === "concluido" || percentualExecucao(e) >= 100).length;
  const mediaConclusao = totalExecucoes
    ? Math.round(execucoes.reduce((s,e) => s + percentualExecucao(e), 0) / totalExecucoes)
    : 0;

  return {
    totalTreinos: treinos.length,
    ativos: ativos.length,
    vencidos: vencidos.length,
    arquivados: treinos.filter((t) => normalizar(t.status) === "arquivado").length,
    execucoes: totalExecucoes,
    execucoesConcluidas: concluidas,
    mediaConclusao
  };
}

function calcularEvolucao(base, alunoId) {
  const avals = avaliacoesAluno(base.avaliacoes, alunoId);
  const atual = avals[0] || null;
  const anterior = avals[1] || null;
  const freq = frequenciasAluno(base.frequencia, alunoId);
  const execs = execucoesAluno(base.execucoes, alunoId);
  const treinos = treinosAluno(base.treinos, alunoId);

  const evolucao = {
    peso: null,
    imc: null,
    gordura: null,
    massaMagra: null
  };

  if (atual && anterior) {
    evolucao.peso = numero(atual.peso) - numero(anterior.peso);
    evolucao.imc = numero(atual.imc) - numero(anterior.imc);
    evolucao.gordura = numero(atual.percentual_gordura || atual.gordura) - numero(anterior.percentual_gordura || anterior.gordura);
    evolucao.massaMagra = numero(atual.massa_magra || atual.massaMagra) - numero(anterior.massa_magra || anterior.massaMagra);
  }

  return {
    avaliacoes: avals.length,
    ultimaAvaliacao: atual,
    avaliacaoAnterior: anterior,
    variacao: evolucao,
    frequencias: freq.length,
    execucoesTreino: execs.length,
    treinos: resumoTreinos(treinos, execs)
  };
}

function marcarHistorico(item, acao, usuario, detalhes = {}) {
  const h = Array.isArray(item.historico) ? item.historico : [];
  return [...h, { id: gerarId("hist"), acao, usuario: usuario || "Administrador", detalhes, criadoEm: agoraISO() }];
}

export async function statusCicloTreino() {
  return {
    ok: true,
    modulo: "treinos-ciclo",
    versao: "Fusion ERP 2.5-F",
    status: "Online",
    conceito: "Ciclo de treino, renovação, arquivamento, vencimento e evolução do aluno"
  };
}

export async function obterEvolucaoAluno(alunoId) {
  const base = await carregarBaseCiclo();
  const aluno = localizarAluno(base.alunos, alunoId);
  const treinos = treinosAluno(base.treinos, alunoId);
  const execucoes = execucoesAluno(base.execucoes, alunoId);
  const ciclos = base.ciclos.filter((c) => String(c.alunoId) === String(alunoId));

  return {
    ok: true,
    aluno: aluno || { id: alunoId },
    resumo: resumoTreinos(treinos, execucoes),
    evolucao: calcularEvolucao(base, alunoId),
    ciclos: ciclos.sort((a,b) => String(b.criadoEm).localeCompare(String(a.criadoEm))),
    treinos: treinos.sort((a,b) => String(b.criadoEm || b.dataInicio).localeCompare(String(a.criadoEm || a.dataInicio))),
    execucoes: execucoes.sort((a,b) => String(b.criadoEm || b.data).localeCompare(String(a.criadoEm || a.data))).slice(0, 20)
  };
}

export async function criarCicloTreino(alunoId, dados = {}) {
  const base = await carregarBaseCiclo();
  const aluno = localizarAluno(base.alunos, alunoId);
  const dataInicio = dados.dataInicio || hojeISO();
  const duracaoDias = Number(dados.duracaoDias || 45);
  const dataFim = dados.dataFim || addDias(dataInicio, duracaoDias);

  const treinosAtivos = treinosAluno(base.treinos, alunoId).filter(ativo);
  const ciclo = {
    id: gerarId(),
    alunoId,
    aluno: alunoNome(aluno || { id: alunoId }),
    nome: dados.nome || `Ciclo ${dataInicio}`,
    objetivo: dados.objetivo || "",
    dataInicio,
    dataFim,
    duracaoDias,
    status: dados.status || "Ativo",
    treinosIds: treinosAtivos.map((t) => t.id),
    totalTreinos: treinosAtivos.length,
    observacao: dados.observacao || "",
    origem: "ciclo_treino_25f",
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    historico: [{ id: gerarId("hist"), acao: "criar_ciclo", usuario: dados.usuario || "Administrador", criadoEm: agoraISO() }]
  };

  for (const treino of base.treinos) {
    if (String(treino.alunoId) === String(alunoId) && ativo(treino)) {
      treino.cicloId = ciclo.id;
      treino.dataInicio = treino.dataInicio || dataInicio;
      treino.dataValidade = treino.dataValidade || dataFim;
      treino.atualizadoEm = agoraISO();
      treino.historico = marcarHistorico(treino, "vincular_ciclo", dados.usuario, { cicloId: ciclo.id });
    }
  }

  base.ciclos.push(ciclo);
  await salvarCiclos(base.ciclos);
  await salvarTreinos(base.treinos);

  return { ok: true, dados: ciclo };
}

export async function arquivarTreinosAnteriores(alunoId, dados = {}) {
  const base = await carregarBaseCiclo();
  let total = 0;

  for (const treino of base.treinos) {
    if (String(treino.alunoId) === String(alunoId) && ativo(treino)) {
      treino.status = "Arquivado";
      treino.motivoArquivamento = dados.motivo || "Arquivado por novo ciclo";
      treino.atualizadoEm = agoraISO();
      treino.historico = marcarHistorico(treino, "arquivar_treino", dados.usuario, { motivo: treino.motivoArquivamento });
      total += 1;
    }
  }

  await salvarTreinos(base.treinos);
  return { ok: true, alunoId, arquivados: total };
}

export async function renovarCiclo(alunoId, dados = {}) {
  const base = await carregarBaseCiclo();
  const ciclosAluno = base.ciclos.filter((c) => String(c.alunoId) === String(alunoId));
  const cicloAtual = ciclosAluno.find((c) => ativo(c)) || ciclosAluno.sort((a,b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))[0] || null;

  if (dados.arquivarAnteriores === true || dados.arquivarAnteriores === "true") {
    for (const treino of base.treinos) {
      if (String(treino.alunoId) === String(alunoId) && ativo(treino)) {
        treino.status = "Arquivado";
        treino.atualizadoEm = agoraISO();
        treino.historico = marcarHistorico(treino, "arquivar_por_renovacao", dados.usuario);
      }
    }
  }

  if (cicloAtual && ativo(cicloAtual)) {
    cicloAtual.status = "Encerrado";
    cicloAtual.dataEncerramento = hojeISO();
    cicloAtual.atualizadoEm = agoraISO();
    cicloAtual.historico = marcarHistorico(cicloAtual, "encerrar_por_renovacao", dados.usuario);
  }

  const dataInicio = dados.dataInicio || hojeISO();
  const duracaoDias = Number(dados.duracaoDias || cicloAtual?.duracaoDias || 45);
  const novoCiclo = {
    id: gerarId(),
    alunoId,
    aluno: cicloAtual?.aluno || "",
    nome: dados.nome || `Renovação ${dataInicio}`,
    objetivo: dados.objetivo || cicloAtual?.objetivo || "",
    dataInicio,
    dataFim: dados.dataFim || addDias(dataInicio, duracaoDias),
    duracaoDias,
    status: "Ativo",
    treinosIds: [],
    totalTreinos: 0,
    cicloAnteriorId: cicloAtual?.id || "",
    observacao: dados.observacao || "",
    origem: "renovacao_ciclo_25f",
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    historico: [{ id: gerarId("hist"), acao: "renovar_ciclo", usuario: dados.usuario || "Administrador", criadoEm: agoraISO() }]
  };

  base.ciclos.push(novoCiclo);
  await salvarCiclos(base.ciclos);
  await salvarTreinos(base.treinos);

  return { ok: true, cicloAnterior: cicloAtual, novoCiclo };
}

export async function processarVencimentos(dados = {}) {
  const base = await carregarBaseCiclo();
  const hoje = dados.data || hojeISO();
  let treinosVencidos = 0;
  let ciclosVencidos = 0;

  for (const treino of base.treinos) {
    if (ativo(treino) && texto(treino.dataValidade) && texto(treino.dataValidade) < hoje) {
      treino.status = "Vencido";
      treino.atualizadoEm = agoraISO();
      treino.historico = marcarHistorico(treino, "vencer_treino", dados.usuario, { data: hoje });
      treinosVencidos += 1;
    }
  }

  for (const ciclo of base.ciclos) {
    if (ativo(ciclo) && texto(ciclo.dataFim) && texto(ciclo.dataFim) < hoje) {
      ciclo.status = "Vencido";
      ciclo.atualizadoEm = agoraISO();
      ciclo.historico = marcarHistorico(ciclo, "vencer_ciclo", dados.usuario, { data: hoje });
      ciclosVencidos += 1;
    }
  }

  await salvarTreinos(base.treinos);
  await salvarCiclos(base.ciclos);
  return { ok: true, data: hoje, treinosVencidos, ciclosVencidos };
}

export async function relatorioEvolucaoGeral() {
  const base = await carregarBaseCiclo();
  const alunosIds = [...new Set(base.treinos.map((t) => t.alunoId).filter(Boolean))];

  const alunos = alunosIds.map((alunoId) => {
    const aluno = localizarAluno(base.alunos, alunoId);
    const treinos = treinosAluno(base.treinos, alunoId);
    const execucoes = execucoesAluno(base.execucoes, alunoId);
    return {
      alunoId,
      aluno: alunoNome(aluno || { id: alunoId }),
      resumo: resumoTreinos(treinos, execucoes),
      evolucao: calcularEvolucao(base, alunoId)
    };
  });

  return {
    ok: true,
    totalAlunos: alunos.length,
    alunos
  };
}
