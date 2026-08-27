import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const FLASH_DIR = path.join(PUBLIC_DIR, "assets", "exercicios", "flash");
const MAP_FILE = path.join(ROOT, "config", "exercise-assets-map.json");
const FLASH_PREFIX = "/assets/exercicios/flash/";
const EXERCISES_PREFIX = "/assets/exercises/";
const GRUPO_ARQUIVADOS = "ARQUIVADOS";

const OBJETIVOS_PADRAO = Object.freeze([
  { id: "hipertrofia", nome: "HIPERTROFIA" },
  { id: "forca", nome: "FORCA" },
  { id: "condicionamento", nome: "CONDICIONAMENTO FISICO" },
  { id: "emagrecimento", nome: "EMAGRECIMENTO" }
]);

let aliasesCache = { mtimeMs: -1, aliases: {}, canonicalToFlash: {} };

function texto(valor) {
  return String(valor ?? "").trim();
}

function normalizar(valor) {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function chaveNome(valor = "") {
  return normalizar(valor)
    .replace(/\bflash\b/g, "")
    .replace(/\btrceps\b/g, "triceps")
    .replace(/\btr[ií]ceps\b/g, "triceps")
    .replace(/\bmartelho\b/g, "martelo")
    .replace(/\bbicepis\b/g, "biceps")
    .replace(/\bpull\s+over\b/g, "pullover")
    .replace(/\bpulley\b/g, "polia")
    .replace(/\bpullover\s+(?:na|no|em|de|da|do)?\s*(?:polia|cabo)\b/g, "pullover")
    .replace(/\bcross\s+over\b/g, "crossover")
    .replace(/\b\d{1,5}\b$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PALAVRAS_IGNORADAS_NOME = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos",
  "e", "em", "na", "nas", "no", "nos", "o", "os", "para", "pela",
  "pelas", "pelo", "pelos", "por", "sem", "cabo", "maquina", "aparelho"
]);

function tokensNome(valor = "") {
  return new Set(
    chaveNome(valor)
      .split(" ")
      .filter((token) => token.length > 2 && !PALAVRAS_IGNORADAS_NOME.has(token))
  );
}

function numerosPossiveis(ex = {}) {
  const bruto = [
    ex.id,
    ex.bibliotecaId,
    ex.exercicioId,
    ex.bibliotecaKey,
    ex.codigo,
    ex.codigoImagem,
    ex.codigoFlash,
    ex.exercicioCodigo,
    ex.bibliotecaCodigo,
    ex.arquivo,
    ex.arquivoRelativo,
    ex.midia,
    ex.imagemUrl,
    ex.foto,
    ex.gif
  ].filter(Boolean).join(" ");

  const numeros = new Set();
  for (const match of bruto.matchAll(/(?:flash[_:\s-]*)?(\d{1,5})(?=\D|$)/gi)) {
    const numero = Number(match[1]);
    if (Number.isInteger(numero) && numero > 0) numeros.add(String(numero));
  }
  return numeros;
}

function numerosConfiaveis(ex = {}) {
  const camposExplicitos = [
    ex.codigo,
    ex.codigoFlash,
    ex.exercicioCodigo,
    ex.bibliotecaCodigo
  ];

  const midiasFlash = [
    ex.arquivo,
    ex.arquivoRelativo,
    ex.midia,
    ex.imagemUrl,
    ex.foto,
    ex.gif
  ].filter((valor) => /flash|\.gif(?:$|\?)/i.test(texto(valor)));

  const bruto = [...camposExplicitos, ...midiasFlash].filter(Boolean).join(" ");
  const numeros = new Set();
  for (const match of bruto.matchAll(/(?:flash[_:\s-]*)?(\d{1,5})(?=\D|$)/gi)) {
    const numero = Number(match[1]);
    if (Number.isInteger(numero) && numero > 0) numeros.add(String(numero));
  }
  return numeros;
}

function pad4(valor) {
  const digitos = texto(valor).match(/\d+/)?.[0] || "0";
  return String(Number(digitos) || 0).padStart(4, "0");
}

export function codigoFlashDeValor(valor = "") {
  const bruto = texto(valor);
  if (!bruto) return "";

  const caminho = bruto.match(/(?:^|[\\/])0*(\d{1,5})\.gif(?:$|\?)/i);
  if (caminho) return String(Number(caminho[1]) || 0).padStart(3, "0");

  const flash = bruto.match(/(?:^|[^a-z0-9])flash[_:\s-]*0*(\d{1,5})(?=\D|$)/i);
  if (flash) return String(Number(flash[1]) || 0).padStart(3, "0");

  if (/^0*\d{1,5}$/.test(bruto)) return String(Number(bruto) || 0).padStart(3, "0");
  return "";
}

export function codigoFlashDeExercicio(ex = {}) {
  const campos = [
    ex.codigoImagem,
    ex.codigoFlash,
    ex.exercicioCodigo,
    ex.bibliotecaCodigo,
    ex.codigo,
    ex.arquivo,
    ex.arquivoRelativo,
    ex.midia,
    ex.imagemUrl,
    ex.foto,
    ex.gif,
    ex.id,
    ex.bibliotecaId,
    ex.exercicioId,
    ex.bibliotecaKey
  ];

  for (const campo of campos) {
    const codigo = codigoFlashDeValor(campo);
    if (codigo && Number(codigo) > 0) return codigo;
  }

  return "";
}

export function caminhoFlashPorCodigo(codigo = "") {
  const normalizado = codigoFlashDeValor(codigo);
  return normalizado ? `${FLASH_PREFIX}${normalizado}.gif` : "";
}

export function caminhoAbsolutoFlashPorCodigo(codigo = "") {
  const normalizado = codigoFlashDeValor(codigo);
  return normalizado ? path.join(FLASH_DIR, `${normalizado}.gif`) : "";
}

function semExtensao(nome = "") {
  return texto(nome).replace(/\.[^.]+$/i, "");
}

function limparNomeExercicio(nome = "") {
  return texto(nome);
}

function tituloDeArquivo(nome = "") {
  const base = semExtensao(nome)
    .replace(/^FLASH[_ -]*/i, "Flash ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return limparNomeExercicio(base || "Exercicio");
}

function normalizarGrupo(valor = "") {
  const chave = normalizar(valor)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const gruposCanonicos = {
    abdome: "ABDOME",
    abdomen: "ABDOME",
    abdomem: "ABDOME",
    antebraco: "ANTEBRAÇO",
    antebracos: "ANTEBRAÇO",
    biceps: "BÍCEPS",
    cardio: "CARDIO",
    core: "CORE",
    costa: "COSTAS",
    costas: "COSTAS",
    gluteo: "GLÚTEOS",
    gluteos: "GLÚTEOS",
    arquivado: GRUPO_ARQUIVADOS,
    arquivados: GRUPO_ARQUIVADOS,
    importados_flash: GRUPO_ARQUIVADOS,
    "importados flash": GRUPO_ARQUIVADOS,
    ombro: "OMBROS",
    ombros: "OMBROS",
    panturilha: "PANTURRILHAS",
    panturrilha: "PANTURRILHAS",
    panturilhas: "PANTURRILHAS",
    panturrilhas: "PANTURRILHAS",
    peito: "PEITO",
    posterior: "POSTERIOR",
    quadriceps: "QUADRÍCEPS",
    step: "STEP",
    steep: "STEP",
    trapezio: "TRAPÉZIO",
    triceps: "TRÍCEPS"
  };

  if (gruposCanonicos[chave]) return gruposCanonicos[chave];

  const grupo = texto(valor)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return grupo ? grupo.toUpperCase() : "GERAL";
}

function exercicioArquivado(ex = {}, grupo = "") {
  return ex.arquivado === true ||
    normalizar(ex.status) === "arquivado" ||
    normalizarGrupo(grupo || ex.grupo || ex.grupoMuscular || ex.grupoId) === GRUPO_ARQUIVADOS;
}

function lerAliases() {
  try {
    const stat = fsSync.statSync(MAP_FILE);
    if (stat.mtimeMs === aliasesCache.mtimeMs) return aliasesCache;

    const parsed = JSON.parse(fsSync.readFileSync(MAP_FILE, "utf8"));
    const aliases = parsed?.aliases && typeof parsed.aliases === "object" ? parsed.aliases : {};
    const canonicalToFlash = {};

    for (const [source, target] of Object.entries(aliases)) {
      if (!String(source).startsWith(FLASH_PREFIX)) continue;
      if (!String(target).startsWith(EXERCISES_PREFIX)) continue;
      canonicalToFlash[target] = source;
    }

    aliasesCache = { mtimeMs: stat.mtimeMs, aliases, canonicalToFlash };
  } catch {
    aliasesCache = { mtimeMs: -1, aliases: {}, canonicalToFlash: {} };
  }

  return aliasesCache;
}

export function resolverAliasMidia(url = "") {
  const midia = texto(url);
  if (!midia) return "";

  const { aliases, canonicalToFlash } = lerAliases();
  if (midia.startsWith(FLASH_PREFIX)) return midia;
  if (canonicalToFlash[midia]) return canonicalToFlash[midia];

  const alvo = aliases[midia];
  if (alvo && canonicalToFlash[alvo]) return canonicalToFlash[alvo];
  return midia;
}

function metadadosPorFlashUrl(flashUrl = "") {
  const { aliases } = lerAliases();
  const destino = aliases[flashUrl] || "";
  if (!destino.startsWith(EXERCISES_PREFIX)) return null;

  const relativo = destino.slice(EXERCISES_PREFIX.length);
  const partes = relativo.split("/").filter(Boolean);
  const arquivo = partes.pop() || "";
  const grupo = normalizarGrupo(partes[0] || "GERAL");

  return {
    grupo,
    nome: tituloDeArquivo(arquivo),
    arquivoRelativo: relativo
  };
}

function ordenarGifs(a, b) {
  const na = Number(a.match(/\d+/)?.[0] || 0);
  const nb = Number(b.match(/\d+/)?.[0] || 0);
  return na - nb || a.localeCompare(b, "pt-BR", { numeric: true });
}

async function listarArquivosFlash() {
  const entradas = await fs.readdir(FLASH_DIR, { withFileTypes: true }).catch(() => []);
  return entradas
    .filter((entry) => entry.isFile() && /\.gif$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort(ordenarGifs);
}

export function normalizarExercicioBiblioteca(ex = {}, indice = 0) {
  const midiaOriginal = texto(
    ex.gif ||
    ex.midia ||
    ex.imagemUrl ||
    ex.foto ||
    ex.videoUrl ||
    ex.imagem ||
    ex.image ||
    ""
  );
  const codigoImagem = codigoFlashDeExercicio({ ...ex, midia: midiaOriginal });
  const midia = codigoImagem ? caminhoFlashPorCodigo(codigoImagem) : resolverAliasMidia(midiaOriginal);
  const id = codigoImagem
    ? `FLASH_${codigoImagem.padStart(4, "0")}`
    : (texto(ex.id || ex.bibliotecaId || ex.exercicioId) || `EX${String(indice + 1).padStart(4, "0")}`);
  let grupo = normalizarGrupo(ex.grupo || ex.grupoMuscular || ex.folder || "GERAL");
  const arquivado = exercicioArquivado(ex, grupo);
  if (arquivado) grupo = GRUPO_ARQUIVADOS;
  const nome = limparNomeExercicio(texto(ex.nome || ex.name || ex.exercicio || tituloDeArquivo(path.basename(midia || id))));
  const gif = /\.gif($|\?)/i.test(midia) ? midia : texto(ex.gif || "");

  return {
    ...ex,
    id,
    bibliotecaId: codigoImagem ? id : texto(ex.bibliotecaId || id),
    exercicioId: codigoImagem ? id : texto(ex.exercicioId || id),
    bibliotecaKey: codigoImagem ? `flash:${codigoImagem.padStart(4, "0")}` : texto(ex.bibliotecaKey || `biblioteca:${normalizar(id)}`),
    codigo: codigoImagem ? id : texto(ex.codigo || id),
    codigoImagem,
    codigoFlash: codigoImagem,
    nome,
    grupo,
    grupoMuscular: arquivado ? GRUPO_ARQUIVADOS : normalizarGrupo(ex.grupoMuscular || grupo),
    grupoId: arquivado ? GRUPO_ARQUIVADOS : grupo,
    musculos: texto(ex.musculos || ex.alvo || ""),
    equipamento: texto(ex.equipamento || ""),
    categoria: texto(ex.categoria || "Musculacao"),
    nivel: texto(ex.nivel || "Geral"),
    status: arquivado ? "Arquivado" : texto(ex.status || "Ativo"),
    arquivado,
    grupoAnterior: texto(ex.grupoAnterior || ""),
    statusAnterior: texto(ex.statusAnterior || ""),
    arquivadoEm: texto(ex.arquivadoEm || ""),
    midia,
    imagemUrl: midia,
    foto: midia,
    gif: gif || midia,
    videoUrl: texto(ex.videoUrl || ""),
    tipoMidia: texto(ex.tipoMidia || ex.tipo || "gif"),
    origem: texto(ex.origem || "biblioteca_gifs_fusion"),
    ativo: arquivado ? false : ex.ativo !== false
  };
}

export function normalizarBibliotecaShape(dados = {}) {
  const origem = Array.isArray(dados)
    ? { grupos: [], objetivos: [], exercicios: dados }
    : {
        grupos: Array.isArray(dados?.grupos) ? dados.grupos : [],
        objetivos: Array.isArray(dados?.objetivos) ? dados.objetivos : [],
        exercicios: Array.isArray(dados?.exercicios) ? dados.exercicios : []
      };

  const exercicios = origem.exercicios.map(normalizarExercicioBiblioteca);
  const gruposPorNome = new Map();

  for (const grupo of origem.grupos) {
    const nome = normalizarGrupo(grupo?.nome || grupo?.id || "");
    if (nome) gruposPorNome.set(nome, { id: nome, nome });
  }

  for (const ex of exercicios) {
    const nome = normalizarGrupo(ex.grupo || ex.grupoMuscular);
    if (!gruposPorNome.has(nome)) gruposPorNome.set(nome, { id: nome, nome });
  }

  return {
    grupos: [...gruposPorNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    objetivos: origem.objetivos.length ? origem.objetivos : [...OBJETIVOS_PADRAO],
    exercicios
  };
}

export function contarExerciciosComGif(exercicios = []) {
  return (Array.isArray(exercicios) ? exercicios : []).filter((ex) => {
    const midia = texto(ex.gif || ex.midia || ex.imagemUrl || ex.foto || "");
    return /\.gif($|\?)/i.test(midia);
  }).length;
}

function criarIndiceGifs(fallback = {}) {
  const porChave = new Map();
  const porNumero = new Map();
  const porNome = new Map();
  const nomes = [];

  for (const gif of Array.isArray(fallback.exercicios) ? fallback.exercicios : []) {
    const normalizado = normalizarExercicioBiblioteca(gif);
    for (const chave of [
      normalizado.id,
      normalizado.bibliotecaId,
      normalizado.exercicioId,
      normalizado.bibliotecaKey,
      normalizado.codigo
    ]) {
      if (texto(chave)) porChave.set(normalizar(chave), normalizado);
    }

    for (const numero of numerosPossiveis(normalizado)) {
      if (!porNumero.has(numero)) porNumero.set(numero, normalizado);
    }

    const nome = chaveNome(normalizado.nome);
    if (nome) {
      if (!porNome.has(nome)) porNome.set(nome, normalizado);
      nomes.push({ nome, tokens: tokensNome(nome), gif: normalizado });
    }
  }

  return { porChave, porNumero, porNome, nomes };
}

function localizarPorNomeAproximado(nome = "", indice = {}) {
  const tokensAtual = tokensNome(nome);
  if (tokensAtual.size < 2) return null;

  let melhor = null;
  for (const item of indice.nomes || []) {
    if (!item.tokens?.size) continue;

    let comuns = 0;
    for (const token of tokensAtual) {
      if (item.tokens.has(token)) comuns += 1;
    }

    const coberturaAtual = comuns / tokensAtual.size;
    const coberturaItem = comuns / item.tokens.size;
    const score = comuns * 100 + coberturaAtual * 10 + coberturaItem;

    if (comuns >= 2 && coberturaAtual >= 0.6 && (!melhor || score > melhor.score)) {
      melhor = { score, gif: item.gif };
    }
  }

  return melhor?.gif || null;
}

function localizarGifCorrespondente(ex = {}, indice = {}) {
  const normalizado = normalizarExercicioBiblioteca(ex);
  const chavesConfiaveis = [
    normalizado.codigo,
    normalizado.codigoFlash,
    normalizado.exercicioCodigo,
    normalizado.bibliotecaCodigo,
    /^flash/i.test(texto(normalizado.id)) ? normalizado.id : "",
    /^flash/i.test(texto(normalizado.bibliotecaId)) ? normalizado.bibliotecaId : "",
    /^flash/i.test(texto(normalizado.exercicioId)) ? normalizado.exercicioId : "",
    /^flash:/i.test(texto(normalizado.bibliotecaKey)) ? normalizado.bibliotecaKey : ""
  ];

  for (const chave of chavesConfiaveis) {
    const encontrado = indice.porChave?.get(normalizar(chave));
    if (encontrado) return encontrado;
  }

  for (const numero of numerosConfiaveis(normalizado)) {
    const encontrado = indice.porNumero?.get(numero);
    if (encontrado) return encontrado;
  }

  const nome = chaveNome(normalizado.nome);
  if (nome) {
    const exato = indice.porNome?.get(nome);
    if (exato) return exato;

    for (const [nomeGif, gif] of indice.porNome || []) {
      if (nomeGif.length >= 8 && (nome.includes(nomeGif) || nomeGif.includes(nome))) return gif;
    }

    const aproximado = localizarPorNomeAproximado(nome, indice);
    if (aproximado) return aproximado;
  }

  for (const chave of [
    normalizado.id,
    normalizado.bibliotecaId,
    normalizado.exercicioId,
    normalizado.bibliotecaKey
  ]) {
    const encontrado = indice.porChave?.get(normalizar(chave));
    if (encontrado) return encontrado;
  }

  return null;
}

export function aplicarGifsNaBiblioteca(atual = {}, fallback = {}) {
  const base = normalizarBibliotecaShape(atual);
  const gifs = normalizarBibliotecaShape(fallback);
  if (!base.exercicios.length) return gifs;
  if (!gifs.exercicios.length) return base;

  const indice = criarIndiceGifs(gifs);
  const usados = new Set();
  const exercicios = base.exercicios.map((ex, idx) => {
    const normalizado = normalizarExercicioBiblioteca(ex, idx);
    const gif = localizarGifCorrespondente(normalizado, indice);
    if (!gif) return normalizado;

    const midiaGif = texto(gif.gif || gif.midia || gif.imagemUrl || gif.foto);
    usados.add(texto(gif.id));
    return {
      ...normalizado,
      grupo: normalizado.grupo || gif.grupo,
      grupoMuscular: normalizado.grupoMuscular || gif.grupoMuscular || gif.grupo,
      grupoId: normalizado.grupoId || gif.grupoId || gif.grupo,
      midia: midiaGif,
      imagemUrl: midiaGif,
      foto: midiaGif,
      gif: midiaGif,
      tipoMidia: "gif",
      fonteMidia: "gifs_restaurados",
      arquivoRelativoGif: gif.arquivoRelativo || normalizado.arquivoRelativo || ""
    };
  });

  const chavesExistentes = new Set(
    exercicios.flatMap((ex) => [
      texto(ex.id),
      texto(ex.bibliotecaId),
      texto(ex.exercicioId),
      texto(ex.bibliotecaKey)
    ]).filter(Boolean)
  );

  const extras = gifs.exercicios.filter((gif) => {
    if (usados.has(texto(gif.id))) return false;
    return ![
      gif.id,
      gif.bibliotecaId,
      gif.exercicioId,
      gif.bibliotecaKey
    ].some((chave) => chavesExistentes.has(texto(chave)));
  });

  return normalizarBibliotecaShape({
    grupos: [...base.grupos, ...gifs.grupos],
    objetivos: base.objetivos.length ? base.objetivos : gifs.objetivos,
    exercicios: [...exercicios, ...extras]
  });
}

export function deveUsarBibliotecaGifs(atual = {}, fallback = {}) {
  const exercicios = Array.isArray(atual?.exercicios) ? atual.exercicios : [];
  const totalAtual = exercicios.length;
  const totalFallback = Array.isArray(fallback?.exercicios) ? fallback.exercicios.length : 0;
  if (!totalFallback) return false;
  if (!totalAtual) return true;

  const gifsAtual = contarExerciciosComGif(exercicios);
  const minimoGifs = Math.max(20, Math.floor(totalAtual * 0.6));
  const fotosOuMidiaLimitada = gifsAtual < minimoGifs && totalFallback >= Math.min(totalAtual, 120);
  const fallbackCompativelComListaGrande = gifsAtual < minimoGifs && totalFallback >= Math.floor(totalAtual * 0.8);
  return fotosOuMidiaLimitada || fallbackCompativelComListaGrande || (gifsAtual < 20 && totalFallback > totalAtual);
}

export async function montarBibliotecaGifs() {
  const arquivos = await listarArquivosFlash();
  const exercicios = arquivos.map((arquivo, indice) => {
    const numero = pad4(arquivo);
    const codigoImagem = codigoFlashDeValor(arquivo);
    const flashUrl = `${FLASH_PREFIX}${arquivo}`;
    const meta = metadadosPorFlashUrl(flashUrl) || {};
    const grupo = normalizarGrupo(meta.grupo || GRUPO_ARQUIVADOS);
    const id = `FLASH_${numero}`;

    return normalizarExercicioBiblioteca({
      id,
      bibliotecaId: id,
      exercicioId: id,
      bibliotecaKey: `flash:${numero}`,
      codigo: id,
      codigoImagem,
      codigoFlash: codigoImagem,
      nome: meta.nome || `Flash ${numero}`,
      grupo,
      grupoMuscular: grupo,
      grupoId: grupo,
      midia: flashUrl,
      imagemUrl: flashUrl,
      foto: flashUrl,
      gif: flashUrl,
      tipoMidia: "gif",
      arquivoRelativo: meta.arquivoRelativo || `flash/${arquivo}`,
      origem: "flash_gifs_restaurados",
      sinonimos: [`Flash ${numero}`, `gif ${Number(numero)}`]
    }, indice);
  });

  return normalizarBibliotecaShape({ grupos: [], objetivos: [...OBJETIVOS_PADRAO], exercicios });
}

function indiceMetadadosPorCodigo(metadados = {}) {
  const lista = Array.isArray(metadados)
    ? metadados
    : (Array.isArray(metadados?.exercicios) ? metadados.exercicios : []);
  const indice = new Map();

  for (const item of lista) {
    const codigo = codigoFlashDeExercicio(item);
    if (!codigo) continue;
    indice.set(codigo, normalizarExercicioBiblioteca(item));
  }

  return indice;
}

export async function montarBibliotecaGifsComMetadados(metadados = {}) {
  const catalogo = await montarBibliotecaGifs();
  const indice = indiceMetadadosPorCodigo(metadados);
  const excluidos = new Set(
    [...indice.entries()]
      .filter(([, meta]) => meta.excluido === true || normalizar(meta.status) === "excluido")
      .map(([codigo]) => codigo)
  );
  const exerciciosBase = excluidos.size
    ? catalogo.exercicios.filter((gif) => !excluidos.has(codigoFlashDeExercicio(gif)))
    : catalogo.exercicios;
  if (!indice.size) return catalogo;

  const exercicios = exerciciosBase.map((gif, idx) => {
    const codigo = codigoFlashDeExercicio(gif);
    const meta = indice.get(codigo);
    if (!meta) return gif;

    const arquivado = exercicioArquivado(meta);
    const grupo = arquivado
      ? GRUPO_ARQUIVADOS
      : normalizarGrupo(meta.grupo || meta.grupoMuscular || gif.grupo);
    const midia = caminhoFlashPorCodigo(codigo);
    return normalizarExercicioBiblioteca({
      ...gif,
      nome: texto(meta.nome) || gif.nome,
      grupo,
      grupoMuscular: grupo,
      grupoId: grupo,
      musculos: texto(meta.musculos || gif.musculos || ""),
      equipamento: texto(meta.equipamento || gif.equipamento || ""),
      categoria: texto(meta.categoria || gif.categoria || "Musculacao"),
      nivel: texto(meta.nivel || gif.nivel || "Geral"),
      status: arquivado ? "Arquivado" : texto(meta.status || gif.status || "Ativo"),
      arquivado,
      grupoAnterior: texto(meta.grupoAnterior || ""),
      statusAnterior: texto(meta.statusAnterior || ""),
      arquivadoEm: texto(meta.arquivadoEm || ""),
      descricao: texto(meta.descricao || gif.descricao || ""),
      sinonimos: Array.isArray(meta.sinonimos) && meta.sinonimos.length ? meta.sinonimos : gif.sinonimos,
      tags: Array.isArray(meta.tags) ? meta.tags : gif.tags,
      historico: Array.isArray(meta.historico) ? meta.historico : gif.historico,
      atualizadoEm: meta.atualizadoEm || gif.atualizadoEm,
      midia,
      imagemUrl: midia,
      foto: midia,
      gif: midia,
      tipoMidia: "gif"
    }, idx);
  });

  return normalizarBibliotecaShape({
    grupos: catalogo.grupos,
    objetivos: catalogo.objetivos,
    exercicios
  });
}

export async function aplicarFallbackGifs(dados = {}, { preferirGifs = false } = {}) {
  const atual = normalizarBibliotecaShape(dados);
  const fallback = await montarBibliotecaGifs();
  const comGifs = aplicarGifsNaBiblioteca(atual, fallback);
  const total = comGifs.exercicios.length;
  const gifs = contarExerciciosComGif(comGifs.exercicios);
  const coberturaBoa = total > 0 && gifs >= Math.max(20, Math.floor(total * 0.6));

  if (preferirGifs) return coberturaBoa ? comGifs : fallback;
  if (deveUsarBibliotecaGifs(atual, fallback)) return coberturaBoa ? comGifs : fallback;
  return comGifs;
}
