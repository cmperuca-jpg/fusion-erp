import { carregarBaseConsolidacao, salvarCiclos, salvarTreinos } from "./treinos-consolidacao.repository.mjs";

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function agoraISO() { return new Date().toISOString(); }
function gerarId(prefixo = "trn") { return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`; }
function texto(v) { return String(v ?? "").trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function numero(v, padrao = 0) { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : padrao; }
function ativo(item) { return !["cancelado","cancelada","encerrado","encerrada","inativo","inativa","arquivado","removido","removida","vencido"].includes(normalizar(item?.status || "Ativo")); }

function addDias(dataISO, dias) {
  const d = new Date(`${dataISO}T12:00:00`);
  d.setDate(d.getDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
}

function alunoNome(a = {}) { return texto(a.nome || a.aluno || a.name || a.nomeCompleto || "Aluno"); }
function localizarAluno(alunos, alunoId) { return alunos.find((a) => String(a.id || a._id || a.alunoId) === String(alunoId)) || null; }

function localizarProfessor(professores, chave = "") {
  const alvo = normalizar(chave);
  if (!alvo) return null;
  return professores.find((p) => String(p.id) === String(chave) || normalizar(p.nome).includes(alvo) || alvo.includes(normalizar(p.nome))) || null;
}

function contratoAtivoAluno(contratos, alunoId) {
  const lista = contratos.filter((c) => String(c.alunoId) === String(alunoId));
  return lista.find(ativo) || lista[0] || null;
}

function servicosAtivosDoContrato(servicos, contratoId) {
  return servicos.filter((s) => String(s.contratoId) === String(contratoId) && ativo(s));
}

function buscarServicoTreino(servicos, dados = {}) {
  if (dados.servicoContratadoId) {
    const item = servicos.find((s) => String(s.id || s.servicoContratadoId) === String(dados.servicoContratadoId));
    if (item) return item;
  }
  if (dados.modalidade) {
    const mod = normalizar(dados.modalidade);
    const item = servicos.find((s) => normalizar(s.modalidade || s.nome || s.turma).includes(mod));
    if (item) return item;
  }
  const preferido = servicos.find((s) => {
    const txt = normalizar([s.nome, s.servico, s.modalidade, s.turma].join(" "));
    return txt.includes("musculacao") || txt.includes("funcional") || txt.includes("personal") || txt.includes("treino");
  });
  return preferido || servicos[0] || null;
}

function historico(item, acao, usuario, detalhes = {}) {
  const h = Array.isArray(item.historico) ? item.historico : [];
  return [...h, { id: gerarId("hist"), acao, usuario: usuario || "Administrador", detalhes, criadoEm: agoraISO() }];
}

function gruposPorDivisao(divisao = "Full Body") {
  const d = normalizar(divisao);
  if (d.includes("abc") && !d.includes("abcd")) {
    return [
      { nome: "Treino A", grupos: ["Peito", "Ombros", "Tríceps"], diasSemana: "Segunda e Quinta" },
      { nome: "Treino B", grupos: ["Costas", "Bíceps"], diasSemana: "Terça e Sexta" },
      { nome: "Treino C", grupos: ["Pernas", "Glúteos", "Core"], diasSemana: "Quarta e Sábado" }
    ];
  }
  if (d.includes("abcd")) {
    return [
      { nome: "Treino A", grupos: ["Peito", "Tríceps"], diasSemana: "Segunda" },
      { nome: "Treino B", grupos: ["Costas", "Bíceps"], diasSemana: "Terça" },
      { nome: "Treino C", grupos: ["Pernas", "Glúteos"], diasSemana: "Quarta" },
      { nome: "Treino D", grupos: ["Ombros", "Core", "Cardio"], diasSemana: "Quinta" }
    ];
  }
  return [{ nome: "Full Body", grupos: ["Pernas", "Peito", "Costas", "Ombros", "Core"], diasSemana: "Segunda, Quarta e Sexta" }];
}

function correspondeGrupo(ex, grupos = []) {
  const set = new Set(grupos.map(normalizar));
  return set.has(normalizar(ex.grupoMuscular)) ||
    (Array.isArray(ex.gruposSecundarios) && ex.gruposSecundarios.some((g) => set.has(normalizar(g))));
}

function correspondeObjetivo(ex, objetivo = "") {
  const obj = normalizar(objetivo);
  const lista = Array.isArray(ex.objetivo) ? ex.objetivo.map(normalizar) : [];
  return !obj || !lista.length || lista.some((x) => x.includes(obj) || obj.includes(x));
}

function nivelPeso(nivel) {
  const n = normalizar(nivel);
  if (n.includes("avanc")) return 3;
  if (n.includes("inter")) return 2;
  return 1;
}

function prescrever(ex, objetivo, nivel) {
  const obj = normalizar(objetivo);
  let series = Number(ex.padraoSeries || 3);
  let repeticoes = ex.padraoRepeticoes || "10-12";
  let descanso = ex.padraoDescanso || "60s";

  if (obj.includes("hipertrof")) { series = Math.max(series, 4); repeticoes = "8-12"; descanso = "60-90s"; }
  if (obj.includes("emagrec") || obj.includes("condicion")) { series = Math.min(Math.max(series, 2), 3); repeticoes = normalizar(ex.grupoMuscular).includes("cardio") ? (ex.padraoRepeticoes || "15-30 min") : "12-15"; descanso = "30-60s"; }

  return {
    id: gerarId("tex"),
    exercicioId: ex.id || "",
    ordem: 0,
    nome: ex.nome,
    grupoMuscular: ex.grupoMuscular || "",
    equipamento: ex.equipamento || "",
    series,
    repeticoes,
    carga: "",
    descanso,
    tempo: ex.tempoExecucao || "",
    cadencia: "",
    intensidade: "",
    observacao: "",
    instrucoes: ex.instrucoes || "",
    cuidados: ex.cuidados || "",
    videoUrl: ex.videoUrl || "",
    imagemUrl: ex.imagemUrl || "",
    status: "Ativo"
  };
}

function selecionarExercicios(biblioteca, grupos, objetivo, nivel, limite = 6) {
  const candidatos = biblioteca.filter(ativo).filter((ex) => correspondeGrupo(ex, grupos));
  const lista = (candidatos.length ? candidatos : biblioteca.filter(ativo))
    .sort((a,b) => {
      const ao = correspondeObjetivo(a, objetivo) ? 1 : 0;
      const bo = correspondeObjetivo(b, objetivo) ? 1 : 0;
      if (ao !== bo) return bo - ao;
      return Math.abs(nivelPeso(a.nivel) - nivelPeso(nivel)) - Math.abs(nivelPeso(b.nivel) - nivelPeso(nivel));
    });

  const usados = new Set();
  const out = [];

  for (const grupo of grupos) {
    const ex = lista.find((x) => !usados.has(x.id) && normalizar(x.grupoMuscular) === normalizar(grupo));
    if (ex) { usados.add(ex.id); out.push(prescrever(ex, objetivo, nivel)); }
  }

  for (const ex of lista) {
    if (out.length >= limite) break;
    if (usados.has(ex.id)) continue;
    usados.add(ex.id);
    out.push(prescrever(ex, objetivo, nivel));
  }

  return out.map((ex, i) => ({ ...ex, ordem: i + 1 }));
}

function percentualExecucao(exec = {}) {
  const total = Array.isArray(exec.exercicios) ? exec.exercicios.length : 0;
  const done = total ? exec.exercicios.filter((x) => x.concluido).length : 0;
  return total ? Math.round((done / total) * 100) : 0;
}

function calcularResumoAluno(base, alunoId) {
  const treinos = base.treinos.filter((t) => String(t.alunoId) === String(alunoId));
  const execucoes = base.execucoes.filter((e) => String(e.alunoId) === String(alunoId));
  const ciclos = base.ciclos.filter((c) => String(c.alunoId) === String(alunoId));
  const avaliacoes = base.avaliacoes.filter((a) => String(a.alunoId || a.aluno_id) === String(alunoId));
  const frequencias = base.frequencia.filter((f) => String(f.alunoId) === String(alunoId));
  const media = execucoes.length ? Math.round(execucoes.reduce((s,e) => s + percentualExecucao(e), 0) / execucoes.length) : 0;

  return {
    treinosTotal: treinos.length,
    treinosAtivos: treinos.filter(ativo).length,
    treinosArquivados: treinos.filter((t) => normalizar(t.status) === "arquivado").length,
    ciclosTotal: ciclos.length,
    cicloAtivo: ciclos.find(ativo) || null,
    execucoes: execucoes.length,
    mediaConclusao: media,
    avaliacoes: avaliacoes.length,
    frequencias: frequencias.length
  };
}

export async function statusConsolidacaoTreino() {
  return {
    ok: true,
    modulo: "treinos-consolidacao",
    versao: "Fusion ERP 2.5-G",
    status: "Online",
    conceito: "Consolidação final do treino no ERP com ciclo limpo, arquivamento e integração operacional"
  };
}

export async function iniciarCicloLimpo(alunoId, dados = {}) {
  const base = await carregarBaseConsolidacao();
  const aluno = localizarAluno(base.alunos, alunoId);
  const contrato = contratoAtivoAluno(base.contratos, alunoId);
  if (!contrato) throw Object.assign(new Error("Aluno sem contrato comercial ativo."), { status: 403 });

  const servicos = servicosAtivosDoContrato(base.servicosContratados, contrato.id);
  const servicoTreino = buscarServicoTreino(servicos, dados);
  if (!servicoTreino) throw Object.assign(new Error("Aluno sem serviço ativo para treino."), { status: 403 });

  const usuario = dados.usuario || "Consolidação 2.5-G";
  let arquivados = 0;
  for (const treino of base.treinos) {
    if (String(treino.alunoId) === String(alunoId) && ativo(treino)) {
      treino.status = "Arquivado";
      treino.motivoArquivamento = dados.motivo || "Novo ciclo limpo iniciado";
      treino.atualizadoEm = agoraISO();
      treino.historico = historico(treino, "arquivar_por_ciclo_limpo", usuario, { motivo: treino.motivoArquivamento });
      arquivados += 1;
    }
  }

  for (const ciclo of base.ciclos) {
    if (String(ciclo.alunoId) === String(alunoId) && ativo(ciclo)) {
      ciclo.status = "Encerrado";
      ciclo.dataEncerramento = hojeISO();
      ciclo.atualizadoEm = agoraISO();
      ciclo.historico = historico(ciclo, "encerrar_por_ciclo_limpo", usuario);
    }
  }

  const dataInicio = dados.dataInicio || hojeISO();
  const duracaoDias = Number(dados.duracaoDias || 45);
  const dataFim = dados.dataFim || addDias(dataInicio, duracaoDias);
  const objetivo = dados.objetivo || "Condicionamento";
  const nivel = dados.nivel || "Iniciante";
  const tipoDivisao = dados.tipoDivisao || dados.divisao || "ABC";
  const limitePorBloco = Math.max(3, Number(dados.limitePorBloco || 6));
  const blocos = gruposPorDivisao(tipoDivisao);
  const professor = localizarProfessor(base.professores, dados.professorId || dados.professor || servicoTreino.professor);

  const ciclo = {
    id: gerarId("ciclo"),
    alunoId,
    aluno: alunoNome(aluno || { id: alunoId }),
    contratoId: contrato.id,
    nome: dados.nome || `Ciclo limpo ${dataInicio}`,
    objetivo,
    nivel,
    tipoDivisao,
    dataInicio,
    dataFim,
    duracaoDias,
    status: "Ativo",
    treinosIds: [],
    totalTreinos: 0,
    origem: "consolidacao_25g_ciclo_limpo",
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    historico: [{ id: gerarId("hist"), acao: "iniciar_ciclo_limpo", usuario, criadoEm: agoraISO() }]
  };

  const novosTreinos = blocos.map((bloco) => {
    const exercicios = selecionarExercicios(base.biblioteca, bloco.grupos, objetivo, nivel, limitePorBloco);
    return {
      id: gerarId("trn"),
      alunoId,
      aluno: alunoNome(aluno || { id: alunoId }),
      contratoId: contrato.id,
      matriculaId: contrato.matriculaId || "",
      numeroMatricula: contrato.numeroMatricula || "",
      cicloId: ciclo.id,
      servicoContratadoId: servicoTreino.id || servicoTreino.servicoContratadoId || "",
      turmaId: servicoTreino.turmaId || "",
      turma: servicoTreino.turma || servicoTreino.nome || "",
      modalidade: servicoTreino.modalidade || "",
      professorId: professor?.id || dados.professorId || "",
      professor: professor?.nome || dados.professor || servicoTreino.professor || "",
      objetivo,
      nivel,
      nome: bloco.nome,
      tipoDivisao,
      gruposMusculares: bloco.grupos,
      dataInicio,
      dataValidade: dataFim,
      diasSemana: dados.diasSemana || bloco.diasSemana,
      status: "Ativo",
      exercicios,
      observacao: dados.observacao || "",
      origem: "consolidacao_25g",
      criadoEm: agoraISO(),
      atualizadoEm: agoraISO(),
      versao: 1,
      historico: [{ id: gerarId("hist"), acao: "criar_treino_ciclo_limpo", usuario, criadoEm: agoraISO() }]
    };
  });

  ciclo.treinosIds = novosTreinos.map((t) => t.id);
  ciclo.totalTreinos = novosTreinos.length;

  base.treinos.push(...novosTreinos);
  base.ciclos.push(ciclo);

  await salvarTreinos(base.treinos);
  await salvarCiclos(base.ciclos);

  return {
    ok: true,
    aluno: aluno || { id: alunoId },
    contrato,
    servicoTreino,
    arquivados,
    ciclo,
    treinosCriados: novosTreinos.length,
    treinos: novosTreinos
  };
}

export async function consolidarAluno(alunoId, dados = {}) {
  const base = await carregarBaseConsolidacao();
  const resumoAntes = calcularResumoAluno(base, alunoId);
  let resultadoCiclo = null;

  if (dados.iniciarCicloLimpo === true || dados.iniciarCicloLimpo === "true") {
    resultadoCiclo = await iniciarCicloLimpo(alunoId, dados);
  }

  const baseDepois = await carregarBaseConsolidacao();
  const resumoDepois = calcularResumoAluno(baseDepois, alunoId);

  return {
    ok: true,
    alunoId,
    resumoAntes,
    cicloLimpo: resultadoCiclo,
    resumoDepois
  };
}

export async function painelConsolidadoAluno(alunoId) {
  const base = await carregarBaseConsolidacao();
  const aluno = localizarAluno(base.alunos, alunoId);
  const resumo = calcularResumoAluno(base, alunoId);
  const treinos = base.treinos.filter((t) => String(t.alunoId) === String(alunoId));
  const ciclos = base.ciclos.filter((c) => String(c.alunoId) === String(alunoId));
  const execucoes = base.execucoes.filter((e) => String(e.alunoId) === String(alunoId));
  const contrato = contratoAtivoAluno(base.contratos, alunoId);
  const servicos = contrato ? servicosAtivosDoContrato(base.servicosContratados, contrato.id) : [];

  return {
    ok: true,
    aluno: aluno || { id: alunoId },
    contrato,
    servicosAtivos: servicos,
    resumo,
    cicloAtivo: ciclos.find(ativo) || null,
    treinosAtivos: treinos.filter(ativo),
    treinosArquivados: treinos.filter((t) => normalizar(t.status) === "arquivado"),
    execucoesRecentes: execucoes.sort((a,b) => String(b.criadoEm || b.data).localeCompare(String(a.criadoEm || a.data))).slice(0, 20)
  };
}

export async function relatorioConsolidado() {
  const base = await carregarBaseConsolidacao();
  const alunosIds = [...new Set(base.treinos.map((t) => t.alunoId).filter(Boolean))];
  return {
    ok: true,
    totalAlunos: alunosIds.length,
    alunos: alunosIds.map((alunoId) => {
      const aluno = localizarAluno(base.alunos, alunoId);
      return { alunoId, aluno: alunoNome(aluno || { id: alunoId }), resumo: calcularResumoAluno(base, alunoId) };
    })
  };
}
