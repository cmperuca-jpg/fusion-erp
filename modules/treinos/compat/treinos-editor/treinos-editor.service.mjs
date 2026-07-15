import { carregarBaseEditor, salvarTreinos } from "./treinos-editor.repository.mjs";

function agoraISO() { return new Date().toISOString(); }
function gerarId(prefixo = "tex") { return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`; }
function texto(v) { return String(v ?? "").trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function numero(v, padrao = 0) { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : padrao; }

function localizarTreino(treinos, id) {
  return treinos.find((t) => String(t.id) === String(id)) || null;
}

function localizarExercicioBiblioteca(biblioteca, dados = {}) {
  const id = dados.exercicioId || dados.bibliotecaId || dados.idBiblioteca;
  if (id) {
    const porId = biblioteca.find((x) => String(x.id) === String(id));
    if (porId) return porId;
  }
  const nome = normalizar(dados.nome || dados.exercicio);
  if (!nome) return null;
  return biblioteca.find((x) => normalizar(x.nome) === nome || normalizar(x.nome).includes(nome) || nome.includes(normalizar(x.nome))) || null;
}

function normalizarExercicioPrescrito(dados = {}, biblioteca = []) {
  const ref = localizarExercicioBiblioteca(biblioteca, dados);
  const nome = texto(dados.nome || dados.exercicio || ref?.nome);
  if (!nome) throw Object.assign(new Error("Informe o nome do exercício."), { status: 400 });

  return {
    id: dados.id || gerarId(),
    exercicioId: dados.exercicioId || dados.bibliotecaId || ref?.id || "",
    ordem: numero(dados.ordem, 0),
    nome,
    grupoMuscular: texto(dados.grupoMuscular || ref?.grupoMuscular || ""),
    equipamento: texto(dados.equipamento || ref?.equipamento || ""),
    series: numero(dados.series ?? ref?.padraoSeries, 3),
    repeticoes: texto(dados.repeticoes || ref?.padraoRepeticoes || "10-12"),
    carga: texto(dados.carga || ""),
    descanso: texto(dados.descanso || ref?.padraoDescanso || "60s"),
    tempo: texto(dados.tempo || dados.tempoExecucao || ref?.tempoExecucao || ""),
    cadencia: texto(dados.cadencia || ""),
    intensidade: texto(dados.intensidade || ""),
    observacao: texto(dados.observacao || dados.observacoes || ""),
    instrucoes: texto(dados.instrucoes || ref?.instrucoes || ""),
    cuidados: texto(dados.cuidados || ref?.cuidados || ""),
    videoUrl: texto(dados.videoUrl || ref?.videoUrl || ""),
    imagemUrl: texto(dados.imagemUrl || ref?.imagemUrl || ""),
    status: texto(dados.status || "Ativo")
  };
}

function ordenarExercicios(lista = []) {
  return [...lista].map((ex, i) => ({ ...ex, ordem: Number(ex.ordem || i + 1) }))
    .sort((a,b) => Number(a.ordem || 0) - Number(b.ordem || 0));
}

function historico(treino, acao, usuario, detalhes = {}) {
  const h = Array.isArray(treino.historico) ? treino.historico : [];
  return [...h, { id: gerarId("hist"), acao, usuario: usuario || "Administrador", detalhes, criadoEm: agoraISO() }];
}

function recalcularVersao(treino) {
  return Number(treino.versao || 1) + 1;
}

export async function statusEditorTreinos() {
  return {
    ok: true,
    modulo: "treinos-editor",
    versao: "Fusion ERP 2.5-D",
    status: "Online",
    conceito: "Prescrição e editor de treino com séries, repetições, carga, descanso, versões e histórico"
  };
}

export async function obterTreino(id) {
  const base = await carregarBaseEditor();
  const treino = localizarTreino(base.treinos, id);
  if (!treino) throw Object.assign(new Error("Treino não encontrado."), { status: 404 });
  return { ok: true, dados: { ...treino, exercicios: ordenarExercicios(treino.exercicios || []) } };
}

export async function atualizarCabecalhoTreino(id, dados = {}) {
  const base = await carregarBaseEditor();
  const idx = base.treinos.findIndex((t) => String(t.id) === String(id));
  if (idx < 0) throw Object.assign(new Error("Treino não encontrado."), { status: 404 });

  const atual = base.treinos[idx];
  const novo = {
    ...atual,
    nome: dados.nome ?? atual.nome,
    objetivo: dados.objetivo ?? atual.objetivo,
    nivel: dados.nivel ?? atual.nivel,
    tipoDivisao: dados.tipoDivisao ?? dados.divisao ?? atual.tipoDivisao,
    gruposMusculares: Array.isArray(dados.gruposMusculares) ? dados.gruposMusculares : atual.gruposMusculares,
    diasSemana: dados.diasSemana ?? atual.diasSemana,
    dataInicio: dados.dataInicio ?? atual.dataInicio,
    dataValidade: dados.dataValidade ?? dados.validade ?? atual.dataValidade,
    status: dados.status ?? atual.status,
    observacao: dados.observacao ?? dados.observacoes ?? atual.observacao,
    atualizadoEm: agoraISO(),
    versao: recalcularVersao(atual),
    historico: historico(atual, "atualizar_cabecalho", dados.usuario, dados)
  };

  base.treinos[idx] = novo;
  await salvarTreinos(base.treinos);
  return { ok: true, dados: novo };
}

export async function adicionarExercicio(id, dados = {}) {
  const base = await carregarBaseEditor();
  const idx = base.treinos.findIndex((t) => String(t.id) === String(id));
  if (idx < 0) throw Object.assign(new Error("Treino não encontrado."), { status: 404 });

  const treino = base.treinos[idx];
  const exercicios = ordenarExercicios(treino.exercicios || []);
  const novoEx = normalizarExercicioPrescrito({ ...dados, ordem: dados.ordem || exercicios.length + 1 }, base.biblioteca);
  const novoTreino = {
    ...treino,
    exercicios: ordenarExercicios([...exercicios, novoEx]),
    atualizadoEm: agoraISO(),
    versao: recalcularVersao(treino),
    historico: historico(treino, "adicionar_exercicio", dados.usuario, { exercicio: novoEx.nome })
  };

  base.treinos[idx] = novoTreino;
  await salvarTreinos(base.treinos);
  return { ok: true, dados: novoTreino, exercicio: novoEx };
}

export async function atualizarExercicio(id, exercicioId, dados = {}) {
  const base = await carregarBaseEditor();
  const idx = base.treinos.findIndex((t) => String(t.id) === String(id));
  if (idx < 0) throw Object.assign(new Error("Treino não encontrado."), { status: 404 });

  const treino = base.treinos[idx];
  const exercicios = Array.isArray(treino.exercicios) ? treino.exercicios : [];
  const exIdx = exercicios.findIndex((e) => String(e.id) === String(exercicioId));
  if (exIdx < 0) throw Object.assign(new Error("Exercício do treino não encontrado."), { status: 404 });

  const atualizado = normalizarExercicioPrescrito({ ...exercicios[exIdx], ...dados, id: exercicios[exIdx].id }, base.biblioteca);
  exercicios[exIdx] = atualizado;

  const novoTreino = {
    ...treino,
    exercicios: ordenarExercicios(exercicios),
    atualizadoEm: agoraISO(),
    versao: recalcularVersao(treino),
    historico: historico(treino, "atualizar_exercicio", dados.usuario, { exercicio: atualizado.nome })
  };

  base.treinos[idx] = novoTreino;
  await salvarTreinos(base.treinos);
  return { ok: true, dados: novoTreino, exercicio: atualizado };
}

export async function removerExercicio(id, exercicioId, dados = {}) {
  const base = await carregarBaseEditor();
  const idx = base.treinos.findIndex((t) => String(t.id) === String(id));
  if (idx < 0) throw Object.assign(new Error("Treino não encontrado."), { status: 404 });

  const treino = base.treinos[idx];
  const exercicios = Array.isArray(treino.exercicios) ? treino.exercicios : [];
  const removido = exercicios.find((e) => String(e.id) === String(exercicioId));
  if (!removido) throw Object.assign(new Error("Exercício do treino não encontrado."), { status: 404 });

  const novoTreino = {
    ...treino,
    exercicios: ordenarExercicios(exercicios.filter((e) => String(e.id) !== String(exercicioId))),
    atualizadoEm: agoraISO(),
    versao: recalcularVersao(treino),
    historico: historico(treino, "remover_exercicio", dados.usuario, { exercicio: removido.nome })
  };

  base.treinos[idx] = novoTreino;
  await salvarTreinos(base.treinos);
  return { ok: true, dados: novoTreino, removido };
}

export async function reordenarExercicios(id, dados = {}) {
  const base = await carregarBaseEditor();
  const idx = base.treinos.findIndex((t) => String(t.id) === String(id));
  if (idx < 0) throw Object.assign(new Error("Treino não encontrado."), { status: 404 });

  const treino = base.treinos[idx];
  const ordem = Array.isArray(dados.ordem) ? dados.ordem : [];
  const mapa = new Map(ordem.map((item, i) => [String(item.id || item), Number(item.ordem || i + 1)]));
  const exercicios = (treino.exercicios || []).map((ex, i) => ({ ...ex, ordem: mapa.get(String(ex.id)) || ex.ordem || i + 1 }));

  const novoTreino = {
    ...treino,
    exercicios: ordenarExercicios(exercicios),
    atualizadoEm: agoraISO(),
    versao: recalcularVersao(treino),
    historico: historico(treino, "reordenar_exercicios", dados.usuario, { total: exercicios.length })
  };

  base.treinos[idx] = novoTreino;
  await salvarTreinos(base.treinos);
  return { ok: true, dados: novoTreino };
}

export async function duplicarTreino(id, dados = {}) {
  const base = await carregarBaseEditor();
  const treino = localizarTreino(base.treinos, id);
  if (!treino) throw Object.assign(new Error("Treino não encontrado."), { status: 404 });

  const copia = {
    ...treino,
    id: gerarId("trn"),
    nome: dados.nome || `${treino.nome || "Treino"} - cópia`,
    status: dados.status || "Ativo",
    dataInicio: dados.dataInicio || treino.dataInicio,
    dataValidade: dados.dataValidade || treino.dataValidade || "",
    exercicios: (treino.exercicios || []).map((ex) => ({ ...ex, id: gerarId("tex") })),
    origem: "duplicacao_editor_25d",
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    versao: 1,
    historico: [{ id: gerarId("hist"), acao: "duplicar_treino", usuario: dados.usuario || "Administrador", detalhes: { treinoOrigemId: id }, criadoEm: agoraISO() }]
  };

  base.treinos.push(copia);
  await salvarTreinos(base.treinos);
  return { ok: true, dados: copia };
}

export async function substituirExercicio(id, exercicioId, dados = {}) {
  const base = await carregarBaseEditor();
  const treino = localizarTreino(base.treinos, id);
  if (!treino) throw Object.assign(new Error("Treino não encontrado."), { status: 404 });

  const antigo = (treino.exercicios || []).find((e) => String(e.id) === String(exercicioId));
  if (!antigo) throw Object.assign(new Error("Exercício do treino não encontrado."), { status: 404 });

  const novoRef = normalizarExercicioPrescrito({
    exercicioId: dados.novoExercicioId || dados.exercicioId,
    nome: dados.nome,
    ordem: antigo.ordem,
    series: dados.series ?? antigo.series,
    repeticoes: dados.repeticoes ?? antigo.repeticoes,
    carga: dados.carga ?? antigo.carga,
    descanso: dados.descanso ?? antigo.descanso,
    observacao: dados.observacao ?? antigo.observacao
  }, base.biblioteca);

  return atualizarExercicio(id, exercicioId, { ...novoRef, usuario: dados.usuario || "Administrador" });
}

export async function progressaoCarga(id, exercicioId, dados = {}) {
  const base = await carregarBaseEditor();
  const treino = localizarTreino(base.treinos, id);
  if (!treino) throw Object.assign(new Error("Treino não encontrado."), { status: 404 });

  const ex = (treino.exercicios || []).find((e) => String(e.id) === String(exercicioId));
  if (!ex) throw Object.assign(new Error("Exercício do treino não encontrado."), { status: 404 });

  const cargaAtual = numero(String(ex.carga || "").replace(/[^\d,.-]/g, ""), 0);
  const incremento = numero(dados.incremento ?? dados.valor ?? 0);
  const novaCarga = incremento ? cargaAtual + incremento : numero(dados.novaCarga ?? dados.carga, cargaAtual);

  return atualizarExercicio(id, exercicioId, {
    carga: novaCarga ? `${novaCarga} kg` : texto(dados.carga || ex.carga),
    observacao: dados.observacao ?? ex.observacao,
    usuario: dados.usuario || "Progressão"
  });
}
