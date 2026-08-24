import { Router } from "express";
import {
  obterBiblioteca,
  obterTreinos,
  criarTreino,
  atualizarTreino,
  removerTreino,
  autenticarAlunoTreino,
  validarSessaoAlunoTreino,
  liberarCatracaPortalAluno,
  obterContadorCatracaPortalAluno
} from "./treinos.service.mjs";
import { obterBibliotecaTeste } from "./exercisedb-free-test.service.mjs";
import {
  obterConfiguracaoEquipamentosAcademia,
  atualizarConfiguracaoEquipamentosAcademia
} from "./equipamentos-academia.service.mjs";
import {
  ativarAlunoApp,
  ativarAlunoAppPorLink,
  statusAlunoApp,
  loginAlunoApp,
  primeiroAcessoAlunoApp,
  primeiroAcessoAlunoAppPorLink,
  gravarSessaoAluno,
  limparSessaoAluno,
  obterHomeAlunoApp
} from "./aluno-app.service.mjs";
import * as alunosService from "../alunos/alunos.service.mjs";
import * as avaliacoesService from "../avaliacoes/avaliacoes.service.mjs";
import {
  registrarGeracaoAprendizado,
  registrarRevisaoAprendizado,
  registrarAprovacaoAprendizado,
  obterResumoAprendizado,
  obterPreferenciasAprendizado
} from "./assistente-aprendizado.service.mjs";
import {
  obterStatusProvedoresAssistente
} from "./assistente-provider.service.mjs";
import {
  atualizarFotoAlunoApp,
  contadorCatracaAlunoApp,
  frequenciaAlunoApp,
  liberarCatracaAlunoApp
} from "./aluno-app-actions.service.mjs";
import {
  consultarPagamentoAlunoApp,
  iniciarPagamentoAlunoApp
} from "../pagamentos-online/pagamentos-online.service.mjs";

const router = Router();

function texto(valor) {
  return String(valor || "").trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mesmo(a, b) {
  return texto(a) && texto(a) === texto(b);
}


/* assistente-avaliacao-contexto-v1 */

function numeroAssistente(valor) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function idadeAlunoContexto(aluno = {}) {
  const bruto = texto(
    aluno.dataNascimento ||
    aluno.data_nascimento ||
    aluno.nascimento ||
    aluno.dataNascimentoAluno
  );

  if (!bruto) return null;

  let data = null;

  if (/^\d{4}-\d{2}-\d{2}/.test(bruto)) {
    const [ano, mes, dia] = bruto.slice(0, 10).split("-").map(Number);
    data = new Date(ano, mes - 1, dia);
  } else {
    const m = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) data = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }

  if (!data || Number.isNaN(data.getTime())) return null;

  const hoje = new Date();
  let idade = hoje.getFullYear() - data.getFullYear();
  const deltaMes = hoje.getMonth() - data.getMonth();

  if (
    deltaMes < 0 ||
    (deltaMes === 0 && hoje.getDate() < data.getDate())
  ) {
    idade -= 1;
  }

  return idade >= 0 ? idade : null;
}

function dataOrdenacaoAvaliacao(av = {}) {
  return texto(
    av.data ||
    av.atualizadoEm ||
    av.atualizado_em ||
    av.criadoEm ||
    av.criado_em
  );
}

function contextoDaAvaliacaoParaAssistente(avaliacao = null, aluno = {}) {
  const idade = idadeAlunoContexto(aluno);

  if (!avaliacao) {
    return {
      schemaVersion: 1,
      fonte: "avaliacao_fisica",
      alunoId: texto(aluno.id || aluno.alunoId || aluno.aluno_id),
      idade,
      avaliacao: null,
      prontoParaGerar: false,
      motivosBloqueio: [
        "O aluno não possui avaliação física concluída e liberada para o assistente."
      ],
      atencoes: [],
      prescricao: {},
      seguranca: {},
      funcional: {},
      capacidadeFisica: {},
      composicao: {}
    };
  }

  const parq = Array.isArray(avaliacao.parq) ? avaliacao.parq : [];

  const respostasParq = parq.map(item =>
    normalizar(item?.resposta)
  );

  const parqCompleto =
    parq.length >= 7 &&
    respostasParq.length === parq.length &&
    respostasParq.every(v => v === "sim" || v === "nao");

  const parqPositivo = respostasParq.some(v => v === "sim");

  const objetivo = texto(avaliacao.objetivo);
  const experiencia = texto(avaliacao.experiencia_treino);
  const frequencia = numeroAssistente(avaliacao.frequencia_semanal);
  const duracao = numeroAssistente(avaliacao.duracao_sessao_min);

  const restricoesMedicas = texto(avaliacao.restricoes_medicas);
  const lesoes = texto(avaliacao.lesoes);
  const dorAtual = texto(avaliacao.dor_atual);
  const dorMovimento = texto(avaliacao.dor_movimento);

  const motivosBloqueio = [];

  if (normalizar(avaliacao.status_avaliacao) !== "concluida") {
    motivosBloqueio.push("avaliação física não concluída");
  }

  if (!objetivo) {
    motivosBloqueio.push("objetivo principal não informado");
  }

  if (!experiencia) {
    motivosBloqueio.push("experiência em musculação não informada");
  }

  if (!frequencia || frequencia < 2 || frequencia > 6) {
    motivosBloqueio.push("frequência do treino deve estar entre 2 e 6 dias por semana");
  }

  if (!duracao) {
    motivosBloqueio.push("duração da sessão não informada");
  }

  if (!parqCompleto) {
    motivosBloqueio.push("PAR-Q incompleto");
  }

  if (parqPositivo) {
    motivosBloqueio.push("PAR-Q possui resposta positiva e requer revisão profissional");
  }

  if (normalizar(avaliacao.apta_sugestao_assistida) !== "sim") {
    motivosBloqueio.push("professor não liberou esta avaliação para sugestão assistida");
  }

  if (restricoesMedicas) {
    motivosBloqueio.push("restrição médica informada; montagem automática bloqueada nesta versão");
  }

  if (lesoes) {
    motivosBloqueio.push("lesão atual ou recorrente informada; montagem automática bloqueada nesta versão");
  }

  if (normalizar(dorAtual) === "sim") {
    motivosBloqueio.push("dor atual informada; montagem automática bloqueada nesta versão");
  }

  if (normalizar(dorMovimento) === "sim") {
    motivosBloqueio.push("dor durante movimento registrada; montagem automática bloqueada nesta versão");
  }

  if (idade === null) {
    motivosBloqueio.push("data de nascimento não disponível");
  } else if (idade < 16) {
    motivosBloqueio.push("assistente automático indisponível para aluno menor de 16 anos nesta versão");
  }

  const atencoes = [];

  if (
    [
      avaliacao.agachamento_funcional,
      avaliacao.mobilidade_ombro,
      avaliacao.mobilidade_quadril,
      avaliacao.equilibrio
    ].some(v => normalizar(v) === "atencao")
  ) {
    atencoes.push("avaliação funcional possui ponto de atenção");
  }

  if (texto(avaliacao.limitacao_movimento)) {
    atencoes.push("há limitação de movimento registrada");
  }

  return {
    schemaVersion: 1,
    fonte: "avaliacao_fisica_concluida",

    alunoId: texto(
      aluno.id ||
      aluno.alunoId ||
      aluno.aluno_id
    ),

    idade,

    avaliacao: {
      id: texto(avaliacao.id),
      data: texto(avaliacao.data),
      professorId: texto(
        avaliacao.professorId ||
        avaliacao.professor_id
      ),
      professorNome: texto(avaliacao.professorNome),
      status: texto(avaliacao.status_avaliacao)
    },

    prontoParaGerar: motivosBloqueio.length === 0,
    motivosBloqueio,
    atencoes,

    prescricao: {
      objetivoPrincipal: objetivo,
      objetivoSecundario: texto(avaliacao.objetivo_secundario),
      experiencia,
      frequenciaSemanal: frequencia,
      duracaoSessaoMin: duracao,
      praticaAtual: texto(avaliacao.pratica_atividade),
      observacoesTreino: texto(avaliacao.observacoes_treino)
    },

    seguranca: {
      parqCompleto,
      parqPositivo,
      usaMedicamentos: texto(avaliacao.usa_medicamentos),
      medicamentos: texto(avaliacao.medicamentos),
      cirurgiaRelevante: texto(avaliacao.cirurgia_relevante),
      cirurgias: texto(avaliacao.cirurgias),
      restricoesMedicas,
      lesoes,
      dorAtual,
      dorRegiao: texto(avaliacao.dor_regiao),
      dorIntensidade: texto(avaliacao.dor_intensidade),
      limitacaoMovimento: texto(avaliacao.limitacao_movimento),
      dorMovimento
    },

    funcional: {
      agachamento: texto(avaliacao.agachamento_funcional),
      mobilidadeOmbro: texto(avaliacao.mobilidade_ombro),
      mobilidadeQuadril: texto(avaliacao.mobilidade_quadril),
      equilibrio: texto(avaliacao.equilibrio),
      dorMovimento,
      observacao: texto(avaliacao.observacao_funcional)
    },

    capacidadeFisica: {
      condicaoFisica: texto(avaliacao.condicao_fisica),
      protocoloCardio: texto(avaliacao.protocolo_cardio),
      vo2Obtido: numeroAssistente(avaliacao.vo2_obtido),
      flexaoBracos: numeroAssistente(avaliacao.flexao_bracos),
      abdominalRepeticoes: numeroAssistente(avaliacao.abdominal_repeticoes),
      bancoWells: numeroAssistente(avaliacao.banco_wells)
    },

    composicao: {
      peso: numeroAssistente(avaliacao.peso),
      altura: numeroAssistente(avaliacao.altura),
      imc: numeroAssistente(avaliacao.imc),
      percentualGordura: numeroAssistente(avaliacao.percentual_gordura),
      massaMagra: numeroAssistente(avaliacao.massa_magra),
      massaGorda: numeroAssistente(avaliacao.massa_gorda),
      cintura: numeroAssistente(avaliacao.cintura),
      quadril: numeroAssistente(avaliacao.quadril),
      rcq: numeroAssistente(avaliacao.rcq)
    }
  };
}

function usuarioPortalProfessor(req) {
  return req.usuario?.portal === true && req.usuario?.portalTipo === "professor";
}

function responsavelTecnico(req) {
  const usuario = req.usuario || {};
  const perfil = normalizar(usuario.perfil);
  const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
  return usuario.acessoTodosAlunos === true ||
    perfil === "responsavel_tecnico" ||
    perfil === "responsavel-tecnico" ||
    perfil === "responsavel tecnico" ||
    permissoes.includes("professores") ||
    permissoes.includes("*");
}

function alunoPertenceAoProfessor(aluno = {}, usuario = {}) {
  const professorId = texto(usuario.id);
  const professorNome = normalizar(usuario.nome);
  const ids = [
    aluno.professorId,
    aluno.professor_id,
    aluno.idProfessor,
    aluno.professorResponsavelId,
    aluno.professor_responsavel_id,
    aluno.professor_responsavel
  ];
  if (ids.some(id => mesmo(id, professorId))) return true;

  const nomes = [
    aluno.professorNome,
    aluno.professor_nome,
    aluno.professor,
    aluno.professorResponsavel,
    aluno.professor_responsavel_nome,
    aluno.nomeProfessor
  ].map(normalizar).filter(Boolean);
  return Boolean(professorNome && nomes.some(nome => nome === professorNome || nome.includes(professorNome) || professorNome.includes(nome)));
}

async function resolverAlunoAssistente(chave = "") {
  const alvo = texto(chave);
  if (!alvo) return null;

  const direto = await alunosService.buscar(alvo);
  if (direto) return direto;

  const lista = await alunosService.listar();
  return (Array.isArray(lista) ? lista : []).find(aluno =>
    [
      aluno?.id,
      aluno?._id,
      aluno?.codigo,
      aluno?.alunoId,
      aluno?.aluno_id,
      aluno?.matriculaId,
      aluno?.numeroMatricula,
      aluno?.matricula,
      aluno?.cpf
    ].some(valor => texto(valor) === alvo)
  ) || null;
}

async function alunoPermitidoParaProfessor(req, alunoId = "") {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return true;
  if (!alunoId) return false;
  const aluno = await alunosService.buscar(alunoId);
  return alunoPertenceAoProfessor(aluno, req.usuario);
}

function filtrosTreino(req) {
  const filtros = { ...req.query };
  if (usuarioPortalProfessor(req) && !responsavelTecnico(req)) {
    filtros.professorId = req.usuario.id;
    filtros.professorNome = req.usuario.nome;
  }
  return filtros;
}

function payloadProfessor(req, payload = {}) {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return payload;
  return {
    ...payload,
    professorId: texto(req.usuario.id),
    professor_id: texto(req.usuario.id),
    professorNome: texto(req.usuario.nome) || payload.professorNome || payload.professor_nome || ""
  };
}

async function treinoPermitidoParaProfessor(req, treinoId = "") {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return true;
  const treinos = await obterTreinos({ professorId: req.usuario.id, professorNome: req.usuario.nome });
  return treinos.some(treino => mesmo(treino.id, treinoId));
}

const tentativasAlunoApp = new Map();
function limitarAlunoApp(req, res, next) {
  const janelaMs = 10 * 60 * 1000;
  const limite = 12;
  const agora = Date.now();
  const chave = String(req.ip || req.socket?.remoteAddress || "desconhecido");
  const atual = tentativasAlunoApp.get(chave);
  if (!atual || atual.resetAt <= agora) {
    tentativasAlunoApp.set(chave, { count: 1, resetAt: agora + janelaMs });
    return next();
  }
  atual.count += 1;
  if (atual.count > limite) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((atual.resetAt - agora) / 1000))));
    return res.status(429).json({ ok: false, code: "RATE_LIMIT", mensagem: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
  }
  return next();
}

function origemDoProprioSistema(req) {
  const origin = String(req.headers.origin || "").trim();
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.host === req.get("host");
  } catch {
    return false;
  }
}

function somenteMesmoSistema(req, res, next) {
  if (!origemDoProprioSistema(req)) {
    return res.status(403).json({ ok: false, code: "ORIGIN_NOT_ALLOWED", mensagem: "Origem não permitida." });
  }
  return next();
}

function responderErroAlunoApp(res, erro, fallback = "Erro no aplicativo do aluno.") {
  const status = Number(erro?.statusCode || erro?.status || 500);
  const code = String(erro?.code || "");
  return res.status(status).json({ ok: false, code, mensagem: erro?.message || fallback });
}

router.get("/biblioteca", async (req, res) => {
  try {
    const catalogo = String(req.query.catalogo || "").trim().toLowerCase();
    const dados = catalogo === "teste-664"
      ? await obterBibliotecaTeste(664)
      : await obterBiblioteca();
    res.json({ ok: true, dados });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: "Erro ao carregar biblioteca de exercicios", erro: erro.message });
  }
});


/* equipamentos-academia-v1 */
router.get("/equipamentos-academia", async (req, res) => {
  if (!usuarioPortalProfessor(req) && !responsavelTecnico(req)) {
    return res.status(403).json({
      ok: false,
      mensagem: "Acesso restrito ao portal do professor."
    });
  }

  try {
    const dados = await obterConfiguracaoEquipamentosAcademia();
    return res.json({ ok: true, dados });
  } catch (erro) {
    return res.status(500).json({
      ok: false,
      mensagem: erro?.message || "Erro ao carregar equipamentos da academia."
    });
  }
});

router.put(
  "/equipamentos-academia",
  somenteMesmoSistema,
  async (req, res) => {
    if (!responsavelTecnico(req)) {
      return res.status(403).json({
        ok: false,
        mensagem: "Somente o responsável técnico pode alterar os equipamentos."
      });
    }

    try {
      const dados = await atualizarConfiguracaoEquipamentosAcademia(
        req.body?.selecionados,
        req.usuario || {}
      );

      return res.json({
        ok: true,
        mensagem: "Equipamentos da academia atualizados.",
        dados
      });
    } catch (erro) {
      return res.status(500).json({
        ok: false,
        mensagem: erro?.message || "Erro ao salvar equipamentos da academia."
      });
    }
  }
);


router.get("/assistente-contexto/:alunoId", async (req, res) => {
  if (!usuarioPortalProfessor(req)) {
    return res.status(403).json({
      ok: false,
      mensagem: "Acesso restrito ao portal do professor."
    });
  }

  try {
    const alunoId = texto(req.params.alunoId);

    if (!alunoId) {
      return res.status(400).json({
        ok: false,
        mensagem: "Aluno não informado."
      });
    }

    if (!await alunoPermitidoParaProfessor(req, alunoId)) {
      return res.status(403).json({
        ok: false,
        mensagem: "Professor sem acesso a este aluno."
      });
    }

    const aluno = await resolverAlunoAssistente(alunoId);

    if (!aluno) {
      return res.status(404).json({
        ok: false,
        mensagem: "Aluno não encontrado."
      });
    }

    const alunoIdCanonico = texto(
      aluno.id ||
      aluno.alunoId ||
      aluno.aluno_id ||
      alunoId
    );

    const avaliacoes = await avaliacoesService.listar(alunoIdCanonico);

    const concluidas = (Array.isArray(avaliacoes) ? avaliacoes : [])
      .filter(av => normalizar(av.status_avaliacao) === "concluida")
      .sort((a, b) =>
        dataOrdenacaoAvaliacao(b).localeCompare(dataOrdenacaoAvaliacao(a))
      );

    const ultimaConcluida = concluidas[0] || null;

    const contexto = contextoDaAvaliacaoParaAssistente(
      ultimaConcluida,
      aluno
    );

    const equipamentos = await obterConfiguracaoEquipamentosAcademia();

    return res.json({
      ok: true,
      dados: {
        ...contexto,
        equipamentos: {
          configurados: Array.isArray(equipamentos?.selecionados),
          quantidade: Array.isArray(equipamentos?.selecionados)
            ? equipamentos.selecionados.length
            : 0
        }
      }
    });
  } catch (erro) {
    return res.status(500).json({
      ok: false,
      mensagem:
        erro?.message ||
        "Erro ao carregar contexto da avaliação física."
    });
  }
});

router.post("/aluno-login", async (req, res) => {
  try {
    res.json({ ok: true, dados: await autenticarAlunoTreino(req.body || {}) });
  } catch (erro) {
    res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao autenticar aluno" });
  }
});

router.post("/aluno-app/ativar", somenteMesmoSistema, limitarAlunoApp, async (req, res) => {
  try {
    res.json({ ok: true, dados: await ativarAlunoApp(req.body || {}) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Erro ao ativar o aplicativo.");
  }
});

router.post("/aluno-app/ativar-link", somenteMesmoSistema, limitarAlunoApp, async (req, res) => {
  try {
    res.json({ ok: true, dados: await ativarAlunoAppPorLink(req.body || {}) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível usar este link de ativação.");
  }
});

router.post("/aluno-app/status", somenteMesmoSistema, async (req, res) => {
  try {
    res.json({ ok: true, dados: await statusAlunoApp(req.body?.device_token || req.body?.deviceToken) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Dispositivo não ativado.");
  }
});

router.post("/aluno-app/login", somenteMesmoSistema, limitarAlunoApp, async (req, res) => {
  try {
    const dados = await loginAlunoApp(req.body || {});
    gravarSessaoAluno(res, dados);
    res.json({ ok: true });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "CPF ou senha inválidos.");
  }
});

router.post("/aluno-app/primeiro-acesso", somenteMesmoSistema, limitarAlunoApp, async (req, res) => {
  try {
    const dados = await primeiroAcessoAlunoApp(req.body || {});
    gravarSessaoAluno(res, dados);
    res.json({ ok: true });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível criar sua senha.");
  }
});

router.post("/aluno-app/primeiro-acesso-link", somenteMesmoSistema, limitarAlunoApp, async (req, res) => {
  try {
    const dados = await primeiroAcessoAlunoAppPorLink(req.body || {});
    gravarSessaoAluno(res, dados);
    res.json({ ok: true });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível criar sua senha.");
  }
});

router.get("/aluno-app/me", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.json({ ok: true, dados: await obterHomeAlunoApp(req, res, deviceToken) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível carregar seus dados.");
  }
});

router.put("/aluno-app/foto", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.json({ ok: true, dados: await atualizarFotoAlunoApp(req, res, deviceToken, req.body || {}) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível atualizar sua foto.");
  }
});

router.post("/aluno-app/catraca", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.json({ ok: true, dados: await liberarCatracaAlunoApp(req, res, deviceToken, req.body || {}) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível liberar a catraca.");
  }
});

router.get("/aluno-app/catraca-contador", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.json({ ok: true, dados: await contadorCatracaAlunoApp(req, res, deviceToken) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível consultar seus acessos.");
  }
});

router.get("/aluno-app/frequencia", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.json({ ok: true, dados: await frequenciaAlunoApp(req, res, deviceToken) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível carregar sua frequência.");
  }
});

router.post("/aluno-app/pagamentos", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.status(201).json({ ok: true, dados: await iniciarPagamentoAlunoApp(req, res, deviceToken, req.body || {}) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível criar o pagamento.");
  }
});

router.get("/aluno-app/pagamentos/:id", somenteMesmoSistema, async (req, res) => {
  try {
    const deviceToken = req.headers["x-fusion-device-token"];
    res.json({ ok: true, dados: await consultarPagamentoAlunoApp(req, res, deviceToken, req.params.id) });
  } catch (erro) {
    responderErroAlunoApp(res, erro, "Não foi possível consultar o pagamento.");
  }
});

router.post("/aluno-app/logout", somenteMesmoSistema, async (_req, res) => {
  limparSessaoAluno(res);
  res.json({ ok: true });
});

router.get("/aluno-sessao", async (req, res) => {
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "") || req.query.token;
    res.json({ ok: true, dados: await validarSessaoAlunoTreino({ alunoId: req.query.alunoId, token }) });
  } catch (erro) {
    res.status(erro.statusCode || 401).json({ ok: false, mensagem: erro.message || "Sessao do aluno invalida" });
  }
});

router.post("/aluno-liberar-catraca", async (req, res) => {
  try {
    res.json({ ok: true, dados: await liberarCatracaPortalAluno(req.body || {}) });
  } catch (erro) {
    res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao liberar catraca" });
  }
});

router.get("/aluno-catraca-contador", async (req, res) => {
  try {
    res.json({ ok: true, dados: await obterContadorCatracaPortalAluno(req.query || {}) });
  } catch (erro) {
    res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao consultar acessos da catraca" });
  }
});


/* assistente-aprendizado-v1 */

router.get(
  "/assistente-provider/status",
  async (req, res) => {
    if (!usuarioPortalProfessor(req)) {
      return res.status(403).json({
        ok: false,
        mensagem:
          "Acesso restrito ao portal do professor."
      });
    }

    return res.json({
      ok: true,
      dados:
        obterStatusProvedoresAssistente()
    });
  }
);

router.get(
  "/assistente-aprendizado/resumo",
  async (req, res) => {
    if (!usuarioPortalProfessor(req)) {
      return res.status(403).json({
        ok: false,
        mensagem:
          "Acesso restrito ao portal do professor."
      });
    }

    try {
      const alunoId =
        texto(req.query?.alunoId);

      if (
        alunoId &&
        !await alunoPermitidoParaProfessor(
          req,
          alunoId
        )
      ) {
        return res.status(403).json({
          ok: false,
          mensagem:
            "Professor sem acesso a este aluno."
        });
      }

      return res.json({
        ok: true,
        dados:
          await obterResumoAprendizado(
            alunoId
          )
      });
    } catch (erro) {
      return res.status(
        erro?.statusCode || 500
      ).json({
        ok: false,
        mensagem:
          erro?.message ||
          "Erro ao consultar banco de aprendizagem."
      });
    }
  }
);

/* assistente-preferencias-aprendidas-v1 */

router.post(
  "/assistente-aprendizado/preferencias",
  somenteMesmoSistema,
  async (req, res) => {
    if (!usuarioPortalProfessor(req)) {
      return res.status(403).json({
        ok: false,
        mensagem:
          "Acesso restrito ao portal do professor."
      });
    }

    try {
      const alunoId =
        texto(
          req.body?.alunoId ||
          req.body?.aluno_id
        );

      if (
        !alunoId ||
        !await alunoPermitidoParaProfessor(
          req,
          alunoId
        )
      ) {
        return res.status(403).json({
          ok: false,
          mensagem:
            "Professor sem acesso a este aluno."
        });
      }

      const dados =
        await obterPreferenciasAprendizado(
          req.body || {}
        );

      return res.json({
        ok: true,
        dados
      });
    } catch (erro) {
      return res.status(
        erro?.statusCode ||
        500
      ).json({
        ok: false,
        code:
          erro?.code ||
          "",
        mensagem:
          erro?.message ||
          "Erro ao calcular preferências do aprendizado."
      });
    }
  }
);

router.post(
  "/assistente-aprendizado/geracao",
  somenteMesmoSistema,
  async (req, res) => {
    if (!usuarioPortalProfessor(req)) {
      return res.status(403).json({
        ok: false,
        mensagem:
          "Acesso restrito ao portal do professor."
      });
    }

    try {
      const alunoId =
        texto(
          req.body?.alunoId ||
          req.body?.aluno_id
        );

      if (
        !await alunoPermitidoParaProfessor(
          req,
          alunoId
        )
      ) {
        return res.status(403).json({
          ok: false,
          mensagem:
            "Professor sem acesso a este aluno."
        });
      }

      const dados =
        await registrarGeracaoAprendizado(
          req.body || {},
          req.usuario || {}
        );

      return res.status(201).json({
        ok: true,
        dados
      });
    } catch (erro) {
      return res.status(
        erro?.statusCode || 400
      ).json({
        ok: false,
        code: erro?.code || "",
        mensagem:
          erro?.message ||
          "Erro ao registrar geração do assistente."
      });
    }
  }
);

router.post(
  "/assistente-aprendizado/revisao",
  somenteMesmoSistema,
  async (req, res) => {
    if (!usuarioPortalProfessor(req)) {
      return res.status(403).json({
        ok: false,
        mensagem:
          "Acesso restrito ao portal do professor."
      });
    }

    try {
      const alunoId =
        texto(
          req.body?.alunoId ||
          req.body?.aluno_id
        );

      if (
        !await alunoPermitidoParaProfessor(
          req,
          alunoId
        )
      ) {
        return res.status(403).json({
          ok: false,
          mensagem:
            "Professor sem acesso a este aluno."
        });
      }

      const dados =
        await registrarRevisaoAprendizado(
          req.body || {},
          req.usuario || {}
        );

      return res.status(201).json({
        ok: true,
        dados
      });
    } catch (erro) {
      return res.status(
        erro?.statusCode || 400
      ).json({
        ok: false,
        code: erro?.code || "",
        mensagem:
          erro?.message ||
          "Erro ao registrar revisão."
      });
    }
  }
);

router.post(
  "/assistente-aprendizado/aprovacao",
  somenteMesmoSistema,
  async (req, res) => {
    if (!usuarioPortalProfessor(req)) {
      return res.status(403).json({
        ok: false,
        mensagem:
          "Acesso restrito ao portal do professor."
      });
    }

    try {
      const alunoId =
        texto(
          req.body?.alunoId ||
          req.body?.aluno_id
        );

      if (
        !await alunoPermitidoParaProfessor(
          req,
          alunoId
        )
      ) {
        return res.status(403).json({
          ok: false,
          mensagem:
            "Professor sem acesso a este aluno."
        });
      }

      const dados =
        await registrarAprovacaoAprendizado(
          req.body || {},
          req.usuario || {}
        );

      return res.status(201).json({
        ok: true,
        dados
      });
    } catch (erro) {
      return res.status(
        erro?.statusCode || 400
      ).json({
        ok: false,
        code: erro?.code || "",
        mensagem:
          erro?.message ||
          "Erro ao registrar aprovação."
      });
    }
  }
);

router.get("/", async (req, res) => {
  try {
    res.json({ ok: true, dados: await obterTreinos(filtrosTreino(req)) });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: "Erro ao carregar treinos", erro: erro.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = payloadProfessor(req, req.body || {});
    if (!await alunoPermitidoParaProfessor(req, payload.alunoId || payload.aluno_id)) {
      return res.status(403).json({ ok: false, mensagem: "Professor sem acesso a este aluno." });
    }
    res.status(201).json({ ok: true, dados: await criarTreino(payload) });
  } catch (erro) {
    res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao salvar treino" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!await treinoPermitidoParaProfessor(req, req.params.id)) {
      return res.status(403).json({ ok: false, mensagem: "Professor sem acesso a este treino." });
    }

    const payload = payloadProfessor(req, req.body || {});
    if (!await alunoPermitidoParaProfessor(req, payload.alunoId || payload.aluno_id)) {
      return res.status(403).json({ ok: false, mensagem: "Professor sem acesso a este aluno." });
    }

    const treino = await atualizarTreino(req.params.id, payload);
    if (!treino) return res.status(404).json({ ok: false, mensagem: "Treino nao encontrado" });
    res.json({ ok: true, dados: treino, mensagem: "Treino atualizado com sucesso" });
  } catch (erro) {
    res.status(erro.statusCode || 400).json({ ok: false, mensagem: erro.message || "Erro ao atualizar treino" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    res.json({ ok: true, dados: await removerTreino(req.params.id) });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: "Erro ao remover treino", erro: erro.message });
  }
});

export default router;
