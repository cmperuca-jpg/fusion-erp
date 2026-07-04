import { carregarBaseMontador, salvarTreinosIntegrados } from "./treinos-montador.repository.mjs";

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function agoraISO() { return new Date().toISOString(); }
function gerarId(prefixo = "trn") { return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`; }
function texto(v) { return String(v ?? "").trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function numero(v, padrao = 0) { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : padrao; }
function ativo(item) { return !["cancelado","cancelada","encerrado","encerrada","inativo","inativa","arquivado","removido","removida"].includes(normalizar(item?.status || "Ativo")); }

function localizarAluno(alunos, alunoId) {
  return alunos.find((a) => String(a.id || a._id || a.alunoId) === String(alunoId)) || null;
}

function alunoNome(a = {}) {
  return texto(a.nome || a.aluno || a.name || a.nomeCompleto || "Aluno");
}

function localizarProfessor(professores, chave = "") {
  const alvo = normalizar(chave);
  if (!alvo) return null;
  return professores.find((p) =>
    String(p.id) === String(chave) ||
    normalizar(p.nome).includes(alvo) ||
    alvo.includes(normalizar(p.nome))
  ) || null;
}

function contratoAtivoAluno(contratos, alunoId) {
  const lista = contratos.filter((c) => String(c.alunoId) === String(alunoId));
  return lista.find(ativo) || lista[0] || null;
}

function servicosAtivosDoContrato(servicos, contratoId) {
  return servicos.filter((s) => String(s.contratoId) === String(contratoId) && ativo(s));
}

function avaliacoesAluno(avaliacoes, alunoId) {
  return avaliacoes
    .filter((a) => String(a.alunoId || a.aluno_id) === String(alunoId))
    .sort((a,b) => String(b.data || b.criadoEm || "").localeCompare(String(a.data || a.criadoEm || "")));
}

function frequenciasAluno(frequencia, alunoId) {
  return frequencia
    .filter((f) => String(f.alunoId) === String(alunoId))
    .sort((a,b) => String(b.data || b.criadoEm || "").localeCompare(String(a.data || a.criadoEm || "")));
}

function inferirNivel(aluno = {}, avaliacao = {}, frequencias = []) {
  const idade = idadeAluno(aluno);
  const freq = frequencias.length;
  const nivel = normalizar(avaliacao.nivel || avaliacao.classificacao || aluno.nivel);
  if (nivel.includes("avanc")) return "Avançado";
  if (nivel.includes("inter")) return "Intermediário";
  if (idade && idade >= 60) return "Iniciante";
  if (freq >= 12) return "Intermediário";
  return "Iniciante";
}

function idadeAluno(aluno = {}) {
  const nasc = texto(aluno.data_nascimento || aluno.dataNascimento || aluno.nascimento);
  if (!/^\d{4}-\d{2}-\d{2}/.test(nasc)) return 0;
  const ano = Number(nasc.slice(0,4));
  const atual = new Date().getFullYear();
  return ano > 1900 ? atual - ano : 0;
}

function inferirObjetivo(dados = {}, aluno = {}, avaliacao = {}) {
  const objetivo = texto(dados.objetivo || avaliacao.objetivo || aluno.objetivo || aluno.observacoes);
  if (objetivo) return objetivo;
  const imc = numero(avaliacao.imc);
  if (imc >= 28) return "Emagrecimento";
  return "Condicionamento";
}

function gruposPorDivisao(divisao = "Full Body") {
  const d = normalizar(divisao);
  if (d === "abc" || d.includes("abc")) {
    return [
      { nome: "Treino A", grupos: ["Peito", "Ombros", "Tríceps"] },
      { nome: "Treino B", grupos: ["Costas", "Bíceps"] },
      { nome: "Treino C", grupos: ["Pernas", "Glúteos", "Panturrilha", "Core"] }
    ];
  }
  if (d.includes("abcd")) {
    return [
      { nome: "Treino A", grupos: ["Peito", "Tríceps"] },
      { nome: "Treino B", grupos: ["Costas", "Bíceps"] },
      { nome: "Treino C", grupos: ["Pernas", "Glúteos"] },
      { nome: "Treino D", grupos: ["Ombros", "Core", "Cardio"] }
    ];
  }
  if (d.includes("push") || d.includes("ppl")) {
    return [
      { nome: "Push", grupos: ["Peito", "Ombros", "Tríceps"] },
      { nome: "Pull", grupos: ["Costas", "Bíceps"] },
      { nome: "Legs", grupos: ["Pernas", "Glúteos", "Panturrilha"] }
    ];
  }
  return [
    { nome: "Full Body", grupos: ["Pernas", "Peito", "Costas", "Ombros", "Core", "Cardio"] }
  ];
}

function correspondeGrupo(ex, grupos = []) {
  const set = new Set(grupos.map(normalizar));
  return set.has(normalizar(ex.grupoMuscular)) ||
    (Array.isArray(ex.gruposSecundarios) && ex.gruposSecundarios.some((g) => set.has(normalizar(g))));
}

function correspondeObjetivo(ex, objetivo = "") {
  const obj = normalizar(objetivo);
  if (!obj) return true;
  const lista = Array.isArray(ex.objetivo) ? ex.objetivo.map(normalizar) : [];
  return !lista.length || lista.some((x) => x.includes(obj) || obj.includes(x));
}

function nivelPeso(nivel) {
  const n = normalizar(nivel);
  if (n.includes("avanc")) return 3;
  if (n.includes("inter")) return 2;
  return 1;
}

function ordenarExercicios(exercicios, objetivo, nivel) {
  const pesoNivel = nivelPeso(nivel);
  return [...exercicios].sort((a,b) => {
    const ao = correspondeObjetivo(a, objetivo) ? 1 : 0;
    const bo = correspondeObjetivo(b, objetivo) ? 1 : 0;
    if (bo !== ao) return bo - ao;
    const an = Math.abs(nivelPeso(a.nivel) - pesoNivel);
    const bn = Math.abs(nivelPeso(b.nivel) - pesoNivel);
    if (an !== bn) return an - bn;
    return String(a.nome).localeCompare(String(b.nome), "pt-BR");
  });
}

function prescreverExercicio(ex, objetivo, nivel) {
  const obj = normalizar(objetivo);
  const niv = normalizar(nivel);
  let series = Number(ex.padraoSeries || 3);
  let repeticoes = ex.padraoRepeticoes || "10-12";
  let descanso = ex.padraoDescanso || "60s";

  if (obj.includes("hipertrof")) {
    series = Math.max(series, niv.includes("inic") ? 3 : 4);
    repeticoes = "8-12";
    descanso = "60-90s";
  } else if (obj.includes("emagrec") || obj.includes("condicion")) {
    series = Math.max(2, Math.min(series, 3));
    repeticoes = normalizar(ex.grupoMuscular).includes("cardio") ? (ex.padraoRepeticoes || "15-30 min") : "12-15";
    descanso = "30-60s";
  } else if (obj.includes("forca")) {
    series = 4;
    repeticoes = "4-8";
    descanso = "90-120s";
  }

  return {
    id: gerarId("tex"),
    exercicioId: ex.id,
    nome: ex.nome,
    grupoMuscular: ex.grupoMuscular,
    equipamento: ex.equipamento || "",
    series,
    repeticoes,
    carga: "",
    descanso,
    instrucoes: ex.instrucoes || "",
    cuidados: ex.cuidados || "",
    videoUrl: ex.videoUrl || "",
    imagemUrl: ex.imagemUrl || ""
  };
}

function selecionarExercicios(biblioteca, grupos, objetivo, nivel, limite = 6) {
  const ativos = biblioteca.filter(ativo);
  let candidatos = ativos.filter((ex) => correspondeGrupo(ex, grupos));
  if (!candidatos.length) candidatos = ativos;
  const ordenados = ordenarExercicios(candidatos, objetivo, nivel);
  const usados = new Set();
  const saida = [];

  for (const grupo of grupos) {
    const item = ordenados.find((ex) => !usados.has(ex.id) && normalizar(ex.grupoMuscular) === normalizar(grupo));
    if (item) {
      usados.add(item.id);
      saida.push(prescreverExercicio(item, objetivo, nivel));
    }
  }

  for (const ex of ordenados) {
    if (saida.length >= limite) break;
    if (usados.has(ex.id)) continue;
    usados.add(ex.id);
    saida.push(prescreverExercicio(ex, objetivo, nivel));
  }

  return saida;
}

function buscarServicoTreino(servicos, dados = {}) {
  if (dados.servicoContratadoId) {
    const porId = servicos.find((s) => String(s.id || s.servicoContratadoId) === String(dados.servicoContratadoId));
    if (porId) return porId;
  }
  const preferido = servicos.find((s) => {
    const txt = normalizar([s.nome, s.servico, s.modalidade, s.turma].join(" "));
    return txt.includes("musculacao") || txt.includes("funcional") || txt.includes("personal") || txt.includes("treino");
  });
  return preferido || servicos[0] || null;
}

export async function statusMontadorTreinos() {
  return {
    ok: true,
    modulo: "treinos-montador",
    versao: "Fusion ERP 2.5-C",
    status: "Online",
    conceito: "Montador inteligente de treinos baseado em biblioteca, contrato, serviços, avaliações e frequência"
  };
}

export async function simularMontagem(alunoId, dados = {}) {
  const base = await carregarBaseMontador();
  const aluno = localizarAluno(base.alunos, alunoId);
  const contrato = contratoAtivoAluno(base.contratos, alunoId);
  if (!contrato) throw Object.assign(new Error("Aluno sem contrato comercial ativo."), { status: 403 });

  const servicos = servicosAtivosDoContrato(base.servicosContratados, contrato.id);
  const servicoTreino = buscarServicoTreino(servicos, dados);
  if (!servicoTreino) throw Object.assign(new Error("Aluno sem serviço ativo para treino."), { status: 403 });

  const avaliacoes = avaliacoesAluno(base.avaliacoes, alunoId);
  const ultimaAvaliacao = avaliacoes[0] || {};
  const frequencias = frequenciasAluno(base.frequencia, alunoId);
  const objetivo = inferirObjetivo(dados, aluno, ultimaAvaliacao);
  const nivel = dados.nivel || inferirNivel(aluno, ultimaAvaliacao, frequencias);
  const divisao = dados.tipoDivisao || dados.divisao || "Full Body";
  const blocos = gruposPorDivisao(divisao);
  const limitePorBloco = Math.max(3, Number(dados.limitePorBloco || dados.exerciciosPorTreino || 6));

  const treinos = blocos.map((bloco) => ({
    nome: bloco.nome,
    grupos: bloco.grupos,
    exercicios: selecionarExercicios(base.biblioteca, bloco.grupos, objetivo, nivel, limitePorBloco)
  }));

  return {
    ok: true,
    aluno: aluno || { id: alunoId },
    contrato,
    servicoTreino,
    objetivo,
    nivel,
    divisao,
    ultimaAvaliacao,
    baseFrequencia: frequencias.length,
    treinos
  };
}

export async function montarTreino(alunoId, dados = {}) {
  const simulacao = await simularMontagem(alunoId, dados);
  const base = await carregarBaseMontador();
  const professor = localizarProfessor(base.professores, dados.professorId || dados.professor || simulacao.servicoTreino.professor);
  const lista = base.treinosIntegrados;

  const criados = simulacao.treinos.map((bloco) => ({
    id: gerarId("trn"),
    alunoId,
    aluno: alunoNome(simulacao.aluno),
    contratoId: simulacao.contrato.id,
    matriculaId: simulacao.contrato.matriculaId || "",
    numeroMatricula: simulacao.contrato.numeroMatricula || "",
    servicoContratadoId: simulacao.servicoTreino.id || simulacao.servicoTreino.servicoContratadoId || "",
    turmaId: simulacao.servicoTreino.turmaId || "",
    turma: simulacao.servicoTreino.turma || simulacao.servicoTreino.nome || "",
    modalidade: simulacao.servicoTreino.modalidade || "",
    professorId: professor?.id || dados.professorId || "",
    professor: professor?.nome || dados.professor || simulacao.servicoTreino.professor || "",
    objetivo: simulacao.objetivo,
    nivel: simulacao.nivel,
    nome: dados.nome ? `${dados.nome} - ${bloco.nome}` : bloco.nome,
    tipoDivisao: simulacao.divisao,
    gruposMusculares: bloco.grupos,
    dataInicio: dados.dataInicio || hojeISO(),
    dataValidade: dados.dataValidade || dados.validade || "",
    diasSemana: dados.diasSemana || "",
    status: "Ativo",
    exercicios: bloco.exercicios,
    observacao: dados.observacao || "",
    origem: "montador_inteligente_25c",
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    versao: 1,
    historico: [{ acao: "montar_treino_inteligente", usuario: dados.usuario || "Montador 2.5-C", criadoEm: agoraISO() }]
  }));

  if (dados.arquivarAnteriores === true || dados.arquivarAnteriores === "true") {
    for (const item of lista) {
      if (String(item.alunoId) === String(alunoId) && ativo(item)) {
        item.status = "Arquivado";
        item.atualizadoEm = agoraISO();
        item.historico = Array.isArray(item.historico) ? item.historico : [];
        item.historico.push({ acao: "arquivar_por_nova_montagem", usuario: dados.usuario || "Montador 2.5-C", criadoEm: agoraISO() });
      }
    }
  }

  lista.push(...criados);
  await salvarTreinosIntegrados(lista);

  return {
    ok: true,
    total: criados.length,
    dados: criados,
    simulacao: { objetivo: simulacao.objetivo, nivel: simulacao.nivel, divisao: simulacao.divisao }
  };
}

export async function obterModelosDivisao() {
  return {
    ok: true,
    dados: [
      { id: "fullbody", nome: "Full Body", descricao: "Treino geral para iniciantes, condicionamento e baixa frequência semanal.", blocos: gruposPorDivisao("Full Body") },
      { id: "abc", nome: "ABC", descricao: "Divisão clássica em três treinos.", blocos: gruposPorDivisao("ABC") },
      { id: "abcd", nome: "ABCD", descricao: "Divisão em quatro treinos para maior volume.", blocos: gruposPorDivisao("ABCD") },
      { id: "ppl", nome: "Push/Pull/Legs", descricao: "Divisão por padrões de movimento.", blocos: gruposPorDivisao("PPL") }
    ]
  };
}
