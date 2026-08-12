import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import jwt from "jsonwebtoken";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function salvarEnv(nomes = []) {
  return Object.fromEntries(nomes.map((nome) => [nome, process.env[nome]]));
}

function restaurarEnv(snapshot = {}) {
  for (const [nome, valor] of Object.entries(snapshot)) {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
}

function respostaJson(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(body); }
  };
}

async function testarContratosDeCodigo() {
  const servicePath = path.join(root, "modules", "treinos", "aluno-app.service.mjs");
  const frontendPath = path.join(root, "public", "pages", "aluno-login", "index.js");
  const [serviceSource, frontendSource] = await Promise.all([
    fs.readFile(servicePath, "utf8"),
    fs.readFile(frontendPath, "utf8")
  ]);

  const contratoDataBackend = String.raw`const calendario = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);`;
  assert.ok(
    serviceSource.includes(contratoDataBackend),
    "Backend precisa reconhecer datas civis no formato YYYY-MM-DD."
  );
  assert.ok(
    serviceSource.includes("T12:00:00.000Z"),
    "Datas civis YYYY-MM-DD precisam continuar protegidas contra deslocamento de fuso."
  );
  assert.match(
    serviceSource,
    /&&\s*!statusPago\(item\.status\)/,
    "Mensalidades pagas não podem voltar a ser escolhidas como próximo vencimento."
  );

  const limiteIndex = serviceSource.indexOf("fusion_app_verificar_limite_ativacao_backend");
  const ativacaoIndex = serviceSource.indexOf("/rest/v1/rpc/fusion_ativar_app");
  assert.ok(limiteIndex >= 0, "RPC persistente de rate limit precisa existir.");
  assert.ok(ativacaoIndex >= 0, "RPC de ativação precisa existir.");
  assert.ok(
    limiteIndex < ativacaoIndex,
    "O rate limit persistente precisa rodar antes do RPC de ativação."
  );

  const contratoDataFrontend = String.raw`const dataSomente = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);`;
  assert.ok(
    frontendSource.includes(contratoDataFrontend),
    "Frontend precisa reconhecer datas civis no formato YYYY-MM-DD."
  );
  assert.ok(
    frontendSource.includes('if (dataSomente) return `${dataSomente[3]}/${dataSomente[2]}/${dataSomente[1]}`;'),
    "O frontend precisa formatar YYYY-MM-DD diretamente, sem depender de timezone."
  );
}

async function testarRateLimitAtivacao() {
  const envNomes = [
    "FUSION_APP_SUPABASE_URL",
    "FUSION_APP_SUPABASE_SECRET_KEY",
    "FUSION_APP_SUPABASE_SERVICE_ROLE_KEY"
  ];
  const envAnterior = salvarEnv(envNomes);
  const fetchAnterior = globalThis.fetch;

  process.env.FUSION_APP_SUPABASE_URL = "https://supabase.qa.local";
  process.env.FUSION_APP_SUPABASE_SECRET_KEY = "sb_secret_regressao_p0";
  delete process.env.FUSION_APP_SUPABASE_SERVICE_ROLE_KEY;

  const serviceUrl = pathToFileURL(
    path.join(root, "modules", "treinos", "aluno-app.service.mjs")
  );
  serviceUrl.searchParams.set("regressao_p0", String(Date.now()));
  const { ativarAlunoApp } = await import(serviceUrl.href);

  try {
    let chamadas = [];
    globalThis.fetch = async (url, options = {}) => {
      chamadas.push({ url: String(url), options });
      return respostaJson(200, { permitido: false, retry_after: 321 });
    };

    await assert.rejects(
      () => ativarAlunoApp({
        codigo: "DEADBEEF",
        instalacao_id: "qa-rate-limit-bloqueado",
        nome_dispositivo: "Teste P0"
      }),
      (erro) => {
        assert.equal(erro?.statusCode, 429);
        assert.equal(erro?.code, "RATE_LIMIT");
        assert.equal(erro?.retryAfter, 321);
        return true;
      }
    );
    assert.equal(chamadas.length, 1, "Bloqueio 429 não pode chegar ao RPC de ativação.");
    assert.match(chamadas[0].url, /fusion_app_verificar_limite_ativacao_backend$/);

    chamadas = [];
    const respostas = [
      respostaJson(200, { permitido: true, retry_after: 0 }),
      respostaJson(200, {
        device_token: "a".repeat(64),
        academia_nome: "Academia QA"
      })
    ];
    globalThis.fetch = async (url, options = {}) => {
      chamadas.push({ url: String(url), options });
      const resposta = respostas.shift();
      assert.ok(resposta, "O fluxo de ativação fez chamada upstream inesperada.");
      return resposta;
    };

    const ativada = await ativarAlunoApp({
      codigo: "A1B2C3D4",
      instalacao_id: "qa-rate-limit-liberado",
      nome_dispositivo: "Teste P0"
    });
    assert.equal(ativada.device_token, "a".repeat(64));
    assert.equal(ativada.academia_nome, "Academia QA");
    assert.equal(chamadas.length, 2);
    assert.match(chamadas[0].url, /fusion_app_verificar_limite_ativacao_backend$/);
    assert.match(chamadas[1].url, /\/rest\/v1\/rpc\/fusion_ativar_app$/);

    chamadas = [];
    globalThis.fetch = async (url, options = {}) => {
      chamadas.push({ url: String(url), options });
      return respostaJson(500, {});
    };
    await assert.rejects(
      () => ativarAlunoApp({ codigo: "A1B2C3D4", instalacao_id: "curto" }),
      (erro) => {
        assert.equal(erro?.statusCode, 400);
        assert.equal(erro?.code, "INVALID_INSTALLATION_ID");
        return true;
      }
    );
    assert.equal(chamadas.length, 0, "Instalação inválida deve falhar antes de chamar Supabase.");
  } finally {
    globalThis.fetch = fetchAnterior;
    restaurarEnv(envAnterior);
  }
}

function tokenPortalProfessor({ professorId = "prof-a", tenantId = "academia-a" } = {}) {
  return jwt.sign(
    {
      sub: professorId,
      tipo: "professor",
      perfil: "Professor",
      permissoes: [],
      nome: "Professor QA",
      tenantId
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function req({ method = "GET", reqPath = "/api/health", headers = {}, query = {}, body = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    method,
    path: reqPath,
    headers: normalizedHeaders,
    query,
    body,
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" }
  };
}

async function testarProfessorMultiempresa() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fusion-professor-tenant-regressao-"));
  const cwdAnterior = process.cwd();
  const envNomes = [
    "NODE_ENV",
    "JWT_SECRET",
    "FUSION_DATABASE_PROVIDER",
    "FUSION_JSON_FALLBACK",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY"
  ];
  const envAnterior = salvarEnv(envNomes);

  try {
    process.chdir(tempDir);
    await fs.mkdir(path.join(tempDir, "data"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "data", "usuarios.json"),
      JSON.stringify([
        { id: "usr_dummy", email: "dummy@example.local", perfil: "Administrador", status: "ativo" }
      ]),
      "utf8"
    );

    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "professor-tenant-regression-secret-32chars";
    process.env.FUSION_DATABASE_PROVIDER = "json";
    process.env.FUSION_JSON_FALLBACK = "true";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;

    const middlewareUrl = pathToFileURL(
      path.join(root, "modules", "security", "api-security.middleware.mjs")
    );
    middlewareUrl.searchParams.set("regressao_professor", String(Date.now()));
    const { apiSecurity } = await import(middlewareUrl.href);

    async function invoke(request) {
      const response = {
        statusCode: 200,
        headers: {},
        setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(bodyValue) { this.body = bodyValue; return this; },
        once() { return this; }
      };
      let nextCalled = false;
      await apiSecurity(request, response, () => { nextCalled = true; });
      return {
        nextCalled,
        status: response.statusCode,
        body: response.body,
        headers: response.headers,
        request
      };
    }

    const token = tokenPortalProfessor();

    let result = await invoke(req({
      reqPath: "/api/alunos/aluno-piloto",
      headers: {
        authorization: `Bearer ${token}`,
        "x-fusion-tenant": "academia-b"
      }
    }));
    assert.equal(result.nextCalled, false);
    assert.equal(result.status, 403);
    assert.match(result.body?.mensagem || "", /outra empresa/i);

    result = await invoke(req({
      reqPath: "/api/alunos/aluno-piloto",
      headers: { authorization: `Bearer ${token}` }
    }));
    assert.equal(result.nextCalled, true);
    assert.equal(result.headers["x-fusion-tenant"], "academia-a");

    result = await invoke(req({
      reqPath: "/api/alunos/aluno-piloto",
      headers: {
        authorization: `Bearer ${token}`,
        "x-fusion-tenant": "academia-a"
      }
    }));
    assert.equal(result.nextCalled, true);
    assert.equal(result.headers["x-fusion-tenant"], "academia-a");
  } finally {
    process.chdir(cwdAnterior);
    restaurarEnv(envAnterior);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

await testarContratosDeCodigo();
await testarRateLimitAtivacao();
await testarProfessorMultiempresa();

console.log("Regressões P0 Fusion OK: datas/financeiro, ativação/rate-limit e professor multiempresa.");
