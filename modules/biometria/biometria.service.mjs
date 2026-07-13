import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { listarBiometrias, salvarBiometrias, buscarPorAlunoId } from "./biometria.repository.mjs";
import { buscarAlunoPorId, atualizarAluno } from "../alunos/alunos.repository.mjs";
import { avaliarAcessoAluno } from "../access-engine/access-engine.service.mjs";

const LOCAL_URL = String(process.env.FUSION_BIOMETRIA_LOCAL_URL || "http://127.0.0.1:3041").replace(/\/$/, "");
const DISPOSITIVO_HENRY = String(process.env.FUSION_BIOMETRIA_DISPOSITIVO_ID || "disp_henry7x_01");
const INTERVALO_MS = Number(process.env.FUSION_BIOMETRIA_POLL_MS || 400);
const COOLDOWN_MS = Number(process.env.FUSION_BIOMETRIA_COOLDOWN_MS || 5000);
const SDK_STARTUP_TENTATIVAS = Number(process.env.FUSION_BIOMETRIA_STARTUP_TENTATIVAS || 30);
const SDK_STARTUP_INTERVALO_MS = Number(process.env.FUSION_BIOMETRIA_STARTUP_INTERVALO_MS || 1000);
const IDENTIFY_TIMEOUT_MS = Number(process.env.FUSION_BIOMETRIA_IDENTIFY_TIMEOUT_MS || 120000);
const SDK_EXECUTAVEL = process.env.FUSION_BIOMETRIA_SDK_EXE ||
  path.join(process.cwd(), "fusion-biometria-local", "sdk-futronic", "FusionBiometriaSdk.exe");

let ultimaQuantidadeTemplatesLogada = -1;
let sdkStartPromise = null;
let sdkProcesso = null;

const sdkControle = {
  fila: Promise.resolve(),
  operacao: "",
  iniciadoEm: null
};

function executarSdkExclusivo(nome, tarefa) {
  const executar = async () => {
    sdkControle.operacao = nome;
    sdkControle.iniciadoEm = new Date().toISOString();
    try {
      return await tarefa();
    } finally {
      sdkControle.operacao = "";
      sdkControle.iniciadoEm = null;
    }
  };

  const proxima = sdkControle.fila.then(executar, executar);
  sdkControle.fila = proxima.catch(() => undefined);
  return proxima;
}

function aguardarMotorParar(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    const verificar = () => {
      if (!motor.processando) return resolve();
      if (Date.now() - inicio >= timeoutMs) {
        return reject(erro(
          "O leitor está concluindo uma identificação em andamento. Aguarde alguns segundos e tente novamente.",
          409
        ));
      }
      setTimeout(verificar, 100);
    };
    verificar();
  });
}

const motor = {
  ativo: false,
  iniciando: false,
  processando: false,
  timer: null,
  sequencia: 0,
  ultimoResultado: null,
  ultimoErro: "",
  iniciadoEm: null,
  ultimaLeituraEm: null,
  ultimaLiberacaoEm: null,
  cooldown: new Map()
};

function erro(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function local(caminho, body, timeoutMs = 30000) {
  let resposta;
  try {
    resposta = await fetch(`${LOCAL_URL}${caminho}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (e) {
    throw erro(`SDK biométrico local indisponível em ${LOCAL_URL}: ${e.message}`, 503);
  }
  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok || json.ok === false) throw erro(json.mensagem || `Serviço SDK respondeu HTTP ${resposta.status}`, 503);
  return json;
}

async function sdkDisponivel(timeoutMs = 1200) {
  try {
    await local("/status", undefined, timeoutMs);
    return true;
  } catch {
    return false;
  }
}

function podeIniciarSdkLocal() {
  return process.platform === "win32" &&
    !process.env.RENDER &&
    String(process.env.FUSION_BIOMETRIA_AUTO_START || "true") !== "false";
}

export async function garantirSdkLocal({
  tentativas = SDK_STARTUP_TENTATIVAS,
  intervaloMs = SDK_STARTUP_INTERVALO_MS,
  silencioso = false
} = {}) {
  if (await sdkDisponivel()) return true;
  if (sdkStartPromise) return sdkStartPromise;

  sdkStartPromise = (async () => {
    if (!podeIniciarSdkLocal()) return false;

    if (!fs.existsSync(SDK_EXECUTAVEL)) {
      if (!silencioso) console.error(`[Biometria] FusionBiometriaSdk.exe nao encontrado em ${SDK_EXECUTAVEL}`);
      return false;
    }

    try {
      sdkProcesso = spawn(SDK_EXECUTAVEL, [], {
        cwd: path.dirname(SDK_EXECUTAVEL),
        windowsHide: true,
        stdio: "ignore"
      });
      sdkProcesso.on("error", (e) => {
        console.error(`[Biometria] Falha ao iniciar SDK local: ${e.message}`);
      });
    } catch (e) {
      if (!silencioso) console.error(`[Biometria] Falha ao iniciar SDK local: ${e.message}`);
      return false;
    }

    for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
      await esperar(intervaloMs);
      if (await sdkDisponivel()) return true;
    }

    return false;
  })().finally(() => {
    sdkStartPromise = null;
  });

  return sdkStartPromise;
}

export function encerrarSdkLocal() {
  if (sdkProcesso && !sdkProcesso.killed) {
    try { sdkProcesso.kill(); } catch {}
  }
}

function publico(registro) {
  if (!registro) return null;
  const { templateBase64, ...dados } = registro;
  return { ...dados, templateDisponivel: Boolean(templateBase64) };
}

async function templatesAtivos() {
  const registros = await listarBiometrias();
  return registros
    .filter((item) =>
      item &&
      item.status === "ativo" &&
      item.alunoId &&
      typeof item.templateBase64 === "string" &&
      item.templateBase64.trim().length > 100
    )
    .map((item) => ({
      alunoId: String(item.alunoId),
      templateBase64: item.templateBase64.trim()
    }));
}

function agendar() {
  clearTimeout(motor.timer);
  if (motor.ativo) motor.timer = setTimeout(executarCicloMotor, INTERVALO_MS);
}

async function processarIdentificacao(identificacao) {
  motor.ultimaLeituraEm = new Date().toISOString();

  if (!identificacao?.identificada || !identificacao?.alunoId) {
    motor.ultimoResultado = {
      ok: true,
      identificada: false,
      autorizado: false,
      motivo: identificacao?.status || identificacao?.mensagem || "Digital não reconhecida.",
      identificacao
    };
    console.log("[Biometria] Digital não reconhecida. Aguardando nova leitura.");
    return;
  }

  const alunoId = String(identificacao.alunoId);
  const agora = Date.now();
  const ultimo = Number(motor.cooldown.get(alunoId) || 0);

  if (agora - ultimo < COOLDOWN_MS) {
    console.log(`[Biometria] Leitura repetida ignorada para ${alunoId}.`);
    return;
  }

  motor.cooldown.set(alunoId, agora);

  const aluno = await buscarAlunoPorId(alunoId);
  if (!aluno) {
    motor.ultimoResultado = {
      ok: true,
      identificada: true,
      autorizado: false,
      motivo: "Aluno vinculado à biometria não foi encontrado.",
      identificacao
    };
    console.log(`[Biometria] Aluno ${alunoId} não encontrado.`);
    return;
  }

  console.log(`[Biometria] Digital reconhecida: ${aluno.nome || aluno.id}. Validando acesso...`);

  const acesso = await avaliarAcessoAluno({
    aluno,
    dispositivoId: DISPOSITIVO_HENRY,
    direcao: "entrada",
    origem: "biometria-futronic"
  });

  motor.ultimoResultado = {
    ok: true,
    identificada: true,
    autorizado: Boolean(acesso.autorizado),
    motivo: acesso.motivo,
    aluno: acesso.aluno || aluno,
    identificacao,
    acesso
  };

  if (acesso.autorizado) {
    motor.ultimaLiberacaoEm = new Date().toISOString();
    console.log(`[Biometria] ${aluno.nome || aluno.id}: Henry 7X liberada.`);
  } else {
    console.log(`[Biometria] ${aluno.nome || aluno.id}: acesso negado — ${acesso.motivo || "sem motivo"}.`);
  }
}

async function executarCicloMotor() {
  if (!motor.ativo || motor.processando) return agendar();

  motor.processando = true;

  try {
    const templates = await templatesAtivos();

    if (templates.length !== ultimaQuantidadeTemplatesLogada) {
      console.log(`[Biometria] ${templates.length} template(s) ativo(s) carregado(s) para identificação.`);
      ultimaQuantidadeTemplatesLogada = templates.length;
    }

    if (!templates.length) {
      throw erro("Nenhuma biometria ativa com template válido está cadastrada no Fusion ERP.", 409);
    }

    const sdkOk = await garantirSdkLocal({ tentativas: 3, intervaloMs: 1000, silencioso: true });
    if (!sdkOk) {
      throw erro(`SDK biometrico local ainda nao respondeu em ${LOCAL_URL}. O motor vai tentar novamente.`, 503);
    }

    console.log("[Biometria] Leitor armado. Coloque o dedo.");

    // Importante: /sdk/identify é atendido pela thread principal do SDK C#.
    // Não usar /monitor/start, pois o FTRAPI não é estável em uma thread secundária.


    console.log("[Biometria] Enviando identificação para SDK. Templates:", templates.length);
    const identificacao = await executarSdkExclusivo(
      "identificacao",
      async () => {
        console.log("[Biometria] SDK /sdk/identify iniciado.");

        const resultado = await local("/sdk/identify", { templates }, IDENTIFY_TIMEOUT_MS);

        console.log("[Biometria] SDK respondeu:", resultado);

        return resultado;
      }
    );

    motor.sequencia += 1;
    motor.ultimoErro = "";
    await processarIdentificacao(identificacao);
  } catch (e) {
    motor.ultimoErro = e.message;
    motor.ultimoResultado = {
      ok: false,
      identificado: false,
      autorizado: false,
      motivo: e.message
    };
    console.error(`[Biometria] Falha no ciclo: ${e.message}`);
    await new Promise((resolve) => setTimeout(resolve, 1200));
  } finally {
    motor.processando = false;
    if (motor.ativo) agendar();
  }
}

export async function iniciarMotorAcessoBiometrico() {
  if (motor.ativo || motor.iniciando) return statusMotor();

  motor.iniciando = true;

  try {
    const templates = await templatesAtivos();
    console.log(`[Biometria] Inicialização: ${templates.length} template(s) válido(s) encontrado(s).`);
    if (!templates.length) {
      throw erro("Nenhuma biometria ativa com template válido está cadastrada no Fusion ERP.", 409);
    }

    const sdkOk = await garantirSdkLocal({
      tentativas: SDK_STARTUP_TENTATIVAS,
      intervaloMs: SDK_STARTUP_INTERVALO_MS
    });
    if (!sdkOk) {
      motor.ativo = true;
      motor.iniciadoEm = motor.iniciadoEm || new Date().toISOString();
      motor.ultimoErro = `SDK biometrico local indisponivel em ${LOCAL_URL}. O motor vai continuar tentando.`;
      agendar();
      return statusMotor();
    }

    motor.ativo = true;
    motor.iniciadoEm = new Date().toISOString();
    motor.ultimoErro = "";
    agendar();

    return statusMotor();
  } finally {
    motor.iniciando = false;
  }
}

export async function pararMotorAcessoBiometrico() {
  motor.ativo = false;
  clearTimeout(motor.timer);
  return statusMotor();
}

export function statusMotor() {
  return {
    ok: true,
    ativo: motor.ativo,
    iniciando: motor.iniciando,
    processando: motor.processando,
    sequencia: motor.sequencia,
    iniciadoEm: motor.iniciadoEm,
    ultimaLeituraEm: motor.ultimaLeituraEm,
    ultimaLiberacaoEm: motor.ultimaLiberacaoEm,
    ultimoErro: motor.ultimoErro,
    ultimoResultado: motor.ultimoResultado,
    operacaoSdk: sdkControle.operacao,
    operacaoSdkIniciadaEm: sdkControle.iniciadoEm,
    sdkLocalUrl: LOCAL_URL
  };
}

export async function statusLocal() {
  if (motor.processando || sdkControle.operacao === "identificacao") {
    return {
      ok: true,
      conectado: true,
      ocupado: true,
      motorSdk: "FTRAPI-1N",
      sinal: "aguardando_digital",
      operacaoSdk: sdkControle.operacao || "identificacao",
      operacaoIniciadaEm: sdkControle.iniciadoEm,
      motor: statusMotor()
    };
  }

  const sdkOk = await garantirSdkLocal({ tentativas: 2, intervaloMs: 700, silencioso: true });
  if (!sdkOk) {
    return {
      ok: false,
      conectado: false,
      mensagem: `SDK biometrico local indisponivel em ${LOCAL_URL}.`,
      motor: statusMotor()
    };
  }

  const sdk = await executarSdkExclusivo(
    "status",
    () => local("/status", undefined, 5000)
  );

  return {
    ...sdk,
    ocupado: Boolean(sdkControle.operacao),
    operacaoSdk: sdkControle.operacao,
    motor: statusMotor()
  };
}

export async function cadastrarSdk({ alunoId, alunoNome = "" } = {}) {
  if (!alunoId) throw erro("alunoId é obrigatório.");
  const aluno = await buscarAlunoPorId(alunoId);
  if (!aluno) throw erro("Aluno não encontrado.", 404);

  const estavaAtivo = motor.ativo;
  let cadastroConcluido = false;
  if (estavaAtivo) await pararMotorAcessoBiometrico();

  try {
    await aguardarMotorParar(8000);
    const sdkOk = await garantirSdkLocal({
      tentativas: SDK_STARTUP_TENTATIVAS,
      intervaloMs: SDK_STARTUP_INTERVALO_MS
    });
    if (!sdkOk) throw erro(`SDK biometrico local indisponivel em ${LOCAL_URL}. Abra o leitor e tente novamente.`, 503);

    const sdk = await executarSdkExclusivo(
      "cadastro",
      () => local("/sdk/enroll", {}, 180000)
    );
    if (Number(sdk.qualidadePercentual || 0) < 70) throw erro(`Qualidade insuficiente: ${sdk.qualidadePercentual || 0}%. Repita o cadastro.`);

    const lista = await listarBiometrias();
    const indice = lista.findIndex((item) => String(item.alunoId) === String(alunoId));
    const agora = new Date().toISOString();
    const registro = {
      id: indice >= 0 ? lista[indice].id : `bio_${crypto.randomUUID()}`,
      alunoId: String(alunoId),
      alunoNome: alunoNome || aluno.nome || "",
      status: "ativo",
      motor: "FTRAPI-1N",
      templateVersion: 2,
      templateBase64: sdk.templateBase64,
      templateBytes: sdk.templateBytes,
      qualidade: sdk.qualidadePercentual,
      criadoEm: indice >= 0 ? lista[indice].criadoEm : agora,
      atualizadoEm: agora
    };
    if (indice >= 0) lista[indice] = registro; else lista.push(registro);
    await salvarBiometrias(lista);
    await atualizarAluno(alunoId, {
      possuiBiometria: true,
      biometriaId: registro.id,
      biometriaStatus: "ativo",
      biometriaMotor: "FTRAPI-1N",
      biometriaAtualizadaEm: agora
    });
    cadastroConcluido = true;
    return publico(registro);
  } finally {
    if (cadastroConcluido || estavaAtivo) await iniciarMotorAcessoBiometrico().catch(() => undefined);
  }
}

export async function identificarSdk() {
  const lista = await templatesAtivos();
  if (!lista.length) throw erro("Nenhuma biometria ativa está cadastrada no Fusion ERP.", 409);
  const sdkOk = await garantirSdkLocal({
    tentativas: SDK_STARTUP_TENTATIVAS,
    intervaloMs: SDK_STARTUP_INTERVALO_MS
  });
  if (!sdkOk) throw erro(`SDK biometrico local indisponivel em ${LOCAL_URL}.`, 503);

  const resultado = await executarSdkExclusivo(
    "identificacao-manual",
    () => local("/sdk/identify", { templates: lista }, IDENTIFY_TIMEOUT_MS)
  );
  if (!resultado.identificada || !resultado.alunoId) return { ...resultado, aluno: null };
  return { ...resultado, aluno: await buscarAlunoPorId(resultado.alunoId) || null };
}

export async function processarAcessoBiometrico() {
  return motor.ultimoResultado || { ok: true, identificada: false, autorizado: false, motivo: "Motor ativo; aguardando digital." };
}

export async function obterBiometriaAluno(id) { return publico(await buscarPorAlunoId(id)); }

export async function excluirBiometriaAluno(id) {
  const estavaAtivo = motor.ativo;
  if (estavaAtivo) await pararMotorAcessoBiometrico();
  try {
    const lista = await listarBiometrias();
    const restante = lista.filter((item) => String(item.alunoId) !== String(id));
    const removido = restante.length !== lista.length;
    if (removido) {
      await salvarBiometrias(restante);
      await atualizarAluno(id, { possuiBiometria: false, biometriaId: "", biometriaStatus: "sem_cadastro" });
    }
    return { removido };
  } finally {
    if (estavaAtivo) await iniciarMotorAcessoBiometrico().catch(() => undefined);
  }
}
export async function listarTemplatesMonitor() {
  const templates = await listarBiometrias();

  return templates
    .filter((item) =>
      item &&
      item.status === "ativo" &&
      item.alunoId &&
      typeof item.templateBase64 === "string" &&
      item.templateBase64.trim().length > 100
    )
    .map((item) => ({
      id: item.id,
      alunoId: item.alunoId,
      alunoNome: item.alunoNome,
      templateVersion: item.templateVersion,
      qualidade: item.qualidade,
      tamanho: item.templateBytes,
      criadoEm: item.criadoEm
    }));
}
