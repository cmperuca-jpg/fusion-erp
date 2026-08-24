import fs from "node:fs/promises";

const ENDPOINT = "https://oss.exercisedb.dev/api/v1/exercises";
const TOTAL_TESTE = 664;
const CACHE_TTL_MS = 55 * 60 * 1000;
const CACHE_FILE = "/tmp/fusion-exercisedb-free-664.json";
const USER_AGENT = "FusionERP-Pilot-Test/1.0";

let cacheMemoria = null;
let cacheMemoriaEm = 0;
let atualizando = null;

function pausa(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function texto(valor) {
  return String(valor ?? "").trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function grupoPorBodyPart(bodyParts = [], targetMuscles = []) {
  const bruto = normalizar([...(bodyParts || []), ...(targetMuscles || [])].join(" "));
  if (bruto.includes("chest") || bruto.includes("pector")) return "PEITO";
  if (bruto.includes("back") || bruto.includes("lat") || bruto.includes("spine")) return "COSTAS";
  if (bruto.includes("shoulder") || bruto.includes("delt")) return "OMBROS";
  if (bruto.includes("upper arm") || bruto.includes("biceps") || bruto.includes("triceps")) return "BRAÇOS";
  if (bruto.includes("lower arm") || bruto.includes("forearm")) return "ANTEBRAÇOS";
  if (bruto.includes("upper leg") || bruto.includes("quadriceps") || bruto.includes("hamstring") || bruto.includes("glute")) return "PERNAS";
  if (bruto.includes("lower leg") || bruto.includes("calf")) return "PANTURRILHAS";
  if (bruto.includes("waist") || bruto.includes("abs") || bruto.includes("core")) return "CORE";
  if (bruto.includes("cardio") || bruto.includes("cardiovascular")) return "CARDIO";
  if (bruto.includes("neck")) return "PESCOÇO";
  return "OUTROS";
}

function montarBiblioteca(lista = []) {
  const nomesGrupo = [];
  const grupoId = new Map();

  const exercicios = lista.slice(0, TOTAL_TESTE).map((item, indice) => {
    const grupo = grupoPorBodyPart(item.bodyParts, item.targetMuscles);
    if (!grupoId.has(grupo)) {
      nomesGrupo.push(grupo);
      grupoId.set(grupo, String(nomesGrupo.length));
    }

    const gifUrl = texto(item.gifUrl);
    const alvo = [...(item.targetMuscles || []), ...(item.secondaryMuscles || [])]
      .map(texto).filter(Boolean);
    const equipamento = (item.equipments || []).map(texto).filter(Boolean).join(", ");
    const instrucoes = (item.instructions || []).map(texto).filter(Boolean);

    return {
      id: `edb_${item.exerciseId || indice + 1}`,
      bibliotecaId: `edb_${item.exerciseId || indice + 1}`,
      exercicioId: `edb_${item.exerciseId || indice + 1}`,
      codigo: `EDB${String(indice + 1).padStart(4, "0")}`,
      nome: texto(item.name) || `Exercício ${indice + 1}`,
      grupo,
      grupoMuscular: grupo,
      grupoId: grupoId.get(grupo),
      musculos: alvo.join(", "),
      equipamento,
      categoria: grupo === "CARDIO" ? "Cardio" : "Teste ExerciseDB",
      nivel: "Teste",
      status: "Ativo",
      imagemUrl: gifUrl,
      midia: gifUrl,
      foto: gifUrl,
      gif: gifUrl,
      videoUrl: "",
      arquivoRelativo: "",
      tipoMidia: "gif",
      fonteMidia: "ExerciseDB Free V1 - teste remoto",
      descricao: instrucoes.join(" "),
      instrucoes,
      origem: "exercisedb_free_test_664",
      teste: true
    };
  });

  return {
    grupos: nomesGrupo.map((nome, idx) => ({ id: String(idx + 1), nome })),
    objetivos: [
      { id: "hipertrofia", nome: "HIPERTROFIA" },
      { id: "forca", nome: "FORÇA" },
      { id: "condicionamento", nome: "CONDICIONAMENTO FÍSICO" },
      { id: "emagrecimento", nome: "EMAGRECIMENTO" }
    ],
    exercicios
  };
}

async function lerCacheDisco() {
  try {
    const stat = await fs.stat(CACHE_FILE);
    const idade = Date.now() - stat.mtimeMs;
    if (idade >= CACHE_TTL_MS) return null;
    const dados = JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
    if (!Array.isArray(dados?.exercicios) || dados.exercicios.length !== TOTAL_TESTE) return null;
    return dados;
  } catch {
    return null;
  }
}

async function salvarCacheDisco(biblioteca) {
  const temp = `${CACHE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(biblioteca), "utf8");
  await fs.rename(temp, CACHE_FILE);
}

async function buscarPagina(after = "") {
  const url = new URL(ENDPOINT);
  url.searchParams.set("limit", "100");
  if (after) url.searchParams.set("after", after);

  const esperas429 = [5000, 10000, 20000, 30000, 60000];

  for (let tentativa = 0; tentativa <= esperas429.length; tentativa += 1) {
    const resposta = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT
      },
      signal: AbortSignal.timeout(30000)
    });

    if (resposta.status === 429) {
      if (tentativa >= esperas429.length) {
        throw new Error("ExerciseDB HTTP 429 após retentativas controladas");
      }
      const retryAfter = Number(resposta.headers.get("retry-after"));
      const espera = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 120000)
        : esperas429[tentativa];
      console.log(`ExerciseDB 429: aguardando ${Math.ceil(espera / 1000)}s...`);
      await pausa(espera);
      continue;
    }

    if (!resposta.ok) {
      throw new Error(`ExerciseDB HTTP ${resposta.status}`);
    }

    const payload = await resposta.json();
    if (!payload?.success || !Array.isArray(payload?.data)) {
      throw new Error("Resposta inválida do ExerciseDB");
    }
    return payload;
  }

  throw new Error("Falha inesperada no ExerciseDB");
}

async function baixarCatalogo() {
  const itens = [];
  let after = "";
  let paginas = 0;
  const vistos = new Set();

  while (itens.length < TOTAL_TESTE) {
    const payload = await buscarPagina(after);
    paginas += 1;

    for (const item of payload.data) {
      if (!item?.exerciseId || !item?.gifUrl) continue;
      if (vistos.has(item.exerciseId)) continue;
      vistos.add(item.exerciseId);
      itens.push(item);
      if (itens.length >= TOTAL_TESTE) break;
    }

    if (itens.length >= TOTAL_TESTE) break;
    if (!payload?.meta?.hasNextPage || !payload?.meta?.nextCursor) break;

    const proximo = String(payload.meta.nextCursor);
    if (!proximo || proximo === after) break;
    after = proximo;

    await pausa(1200);
  }

  if (itens.length < TOTAL_TESTE) {
    throw new Error(`ExerciseDB retornou apenas ${itens.length}/${TOTAL_TESTE} exercícios`);
  }

  console.log(`ExerciseDB: ${itens.length} exercícios em ${paginas} página(s)`);
  return itens.slice(0, TOTAL_TESTE);
}

async function carregarBiblioteca() {
  if (cacheMemoria && Date.now() - cacheMemoriaEm < CACHE_TTL_MS) {
    return cacheMemoria;
  }

  const cacheDisco = await lerCacheDisco();
  if (cacheDisco) {
    cacheMemoria = cacheDisco;
    cacheMemoriaEm = Date.now();
    return cacheMemoria;
  }

  const catalogo = await baixarCatalogo();
  const biblioteca = montarBiblioteca(catalogo);
  await salvarCacheDisco(biblioteca);
  cacheMemoria = biblioteca;
  cacheMemoriaEm = Date.now();
  return biblioteca;
}

export async function obterBibliotecaTeste() {
  if (!atualizando) {
    atualizando = carregarBiblioteca().finally(() => {
      atualizando = null;
    });
  }
  return await atualizando;
}

export async function limparCacheBibliotecaTeste() {
  cacheMemoria = null;
  cacheMemoriaEm = 0;
  await fs.rm(CACHE_FILE, { force: true }).catch(() => {});
  return true;
}

export function statusBibliotecaTeste() {
  return {
    modo: "teste",
    fonte: "ExerciseDB Free V1",
    total: TOTAL_TESTE,
    cacheTemporarioMinutos: 55,
    persistenciaMidia: false
  };
}

export const obterStatusBibliotecaTeste = statusBibliotecaTeste;

