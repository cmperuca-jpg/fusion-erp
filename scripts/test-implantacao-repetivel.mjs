import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), "fusion-implantacao-repetivel-v2-"));
const dataDir = path.join(temporario, "data");
const uploadsDir = path.join(temporario, "uploads");

const tenantPadrao = "academia-piloto";
const tenantA = "academia-nova-a";
const tenantB = "academia-nova-b";
const jwtSecret = "fusion-implantacao-repetivel-v2-secret-32chars";

async function escreverJson(relativo, valor) {
  const destino = path.join(temporario, relativo);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, JSON.stringify(valor, null, 2), "utf8");
}

async function lerJson(relativo) {
  return JSON.parse(await fs.readFile(path.join(temporario, relativo), "utf8"));
}

async function existe(relativo) {
  try {
    await fs.access(path.join(temporario, relativo));
    return true;
  } catch {
    return false;
  }
}

async function portaLivre() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const porta = server.address().port;
      server.close(() => resolve(porta));
    });
  });
}

async function prepararRaiz() {
  await escreverJson("data/usuarios.json", [{
    id: "usr_raiz",
    nome: "Administrador Academia Piloto",
    email: "raiz@example.local",
    perfil: "Administrador",
    status: "ativo",
    permissoes: ["*"]
  }]);

  await escreverJson("data/alunos.json", [{
    id: "aluno_raiz",
    nome: "Aluno Exclusivo Raiz",
    status: "ativo"
  }]);

  await escreverJson("data/planos.json", [{
    id: "plano_raiz",
    nome: "Plano Base Preservado",
    status: "Ativo",
    valorMensal: 129
  }]);

  await escreverJson("data/access_dispositivos.json", [{
    id: "catraca-piloto-01",
    nome: "Catraca Piloto Henry 7X",
    fabricante: "Henry",
    modelo: "7X",
    driver: "henry7x",
    ip: "10.0.0.236",
    porta: "3000",
    status: "ativo"
  }]);

  await fs.mkdir(path.join(dataDir, "importacao"), { recursive: true });
  await fs.writeFile(
    path.join(dataDir, "importacao", "preservar.txt"),
    "importacao-raiz",
    "utf8"
  );

  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(
    path.join(uploadsDir, "preservar.txt"),
    "upload-raiz",
    "utf8"
  );

  // Simula resíduos de uma preparação anterior para provar backup + limpeza.
  for (const tenant of [tenantA, tenantB]) {
    await escreverJson(`data/tenants/${tenant}/fusion_billing.json`, [{
      id: `billing-antigo-${tenant}`,
      status: "suspensa"
    }]);
    await escreverJson(`data/tenants/${tenant}/alunos.json`, [{
      id: `aluno-antigo-${tenant}`,
      nome: `Aluno antigo ${tenant}`
    }]);
  }
}

async function executarReset(tenant) {
  const processo = spawn(process.execPath, [
    path.join(raiz, "scripts", "resetar-sistema-virgem.mjs"),
    `--tenant=${tenant}`,
    "--confirmar=RESETAR-MODELO"
  ], {
    cwd: temporario,
    env: {
      ...process.env,
      NODE_ENV: "development",
      FUSION_TENANT_ID: tenantPadrao,
      FUSION_DATABASE_PROVIDER: "json",
      FUSION_JSON_FALLBACK: "true",
      FUSION_REQUIRE_SUPABASE_DATA: "false",
      FUSION_SYNC_DATA_ON_LOCAL: "false",
      FUSION_BACKUP_AUTO_ON_LOCAL: "false",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_SECRET_KEY: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let saida = "";
  processo.stdout.on("data", parte => { saida += parte; });
  processo.stderr.on("data", parte => { saida += parte; });

  const resultado = await new Promise(resolve => {
    processo.once("exit", (code, signal) => resolve({ code, signal }));
  });

  assert.equal(resultado.code, 0, `Reset de ${tenant} falhou:\n${saida}`);
  assert.match(saida, new RegExp(`"tenantId":\\s*"${tenant}"`), saida);
  return saida;
}

function token(tenantId, sub) {
  return jwt.sign(
    {
      sub,
      email: `${sub}@example.local`,
      perfil: "Administrador",
      permissoes: ["*"],
      tenantId
    },
    jwtSecret,
    { expiresIn: "1h" }
  );
}

function envServidor(porta) {
  return {
    ...process.env,
    PORT: String(porta),
    NODE_ENV: "development",
    JWT_SECRET: jwtSecret,
    FUSION_TENANT_ID: tenantPadrao,
    FUSION_DATABASE_PROVIDER: "json",
    FUSION_JSON_FALLBACK: "true",
    FUSION_SYNC_DATA_ON_LOCAL: "false",
    FUSION_REQUIRE_SUPABASE_DATA: "false",
    FUSION_BACKUP_AUTO_ON_LOCAL: "false",
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    SUPABASE_SECRET_KEY: "",
    // A catraca física pertence apenas ao tenant padrão.
    ACCESS_AGENT_ID: "academia-piloto-agent-01",
    ACCESS_AGENT_TENANT_ID: tenantPadrao,
    ACCESS_EQUIPMENT_ID: "catraca-piloto-01",
    ACCESS_EQUIPMENT_IDS: "catraca-piloto-01",
    ACCESS_AGENT_TOKEN: "token-local-implantacao-repetivel-v2"
  };
}

async function iniciarServidor() {
  const porta = await portaLivre();
  const processo = spawn(process.execPath, [path.join(raiz, "server.mjs")], {
    cwd: temporario,
    env: envServidor(porta),
    stdio: ["ignore", "pipe", "pipe"]
  });

  let saida = "";
  let encerrado = null;
  processo.stdout.on("data", parte => { saida += parte; });
  processo.stderr.on("data", parte => { saida += parte; });
  processo.once("exit", (code, signal) => { encerrado = { code, signal }; });

  for (let i = 0; i < 200; i += 1) {
    if (encerrado) {
      throw new Error(
        `Servidor encerrou durante implantação repetível: ${JSON.stringify(encerrado)}.\n${saida}`
      );
    }
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/health`);
      if (resposta.ok) {
        return { processo, porta, saida: () => saida };
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  processo.kill("SIGTERM");
  throw new Error(`Servidor não respondeu.\n${saida}`);
}

async function pararServidor(instancia) {
  if (!instancia?.processo) return;
  instancia.processo.kill("SIGTERM");
  await Promise.race([
    new Promise(resolve => instancia.processo.once("exit", resolve)),
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);
}

function headersJwt(jwtToken, extra = {}) {
  return {
    authorization: `Bearer ${jwtToken}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function chamar(instancia, caminho, {
  jwtToken,
  method = "GET",
  headers = {},
  body
} = {}) {
  const resposta = await fetch(`http://127.0.0.1:${instancia.porta}${caminho}`, {
    method,
    headers: jwtToken ? headersJwt(jwtToken, headers) : headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const texto = await resposta.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch {}
  return { resposta, json, texto };
}

async function idsAlunos(instancia, jwtToken) {
  const r = await chamar(instancia, "/api/alunos", { jwtToken });
  assert.equal(r.resposta.status, 200, r.texto);
  return {
    tenant: r.resposta.headers.get("x-fusion-tenant"),
    ids: r.json.map(item => item.id),
    nomes: r.json.map(item => item.nome)
  };
}

let servidor = null;

try {
  await prepararRaiz();

  // O mesmo procedimento provisiona dois tenants arbitrários.
  await executarReset(tenantA);
  await executarReset(tenantB);

  // 1. O tenant padrão não pode ter sido alterado.
  const usuariosRaiz = await lerJson("data/usuarios.json");
  const alunosRaiz = await lerJson("data/alunos.json");
  assert.deepEqual(usuariosRaiz.map(item => item.id), ["usr_raiz"]);
  assert.deepEqual(alunosRaiz.map(item => item.id), ["aluno_raiz"]);
  assert.equal(await existe("uploads/preservar.txt"), true);
  assert.equal(await existe("data/importacao/preservar.txt"), true);

  // 2. Cada academia nova recebe a mesma estrutura inicial, em diretório próprio.
  for (const tenant of [tenantA, tenantB]) {
    const base = `data/tenants/${tenant}`;
    const usuarios = await lerJson(`${base}/usuarios.json`);
    const alunos = await lerJson(`${base}/alunos.json`);
    const planos = await lerJson(`${base}/planos.json`);
    const contratos = await lerJson(`${base}/comercial/contratos.json`);
    const billing = await lerJson(`${base}/fusion_billing.json`);

    assert.equal(usuarios.some(item => item.id === "usr_modelo_admin"), true);
    assert.deepEqual(alunos.map(item => item.id), ["aluno_modelo_001"]);
    assert.equal(planos.some(item => item.id === "plano_raiz"), true);
    assert.equal(planos.some(item => item.id === "plano_modelo_demonstracao"), true);
    assert.equal(contratos.length, 1);
    assert.deepEqual(billing, []);
    assert.equal(
      await existe(`${base}/CREDENCIAIS-INICIAIS-FUSION-ERP.txt`),
      true
    );

    const backups = await fs.readdir(path.join(temporario, "backups", tenant));
    assert.equal(
      backups.some(nome => nome.endsWith(".zip")),
      true,
      `Backup pré-reset não encontrado para ${tenant}.`
    );
  }

  // 3. Sobe o MESMO servidor para operar os dois tenants.
  servidor = await iniciarServidor();

  const tokenRaiz = token(tenantPadrao, "usr_raiz");
  const tokenA = token(tenantA, "usr_modelo_admin");
  const tokenB = token(tenantB, "usr_modelo_admin");

  let raizHttp = await idsAlunos(servidor, tokenRaiz);
  let tenantAHttp = await idsAlunos(servidor, tokenA);
  let tenantBHttp = await idsAlunos(servidor, tokenB);

  assert.equal(raizHttp.tenant, tenantPadrao);
  assert.equal(tenantAHttp.tenant, tenantA);
  assert.equal(tenantBHttp.tenant, tenantB);
  assert.deepEqual(raizHttp.ids, ["aluno_raiz"]);
  assert.deepEqual(tenantAHttp.ids, ["aluno_modelo_001"]);
  assert.deepEqual(tenantBHttp.ids, ["aluno_modelo_001"]);

  // 4. Gravações independentes em cada academia.
  let r = await chamar(servidor, "/api/alunos", {
    jwtToken: tokenA,
    method: "POST",
    body: {
      nome: "Aluno Exclusivo Academia A",
      email: "aluno-a@example.local",
      status: "inativo",
      observacoes: "Criado pelo teste de implantação repetível V2"
    }
  });
  assert.equal(r.resposta.status, 201, r.texto);
  const alunoAId = r.json?.aluno?.id;
  assert.ok(alunoAId);

  r = await chamar(servidor, "/api/alunos", {
    jwtToken: tokenB,
    method: "POST",
    body: {
      nome: "Aluno Exclusivo Academia B",
      email: "aluno-b@example.local",
      status: "inativo",
      observacoes: "Criado pelo teste de implantação repetível V2"
    }
  });
  assert.equal(r.resposta.status, 201, r.texto);
  const alunoBId = r.json?.aluno?.id;
  assert.ok(alunoBId);
  assert.notEqual(alunoAId, alunoBId);

  tenantAHttp = await idsAlunos(servidor, tokenA);
  tenantBHttp = await idsAlunos(servidor, tokenB);

  assert.equal(tenantAHttp.ids.includes(alunoAId), true);
  assert.equal(tenantAHttp.ids.includes(alunoBId), false);
  assert.equal(tenantBHttp.ids.includes(alunoBId), true);
  assert.equal(tenantBHttp.ids.includes(alunoAId), false);

  // Token de A mentindo que é B deve ser rejeitado.
  r = await chamar(servidor, "/api/alunos", {
    jwtToken: tokenA,
    headers: { "x-fusion-tenant": tenantB }
  });
  assert.equal(r.resposta.status, 403, r.texto);

  // 5. Academias novas não podem herdar a catraca física da piloto.
  for (const [tenant, jwtToken] of [[tenantA, tokenA], [tenantB, tokenB]]) {
    r = await chamar(servidor, "/api/access-engine/dashboard", { jwtToken });
    assert.equal(r.resposta.status, 200, r.texto);
    assert.deepEqual(
      r.json.dispositivos.map(item => item.id),
      [],
      `${tenant} herdou equipamento físico indevidamente.`
    );
    assert.equal(r.json.resumo?.dispositivos, 0);
    assert.equal(r.json.resumo?.online, 0);
  }

  // 6. Confirma fisicamente que as gravações foram para os diretórios corretos.
  const arquivoA = await lerJson(`data/tenants/${tenantA}/alunos.json`);
  const arquivoB = await lerJson(`data/tenants/${tenantB}/alunos.json`);
  assert.equal(arquivoA.some(item => item.id === alunoAId), true);
  assert.equal(arquivoA.some(item => item.id === alunoBId), false);
  assert.equal(arquivoB.some(item => item.id === alunoBId), true);
  assert.equal(arquivoB.some(item => item.id === alunoAId), false);
  assert.deepEqual((await lerJson("data/alunos.json")).map(item => item.id), ["aluno_raiz"]);

  // 7. Reinicia o mesmo servidor e exige persistência sem nova preparação.
  await pararServidor(servidor);
  servidor = await iniciarServidor();

  tenantAHttp = await idsAlunos(servidor, tokenA);
  tenantBHttp = await idsAlunos(servidor, tokenB);
  raizHttp = await idsAlunos(servidor, tokenRaiz);

  assert.equal(tenantAHttp.ids.includes(alunoAId), true);
  assert.equal(tenantBHttp.ids.includes(alunoBId), true);
  assert.deepEqual(raizHttp.ids, ["aluno_raiz"]);

  console.log(JSON.stringify({
    ok: true,
    procedimento: "mesmo reset + mesmo servidor, sem patch por academia",
    tenantPadrao,
    tenantsNovos: [tenantA, tenantB],
    estruturaInicial: {
      modeloCriado: true,
      planoBasePreservado: true,
      credenciaisGeradas: true,
      backupAntesDoReset: true
    },
    operacaoHttp: {
      tenantA: {
        alunoCriado: alunoAId,
        isoladoDoTenantB: true
      },
      tenantB: {
        alunoCriado: alunoBId,
        isoladoDoTenantA: true
      },
      conflitoHeaderTokenBloqueado: true
    },
    acessoFisico: {
      tenantANaoHerdouCatracaPiloto: true,
      tenantBNaoHerdouCatracaPiloto: true
    },
    reinicio: {
      dadosPersistiram: true,
      tenantPadraoPreservado: true
    }
  }, null, 2));
} finally {
  if (servidor) await pararServidor(servidor);
  await fs.rm(temporario, { recursive: true, force: true });
}
