import fs from "node:fs/promises";

const ENDPOINT = "https://oss.exercisedb.dev/api/v1/exercises";
const TOTAL_TESTE = 664;
const CACHE_TTL_MS = 55 * 60 * 1000;
const CACHE_FILE = "/tmp/fusion-exercisedb-free-664.json";
const USER_AGENT = "FusionERP-Pilot-Test/1.0";
/* fusion-ptbr-exercisedb-piloto-v1 */
const FUSION_TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=";
async function traduzirNomePtBr(nome) {
  const original = texto(nome);
  if (!original) return original;
  const esperas = [0, 1200, 3000];
  for (const espera of esperas) {
    if (espera) await pausa(espera);
    try {
      const r = await fetch(FUSION_TRANSLATE_URL + encodeURIComponent(original), {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(12000)
      });
      if (r.status === 429) continue;
      if (!r.ok) break;
      const j = await r.json();
      const pt = Array.isArray(j?.[0]) ? j[0].map(x => texto(x?.[0])).join("").trim() : "";
      if (pt) return pt.charAt(0).toUpperCase() + pt.slice(1);
    } catch {}
  }
  return original;
}
async function traduzirCatalogoPtBr(lista = []) {
  const saida = new Array(lista.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= lista.length) return;
      const item = lista[i];
      const nomeOriginal = texto(item.name);
      const nomePtBr = await traduzirNomePtBr(nomeOriginal);
      saida[i] = { ...item, nameOriginal: nomeOriginal, name: nomePtBr, nomePtBr };
      await pausa(120);
    }
  }
  await Promise.all([worker(), worker()]);
  const pt = saida.filter(x => x?.nomePtBr && x.nomePtBr !== x.nameOriginal).length;
  console.log(`PT-BR: ${pt}/${saida.length} nomes traduzidos`);
  return saida;
}


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


function traduzirNomeLocalPtBr(valor) {
  let n = normalizar(valor).replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return "";

  const exatos = {
    "upward facing dog": "Cachorro olhando para cima",
    "downward facing dog": "Cachorro olhando para baixo",
    "roller back stretch": "Alongamento das costas com rolo",
    "child pose": "Postura da criança",
    "cobra stretch": "Alongamento cobra",
    "cat cow stretch": "Alongamento gato-vaca",
    "worlds greatest stretch": "Alongamento completo do corpo",
    "jumping jack": "Polichinelo",
    "mountain climber": "Escalador",
    "high knees": "Corrida com joelhos altos",
    "butt kicks": "Corrida com calcanhares nos glúteos",
    "bear crawl": "Caminhada do urso",
    "dead bug": "Inseto morto",
    "bird dog": "Bird dog",
    "good morning": "Bom dia",
    "hip thrust": "Elevação pélvica",
    "glute bridge": "Ponte de glúteos",
    "romanian deadlift": "Levantamento terra romeno",
    "stiff leg deadlift": "Levantamento terra com pernas estendidas",
    "sumo deadlift": "Levantamento terra sumô",
    "bench press": "Supino reto",
    "incline bench press": "Supino inclinado",
    "decline bench press": "Supino declinado",
    "push up": "Flexão de braços",
    "pull up": "Barra fixa",
    "chin up": "Barra fixa supinada",
    "lat pulldown": "Puxada alta",
    "seated row": "Remada sentada",
    "bent over row": "Remada curvada",
    "upright row": "Remada alta",
    "lateral raise": "Elevação lateral",
    "front raise": "Elevação frontal",
    "shoulder press": "Desenvolvimento de ombros",
    "chest fly": "Crucifixo",
    "pec deck": "Voador peitoral",
    "leg press": "Leg press",
    "leg extension": "Extensão de joelhos",
    "leg curl": "Flexão de joelhos",
    "calf raise": "Elevação de panturrilhas",
    "biceps curl": "Rosca bíceps",
    "hammer curl": "Rosca martelo",
    "preacher curl": "Rosca Scott",
    "concentration curl": "Rosca concentrada",
    "triceps pushdown": "Tríceps na polia",
    "triceps extension": "Extensão de tríceps",
    "skull crusher": "Tríceps testa",
    "sit up": "Abdominal",
    "crunch": "Abdominal curto",
    "plank": "Prancha",
    "side plank": "Prancha lateral",
    "russian twist": "Rotação russa",
    "bicycle crunch": "Abdominal bicicleta",
    "hanging leg raise": "Elevação de pernas suspenso",
    "burpee": "Burpee"
  };
  if (exatos[n]) return exatos[n];

  let sufixos = [];
  const prefixos = [
    ["barbell ", "com barra"], ["dumbbell ", "com halteres"],
    ["cable ", "na polia"], ["machine ", "na máquina"],
    ["smith ", "no Smith"], ["kettlebell ", "com kettlebell"],
    ["band ", "com faixa elástica"], ["resistance band ", "com faixa elástica"],
    ["bodyweight ", "com peso corporal"], ["weighted ", "com carga"],
    ["standing ", "em pé"], ["seated ", "sentado"],
    ["lying ", "deitado"], ["kneeling ", "ajoelhado"]
  ];
  for (const [p,s] of prefixos) {
    if (n.startsWith(p)) { n=n.slice(p.length); sufixos.push(s); break; }
  }

  const frases = [
    ["close grip","pegada fechada"],["wide grip","pegada aberta"],
    ["reverse grip","pegada invertida"],["neutral grip","pegada neutra"],
    ["single arm","unilateral"],["one arm","unilateral"],
    ["single leg","unilateral"],["one leg","unilateral"],
    ["straight arm","braços estendidos"],["straight leg","pernas estendidas"],
    ["bent over","curvado"],["rear delt","deltoide posterior"],
    ["chest press","supino na máquina"],["bench press","supino"],
    ["shoulder press","desenvolvimento de ombros"],["military press","desenvolvimento militar"],
    ["lat pulldown","puxada alta"],["pull down","puxada alta"],
    ["pull up","barra fixa"],["chin up","barra fixa supinada"],
    ["push up","flexão de braços"],["deadlift","levantamento terra"],
    ["hip thrust","elevação pélvica"],["glute bridge","ponte de glúteos"],
    ["leg press","leg press"],["leg extension","extensão de joelhos"],
    ["leg curl","flexão de joelhos"],["calf raise","elevação de panturrilhas"],
    ["lateral raise","elevação lateral"],["front raise","elevação frontal"],
    ["upright row","remada alta"],["seated row","remada sentada"],
    ["chest fly","crucifixo"],["reverse fly","crucifixo inverso"],
    ["biceps curl","rosca bíceps"],["hammer curl","rosca martelo"],
    ["preacher curl","rosca Scott"],["concentration curl","rosca concentrada"],
    ["triceps pushdown","tríceps na polia"],["triceps extension","extensão de tríceps"],
    ["skull crusher","tríceps testa"],["sit up","abdominal"],
    ["side plank","prancha lateral"],["russian twist","rotação russa"],
    ["mountain climber","escalador"],["jumping jack","polichinelo"]
  ];
  for (const [a,b] of frases) n=(" "+n+" ").replaceAll(" "+a+" "," "+b+" ").trim();

  const d = {
    squat:"agachamento", lunge:"afundo", row:"remada", curl:"rosca",
    press:"desenvolvimento", fly:"crucifixo", raise:"elevação",
    extension:"extensão", flexion:"flexão", rotation:"rotação",
    twist:"rotação", stretch:"alongamento", bridge:"ponte",
    pull:"puxada", push:"empurrar", kick:"chute", jump:"salto",
    walk:"caminhada", walking:"caminhando", run:"corrida", running:"correndo",
    hold:"isometria", rollout:"rolamento", roller:"rolo",
    chest:"peito", back:"costas", shoulder:"ombro", shoulders:"ombros",
    arm:"braço", arms:"braços", forearm:"antebraço", forearms:"antebraços",
    bicep:"bíceps", biceps:"bíceps", tricep:"tríceps", triceps:"tríceps",
    leg:"perna", legs:"pernas", quadriceps:"quadríceps", hamstring:"posterior de coxa",
    hamstrings:"posteriores de coxa", glute:"glúteo", glutes:"glúteos",
    calf:"panturrilha", calves:"panturrilhas", adductor:"adutor", abductor:"abdutor",
    hip:"quadril", hips:"quadris", knee:"joelho", knees:"joelhos",
    ankle:"tornozelo", wrist:"punho", neck:"pescoço", waist:"cintura",
    abs:"abdômen", abdominal:"abdominal", core:"core",
    incline:"inclinado", decline:"declinado", horizontal:"horizontal",
    vertical:"vertical", reverse:"invertido", alternate:"alternado",
    alternating:"alternado", assisted:"assistido", supported:"apoiado",
    unilateral:"unilateral", bilateral:"bilateral", lateral:"lateral",
    front:"frontal", rear:"posterior", upper:"superior", lower:"inferior",
    inner:"interno", outer:"externo", side:"lateral", straight:"estendido",
    bent:"flexionado", over:"sobre", under:"sob", with:"com", without:"sem",
    on:"em", floor:"solo", bench:"banco", chair:"cadeira", ball:"bola",
    rope:"corda", bar:"barra", plate:"anilha", sled:"trenó",
    wheel:"roda", step:"degrau", box:"caixa", dip:"mergulho", dips:"mergulhos",
    shrug:"encolhimento", shrugs:"encolhimentos", pullover:"pullover",
    clean:"clean", snatch:"arranco", swing:"balanço", thruster:"thruster",
    muscle:"muscular", mobility:"mobilidade", cardio:"cardio"
  };
  n=n.split(/\s+/).map(w => d[w] || w).join(" ")
    .replace(/\s+/g," ").trim();

  if (sufixos.length) n += " " + sufixos.join(" ");
  return n ? n.charAt(0).toLocaleUpperCase("pt-BR") + n.slice(1) : "";
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
      nome: traduzirNomeLocalPtBr(item.name) || `Exercício ${indice + 1}`,
      nomeOriginal: texto(item.nameOriginal || item.name),
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

