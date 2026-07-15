import { listarBiblioteca, salvarBiblioteca, listarLegado } from "./exercicios-biblioteca.repository.mjs";
import { EXERCICIOS_BASE } from "./exercicios-biblioteca.seed.mjs";

function agoraISO() { return new Date().toISOString(); }
function gerarId(prefixo = "exb") { return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`; }
function texto(v) { return String(v ?? "").trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function numero(v, padrao = 0) { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : padrao; }
function ativo(item) { return !["cancelado","cancelada","inativo","inativa","arquivado","removido","removida"].includes(normalizar(item?.status || "Ativo")); }

function normalizarLista(v) {
  if (Array.isArray(v)) return v.map(texto).filter(Boolean);
  if (!v) return [];
  return String(v).split(",").map(texto).filter(Boolean);
}

function normalizarExercicio(dados = {}, existente = {}) {
  const nome = texto(dados.nome || dados.exercicio || existente.nome);
  if (!nome) throw Object.assign(new Error("Informe o nome do exercício."), { status: 400 });

  return {
    id: existente.id || dados.id || gerarId(),
    nome,
    grupoMuscular: texto(dados.grupoMuscular || dados.grupo || existente.grupoMuscular),
    gruposSecundarios: normalizarLista(dados.gruposSecundarios ?? existente.gruposSecundarios),
    categoria: texto(dados.categoria || existente.categoria || "Musculação"),
    equipamento: texto(dados.equipamento || existente.equipamento),
    nivel: texto(dados.nivel || existente.nivel || "Iniciante"),
    objetivo: normalizarLista(dados.objetivo ?? existente.objetivo),
    padraoSeries: numero(dados.padraoSeries ?? dados.series ?? existente.padraoSeries, 3),
    padraoRepeticoes: texto(dados.padraoRepeticoes || dados.repeticoes || existente.padraoRepeticoes || "10-12"),
    padraoDescanso: texto(dados.padraoDescanso || dados.descanso || existente.padraoDescanso || "60s"),
    tempoExecucao: texto(dados.tempoExecucao || existente.tempoExecucao),
    instrucoes: texto(dados.instrucoes || dados.descricao || existente.instrucoes),
    cuidados: texto(dados.cuidados || existente.cuidados),
    contraindicacoes: texto(dados.contraindicacoes || existente.contraindicacoes),
    videoUrl: texto(dados.videoUrl || dados.video || existente.videoUrl),
    imagemUrl: texto(dados.imagemUrl || dados.imagem || existente.imagemUrl),
    tags: normalizarLista(dados.tags ?? existente.tags),
    status: texto(dados.status || existente.status || "Ativo"),
    criadoEm: existente.criadoEm || dados.criadoEm || agoraISO(),
    atualizadoEm: agoraISO()
  };
}

function corresponde(ex, filtros = {}) {
  const busca = normalizar(filtros.busca || filtros.q || "");
  if (busca) {
    const hay = normalizar([
      ex.nome, ex.grupoMuscular, ex.categoria, ex.equipamento, ex.nivel,
      ...(ex.objetivo || []), ...(ex.tags || [])
    ].join(" "));
    if (!hay.includes(busca)) return false;
  }
  if (filtros.grupoMuscular && normalizar(ex.grupoMuscular) !== normalizar(filtros.grupoMuscular)) return false;
  if (filtros.categoria && normalizar(ex.categoria) !== normalizar(filtros.categoria)) return false;
  if (filtros.nivel && normalizar(ex.nivel) !== normalizar(filtros.nivel)) return false;
  if (filtros.equipamento && !normalizar(ex.equipamento).includes(normalizar(filtros.equipamento))) return false;
  if (filtros.objetivo) {
    const alvo = normalizar(filtros.objetivo);
    const lista = (ex.objetivo || []).map(normalizar);
    if (!lista.some((x) => x.includes(alvo) || alvo.includes(x))) return false;
  }
  if (filtros.status && normalizar(ex.status) !== normalizar(filtros.status)) return false;
  return true;
}

export async function statusBibliotecaExercicios() {
  return {
    ok: true,
    modulo: "exercicios-biblioteca",
    versao: "Fusion ERP 2.5-B",
    status: "Online",
    conceito: "Biblioteca inteligente de exercícios para montagem e prescrição de treinos"
  };
}

export async function inicializarBiblioteca() {
  const atual = await listarBiblioteca();
  const legado = await listarLegado();
  const mapa = new Map();

  for (const ex of [...EXERCICIOS_BASE, ...legado, ...atual]) {
    try {
      const norm = normalizarExercicio(ex);
      const chave = normalizar(norm.nome);
      if (!mapa.has(chave)) mapa.set(chave, norm);
      else mapa.set(chave, { ...mapa.get(chave), ...norm, id: mapa.get(chave).id, criadoEm: mapa.get(chave).criadoEm });
    } catch {}
  }

  const lista = [...mapa.values()].sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR"));
  await salvarBiblioteca(lista);
  return { ok: true, total: lista.length, dados: lista };
}

export async function listarExercicios(filtros = {}) {
  let lista = await listarBiblioteca();
  if (!lista.length) lista = (await inicializarBiblioteca()).dados;
  lista = lista.filter((x) => corresponde(x, filtros));
  if (filtros.apenasAtivos === "true" || filtros.apenasAtivos === true) lista = lista.filter(ativo);
  return { ok: true, total: lista.length, dados: lista };
}

export async function buscarExercicio(id) {
  const lista = await listarBiblioteca();
  const item = lista.find((x) => String(x.id) === String(id));
  if (!item) throw Object.assign(new Error("Exercício não encontrado."), { status: 404 });
  return { ok: true, dados: item };
}

export async function criarExercicio(dados = {}) {
  const lista = await listarBiblioteca();
  const novo = normalizarExercicio(dados);
  const duplicado = lista.find((x) => normalizar(x.nome) === normalizar(novo.nome));
  if (duplicado) throw Object.assign(new Error("Já existe exercício com este nome."), { status: 409 });
  lista.push(novo);
  await salvarBiblioteca(lista);
  return { ok: true, dados: novo };
}

export async function atualizarExercicio(id, dados = {}) {
  const lista = await listarBiblioteca();
  const idx = lista.findIndex((x) => String(x.id) === String(id));
  if (idx < 0) throw Object.assign(new Error("Exercício não encontrado."), { status: 404 });
  lista[idx] = normalizarExercicio({ ...lista[idx], ...dados, id: lista[idx].id }, lista[idx]);
  await salvarBiblioteca(lista);
  return { ok: true, dados: lista[idx] };
}

export async function arquivarExercicio(id, dados = {}) {
  return atualizarExercicio(id, { status: "Inativo", observacaoArquivamento: dados.motivo || "" });
}

export async function obterFiltros() {
  const lista = (await listarExercicios({})).dados;
  const unico = (campo) => [...new Set(lista.map((x) => x[campo]).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), "pt-BR"));
  const objetivos = [...new Set(lista.flatMap((x) => Array.isArray(x.objetivo) ? x.objetivo : []).filter(Boolean))].sort((a,b) => a.localeCompare(b, "pt-BR"));
  return {
    ok: true,
    gruposMusculares: unico("grupoMuscular"),
    categorias: unico("categoria"),
    equipamentos: unico("equipamento"),
    niveis: unico("nivel"),
    objetivos
  };
}

export async function sugerirExercicios(dados = {}) {
  const filtros = {
    objetivo: dados.objetivo || "",
    nivel: dados.nivel || "",
    categoria: dados.categoria || "",
    apenasAtivos: true
  };
  const todos = (await listarExercicios(filtros)).dados;
  const grupos = normalizarLista(dados.gruposMusculares || dados.grupos || "");
  const limite = Math.max(1, Number(dados.limite || 8));

  let lista = todos;
  if (grupos.length) {
    const set = new Set(grupos.map(normalizar));
    lista = todos.filter((x) => set.has(normalizar(x.grupoMuscular)) || (x.gruposSecundarios || []).some((g) => set.has(normalizar(g))));
  }

  if (!lista.length) lista = todos;
  return {
    ok: true,
    total: Math.min(lista.length, limite),
    dados: lista.slice(0, limite)
  };
}
