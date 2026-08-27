import { listarTreinos, salvarTreinos } from "./treinos.repository.mjs";
import { avaliarAcessoAluno } from "../access-engine/access-engine.service.mjs";
import { listarLogs as listarLogsAcesso, registrarLog as registrarLogAcesso } from "../access-engine/access-engine.repository.mjs";
import { lerJsonDuravel } from "../core/persistence/durable-json.mjs";
import { lerColecao } from "../core/persistence/collection-store.mjs";
import { tenantAtual } from "../core/persistence/tenant-context.mjs";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { combinarContadorAcessos } from "./aluno-app-access-counter.mjs";
import { gerarTokenPortal, validarTokenPortal } from "../auth/auth.service.mjs";
import {
  montarBibliotecaGifsComMetadados,
  resolverAliasMidia
} from "./biblioteca-gifs.service.mjs";
import fs from "node:fs";
import path from "node:path";

const LIMITE_ACESSOS_PORTAL_DIA = (() => {
  const valor = Number(process.env.FUSION_PORTAL_ALUNO_LIMITE_CATRACA_DIA || 1);
  return Number.isInteger(valor) && valor >= 1 && valor <= 10 ? valor : 1;
})();

function limiteAcessosDiariosAluno(aluno = {}) {
  const individual = Number(aluno?.limiteAcessosDiarios);
  return Number.isInteger(individual) && individual >= 1 && individual <= 10
    ? individual
    : LIMITE_ACESSOS_PORTAL_DIA;
}

const TIMEZONE_SISTEMA = process.env.FUSION_TIMEZONE || "America/Sao_Paulo";
const BIBLIOTECA_EXERCICIOS_COLECAO = "treinos_exercicios";

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
  if (origem === "fusion-biometria-local") return false;
  return dataLocalISO(log.criadoEm || log.data || log.timestamp) === dataAlvo;
}

async function acessosBiometriaEdgeHoje(alunoId, dataAlvo) {
  const supabase = obterSupabaseAdmin();
  if (!supabase) return 0;

  const { data, error } = await supabase
    .from("fusion_edge_daily_frequency")
    .select("entry_count")
    .eq("tenant_id", tenantAtual())
    .eq("student_id", alunoId)
    .eq("attendance_date", dataAlvo)
    .eq("modality", "biometria")
    .maybeSingle();

  if (error) {
    throw erroHttp(
      `Nao foi possivel consultar os acessos biometricos do dia: ${error.message}`,
      502
    );
  }

  const quantidade = Number(data?.entry_count || 0);
  return Number.isFinite(quantidade) ? Math.max(0, Math.trunc(quantidade)) : 0;
}

async function contadorAcessosPortal(alunoOuId) {
  const aluno = alunoOuId && typeof alunoOuId === "object"
    ? alunoOuId
    : await buscarAlunoPorId(alunoOuId);

  const alunoId = idPessoa(aluno) || String(alunoOuId || "");
  const data = dataLocalISO();
  const [logs, biometricos] = await Promise.all([
    listarLogsAcesso(),
    acessosBiometriaEdgeHoje(String(alunoId || ""), data)
  ]);

  const centrais = logs.filter((log) =>
    logContaComoAcessoPortal(log, alunoId, data)
  ).length;

  return {
    data,
    ...combinarContadorAcessos({
      central: centrais,
      biometria: biometricos,
      limite: limiteAcessosDiariosAluno(aluno)
    }),
    acessosCentralHoje: centrais,
    acessosBiometriaHoje: biometricos
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
  const senhaCadastrada = aluno?.senhaAluno || aluno?.senhaAcesso || aluno?.senhaPortal || aluno?.portalSenha || aluno?.senha || aluno?.password;
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
  const controleAntes = await contadorAcessosPortal(aluno);

  // Saída nunca consome nem é bloqueada pelo limite diário de entradas.
  if (direcaoNormalizada !== "saida" && controleAntes.limiteAtingido) {
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
    ? await contadorAcessosPortal(aluno)
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

  const controle = await contadorAcessosPortal(aluno);
  return {
    alunoId: idPessoa(aluno),
    alunoNome: nomePessoa(aluno),
    ...controle
  };
}


export async function obterBiblioteca() {
  let metadados = { grupos: [], objetivos: [], exercicios: [] };
  try {
    metadados = await lerColecao(BIBLIOTECA_EXERCICIOS_COLECAO, metadados);
  } catch (erro) {
    console.warn(`Biblioteca de exercicios: metadados indisponiveis (${erro.message}).`);
  }

  const biblioteca = await montarBibliotecaGifsComMetadados(metadados);
  biblioteca.grupos = Array.isArray(biblioteca.grupos) ? biblioteca.grupos : [];
  biblioteca.objetivos = Array.isArray(biblioteca.objetivos) ? biblioteca.objetivos : [];
  biblioteca.exercicios = Array.isArray(biblioteca.exercicios)
    ? biblioteca.exercicios.map((ex) => {
        const midia = resolverAliasMidia(ex.gif || ex.midia || ex.imagemUrl || ex.foto || "");
        return {
          ...ex,
          foto: midia,
          gif: midia,
          midia,
          imagemUrl: midia,
          tipoMidia: "gif"
        };
      })
    : [];

  return biblioteca;
}

function textoDivisao(valor = "") {
  const texto = String(valor || "").trim();
  const encontrado = texto.match(/(?:^|\b)treino\s*([a-z0-9]+)/i);
  return encontrado ? encontrado[1].toUpperCase() : "";
}

function treinoEstaAtivo(treino = {}) {
  const status = String(treino.status || "ativo").trim().toLowerCase();
  return treino.ativo !== false && !["cancelado", "inativo", "arquivado"].includes(status);
}

function exercicioParaPortal(item = {}) {
  const midia = resolverAliasMidia(item.gif || item.imagemUrl || item.midia || item.foto || "");

  return {
    ...item,
    nome: item.nome || item.exercicio || "Exercício",
    descricao: item.descricao || item.observacoes || item.observacao || "",
    exercicioId: item.exercicioId || "",
    bibliotecaId: item.bibliotecaId || "",
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

function divisoesDoTreinoPlano(treino = {}, indice = 0) {
  const exercicios = Array.isArray(treino.exercicios) ? treino.exercicios : [];
  const nomePadrao = textoDivisao(treino.nome || treino.tipoDivisao) || String.fromCharCode(65 + indice);
  const grupos = new Map();

  exercicios.forEach((item) => {
    const nome = textoDivisao(item.divisao || item.nomeDivisao || item.treino || item.observacao || item.obs) || nomePadrao;
    if (!grupos.has(nome)) grupos.set(nome, []);
    grupos.get(nome).push(exercicioParaPortal(item));
  });

  return [...grupos.entries()].map(([nome, itens]) => ({ nome, itens }));
}

function normalizarTreinosParaPortal(lista = []) {
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
        itens: (divisao.itens || []).map((item) => exercicioParaPortal(item))
      }))
    }));

  const planos = lista.filter((treino) => Array.isArray(treino.exercicios) && treino.exercicios.length);
  if (!planos.length) return estruturados;

  const primeiro = planos[0];
  const divisoes = planos
    .flatMap((treino, indice) => divisoesDoTreinoPlano(treino, indice))
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

function textoPessoa(valor = "") {
  return String(valor || "").trim();
}

function normalizarPessoa(valor = "") {
  return textoPessoa(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function treinoDoProfessor(treino = {}, professorId = "", professorNome = "") {
  const id = textoPessoa(professorId);
  const nome = normalizarPessoa(professorNome);
  const ids = [treino.professorId, treino.professor_id, treino.idProfessor, treino.treinadorId].map(textoPessoa);
  if (id && ids.includes(id)) return true;

  const nomes = [treino.professorNome, treino.professor_nome, treino.professor, treino.treinador, treino.treinadorNome]
    .map(normalizarPessoa)
    .filter(Boolean);
  return Boolean(nome && nomes.some(item => item === nome || item.includes(nome) || nome.includes(item)));
}

export async function obterTreinos(filtros = {}) {
  const treinos = await listarTreinos();
  const alunoId = filtros.alunoId ? String(filtros.alunoId) : "";
  const professorId = filtros.professorId ? String(filtros.professorId) : "";
  const professorNome = filtros.professorNome ? String(filtros.professorNome) : "";
  let filtrados = alunoId
    ? treinos.filter((t) => String(t.alunoId || t.aluno_id || "") === alunoId)
    : treinos;
  if (professorId || professorNome) {
    filtrados = filtrados.filter((t) => treinoDoProfessor(t, professorId, professorNome));
  }
  const ativos = filtrados.filter(treinoEstaAtivo);
  return normalizarTreinosParaPortal(ativos.length ? ativos : filtrados);
}

/* treinos-versionamento-seguro-v1 */

export async function criarTreino(payload) {
  if (!payload?.alunoId || !payload?.alunoNome) {
    const erro = new Error(
      "Selecione um aluno antes de salvar o treino."
    );
    erro.statusCode = 400;
    throw erro;
  }

  if (!payload?.professorId || !payload?.professorNome) {
    const erro = new Error(
      "Selecione o professor responsável antes de salvar o treino."
    );
    erro.statusCode = 400;
    throw erro;
  }

  const origem =
    String(payload.origem || "manual")
      .trim();

  const assistenteExecucaoId =
    String(
      payload.assistenteExecucaoId ||
      ""
    ).trim();

  const assistenteSugestaoId =
    String(
      payload.assistenteSugestaoId ||
      ""
    ).trim();

  const origemAssistente =
    origem.startsWith("assistente") ||
    Boolean(
      assistenteExecucaoId ||
      assistenteSugestaoId
    );

  /*
   * Sugestões automáticas somente podem virar uma nova
   * prescrição depois de confirmação explícita do professor.
   */
  if (
    origemAssistente &&
    payload.revisaoProfessorConfirmada !== true
  ) {
    const erro = new Error(
      "A sugestão assistida precisa ser revisada e confirmada pelo professor antes de virar um treino ativo."
    );
    erro.statusCode = 409;
    erro.code = "REVISAO_PROFESSOR_OBRIGATORIA";
    throw erro;
  }

  if (
    origemAssistente &&
    (
      !assistenteExecucaoId ||
      !assistenteSugestaoId
    )
  ) {
    const erro = new Error(
      "Execução e sugestão do assistente são obrigatórias para salvar uma versão assistida."
    );
    erro.statusCode = 400;
    erro.code = "RASTREABILIDADE_ASSISTENTE_OBRIGATORIA";
    throw erro;
  }

  const divisoes =
    Array.isArray(payload.divisoes)
      ? payload.divisoes.map((divisao) => ({
          nome: divisao.nome || "A",

          itens:
            Array.isArray(divisao.itens)
              ? divisao.itens.map((item) => {
                  const midia = resolverAliasMidia(item.gif || item.foto || item.imagemUrl || item.midia || "");
                  return {
                    id: item.id,
                    codigo: item.codigo,
                    nome: item.nome,
                    descricao:
                      item.descricao || "",
                    musculos:
                      item.musculos || "",
                    grupoId:
                      item.grupoId || "",
                    grupo:
                      item.grupo || "",
                    foto: midia,
                    gif: midia,
                    series:
                      item.series || "",
                    repeticoes:
                      item.repeticoes || "",
                    carga:
                      item.carga || "",
                    descanso:
                      item.descanso || "",
                    metodo:
                      item.metodo ||
                      "Convencional",
                    cadencia:
                      item.cadencia || "",
                    obs:
                      item.obs || ""
                  };
                })
              : []
        }))
      : [];

  const treinos =
    await listarTreinos();

  const alunoId =
    String(payload.alunoId);

  const agora =
    new Date().toISOString();

  const treinosAluno =
    treinos.filter(
      item =>
        String(
          item.alunoId ||
          item.aluno_id ||
          ""
        ) === alunoId
    );

  const ativosAnteriores =
    treinosAluno.filter(
      treinoEstaAtivo
    );

  /*
   * Registros legados podem não possuir versao.
   * Se já existe treino, ele é tratado no mínimo como V1.
   */
  const maiorVersaoInformada =
    treinosAluno.reduce(
      (maior, item) => {
        const numero =
          Number(
            item.versao ??
            item.versaoNumero ??
            0
          );

        return Number.isFinite(numero)
          ? Math.max(maior, numero)
          : maior;
      },
      0
    );

  const baseVersao =
    maiorVersaoInformada > 0
      ? maiorVersaoInformada
      : treinosAluno.length
        ? 1
        : 0;

  const versao =
    baseVersao + 1;

  const versaoOrigemId =
    String(
      payload.versaoOrigemId ||
      ativosAnteriores[0]?.id ||
      ""
    ).trim();

  const treinoId =
    payload.id ||
    `treino_${Date.now()}`;

  const treino = {
    id: treinoId,

    alunoId,
    alunoNome:
      payload.alunoNome,

    professorId:
      String(payload.professorId),

    professorNome:
      payload.professorNome,

    objetivo:
      payload.objetivo || "",

    validade:
      payload.validade || "",

    observacoes:
      payload.observacoes || "",

    divisoes,

    criadoEm:
      payload.criadoEm || agora,

    dataPrescricao:
      payload.dataPrescricao ||
      agora.slice(0, 10),

    atualizadoEm:
      agora,

    ativo: true,
    status: "ativo",

    versao,
    versaoAnteriorId:
      versaoOrigemId || null,

    origem,

    assistenteExecucaoId:
      assistenteExecucaoId || null,

    assistenteSugestaoId:
      assistenteSugestaoId || null,

    revisaoProfessorConfirmada:
      origemAssistente
        ? true
        : Boolean(
            payload.revisaoProfessorConfirmada
          ),

    revisadoEm:
      origemAssistente
        ? agora
        : null,

    revisadoPor:
      origemAssistente
        ? {
            professorId:
              String(payload.professorId),
            professorNome:
              payload.professorNome
          }
        : null
  };

  /*
   * Nenhum treino anterior é removido.
   * Os ativos anteriores do mesmo aluno são preservados,
   * apenas arquivados.
   */
  const historico =
    treinos.map(item => {
      const mesmoAluno =
        String(
          item.alunoId ||
          item.aluno_id ||
          ""
        ) === alunoId;

      if (
        !mesmoAluno ||
        !treinoEstaAtivo(item)
      ) {
        return item;
      }

      const versaoLegada =
        Number(
          item.versao ??
          item.versaoNumero ??
          0
        );

      return {
        ...item,

        versao:
          Number.isFinite(versaoLegada) &&
          versaoLegada > 0
            ? versaoLegada
            : Math.max(1, versao - 1),

        ativo: false,
        status: "arquivado",

        arquivadoEm:
          agora,

        substituidoPor:
          treinoId,

        atualizadoEm:
          item.atualizadoEm || agora
      };
    });

  await salvarTreinos([
    treino,
    ...historico
  ]);

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
