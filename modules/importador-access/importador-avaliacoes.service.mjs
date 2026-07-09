import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { calcularAvaliacaoCompleta } from "../avaliacoes/engine/evaluation.engine.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const AVALIACOES_JSON = path.join(DATA_DIR, "avaliacoes.json");
const ALUNOS_JSON = path.join(DATA_DIR, "alunos.json");
const IMPORT_DIR = path.join(DATA_DIR, "importacao");
const RELATORIO_JSON = path.join(IMPORT_DIR, "relatorio_importacao_avaliacoes_access.json");

const NOME_PRINCIPAL = "Avaliacao.txt";

function texto(v = "") { return String(v ?? "").replace(/\u0000/g, "").trim(); }
function normalizarNomeArquivo(nome = "") { return texto(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function numero(v, padrao = 0) {
  if (v === null || v === undefined || v === "") return padrao;
  if (typeof v === "number") return Number.isFinite(v) ? v : padrao;
  let s = texto(v).replace(/\s+/g, "").replace(/kg|cm|m|%|anos?|lt|g/gi, "");
  if (!s) return padrao;

  // 1.234,56 -> 1234.56
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",") && !s.includes(".")) {
    // 29,56 -> 29.56
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : padrao;
}
function intLegado(v) {
  const n = numero(v, 0);
  return n ? String(Math.trunc(n)) : "";
}

function normalizarSexoAccess(valor = "") {
  const s = texto(valor).toLowerCase();
  if (!s) return "";
  if (["m", "masc", "masculino", "homem", "0", "0,00"].includes(s)) return "masculino";
  if (["f", "fem", "feminino", "mulher", "1", "1,00"].includes(s)) return "feminino";
  return "";
}

function sexoDoAluno(aluno = {}, mapaSexoLegado = new Map()) {
  const direto = normalizarSexoAccess(aluno.sexo || aluno.genero || aluno.sexoBiologico || aluno.sexo_biologico || aluno.alunoSexo || aluno.alunoGenero);
  if (direto) return direto;
  const idLegado = texto(aluno.id_legado || aluno.idLegado || aluno.legacyId);
  return idLegado ? (mapaSexoLegado.get(idLegado) || "") : "";
}

async function criarMapaSexoAlunosAccess() {
  const candidatos = [
    path.join(IMPORT_DIR, "Alunos.txt"),
    path.resolve(process.cwd(), "Alunos.txt")
  ];
  const mapa = new Map();
  for (const arquivo of candidatos) {
    if (!(await existeArquivo(arquivo))) continue;
    const conteudo = await lerArquivoTextoLegado(arquivo);
    for (const c of parseDelimitado(conteudo)) {
      const id = intLegado(c[0] || c[1]);
      const sexo = normalizarSexoAccess(c[10]);
      if (id && sexo && !mapa.has(id)) mapa.set(id, sexo);
    }
    if (mapa.size) return mapa;
  }
  return mapa;
}
function dataAccess(v) {
  const s = texto(v);
  if (!s) return "";
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function agoraISO() { return new Date().toISOString(); }

function parseDelimitado(conteudo = "") {
  const textoArquivo = String(conteudo || "").replace(/^\uFEFF/, "");
  const linhas = [];
  let linha = [];
  let atual = "";
  let aspas = false;

  for (let i = 0; i < textoArquivo.length; i += 1) {
    const c = textoArquivo[i];
    const prox = textoArquivo[i + 1];
    if (c === '"') {
      if (aspas && prox === '"') { atual += '"'; i += 1; }
      else aspas = !aspas;
      continue;
    }
    if (c === ";" && !aspas) { linha.push(atual); atual = ""; continue; }
    if ((c === "\n" || c === "\r") && !aspas) {
      if (c === "\r" && prox === "\n") i += 1;
      linha.push(atual);
      if (linha.some(campo => texto(campo))) linhas.push(linha.map(texto));
      linha = []; atual = "";
      continue;
    }
    atual += c;
  }
  if (atual || linha.length) {
    linha.push(atual);
    if (linha.some(campo => texto(campo))) linhas.push(linha.map(texto));
  }
  return linhas;
}

async function lerJsonArray(arquivo) {
  try {
    const bruto = await fs.readFile(arquivo, "utf-8");
    const dados = bruto.trim() ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados : [];
  } catch {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    await fs.writeFile(arquivo, "[]", "utf-8");
    return [];
  }
}
async function salvarJson(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), "utf-8");
}

function arquivoPorNome(arquivos = {}, nomeBase = "") {
  const alvo = normalizarNomeArquivo(nomeBase);
  const entrada = Object.entries(arquivos).find(([nome]) => normalizarNomeArquivo(nome) === alvo);
  return entrada ? entrada[1] : "";
}
function parseArquivo(arquivos, nome) { return parseDelimitado(arquivoPorNome(arquivos, nome)); }

function agruparPorAvaliacao(linhas = [], indiceAvaliacao = -1) {
  const mapa = new Map();
  for (const c of linhas) {
    const id = intLegado(c[indiceAvaliacao]);
    if (!id) continue;
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id).push(c);
  }
  return mapa;
}
function mapearPerguntas(linhas = []) {
  const out = {};
  for (const c of linhas) {
    const pergunta = intLegado(c[2]);
    if (!pergunta) continue;
    out[`pergunta_${pergunta}`] = texto(c[3]);
  }
  return {
    objetivo: out.pergunta_1 || "",
    historico_atividade: out.pergunta_2 || "",
    medicamentos: out.pergunta_3 || "",
    cirurgia_lesao: out.pergunta_4 || "",
    historico_familiar: out.pergunta_5 || "",
    respostas: out
  };
}
function mapearParq(linhas = []) {
  const c = linhas[0] || [];
  return {
    q1: texto(c[2]), q2: texto(c[3]), q3: texto(c[4]), q4: texto(c[5]),
    q5: texto(c[6]), q6: texto(c[7]), q7: texto(c[8]),
    observacoes: texto(c[9]),
    bruto: c
  };
}
function mapearComposicao(c = []) {
  return {
    peso: numero(c[2], 0),
    peso_ideal: texto(c[3]),
    altura: numero(c[4], 0),
    imc: numero(c[5], 0),
    percentual_gordura: numero(c[16], 0),
    peso_referencia: numero(c[17], 0),
    protocolo: texto(c[19]),
    bruto: c
  };
}
function mapearPerimetros(c = []) {
  return {
    pescoco: numero(c[18], 0),
    ombro: numero(c[23], 0),
    torax_relaxado: numero(c[13], 0),
    torax_inspirado: numero(c[14], 0),
    abdome: numero(c[16], 0),
    cintura: numero(c[12], 0),
    quadril: numero(c[15], 0),
    rcq: numero(c[17], 0),
    antebraco_esq: numero(c[2], 0),
    antebraco_dir: numero(c[3], 0),
    braco_relaxado_esq: numero(c[4], 0),
    braco_relaxado_dir: numero(c[5], 0),
    braco_contraido_esq: numero(c[6], 0),
    braco_contraido_dir: numero(c[7], 0),
    coxa_esq: numero(c[8], 0),
    coxa_dir: numero(c[9], 0),
    panturrilha_esq: numero(c[10], 0),
    panturrilha_dir: numero(c[11], 0),
    bruto: c
  };
}
function mapearBioimpedancia(linhas = [], config = []) {
  const labels = new Map(config.map(c => [intLegado(c[0]), { nome: texto(c[1]), unidade: texto(c[2]) }]));
  const itens = {};
  for (const c of linhas) {
    const tipo = intLegado(c[2]);
    const cfg = labels.get(tipo) || { nome: `item_${tipo}`, unidade: "" };
    itens[cfg.nome] = { valor: texto(c[3]), unidade: cfg.unidade, bruto: c };
  }
  return { itens, bruto: linhas };
}
function mapearRisco(c = []) {
  return {
    escore_total: numero(c[c.length - 1], 0),
    bruto: c
  };
}

function classificarIMC(imc) {
  const n = numero(imc, 0);
  if (!n) return "";
  if (n < 18.5) return "Baixo peso";
  if (n < 25) return "Adequado";
  if (n < 30) return "Sobrepeso";
  if (n < 35) return "Obesidade grau I";
  if (n < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}
function classificarRCQ(rcq) {
  const n = numero(rcq, 0);
  if (!n) return "";
  if (n < 0.80) return "Baixo risco";
  if (n < 0.90) return "Risco moderado";
  return "Risco elevado";
}
function classificarRisco(score) {
  const n = numero(score, 0);
  if (!n) return "Não calculado";
  if (n < 10) return "Baixo";
  if (n < 20) return "Moderado";
  return "Elevado";
}
function parqPositivo(parq = {}) {
  return ["q1", "q2", "q3", "q4", "q5", "q6", "q7"].some(k => ["s", "sim", "1"].includes(texto(parq[k]).toLowerCase()));
}
function diferencaNum(atual, anterior) {
  const a = numero(atual, 0);
  const b = numero(anterior, 0);
  if (!a || !b) return null;
  return Number((a - b).toFixed(2));
}
function montarDiagnosticoComercial(av = {}) {
  const massaGorda = av.peso && av.percentual_gordura ? Number((numero(av.peso) * numero(av.percentual_gordura) / 100).toFixed(2)) : 0;
  const massaMagra = av.peso && massaGorda ? Number((numero(av.peso) - massaGorda).toFixed(2)) : 0;
  const alertas = [];
  const imc = numero(av.imc, 0);
  if (imc >= 30) alertas.push("IMC em faixa de obesidade. Recomenda-se acompanhamento e metas graduais.");
  const rcq = numero(av.rcq, 0);
  if (rcq >= 0.90) alertas.push("RCQ em faixa de risco elevado. Monitorar cintura e composição corporal.");
  if (parqPositivo(av.parq)) alertas.push("PAR-Q possui resposta positiva. Recomenda-se atenção antes de exercício intenso.");
  const riscoScore = numero(av.risco?.escore_total, 0);
  if (riscoScore >= 20) alertas.push("Escore de risco elevado. Considerar encaminhamento/avaliação médica.");
  return {
    imc: { valor: imc || "", classificacao: classificarIMC(imc) },
    rcq: { valor: rcq || "", classificacao: classificarRCQ(rcq) },
    risco: { escore: riscoScore || 0, classificacao: classificarRisco(riscoScore) },
    composicao: { massa_gorda: massaGorda || "", massa_magra: massaMagra || "" },
    alertas,
    resumo: [
      imc ? `IMC ${imc.toFixed(2)} (${classificarIMC(imc)})` : "IMC não calculado",
      av.percentual_gordura ? `Gordura corporal ${numero(av.percentual_gordura)}%` : "Gordura corporal não informada",
      rcq ? `RCQ ${rcq.toFixed(2)} (${classificarRCQ(rcq)})` : "RCQ não calculado"
    ]
  };
}
function enriquecerAvaliacoesComEvolucao(novas = [], existentes = []) {
  const todas = [...existentes, ...novas].filter(Boolean);
  const porAluno = new Map();
  for (const av of todas) {
    const alunoId = texto(av.alunoId || av.aluno_id);
    if (!alunoId) continue;
    if (!porAluno.has(alunoId)) porAluno.set(alunoId, []);
    porAluno.get(alunoId).push(av);
  }
  for (const lista of porAluno.values()) {
    lista.sort((a, b) => String(a.data || a.dataAvaliacao || "").localeCompare(String(b.data || b.dataAvaliacao || "")) || numero(a.numero_avaliacao,0) - numero(b.numero_avaliacao,0));
    for (let i = 0; i < lista.length; i += 1) {
      const av = lista[i];
      const ant = lista[i - 1] || null;
      if (!novas.includes(av)) continue;
      av.ordem_cronologica_aluno = i + 1;
      av.total_avaliacoes_aluno = lista.length;
      av.avaliacao_anterior_id = ant?.id || "";
      av.avaliacao_anterior_data = ant?.data || ant?.dataAvaliacao || "";
      av.evolucao = ant ? {
        peso: diferencaNum(av.peso, ant.peso),
        imc: diferencaNum(av.imc, ant.imc),
        percentual_gordura: diferencaNum(av.percentual_gordura, ant.percentual_gordura),
        cintura: diferencaNum(av.cintura, ant.cintura),
        quadril: diferencaNum(av.quadril, ant.quadril),
        rcq: diferencaNum(av.rcq, ant.rcq)
      } : { primeira_avaliacao: true };

      // Fusion Avaliação 4.0.1: todo diagnóstico passa pela Engine única.
      Object.assign(av, calcularAvaliacaoCompleta(av, lista.slice(0, i)));
    }
  }
  for (const av of novas) {
    if (!av.diagnostico_comercial) {
      av.ordem_cronologica_aluno = av.ordem_cronologica_aluno || 1;
      av.total_avaliacoes_aluno = av.total_avaliacoes_aluno || 1;
      av.evolucao = av.evolucao || { primeira_avaliacao: true };
      Object.assign(av, calcularAvaliacaoCompleta(av, []));
    }
  }
  return novas;
}
function montarLinhaTempoResumo(avaliacoes = []) {
  const porAluno = new Map();
  for (const av of avaliacoes) {
    const alunoId = texto(av.alunoId || av.aluno_id);
    if (!alunoId) continue;
    if (!porAluno.has(alunoId)) porAluno.set(alunoId, { alunoId, aluno: av.alunoNome || "", total: 0, datas: [], ultima: null });
    const item = porAluno.get(alunoId);
    item.total += 1;
    item.datas.push(av.data || av.dataAvaliacao || "");
    if (!item.ultima || String(av.data || "") > String(item.ultima.data || "")) item.ultima = { data: av.data, peso: av.peso, imc: av.imc, gordura: av.percentual_gordura };
  }
  return [...porAluno.values()].map(item => ({ ...item, primeiraData: item.datas.filter(Boolean).sort()[0] || "", ultimaData: item.datas.filter(Boolean).sort().at(-1) || "" }));
}

function criarIndiceAlunos(alunos = []) {
  const porLegado = new Map();
  for (const aluno of alunos) {
    const id = texto(aluno.id_legado || aluno.idLegado || aluno.legacyId);
    if (id && !porLegado.has(id)) porLegado.set(id, aluno);
  }
  return porLegado;
}
function chaveBase(av = {}) {
  if (av.id_legado_avaliacao) return `access:${av.id_legado_avaliacao}`;
  return `${av.alunoId}|${av.data}|${av.numero_avaliacao}`;
}

export function montarAvaliacoesAccess({ arquivos = {}, alunos = [], mapaSexoLegado = new Map() } = {}) {
  const principal = parseArquivo(arquivos, "Avaliacao.txt");
  const linhasAnamnese = parseArquivo(arquivos, "AvaliacaoAnamnese.txt");
  const linhasComposicao = parseArquivo(arquivos, "AvaliacaoComposicao.txt");
  const linhasPerimetros = parseArquivo(arquivos, "AvaliacaoPerimetros.txt");
  const linhasBio = parseArquivo(arquivos, "AvaliacaoBioimpedancia.txt");
  const linhasBioCfg = parseArquivo(arquivos, "AvaliacaoBioimpedanciaConfig.txt");
  const linhasParq = parseArquivo(arquivos, "AvaliacaoPARQ.txt");
  const linhasRisco = parseArquivo(arquivos, "AvaliacaoRisco.txt");
  const linhasPostural = parseArquivo(arquivos, "AvaliacaoPostural.txt");
  const linhasCardio = parseArquivo(arquivos, "AvaliacaoCardiorrespiratoria.txt");
  const linhasNeuro = parseArquivo(arquivos, "AvaliacaoNeuromotora.txt");
  const linhasObs = parseArquivo(arquivos, "AvaliacaoObs.txt");

  const porAlunoLegado = criarIndiceAlunos(alunos);
  const anamnesePorAv = agruparPorAvaliacao(linhasAnamnese, 4);
  const composicaoPorAv = new Map(linhasComposicao.map(c => [intLegado(c[1]), c]).filter(([id]) => id));
  const perimetrosPorAv = new Map(linhasPerimetros.map(c => [intLegado(c[1]), c]).filter(([id]) => id));
  const bioPorAv = agruparPorAvaliacao(linhasBio, 4);
  const parqPorAv = agruparPorAvaliacao(linhasParq, 10);
  const riscoPorAv = new Map(linhasRisco.map(c => [intLegado(c[1]), c]).filter(([id]) => id));
  const posturalPorAv = new Map(linhasPostural.map(c => [intLegado(c[1]), c]).filter(([id]) => id));
  const cardioPorAv = new Map(linhasCardio.map(c => [intLegado(c[1]), c]).filter(([id]) => id));
  const neuroPorAv = new Map(linhasNeuro.map(c => [intLegado(c[1]), c]).filter(([id]) => id));
  const obsPorAluno = new Map(linhasObs.map(c => [intLegado(c[1]), texto(c[2])]).filter(([id]) => id));

  const avaliacoes = [];
  const semAluno = [];
  const ignorados = [];
  const agora = agoraISO();

  for (const c of principal) {
    const idAvaliacao = intLegado(c[0]);
    const idAlunoLegado = intLegado(c[1]);
    const aluno = porAlunoLegado.get(idAlunoLegado);
    if (!idAvaliacao || !idAlunoLegado) {
      ignorados.push({ linha: c, motivo: "sem_id_avaliacao_ou_aluno" });
      continue;
    }
    if (!aluno) {
      semAluno.push({ id_legado_avaliacao: idAvaliacao, id_legado_aluno: idAlunoLegado, motivo: "aluno_nao_encontrado_por_id_legado" });
      continue;
    }

    const composicao = mapearComposicao(composicaoPorAv.get(idAvaliacao) || []);
    const perimetros = mapearPerimetros(perimetrosPorAv.get(idAvaliacao) || []);
    const rcqRecalculado = perimetros.cintura > 0 && perimetros.quadril > 0
      ? Number((perimetros.cintura / perimetros.quadril).toFixed(2))
      : 0;
    if (rcqRecalculado) perimetros.rcq = rcqRecalculado;
    const anamnese = mapearPerguntas(anamnesePorAv.get(idAvaliacao) || []);
    const parq = mapearParq(parqPorAv.get(idAvaliacao) || []);
    const bioimpedancia = mapearBioimpedancia(bioPorAv.get(idAvaliacao) || [], linhasBioCfg);
    const risco = mapearRisco(riscoPorAv.get(idAvaliacao) || []);

    const avaliacao = {
      id: `aval_imp_${crypto.randomUUID()}`,
      id_legado_avaliacao: idAvaliacao,
      id_legado_aluno: idAlunoLegado,
      origem_importacao: "Access",
      importadoAccess: true,
      versao_importador: "avaliacoes-access-v4.0.1",
      alunoId: aluno.id,
      aluno_id: aluno.id,
      alunoNome: aluno.nome || aluno.aluno || "",
      sexo: sexoDoAluno(aluno, mapaSexoLegado),
      data: dataAccess(c[3]) || hojeISO(),
      dataAvaliacao: dataAccess(c[3]) || hojeISO(),
      numero_avaliacao: intLegado(c[2]),
      idade: numero(c[5], 0),
      objetivo: anamnese.objetivo || "",
      observacoes: [texto(c[6]), obsPorAluno.get(idAlunoLegado)].filter(Boolean).join("\n"),
      peso: composicao.peso || "",
      altura: composicao.altura || "",
      imc: composicao.imc || "",
      percentual_gordura: composicao.percentual_gordura || "",
      rcq: rcqRecalculado || "",
      cintura: perimetros.cintura || "",
      quadril: perimetros.quadril || "",
      composicao,
      perimetros,
      anamnese,
      parq,
      bioimpedancia,
      risco,
      postural: { bruto: posturalPorAv.get(idAvaliacao) || [] },
      cardiorrespiratoria: { bruto: cardioPorAv.get(idAvaliacao) || [] },
      neuromotora: { bruto: neuroPorAv.get(idAvaliacao) || [] },
      legado: { avaliacao: c },
      criado_em: agora,
      criadoEm: agora,
      atualizado_em: agora,
      atualizadoEm: agora
    };
    avaliacoes.push(avaliacao);
  }

  return {
    avaliacoes,
    estatisticas: {
      total_linhas_avaliacao: principal.length,
      anamnese_linhas: linhasAnamnese.length,
      composicao_linhas: linhasComposicao.length,
      perimetros_linhas: linhasPerimetros.length,
      bioimpedancia_linhas: linhasBio.length,
      parq_linhas: linhasParq.length,
      risco_linhas: linhasRisco.length,
      normalizadas: avaliacoes.length,
      sem_aluno: semAluno.length,
      ignorados: ignorados.length
    },
    detalhes: { sem_aluno: semAluno.slice(0, 100), ignorados: ignorados.slice(0, 100) }
  };
}

export async function analisarAvaliacoesAccess({ arquivos = {} } = {}) {
  if (!arquivoPorNome(arquivos, NOME_PRINCIPAL)) throw new Error("Envie pelo menos o arquivo Avaliacao.txt.");
  const alunos = await lerJsonArray(ALUNOS_JSON);
  const mapaSexoLegado = await criarMapaSexoAlunosAccess();
  const montado = montarAvaliacoesAccess({ arquivos, alunos, mapaSexoLegado });
  enriquecerAvaliacoesComEvolucao(montado.avaliacoes, []);
  return {
    ok: true,
    destino: "simulacao",
    arquivos_recebidos: Object.keys(arquivos),
    alunos_na_base: alunos.length,
    sexo_mapeado_access: mapaSexoLegado.size,
    ...montado.estatisticas,
    preview: montado.avaliacoes.slice(0, 10),
    detalhes: montado.detalhes,
    gerado_em: agoraISO()
  };
}

export async function importarAvaliacoesAccessLocal({ arquivos = {}, dryRun = false } = {}) {
  if (!arquivoPorNome(arquivos, NOME_PRINCIPAL)) throw new Error("Envie pelo menos o arquivo Avaliacao.txt.");
  const [alunos, existentes] = await Promise.all([lerJsonArray(ALUNOS_JSON), lerJsonArray(AVALIACOES_JSON)]);
  const mapaSexoLegado = await criarMapaSexoAlunosAccess();
  const montado = montarAvaliacoesAccess({ arquivos, alunos, mapaSexoLegado });
  const chavesExistentes = new Set(existentes.map(chaveBase));
  const novas = [];
  const duplicadasBase = [];

  for (const av of montado.avaliacoes) {
    const chave = chaveBase(av);
    if (chavesExistentes.has(chave)) {
      duplicadasBase.push({ id_legado_avaliacao: av.id_legado_avaliacao, aluno: av.alunoNome, chave });
      continue;
    }
    chavesExistentes.add(chave);
    novas.push(av);
  }

  enriquecerAvaliacoesComEvolucao(novas, existentes);
  const linhaTempo = montarLinhaTempoResumo(novas);

  const relatorio = {
    ok: true,
    destino: dryRun ? "simulacao" : "data/avaliacoes.json",
    arquivos_recebidos: Object.keys(arquivos),
    alunos_na_base: alunos.length,
    sexo_mapeado_access: mapaSexoLegado.size,
    avaliacoes_existentes: existentes.length,
    ...montado.estatisticas,
    importaveis: novas.length,
    importadas: dryRun ? 0 : novas.length,
    alunos_com_historico: linhaTempo.length,
    avaliacoes_com_diagnostico: novas.filter(av => av.diagnostico_comercial).length,
    duplicadas_base: duplicadasBase.length,
    preview: novas.slice(0, 10),
    detalhes: { ...montado.detalhes, duplicadas_base: duplicadasBase.slice(0, 100), linha_tempo: linhaTempo.slice(0, 100) },
    gerado_em: agoraISO()
  };

  if (!dryRun) {
    await salvarJson(AVALIACOES_JSON, [...existentes, ...novas]);
    await salvarJson(RELATORIO_JSON, relatorio);
    await salvarJson(path.join(IMPORT_DIR, "avaliacoes_access_ultima_importacao.json"), novas);
    await salvarJson(path.join(IMPORT_DIR, "avaliacoes_access_linha_tempo.json"), linhaTempo);
  }

  return relatorio;
}

export async function lerRelatorioAvaliacoesAccess() {
  try {
    const bruto = await fs.readFile(RELATORIO_JSON, "utf-8");
    return JSON.parse(bruto);
  } catch {
    return { ok: true, mensagem: "Nenhuma importação de avaliações executada ainda." };
  }
}


const DIRETORIOS_AVALIACOES_LOCAL = [
  path.join(DATA_DIR, "importacao", "avaliacoes-access"),
  path.resolve(process.cwd(), "avaliacoes-access"),
  path.resolve(process.cwd(), "Nova pasta")
];

async function existeArquivo(abs) {
  try { await fs.access(abs); return true; } catch { return false; }
}

async function lerArquivoTextoLegado(abs) {
  const buf = await fs.readFile(abs);
  // Textos exportados do Access geralmente vêm em Windows-1252/latin1.
  return Buffer.from(buf).toString("latin1");
}

export async function lerArquivosAvaliacoesAccessLocal() {
  const nomesEsperados = [
    "Avaliacao.txt",
    "AvaliacaoAnamnese.txt",
    "AvaliacaoBioimpedancia.txt",
    "AvaliacaoBioimpedanciaConfig.txt",
    "AvaliacaoCardiorrespiratoria.txt",
    "AvaliacaoComparacao.txt",
    "AvaliacaoComparacaoT.txt",
    "AvaliacaoComposicao.txt",
    "AvaliacaoConfig.txt",
    "AvaliacaoNeuromotora.txt",
    "AvaliacaoObs.txt",
    "AvaliacaoPARQ.txt",
    "AvaliacaoPerimetros.txt",
    "AvaliacaoPerimetrosC.txt",
    "AvaliacaoPostural.txt",
    "AvaliacaoRisco.txt",
    "AvaliacaoTestes1a3.txt",
    "AvaliacaoTestes4a6.txt"
  ];

  let diretorioUsado = "";
  for (const dir of DIRETORIOS_AVALIACOES_LOCAL) {
    if (await existeArquivo(path.join(dir, NOME_PRINCIPAL))) { diretorioUsado = dir; break; }
  }
  if (!diretorioUsado) {
    throw new Error("Arquivos de avaliação não encontrados. Coloque os TXT em data/importacao/avaliacoes-access/ ou envie pela tela.");
  }

  const arquivos = {};
  for (const nome of nomesEsperados) {
    const abs = path.join(diretorioUsado, nome);
    if (await existeArquivo(abs)) arquivos[nome] = await lerArquivoTextoLegado(abs);
  }
  return { arquivos, diretorio: diretorioUsado };
}

export async function analisarAvaliacoesAccessLocal() {
  const { arquivos, diretorio } = await lerArquivosAvaliacoesAccessLocal();
  const resultado = await analisarAvaliacoesAccess({ arquivos });
  return { ...resultado, modo_arquivos: "servidor", diretorio_arquivos: diretorio };
}

export async function importarAvaliacoesAccessLocalArquivos({ dryRun = false } = {}) {
  const { arquivos, diretorio } = await lerArquivosAvaliacoesAccessLocal();
  const resultado = await importarAvaliacoesAccessLocal({ arquivos, dryRun });
  return { ...resultado, modo_arquivos: "servidor", diretorio_arquivos: diretorio };
}
