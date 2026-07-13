import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { listarBiblioteca, listarTreinos, salvarTreinos } from "./treinos.repository.mjs";
import { avaliarAcessoAluno } from "../access-engine/access-engine.service.mjs";
import { listarLogs as listarLogsAcesso, registrarLog as registrarLogAcesso } from "../access-engine/access-engine.repository.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");
const TOKEN_TTL_MS = Number(process.env.FUSION_ALUNO_TOKEN_TTL_MS || 12 * 60 * 60 * 1000);
const LIMITE_ACESSOS_PORTAL_DIA = Math.max(0, Number(process.env.FUSION_PORTAL_ALUNO_LIMITE_CATRACA_DIA || 3));
const TIMEZONE_SISTEMA = process.env.FUSION_TIMEZONE || "America/Sao_Paulo";

async function lerJsonSeguro(arquivo, fallback) {
  try {
    const bruto = await fs.readFile(arquivo, "utf-8");
    return bruto.trim() ? JSON.parse(bruto) : fallback;
  } catch {
    return fallback;
  }
}

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
  const candidatos = [
    path.join(DATA_DIR, "alunos.json"),
    path.join(DATA_DIR, "alunos", "alunos.json"),
    path.join(DATA_DIR, "matriculas", "alunos.json")
  ];
  for (const arquivo of candidatos) {
    const dados = await lerJsonSeguro(arquivo, null);
    const lista = listaDePessoas(dados, "alunos");
    if (lista.length) return lista;
  }
  return [];
}

function erroHttp(mensagem, statusCode = 400) {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  return erro;
}

function criarTokenAluno(alunoId) {
  return Buffer.from(`${alunoId}:${Date.now()}`).toString("base64");
}

function validarTokenAluno(token, alunoId) {
  if (!token || !alunoId) throw erroHttp("Faça login novamente para liberar a catraca.", 401);

  let bruto = "";
  try {
    bruto = Buffer.from(String(token), "base64").toString("utf-8");
  } catch {
    throw erroHttp("Sessão do aluno inválida. Faça login novamente.", 401);
  }

  const [idToken, criadoEm] = bruto.split(":");
  if (!idToken || String(idToken) !== String(alunoId)) {
    throw erroHttp("Sessão do aluno não confere com este cadastro.", 401);
  }

  const criadoEmMs = Number(criadoEm);
  if (!Number.isFinite(criadoEmMs) || (TOKEN_TTL_MS > 0 && Date.now() - criadoEmMs > TOKEN_TTL_MS)) {
    throw erroHttp("Sessão expirada. Faça login novamente.", 401);
  }
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
  if (String(log.origem || "") !== "portal-aluno-botao") return false;
  if (String(log.alunoId || log.identificador || "") !== String(alunoId)) return false;
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
  biblioteca.exercicios = Array.isArray(biblioteca.exercicios) ? biblioteca.exercicios.map((ex) => ({
    ...ex,
    foto: ex.foto || ex.gif || `/assets/exercicios/flash/${String(ex.codigo || ex.id || "").padStart(3, "0")}.gif`
  })) : [];
  return biblioteca;
}

export async function obterTreinos(filtros = {}) {
  const treinos = await listarTreinos();
  const alunoId = filtros.alunoId ? String(filtros.alunoId) : "";
  if (!alunoId) return treinos;
  return treinos.filter((t) => String(t.alunoId || "") === alunoId);
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
