import { listarBiblioteca, listarTreinos, salvarTreinos } from "./treinos.repository.mjs";
import { avaliarAcessoAluno } from "../access-engine/access-engine.service.mjs";
import { listarLogs as listarLogsAcesso, registrarLog as registrarLogAcesso } from "../access-engine/access-engine.repository.mjs";
import { lerJsonDuravel } from "../core/persistence/durable-json.mjs";
import { gerarTokenPortal, validarTokenPortal } from "../auth/auth.service.mjs";
import fs from "node:fs";
import path from "node:path";

const LIMITE_ACESSOS_PORTAL_DIA = Math.max(0, Number(process.env.FUSION_PORTAL_ALUNO_LIMITE_CATRACA_DIA || 3));
const TIMEZONE_SISTEMA = process.env.FUSION_TIMEZONE || "America/Sao_Paulo";

function listaDePessoas(dados, chave) {
  if (Array.isArray(dados)) return dados;
  if (Array.isArray(dados?.dados)) return dados.dados;
  if (Array.isArray(dados?.[chave])) return dados[chave];
  if (Array.isArray(dados?.items)) return dados.items;
  if (dados?.dados && Array.isArray(dados.dados.itens)) return dados.dados.itens;
  return [];
}

function somenteDigitos(valor) {
  return String(valor || "").replace(/\D+/g, "");
}

function idPessoa(pessoa) {
  return String(pessoa?.id ?? pessoa?._id ?? pessoa?.codigo ?? pessoa?.alunoId ?? pessoa?.matriculaId ?? pessoa?.cpf ?? "");
}

function nomePessoa(pessoa) {
  return pessoa?.nome || pessoa?.nomeCompleto || pessoa?.alunoNome || pessoa?.name || "Aluno";
}

function dataNascimentoSenha(pessoa) {
  const raw = pessoa?.dataNascimento || pessoa?.nascimento || pessoa?.data_nascimento || "";
  const digitos = somenteDigitos(raw);
  if (digitos.length >= 8) return digitos.slice(0, 8);
  return "";
}

async function listarAlunosSistema() {
  const dados = await lerJsonDuravel("alunos.json", []);
  return listaDePessoas(dados, "alunos");
}

function erroHttp(mensagem, statusCode = 400) {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  return erro;
}

function criarTokenAluno(alunoId) {
  return gerarTokenPortal({ sub: alunoId, tipo: "aluno", perfil: "aluno", permissoes: ["aluno-treinos", "aluno-avaliacao"] });
}

function validarTokenAluno(token, alunoId) {
  if (!token || !alunoId) throw erroHttp("Faça login novamente para liberar a catraca.", 401);
  try {
    const payload = validarTokenPortal(token, "aluno");
    if (String(payload.sub) !== String(alunoId)) throw new Error("aluno divergente");
    return payload;
  } catch { throw erroHttp("Sessão do aluno expirada ou inválida. Faça login novamente.", 401); }
}

function dataLocalISO(valor = new Date()) {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return "";

  try {
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE_SISTEMA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(data);
    const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
    if (mapa.year && mapa.month && mapa.day) return `${mapa.year}-${mapa.month}-${mapa.day}`;
  } catch {}

  return data.toISOString().slice(0, 10);
}

function logContaComoAcessoPortal(log = {}, alunoId = "", dataAlvo = dataLocalISO()) {
  if (log.autorizado !== true) return false;
  if (String(log.alunoId || log.identificador || "") !== String(alunoId)) return false;
  const origem = String(log.origem || "").trim().toLowerCase();
  const direcao = String(log.direcao || log.movimento || "entrada").trim().toLowerCase();
  if (direcao === "saida") return false;
  if (origem.includes("teste") || origem.includes("diagnostico") || origem.includes("simulador")) return false;
  return dataLocalISO(log.criadoEm || log.data || log.timestamp) === dataAlvo;
}

async function contadorAcessosPortal(alunoId) {
  const data = dataLocalISO();
  const logs = await listarLogsAcesso();
  const usados = logs.filter((log) => logContaComoAcessoPortal(log, alunoId, data)).length;
  const limite = LIMITE_ACESSOS_PORTAL_DIA;
  const restantes = limite > 0 ? Math.max(0, limite - usados) : null;

  return {
    data,
    limite,
    usados,
    restantes,
    limiteAtingido: limite > 0 && usados >= limite
  };
}

async function registrarBloqueioLimitePortal({ aluno, controle, direcao = "entrada" } = {}) {
  try {
    await registrarLogAcesso({
      autorizado: false,
      motivo: `Limite diario de ${controle.limite} acessos atingido no portal do aluno.`,
      direcao,
      origem: "portal-aluno-botao-limite",
      identificador: idPessoa(aluno),
      alunoId: idPessoa(aluno),
      alunoNome: nomePessoa(aluno),
      numeroMatricula: aluno?.numeroMatricula || aluno?.matricula || "",
      limiteDiario: controle.limite,
      acessosUsadosHoje: controle.usados,
      acessosRestantesHoje: controle.restantes,
      dataControle: controle.data
    });
  } catch {}
}

async function buscarAlunoPorId(alunoId) {
  const alvo = String(alunoId || "");
  const alvoNumeros = somenteDigitos(alvo);
  const alunos = await listarAlunosSistema();
  return alunos.find((aluno) => {
    if (idPessoa(aluno) === alvo) return true;
    const campos = [aluno?.id, aluno?._id, aluno?.codigo, aluno?.alunoId, aluno?.matriculaId, aluno?.numeroMatricula, aluno?.matricula, aluno?.cpf];
    return campos.some((v) => String(v || "") === alvo || (alvoNumeros && somenteDigitos(v) === alvoNumeros));
  }) || null;
}

function loginCombina(aluno, login) {
  const l = String(login || "").trim().toLowerCase();
  const ld = somenteDigitos(l);
  const campos = [
    aluno?.email, aluno?.login, aluno?.usuario, aluno?.matricula, aluno?.codigo, aluno?.id, aluno?.alunoId, aluno?.cpf, aluno?.telefone, aluno?.celular
  ].filter(Boolean).map(v => String(v).trim().toLowerCase());
  if (campos.includes(l)) return true;
  if (ld) {
    return [aluno?.cpf, aluno?.telefone, aluno?.celular, aluno?.matricula, aluno?.codigo, aluno?.id, aluno?.alunoId]
      .some(v => somenteDigitos(v) === ld);
  }
  return false;
}

function senhaCombina(aluno, senha) {
  const s = String(senha || "").trim();
  const sd = somenteDigitos(s);
  const senhaCadastrada = aluno?.senhaAluno || aluno?.senha || aluno?.password || aluno?.senhaPortal || aluno?.portalSenha;
  if (senhaCadastrada && String(senhaCadastrada) === s) return true;

  const cpf = somenteDigitos(aluno?.cpf);
  if (cpf && (sd === cpf || sd === cpf.slice(-4))) return true;

  const nascimento = dataNascimentoSenha(aluno);
  if (nascimento && sd === nascimento) return true;

  return false;
}

export async function autenticarAlunoTreino({ login, senha } = {}) {
  if (!login || !senha) {
    const erro = new Error("Informe login e senha do aluno.");
    erro.statusCode = 400;
    throw erro;
  }

  const alunos = await listarAlunosSistema();
  const aluno = alunos.find((item) => loginCombina(item, login));
  if (!aluno || !senhaCombina(aluno, senha)) {
    const erro = new Error("Login ou senha inválidos.");
    erro.statusCode = 401;
    throw erro;
  }

  const alunoId = idPessoa(aluno);
  return {
    alunoId,
    alunoNome: nomePessoa(aluno),
    token: criarTokenAluno(alunoId),
    mensagem: "Aluno autenticado com sucesso."
  };
}

export async function validarSessaoAlunoTreino({ alunoId, token } = {}) {
  validarTokenAluno(token, alunoId);
  const aluno = await buscarAlunoPorId(alunoId);
  if (!aluno) throw erroHttp("Aluno não encontrado ou acesso indisponível.", 401);
  return { alunoId: idPessoa(aluno), alunoNome: nomePessoa(aluno) };
}

export async function liberarCatracaPortalAluno({ alunoId, token, direcao = "entrada" } = {}) {
  validarTokenAluno(token, alunoId);

  const aluno = await buscarAlunoPorId(alunoId);
  if (!aluno) throw erroHttp("Aluno não encontrado para liberar a catraca.", 404);

  const direcaoNormalizada = direcao === "saida" ? "saida" : "entrada";
  const controleAntes = await contadorAcessosPortal(idPessoa(aluno));

  if (controleAntes.limiteAtingido) {
    await registrarBloqueioLimitePortal({ aluno, controle: controleAntes, direcao: direcaoNormalizada });
    return {
      autorizado: false,
      motivo: `Limite diario de ${controleAntes.limite} acessos atingido. Procure a recepcao.`,
      alunoId: idPessoa(aluno),
      alunoNome: nomePessoa(aluno),
      catraca: null,
      logId: "",
      limiteAtingido: true,
      limiteDiario: controleAntes.limite,
      acessosUsadosHoje: controleAntes.usados,
      acessosRestantesHoje: controleAntes.restantes,
      controleAcessos: controleAntes
    };
  }

  const resultado = await avaliarAcessoAluno({
    aluno,
    direcao: direcaoNormalizada,
    origem: "portal-aluno-botao"
  });

  const controleDepois = resultado.autorizado
    ? await contadorAcessosPortal(idPessoa(aluno))
    : controleAntes;

  return {
    autorizado: Boolean(resultado.autorizado),
    motivo: resultado.motivo || (resultado.autorizado ? "Acesso liberado" : "Acesso bloqueado"),
    alunoId: idPessoa(aluno),
    alunoNome: nomePessoa(aluno),
    catraca: resultado.catraca || null,
    logId: resultado.log?.id || "",
    limiteAtingido: controleDepois.limiteAtingido,
    limiteDiario: controleDepois.limite,
    acessosUsadosHoje: controleDepois.usados,
    acessosRestantesHoje: controleDepois.restantes,
    controleAcessos: controleDepois
  };
}

export async function obterContadorCatracaPortalAluno({ alunoId, token } = {}) {
  validarTokenAluno(token, alunoId);

  const aluno = await buscarAlunoPorId(alunoId);
  if (!aluno) throw erroHttp("Aluno nao encontrado para consultar acessos.", 404);

  const controle = await contadorAcessosPortal(idPessoa(aluno));
  return {
    alunoId: idPessoa(aluno),
    alunoNome: nomePessoa(aluno),
    ...controle
  };
}


export async function obterBiblioteca() {
  const biblioteca = await listarBiblioteca();
  biblioteca.grupos = Array.isArray(biblioteca.grupos) ? biblioteca.grupos : [];
  biblioteca.objetivos = Array.isArray(biblioteca.objetivos) ? biblioteca.objetivos : [];
  biblioteca.exercicios = Array.isArray(biblioteca.exercicios) ? biblioteca.exercicios
    .map((ex) => {
      const codigo = String(ex.codigo || ex.id || "").padStart(3, "0");
      return { ...ex, codigo, foto: `/assets/exercicios/flash/${codigo}.gif` };
    })
    .filter((ex) => fs.existsSync(path.resolve("public/assets/exercicios/flash", `${ex.codigo}.gif`))) : [];
  return biblioteca;
}

function textoDivisao(valor = "") {
  const texto = String(valor || "").trim();
  const encontrado = texto.match(/(?:^|\b)treino\s*([a-z0-9]+)/i);
  return encontrado ? encontrado[1].toUpperCase() : "";
}

function normalizarBuscaExercicio(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b\d+(?:x\d+)?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const ALIASES_EXERCICIOS = new Map(Object.entries({
  "crucifixo na maquina": "crucifixo no voador",
  "triceps na polia com corda": "triceps corda no cross over",
  "puxada frontal pegada aberta": "pulley frente",
  "remada baixa": "remada baixa neutra",
  "remada unilateral com halter": "remada unilateral",
  "pulldown com corda": "pull down com corda",
  "rosca direta com barra": "rosca direta",
  "rosca martelo": "rosca martelo com halteres",
  "cadeira extensora": "extensao de joelhos",
  "stiff com barra": "stiff",
  "panturrilha em pe": "elevacao de panturrilha em pe"
}));

function midiaExercicio(item = {}) {
  return item.midia || item.imagemUrl || item.foto || item.gif || item.videoUrl || "";
}

function criarCatalogoMidias(...fontes) {
  const itens = fontes.flatMap((fonte) => {
    if (Array.isArray(fonte)) return fonte;
    if (Array.isArray(fonte?.exercicios)) return fonte.exercicios;
    return [];
  }).filter((item) => item && midiaExercicio(item));

  const porId = new Map();
  const porNome = new Map();
  for (const item of itens) {
    for (const id of [item.id, item.codigo, item.exercicioId, item.bibliotecaId].filter(Boolean)) {
      if (!porId.has(String(id))) porId.set(String(id), item);
    }
    const nome = normalizarBuscaExercicio(item.nome || item.exercicio);
    if (nome && !porNome.has(nome)) porNome.set(nome, item);
  }
  return { itens, porId, porNome };
}

function resolverExercicioNaBiblioteca(item = {}, catalogo) {
  if (!catalogo?.itens?.length) return null;

  for (const id of [item.bibliotecaId, item.exercicioId, item.codigo, item.id].filter(Boolean)) {
    const encontrado = catalogo.porId.get(String(id));
    if (encontrado) return encontrado;
  }

  const nomeOriginal = normalizarBuscaExercicio(item.nome || item.exercicio);
  if (!nomeOriginal) return null;
  const nomeAlvo = ALIASES_EXERCICIOS.get(nomeOriginal) || nomeOriginal;
  const exato = catalogo.porNome.get(nomeAlvo) || catalogo.porNome.get(nomeOriginal);
  if (exato) return exato;

  const tokensAlvo = nomeAlvo.split(" ").filter((token) => token.length > 2);
  const grupo = normalizarBuscaExercicio(item.grupoMuscular || item.grupo);
  let melhor = null;
  let melhorNota = 0;

  for (const candidato of catalogo.itens) {
    const nome = normalizarBuscaExercicio(candidato.nome || candidato.exercicio);
    if (!nome) continue;
    const tokensNome = new Set(nome.split(" "));
    const acertos = tokensAlvo.filter((token) => tokensNome.has(token)).length;
    if (!acertos) continue;

    let nota = acertos / Math.max(tokensAlvo.length, 1);
    if (nome.startsWith(nomeAlvo) || nomeAlvo.startsWith(nome)) nota += 0.35;
    const grupoCandidato = normalizarBuscaExercicio(candidato.grupoMuscular || candidato.grupo);
    if (grupo && grupoCandidato && (grupo.includes(grupoCandidato) || grupoCandidato.includes(grupo))) nota += 0.1;

    if (nota > melhorNota) {
      melhor = candidato;
      melhorNota = nota;
    }
  }

  return melhorNota >= 0.72 ? melhor : null;
}

function treinoEstaAtivo(treino = {}) {
  const status = String(treino.status || "ativo").trim().toLowerCase();
  return treino.ativo !== false && !["cancelado", "inativo", "arquivado"].includes(status);
}

function exercicioParaPortal(item = {}, catalogo = null) {
  const referencia = resolverExercicioNaBiblioteca(item, catalogo);
  const midia = midiaExercicio(item) || midiaExercicio(referencia);
  return {
    ...item,
    nome: item.nome || item.exercicio || "Exercício",
    descricao: item.descricao || item.observacoes || item.observacao || "",
    exercicioId: item.exercicioId || referencia?.id || referencia?.codigo || "",
    bibliotecaId: item.bibliotecaId || referencia?.bibliotecaId || referencia?.id || "",
    foto: midia,
    gif: midia,
    series: item.series ?? "",
    repeticoes: item.repeticoes ?? item.reps ?? "",
    carga: item.carga ?? "",
    descanso: item.descanso ?? "",
    metodo: item.metodo || item.intensidade || "Convencional",
    cadencia: item.cadencia || "",
    obs: item.obs || item.observacao || item.observacoes || ""
  };
}

function divisoesDoTreinoPlano(treino = {}, indice = 0, catalogo = null) {
  const exercicios = Array.isArray(treino.exercicios) ? treino.exercicios : [];
  const nomePadrao = textoDivisao(treino.nome || treino.tipoDivisao) || String.fromCharCode(65 + indice);
  const grupos = new Map();

  exercicios.forEach((item) => {
    const nome = textoDivisao(item.divisao || item.nomeDivisao || item.treino || item.observacao || item.obs) || nomePadrao;
    if (!grupos.has(nome)) grupos.set(nome, []);
    grupos.get(nome).push(exercicioParaPortal(item, catalogo));
  });

  return [...grupos.entries()].map(([nome, itens]) => ({ nome, itens }));
}

function normalizarTreinosParaPortal(lista = [], catalogo = null) {
  const estruturados = lista
    .filter((treino) => Array.isArray(treino.divisoes) && treino.divisoes.some((divisao) => Array.isArray(divisao.itens) && divisao.itens.length))
    .map((treino) => ({
      ...treino,
      alunoNome: treino.alunoNome || treino.aluno || "Aluno",
      professorNome: treino.professorNome || treino.professor || "",
      validade: treino.validade || treino.dataValidade || "",
      ativo: treinoEstaAtivo(treino),
      divisoes: treino.divisoes.map((divisao) => ({
        ...divisao,
        nome: textoDivisao(divisao.nome) || divisao.nome || "A",
        itens: (divisao.itens || []).map((item) => exercicioParaPortal(item, catalogo))
      }))
    }));

  const planos = lista.filter((treino) => Array.isArray(treino.exercicios) && treino.exercicios.length);
  if (!planos.length) return estruturados;

  const primeiro = planos[0];
  const divisoes = planos
    .flatMap((treino, indice) => divisoesDoTreinoPlano(treino, indice, catalogo))
    .filter((divisao) => divisao.itens.length)
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR", { numeric: true }));

  const combinado = {
    ...primeiro,
    id: `portal_${primeiro.alunoId || primeiro.aluno_id || primeiro.id || "treino"}`,
    nome: planos.length > 1 ? "Treino ABC" : (primeiro.nome || "Treino"),
    alunoNome: primeiro.alunoNome || primeiro.aluno || "Aluno",
    professorNome: primeiro.professorNome || primeiro.professor || "",
    validade: primeiro.validade || primeiro.dataValidade || "",
    ativo: planos.some(treinoEstaAtivo),
    divisoes
  };

  return [combinado, ...estruturados];
}

export async function obterTreinos(filtros = {}) {
  const [treinos, bibliotecaTreinos, bibliotecaAtual] = await Promise.all([
    listarTreinos(),
    listarBiblioteca(),
    lerJsonDuravel("exercicios_biblioteca.json", [])
  ]);
  // A biblioteca atual vem primeiro. O catálogo legado complementa nomes e
  // mantém compatibilidade com treinos antigos sem gravar caminhos duplicados.
  const catalogo = criarCatalogoMidias(bibliotecaAtual, bibliotecaTreinos);
  const alunoId = filtros.alunoId ? String(filtros.alunoId) : "";
  const filtrados = alunoId
    ? treinos.filter((t) => String(t.alunoId || t.aluno_id || "") === alunoId)
    : treinos;
  const ativos = filtrados.filter(treinoEstaAtivo);
  return normalizarTreinosParaPortal(ativos.length ? ativos : filtrados, catalogo);
}

export async function criarTreino(payload) {
  if (!payload?.alunoId || !payload?.alunoNome) {
    const erro = new Error("Selecione um aluno antes de salvar o treino.");
    erro.statusCode = 400;
    throw erro;
  }
  if (!payload?.professorId || !payload?.professorNome) {
    const erro = new Error("Selecione o professor responsável antes de salvar o treino.");
    erro.statusCode = 400;
    throw erro;
  }

  const divisoes = Array.isArray(payload.divisoes) ? payload.divisoes.map((divisao) => ({
    nome: divisao.nome || "A",
    itens: Array.isArray(divisao.itens) ? divisao.itens.map((item) => ({
      id: item.id,
      codigo: item.codigo,
      nome: item.nome,
      descricao: item.descricao || "",
      musculos: item.musculos || "",
      grupoId: item.grupoId || "",
      grupo: item.grupo || "",
      foto: item.foto || item.gif || "",
      gif: item.gif || item.foto || "",
      series: item.series || "",
      repeticoes: item.repeticoes || "",
      carga: item.carga || "",
      descanso: item.descanso || "",
      metodo: item.metodo || "Convencional",
      cadencia: item.cadencia || "",
      obs: item.obs || ""
    })) : []
  })) : [];

  const treinos = await listarTreinos();
  const agora = new Date().toISOString();
  const treino = {
    id: payload.id || `treino_${Date.now()}`,
    alunoId: String(payload.alunoId),
    alunoNome: payload.alunoNome,
    professorId: String(payload.professorId),
    professorNome: payload.professorNome,
    objetivo: payload.objetivo || "",
    validade: payload.validade || "",
    observacoes: payload.observacoes || "",
    divisoes,
    criadoEm: payload.criadoEm || agora,
    dataPrescricao: payload.dataPrescricao || agora.slice(0, 10),
    atualizadoEm: agora,
    ativo: payload.ativo !== false
  };

  const restantes = treinos.filter((t) => String(t.alunoId || "") !== String(treino.alunoId) || t.ativo === false);
  restantes.unshift(treino);
  await salvarTreinos(restantes);
  return treino;
}

export async function removerTreino(id) {
  const treinos = await listarTreinos();
  const filtrados = treinos.filter((t) => String(t.id) !== String(id));
  await salvarTreinos(filtrados);
  return { removido: filtrados.length !== treinos.length };
}


export async function atualizarTreino(id, payload = {}) {
  const treinos = await listarTreinos();
  const index = treinos.findIndex(t => String(t.id) === String(id));
  if (index < 0) return null;
  const atual = treinos[index];
  const atualizado = {
    ...atual,
    ...payload,
    id: atual.id,
    alunoId: String(payload.alunoId ?? atual.alunoId ?? ''),
    professorId: String(payload.professorId ?? atual.professorId ?? ''),
    atualizadoEm: new Date().toISOString()
  };
  treinos[index] = atualizado;
  await salvarTreinos(treinos);
  return atualizado;
}
