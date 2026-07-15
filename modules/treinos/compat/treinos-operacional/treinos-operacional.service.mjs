import { carregarBaseTreinoOperacional, salvarExecucoes } from "./treinos-operacional.repository.mjs";

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function agoraISO() { return new Date().toISOString(); }
function gerarId(prefixo = "texec") { return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`; }
function texto(v) { return String(v ?? "").trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function ativo(item) { return !["cancelado","cancelada","encerrado","encerrada","inativo","inativa","arquivado","removido","removida","vencido"].includes(normalizar(item?.status || "Ativo")); }
function numero(v) { const n = Number(String(v ?? "").replace(",", ".").match(/-?\d+(\.\d+)?/)?.[0] || 0); return Number.isFinite(n) ? n : 0; }
function seriesNumero(v) { const n = numero(v); return n > 0 ? n : 1; }
function calcularVolumeExecucao(execucao = {}) { return (execucao.exercicios || []).reduce((total, ex) => total + (numero(ex.cargaRealizada || ex.cargaPrevista) * numero(ex.repeticoesRealizadas || ex.repeticoes) * seriesNumero(ex.series)), 0); }


function arquivoMidia(item = {}) {
  return texto(item.midia || item.media || item.imagem || item.image || item.imagemUrl || item.videoUrl || "");
}
function nomeBiblioteca(item = {}) { return texto(item.nome || item.name || item.exercicio || ""); }
function grupoBiblioteca(item = {}) { return texto(item.grupoMuscular || item.grupo || item.group || item.folder || ""); }
function bibliotecaKey(item = {}) {
  const midia = arquivoMidia(item);
  const baseArquivo = texto(midia.split("/").pop() || "").replace(/\.[^.]+$/, "");
  const nome = normalizar(item.bibliotecaKey || baseArquivo || nomeBiblioteca(item));
  const grupo = normalizar(grupoBiblioteca(item));
  return [grupo, nome].filter(Boolean).join("::");
}
function normalizarItemBiblioteca(item = {}) {
  const midia = arquivoMidia(item);
  const video = /\.(mp4|webm|mov)$/i.test(midia);
  return {
    id: texto(item.id || item.exercicioId || item.bibliotecaId || ""),
    bibliotecaId: texto(item.bibliotecaId || item.id || item.exercicioId || ""),
    bibliotecaKey: texto(item.bibliotecaKey || bibliotecaKey(item)),
    nome: nomeBiblioteca(item),
    grupoMuscular: grupoBiblioteca(item),
    grupo: grupoBiblioteca(item),
    midia,
    tipoMidia: texto(item.tipoMidia || item.tipo || (video ? "video" : (midia ? "imagem" : ""))),
    imagemUrl: texto(item.imagemUrl || (!video ? midia : "")),
    videoUrl: texto(item.videoUrl || (video ? midia : ""))
  };
}
function localizarBiblioteca(biblioteca = [], ex = {}) {
  if (!Array.isArray(biblioteca) || !biblioteca.length) return null;
  const itens = biblioteca.map(normalizarItemBiblioteca);
  const ids = [ex.bibliotecaId, ex.exercicioId, ex.exercicio_id, ex.idBiblioteca].map(texto).filter(Boolean);
  if (ids.length) {
    const porId = itens.find((b) => ids.includes(texto(b.id)) || ids.includes(texto(b.bibliotecaId)));
    if (porId) return porId;
  }
  const key = texto(ex.bibliotecaKey || bibliotecaKey(ex));
  if (key) {
    const porKey = itens.find((b) => texto(b.bibliotecaKey) === key);
    if (porKey) return porKey;
  }
  const nome = normalizar(ex.nome || ex.nomeOriginal || ex.exercicio);
  const grupo = normalizar(ex.grupoMuscular || ex.grupo || ex.musculo);
  if (nome) return itens.find((b) => normalizar(b.nome) === nome && (!grupo || normalizar(b.grupoMuscular) === grupo)) || null;
  return null;
}
function aplicarBibliotecaAoExercicio(ex = {}, biblioteca = []) {
  const ref = localizarBiblioteca(biblioteca, ex);
  if (!ref) return ex;
  return {
    ...ex,
    bibliotecaId: ref.bibliotecaId || ref.id || ex.bibliotecaId || ex.exercicioId || "",
    exercicioId: ex.exercicioId || ref.id || ref.bibliotecaId || "",
    bibliotecaKey: ref.bibliotecaKey || ex.bibliotecaKey || "",
    nome: ref.nome || ex.nome,
    grupoMuscular: ref.grupoMuscular || ex.grupoMuscular,
    grupo: ref.grupo || ref.grupoMuscular || ex.grupo,
    midia: ref.midia || ex.midia || "",
    tipoMidia: ref.tipoMidia || ex.tipoMidia || "",
    imagemUrl: ref.imagemUrl || ex.imagemUrl || "",
    videoUrl: ref.videoUrl || ex.videoUrl || ""
  };
}
function hidratarTreinoComBiblioteca(treino = {}, biblioteca = []) {
  return { ...treino, exercicios: Array.isArray(treino.exercicios) ? treino.exercicios.map((ex) => aplicarBibliotecaAoExercicio(ex, biblioteca)) : [] };
}

function localizarAluno(alunos, alunoId) {
  return alunos.find((a) => String(a.id || a._id || a.alunoId) === String(alunoId)) || null;
}

function alunoNome(a = {}) {
  return texto(a.nome || a.aluno || a.name || a.nomeCompleto || "Aluno");
}

function localizarProfessor(professores, chave = "") {
  const alvo = normalizar(chave);
  if (!alvo) return null;
  return professores.find((p) => String(p.id) === String(chave) || normalizar(p.nome).includes(alvo) || alvo.includes(normalizar(p.nome))) || null;
}

function dataTreinoStatus(treino = {}) {
  if (!ativo(treino)) return "Inativo";
  const validade = texto(treino.dataValidade || treino.validade);
  if (validade && validade < hojeISO()) return "Vencido";
  return "Ativo";
}

function treinosAluno(treinos, alunoId) {
  return treinos
    .filter((t) => String(t.alunoId || t.aluno_id) === String(alunoId))
    .sort((a,b) => String(b.criadoEm || b.dataInicio || "").localeCompare(String(a.criadoEm || a.dataInicio || "")));
}

function treinosProfessor(treinos, professorChave = "") {
  const alvo = normalizar(professorChave);
  if (!alvo) return treinos;
  return treinos.filter((t) =>
    String(t.professorId) === String(professorChave) ||
    normalizar(t.professor).includes(alvo) ||
    alvo.includes(normalizar(t.professor))
  );
}

function execucoesTreino(execucoes, treinoId) {
  return execucoes.filter((e) => String(e.treinoId) === String(treinoId));
}

function ultimaExecucao(execucoes, treinoId) {
  return execucoesTreino(execucoes, treinoId)
    .sort((a,b) => String(b.criadoEm || b.data).localeCompare(String(a.criadoEm || a.data)))[0] || null;
}

function calcularResumoExecucao(treino = {}, execucao = null) {
  const total = Array.isArray(treino.exercicios) ? treino.exercicios.length : 0;
  if (!execucao) return { totalExercicios: total, concluidos: 0, percentual: 0, statusExecucao: "Não iniciado" };
  const concluidos = Array.isArray(execucao.exercicios) ? execucao.exercicios.filter((x) => x.concluido).length : 0;
  const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  return { totalExercicios: total, concluidos, percentual, statusExecucao: execucao.status || (percentual >= 100 ? "Concluído" : "Em andamento") };
}

function enriquecerTreino(treino, base) {
  treino = hidratarTreinoComBiblioteca(treino, base.biblioteca);
  const aluno = localizarAluno(base.alunos, treino.alunoId);
  const professor = localizarProfessor(base.professores, treino.professorId || treino.professor);
  const ultima = ultimaExecucao(base.execucoes, treino.id);
  return {
    ...treino,
    aluno: alunoNome(aluno || { nome: treino.aluno }),
    professor: professor?.nome || treino.professor || "",
    statusCalculado: dataTreinoStatus(treino),
    ultimaExecucao: ultima,
    resumoExecucao: calcularResumoExecucao(treino, ultima)
  };
}

export async function statusTreinoOperacional() {
  return {
    ok: true,
    modulo: "treinos-operacional",
    versao: "Fusion ERP 2.6.2-A",
    status: "Online",
    conceito: "Treino operacional integrado à Biblioteca Inteligente e IA de progressão"
  };
}

export async function portalTreinosAluno(alunoId, filtros = {}) {
  const base = await carregarBaseTreinoOperacional();
  const aluno = localizarAluno(base.alunos, alunoId);
  let lista = treinosAluno(base.treinos, alunoId).map((t) => enriquecerTreino(t, base));
  if (filtros.apenasAtivos === true || filtros.apenasAtivos === "true") lista = lista.filter((t) => t.statusCalculado === "Ativo");

  return {
    ok: true,
    aluno: aluno || { id: alunoId },
    total: lista.length,
    ativos: lista.filter((t) => t.statusCalculado === "Ativo").length,
    treinos: lista
  };
}

export async function painelProfessorTreinos(professorChave, filtros = {}) {
  const base = await carregarBaseTreinoOperacional();
  let lista = treinosProfessor(base.treinos, professorChave).map((t) => enriquecerTreino(t, base));
  if (filtros.apenasAtivos === true || filtros.apenasAtivos === "true") lista = lista.filter((t) => t.statusCalculado === "Ativo");
  if (filtros.alunoId) lista = lista.filter((t) => String(t.alunoId) === String(filtros.alunoId));
  if (filtros.turmaId) lista = lista.filter((t) => String(t.turmaId) === String(filtros.turmaId));

  const alunos = new Map();
  for (const t of lista) {
    if (!alunos.has(t.alunoId)) alunos.set(t.alunoId, { alunoId: t.alunoId, aluno: t.aluno, treinos: [] });
    alunos.get(t.alunoId).treinos.push(t);
  }

  return {
    ok: true,
    professor: professorChave || "Todos",
    totalTreinos: lista.length,
    totalAlunos: alunos.size,
    alunos: [...alunos.values()]
  };
}


function exerciciosExecucaoDoTreino(treino = {}) {
  return (treino.exercicios || []).map((ex, idx) => ({
    exercicioTreinoId: ex.id || ex.exercicioId || ex.exercicio_id || `ex_${idx + 1}`,
    nome: ex.nome,
    ordem: ex.ordem || idx + 1,
    series: ex.series,
    repeticoes: ex.repeticoes,
    cargaPrevista: ex.carga || "",
    descanso: ex.descanso || ex.tempoDescanso || "",
    cargaRealizada: "",
    repeticoesRealizadas: "",
    concluido: false,
    observacao: ""
  }));
}

function chaveExercicioExecucao(ex = {}) {
  return [String(ex.ordem || ""), normalizar(ex.nome || "")].join("|");
}

function sincronizarExecucaoComTreino(execucao = {}, treino = {}) {
  const antigos = Array.isArray(execucao.exercicios) ? execucao.exercicios : [];
  const porId = new Map(antigos.map((ex) => [String(ex.exercicioTreinoId || ""), ex]).filter(([id]) => id));
  const porChave = new Map(antigos.map((ex) => [chaveExercicioExecucao(ex), ex]));
  const novos = exerciciosExecucaoDoTreino(treino).map((ex) => {
    const antigo = porId.get(String(ex.exercicioTreinoId || "")) || porChave.get(chaveExercicioExecucao(ex));
    if (!antigo) return ex;
    return {
      ...ex,
      cargaRealizada: antigo.cargaRealizada || "",
      repeticoesRealizadas: antigo.repeticoesRealizadas || "",
      concluido: Boolean(antigo.concluido),
      observacao: antigo.observacao || "",
      atualizadoEm: antigo.atualizadoEm || execucao.atualizadoEm || ""
    };
  });

  const idsAntigos = antigos.map((ex) => String(ex.exercicioTreinoId || "")).join("|");
  const idsNovos = novos.map((ex) => String(ex.exercicioTreinoId || "")).join("|");
  const totalAntigo = antigos.length;
  if (idsAntigos === idsNovos && totalAntigo === novos.length) return { execucao, alterado: false };

  const total = novos.length;
  const concluidos = novos.filter((e) => e.concluido).length;
  return {
    execucao: {
      ...execucao,
      exercicios: novos,
      status: total > 0 && concluidos >= total ? "Concluído" : "Em andamento",
      atualizadoEm: agoraISO(),
      sincronizadoComTreinoEm: agoraISO()
    },
    alterado: true
  };
}

export async function iniciarExecucaoTreino(treinoId, dados = {}) {
  const base = await carregarBaseTreinoOperacional();
  let treino = base.treinos.find((t) => String(t.id) === String(treinoId));
  if (!treino) throw Object.assign(new Error("Treino não encontrado."), { status: 404 });
  treino = hidratarTreinoComBiblioteca(treino, base.biblioteca);
  if (dataTreinoStatus(treino) !== "Ativo") throw Object.assign(new Error("Treino não está ativo."), { status: 403 });

  const data = dados.data || hojeISO();
  const existente = base.execucoes.find((e) =>
    String(e.treinoId) === String(treinoId) &&
    String(e.alunoId) === String(treino.alunoId) &&
    String(e.data) === String(data) &&
    !["Cancelado", "Concluído"].includes(e.status)
  );

  if (existente) {
    const idxExistente = base.execucoes.findIndex((e) => String(e.id) === String(existente.id));
    const sincronizada = sincronizarExecucaoComTreino(existente, treino);
    if (sincronizada.alterado && idxExistente >= 0) {
      base.execucoes[idxExistente] = sincronizada.execucao;
      await salvarExecucoes(base.execucoes);
    }
    return { ok: true, dados: sincronizada.execucao, reutilizado: true, sincronizado: sincronizada.alterado };
  }

  const execucao = {
    id: gerarId(),
    data,
    treinoId: treino.id,
    alunoId: treino.alunoId,
    aluno: treino.aluno || "",
    contratoId: treino.contratoId || "",
    servicoContratadoId: treino.servicoContratadoId || "",
    turmaId: treino.turmaId || "",
    professorId: treino.professorId || "",
    professor: treino.professor || "",
    status: "Em andamento",
    exercicios: exerciciosExecucaoDoTreino(treino),
    origem: dados.origem || "portal_aluno",
    usuario: dados.usuario || "Aluno",
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  base.execucoes.push(execucao);
  await salvarExecucoes(base.execucoes);
  return { ok: true, dados: execucao, reutilizado: false };
}

export async function atualizarExecucaoExercicio(execucaoId, exercicioTreinoId, dados = {}) {
  const base = await carregarBaseTreinoOperacional();
  const idx = base.execucoes.findIndex((e) => String(e.id) === String(execucaoId));
  if (idx < 0) throw Object.assign(new Error("Execução de treino não encontrada."), { status: 404 });

  const execucao = base.execucoes[idx];
  const exIdx = (execucao.exercicios || []).findIndex((e) => String(e.exercicioTreinoId) === String(exercicioTreinoId));
  if (exIdx < 0) throw Object.assign(new Error("Exercício da execução não encontrado."), { status: 404 });

  execucao.exercicios[exIdx] = {
    ...execucao.exercicios[exIdx],
    cargaRealizada: dados.cargaRealizada ?? dados.carga ?? execucao.exercicios[exIdx].cargaRealizada,
    repeticoesRealizadas: dados.repeticoesRealizadas ?? dados.repeticoes ?? execucao.exercicios[exIdx].repeticoesRealizadas,
    concluido: dados.concluido !== undefined ? Boolean(dados.concluido) : true,
    observacao: dados.observacao ?? execucao.exercicios[exIdx].observacao,
    atualizadoEm: agoraISO()
  };

  const total = execucao.exercicios.length;
  const concluidos = execucao.exercicios.filter((e) => e.concluido).length;
  execucao.status = total > 0 && concluidos >= total ? "Concluído" : "Em andamento";
  execucao.tempoSegundos = Number(dados.tempoSegundos ?? execucao.tempoSegundos ?? 0);
  execucao.volumeTotal = Number(dados.volumeTotal ?? calcularVolumeExecucao(execucao));
  execucao.atualizadoEm = agoraISO();
  if (execucao.status === "Concluído" && !execucao.concluidoEm) execucao.concluidoEm = agoraISO();

  base.execucoes[idx] = execucao;
  await salvarExecucoes(base.execucoes);
  return { ok: true, dados: execucao, resumo: { total, concluidos, percentual: total ? Math.round((concluidos / total) * 100) : 0 } };
}

export async function concluirExecucaoTreino(execucaoId, dados = {}) {
  const base = await carregarBaseTreinoOperacional();
  const idx = base.execucoes.findIndex((e) => String(e.id) === String(execucaoId));
  if (idx < 0) throw Object.assign(new Error("Execução de treino não encontrada."), { status: 404 });

  const execucao = base.execucoes[idx];
  execucao.status = "Concluído";
  execucao.observacaoFinal = dados.observacao || execucao.observacaoFinal || "";
  execucao.tempoSegundos = Number(dados.tempoSegundos ?? execucao.tempoSegundos ?? 0);
  execucao.volumeTotal = Number(dados.volumeTotal ?? calcularVolumeExecucao(execucao));
  execucao.concluidoEm = agoraISO();
  execucao.atualizadoEm = agoraISO();
  execucao.exercicios = (execucao.exercicios || []).map((e) => ({ ...e, concluido: true }));

  base.execucoes[idx] = execucao;
  await salvarExecucoes(base.execucoes);
  return { ok: true, dados: execucao };
}

export async function historicoExecucoesAluno(alunoId, filtros = {}) {
  const base = await carregarBaseTreinoOperacional();
  let lista = base.execucoes.filter((e) => String(e.alunoId) === String(alunoId));
  if (filtros.treinoId) lista = lista.filter((e) => String(e.treinoId) === String(filtros.treinoId));
  return {
    ok: true,
    alunoId,
    total: lista.length,
    dados: lista.sort((a,b) => String(b.criadoEm || b.data).localeCompare(String(a.criadoEm || a.data)))
  };
}


function chaveExercicio(nome = "") {
  return normalizar(nome).replace(/[^a-z0-9]+/g, " ").trim();
}

function volumeExercicio(ex = {}) {
  return numero(ex.cargaRealizada || ex.cargaPrevista) * numero(ex.repeticoesRealizadas || ex.repeticoes) * seriesNumero(ex.series);
}

function compararPercentual(atual = 0, anterior = 0) {
  if (!anterior) return atual > 0 ? 100 : 0;
  return Math.round(((atual - anterior) / anterior) * 100);
}

function classificarTendencia(atual = 0, anterior = 0) {
  const delta = compararPercentual(atual, anterior);
  if (!anterior && atual > 0) return "Primeiro registro";
  if (delta >= 5) return "Evolução";
  if (delta <= -5) return "Regressão";
  return "Estável";
}

function sugerirProgressao({ cargaAtual, repsAtual, cargaAnterior, repsAnterior, melhorCarga, registros }) {
  if (!registros) return "Sem histórico suficiente. Manter técnica e registrar a próxima execução.";
  if (cargaAtual > cargaAnterior && repsAtual >= Math.max(1, repsAnterior - 1)) return "Progressão positiva. Manter a carga na próxima execução e buscar estabilidade.";
  if (cargaAtual >= melhorCarga && repsAtual >= repsAnterior) return "Novo melhor desempenho. Considerar aumento leve de carga na próxima sessão.";
  if (cargaAtual === cargaAnterior && repsAtual > repsAnterior) return "Boa evolução de repetições. Se repetir o desempenho, subir carga moderadamente.";
  if (cargaAtual < cargaAnterior || repsAtual < Math.max(1, repsAnterior - 2)) return "Queda de desempenho. Manter ou reduzir carga e revisar descanso/técnica.";
  return "Desempenho estável. Repetir carga e buscar pequena evolução de repetições.";
}

function consolidarProgressao(execucoes = [], alunoId = "") {
  const mapa = new Map();
  const lista = execucoes
    .filter((e) => String(e.alunoId) === String(alunoId) && Array.isArray(e.exercicios))
    .sort((a, b) => String(a.criadoEm || a.data || "").localeCompare(String(b.criadoEm || b.data || "")));

  for (const execucao of lista) {
    for (const ex of execucao.exercicios || []) {
      const chave = chaveExercicio(ex.nome || ex.exercicio || ex.exercicioTreinoId);
      if (!chave) continue;
      const carga = numero(ex.cargaRealizada || ex.cargaPrevista);
      const reps = numero(ex.repeticoesRealizadas || ex.repeticoes);
      const series = seriesNumero(ex.series);
      const volume = carga * reps * series;
      const registro = {
        execucaoId: execucao.id,
        treinoId: execucao.treinoId,
        data: execucao.data || String(execucao.criadoEm || "").slice(0, 10),
        criadoEm: execucao.criadoEm || execucao.atualizadoEm || "",
        exercicioTreinoId: ex.exercicioTreinoId,
        nome: ex.nome || "Exercício",
        carga,
        repeticoes: reps,
        series,
        volume,
        concluido: Boolean(ex.concluido),
        observacao: ex.observacao || ""
      };

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          nome: registro.nome,
          totalRegistros: 0,
          melhorCarga: 0,
          melhorVolume: 0,
          melhorRepeticoes: 0,
          historico: []
        });
      }

      const item = mapa.get(chave);
      item.totalRegistros += 1;
      item.melhorCarga = Math.max(item.melhorCarga, carga);
      item.melhorVolume = Math.max(item.melhorVolume, volume);
      item.melhorRepeticoes = Math.max(item.melhorRepeticoes, reps);
      item.historico.push(registro);
    }
  }

  const exercicios = [...mapa.values()].map((item) => {
    const historico = item.historico.sort((a, b) => String(a.criadoEm || a.data).localeCompare(String(b.criadoEm || b.data)));
    const atual = historico[historico.length - 1] || null;
    const anterior = historico[historico.length - 2] || null;
    const cargaAtual = atual?.carga || 0;
    const repsAtual = atual?.repeticoes || 0;
    const volumeAtual = atual?.volume || 0;
    const cargaAnterior = anterior?.carga || 0;
    const repsAnterior = anterior?.repeticoes || 0;
    const volumeAnterior = anterior?.volume || 0;
    const deltaCarga = cargaAtual - cargaAnterior;
    const deltaRepeticoes = repsAtual - repsAnterior;
    const deltaVolume = volumeAtual - volumeAnterior;
    const tendencia = classificarTendencia(volumeAtual, volumeAnterior);

    return {
      ...item,
      ultimaCarga: cargaAtual,
      ultimaRepeticoes: repsAtual,
      ultimoVolume: volumeAtual,
      cargaAnterior,
      repeticoesAnteriores: repsAnterior,
      volumeAnterior,
      deltaCarga,
      deltaRepeticoes,
      deltaVolume,
      percentualVolume: compararPercentual(volumeAtual, volumeAnterior),
      tendencia,
      sugestao: sugerirProgressao({ cargaAtual, repsAtual, cargaAnterior, repsAnterior, melhorCarga: item.melhorCarga, registros: historico.length }),
      historico: historico.slice(-12).reverse()
    };
  }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

  const volumePorTreino = lista.map((e) => ({
    execucaoId: e.id,
    treinoId: e.treinoId,
    data: e.data || String(e.criadoEm || "").slice(0, 10),
    status: e.status,
    volumeTotal: Number(e.volumeTotal ?? calcularVolumeExecucao(e)),
    tempoSegundos: Number(e.tempoSegundos || 0),
    exercicios: Array.isArray(e.exercicios) ? e.exercicios.length : 0
  })).reverse();

  return { exercicios, volumePorTreino };
}

export async function progressaoCargaAluno(alunoId, filtros = {}) {
  const base = await carregarBaseTreinoOperacional();
  const aluno = localizarAluno(base.alunos, alunoId);
  const { exercicios, volumePorTreino } = consolidarProgressao(base.execucoes, alunoId);
  const exercicioBusca = normalizar(filtros.exercicio || filtros.q || "");
  const filtrados = exercicioBusca ? exercicios.filter((e) => normalizar(e.nome).includes(exercicioBusca)) : exercicios;
  return {
    ok: true,
    aluno: aluno || { id: alunoId },
    alunoId,
    totalExercicios: filtrados.length,
    totalExecucoes: volumePorTreino.length,
    melhorVolumeTreino: volumePorTreino.reduce((max, item) => Math.max(max, Number(item.volumeTotal || 0)), 0),
    volumePorTreino: volumePorTreino.slice(0, 20),
    exercicios: filtrados
  };
}


function media(lista = []) {
  const nums = lista.map(Number).filter((n) => Number.isFinite(n));
  return nums.length ? nums.reduce((t, n) => t + n, 0) / nums.length : 0;
}

function classificarRiscoProgressao(item = {}) {
  const dc = Number(item.deltaCarga || 0);
  const pc = item.cargaAnterior ? Math.round((dc / Math.max(1, item.cargaAnterior)) * 100) : 0;
  const quedaReps = Number(item.deltaRepeticoes || 0) <= -3;
  if (pc >= 15 && quedaReps) return { nivel: "Alto", motivo: "Aumento de carga alto com queda relevante de repetições." };
  if (pc >= 15) return { nivel: "Moderado", motivo: "Aumento de carga acima do padrão seguro." };
  if (item.tendencia === "Regressão") return { nivel: "Moderado", motivo: "Desempenho abaixo da execução anterior." };
  return { nivel: "Baixo", motivo: "Progressão dentro de faixa operacional segura." };
}

function recomendarCargaNumerica(item = {}) {
  const atual = Number(item.ultimaCarga || 0);
  const anterior = Number(item.cargaAnterior || 0);
  const reps = Number(item.ultimaRepeticoes || 0);
  const repsAnt = Number(item.repeticoesAnteriores || 0);
  const registros = Number(item.totalRegistros || 0);
  if (!atual) return { cargaSugerida: 0, ajusteKg: 0, acao: "Registrar carga" };
  if (registros < 2) return { cargaSugerida: atual, ajusteKg: 0, acao: "Manter" };
  if (item.tendencia === "Evolução" && reps >= Math.max(1, repsAnt)) {
    const ajuste = atual >= 40 ? 2.5 : 1;
    return { cargaSugerida: Number((atual + ajuste).toFixed(1)), ajusteKg: ajuste, acao: "Subir carga" };
  }
  if (item.tendencia === "Regressão") {
    const ajuste = atual >= 40 ? -2.5 : -1;
    return { cargaSugerida: Math.max(0, Number((atual + ajuste).toFixed(1))), ajusteKg: ajuste, acao: "Reduzir ou manter" };
  }
  if (reps > repsAnt) return { cargaSugerida: atual, ajusteKg: 0, acao: "Manter carga e subir repetições" };
  return { cargaSugerida: atual, ajusteKg: 0, acao: "Manter" };
}

function indiceDesempenho(item = {}) {
  let score = 50;
  score += Math.min(25, Math.max(-25, Number(item.percentualVolume || 0)));
  if (item.tendencia === "Evolução") score += 15;
  if (item.tendencia === "Regressão") score -= 15;
  if (Number(item.totalRegistros || 0) >= 4) score += 5;
  if (Number(item.ultimaCarga || 0) >= Number(item.melhorCarga || 0) && Number(item.ultimaCarga || 0) > 0) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function gerarResumoIA(exercicios = []) {
  const score = Math.round(media(exercicios.map((e) => e.indiceDesempenho)) || 0);
  const evoluindo = exercicios.filter((e) => e.tendencia === "Evolução").length;
  const regressao = exercicios.filter((e) => e.tendencia === "Regressão").length;
  const estavel = exercicios.filter((e) => e.tendencia === "Estável").length;
  let classificacao = "Sem dados";
  if (exercicios.length) {
    if (score >= 75) classificacao = "Evolução forte";
    else if (score >= 60) classificacao = "Evolução controlada";
    else if (score >= 45) classificacao = "Estável";
    else classificacao = "Atenção necessária";
  }
  return { score, classificacao, evoluindo, estavel, regressao, avaliados: exercicios.length };
}

function gerarRecomendacoesGerais(resumo = {}, exercicios = []) {
  const prioridade = exercicios.filter((e) => ["Regressão", "Estável"].includes(e.tendencia)).slice(0, 5);
  const aluno = [];
  const professor = [];
  if (!exercicios.length) {
    aluno.push("Execute ao menos dois treinos completos para liberar recomendações de IA.");
    professor.push("Aluno sem histórico suficiente para prescrição automatizada.");
    return { aluno, professor, prioridade: [] };
  }
  if (resumo.regressao > 0) {
    aluno.push("Alguns exercícios tiveram queda de desempenho. Priorize técnica, descanso e execução completa.");
    professor.push("Revisar exercícios em regressão antes de aumentar carga.");
  }
  if (resumo.evoluindo > resumo.regressao) {
    aluno.push("A evolução está positiva. Mantenha regularidade e registre carga/repetições em todos os exercícios.");
    professor.push("Há margem para progressão leve nos exercícios com evolução consistente.");
  }
  if (resumo.score < 45) {
    aluno.push("O desempenho geral exige atenção. Evite subir carga sem orientação.");
    professor.push("Avaliar sono, fadiga, frequência e possível ajuste de volume total.");
  }
  if (!aluno.length) aluno.push("Desempenho estável. Mantenha a execução e busque pequenas melhorias de repetição.");
  if (!professor.length) professor.push("Manter acompanhamento e validar progressões sugeridas pela IA.");
  return { aluno, professor, prioridade: prioridade.map((e) => ({ exercicio: e.nome, tendencia: e.tendencia, motivo: e.sugestao })) };
}

export async function iaProgressaoFisicaAluno(alunoId, filtros = {}) {
  const base = await carregarBaseTreinoOperacional();
  const aluno = localizarAluno(base.alunos, alunoId);
  const consolidado = consolidarProgressao(base.execucoes, alunoId);
  const exercicios = consolidado.exercicios.map((item) => {
    const risco = classificarRiscoProgressao(item);
    const recomendacao = recomendarCargaNumerica(item);
    const score = indiceDesempenho(item);
    const estagnado = item.totalRegistros >= 3 && item.historico.slice(0, 3).every((h) => Number(h.carga || 0) === Number(item.ultimaCarga || 0));
    return {
      ...item,
      indiceDesempenho: score,
      riscoLesao: risco,
      recomendacaoIA: {
        ...recomendacao,
        repeticoesSugeridas: item.tendencia === "Estável" ? Number(item.ultimaRepeticoes || 0) + 1 : Number(item.ultimaRepeticoes || 0),
        mensagemAluno: recomendacao.acao === "Subir carga" ? "Boa evolução. Próxima sessão pode tentar subir carga com controle." : recomendacao.acao === "Reduzir ou manter" ? "Reduza a pressa de progressão e priorize técnica." : "Mantenha a carga e busque execução consistente.",
        mensagemProfessor: `${recomendacao.acao}: ${item.nome}. Tendência ${item.tendencia}. Risco ${risco.nivel}.`
      },
      estagnado,
      prioridade: risco.nivel === "Alto" || item.tendencia === "Regressão" || estagnado ? "Alta" : item.tendencia === "Estável" ? "Média" : "Baixa"
    };
  });
  const resumoIA = gerarResumoIA(exercicios);
  const recomendacoes = gerarRecomendacoesGerais(resumoIA, exercicios);
  return {
    ok: true,
    modulo: "ia-progressao-fisica",
    versao: "Fusion ERP 2.6.2-A",
    aluno: aluno || { id: alunoId },
    alunoId,
    resumoIA,
    recomendacoes,
    exercicios,
    volumePorTreino: consolidado.volumePorTreino.slice(0, 20),
    atualizadoEm: agoraISO()
  };
}
