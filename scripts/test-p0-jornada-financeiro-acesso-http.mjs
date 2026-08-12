import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), "fusion-p0-jornada-fin-access-"));
const data = path.join(temporario, "data");
await fs.mkdir(data, { recursive: true });

const tenantId = "academia-p0-jornada";
const agentId = "academia-p0-jornada-agent-01";
const equipmentId = "catraca-p0-jornada-01";
const agentToken = `tok_${crypto.randomBytes(24).toString("hex")}`;
const jwtSecret = "fusion-p0-jornada-financeiro-acesso-secret-32chars";

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

async function escrever(nome, valor) {
  await fs.writeFile(
    path.join(data, `${nome}.json`),
    JSON.stringify(valor, null, 2),
    "utf8"
  );
}

await escrever("usuarios", [{
  id: "usr-p0-jornada",
  nome: "Administrador P0",
  email: "admin-p0@example.local",
  perfil: "Administrador",
  status: "ativo",
  permissoes: ["*"]
}]);

await escrever("alunos", [{
  id: "alu-p0-jornada",
  nome: "Aluno Jornada P0",
  cpf: "12345678901",
  status: "pre-matriculado",
  ativo: false
}]);

await escrever("planos", [{
  id: "pla-p0-jornada",
  nome: "Plano Mensal P0",
  valorMensal: 70,
  periodicidade: "Mensal",
  tipoPlano: "Mensal",
  renovacaoAutomatica: true,
  geraMensalidade: true,
  cobraMatricula: true,
  valorMatricula: 0,
  status: "ativo"
}]);

await escrever("matriculas", []);
await escrever("mensalidades", []);
await escrever("financeiro", []);
await escrever("recebimentos", []);
await escrever("recibos", []);
await escrever("recibos_itens", []);
await escrever("checkins", []);
await escrever("alunos_historico_planos", []);
await escrever("turmas", []);
await escrever("caixa", { caixas: [], movimentos: [] });
await escrever("taxas_cartao", []);
await escrever("access_dispositivos", [{
  id: equipmentId,
  nome: "Catraca P0 Henry 7X",
  fabricante: "Henry",
  modelo: "7X",
  driver: "henry7x",
  ip: "10.0.0.250",
  porta: "3000",
  sentido: "entrada_saida",
  status: "ativo"
}]);

const porta = await portaLivre();
const env = {
  ...process.env,
  PORT: String(porta),
  NODE_ENV: "development",
  JWT_SECRET: jwtSecret,
  FUSION_TENANT_ID: tenantId,
  FUSION_DATABASE_PROVIDER: "json",
  FUSION_JSON_FALLBACK: "true",
  FUSION_SYNC_DATA_ON_LOCAL: "false",
  FUSION_REQUIRE_SUPABASE_DATA: "false",
  FUSION_BACKUP_AUTO_ON_LOCAL: "false",
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SECRET_KEY: "",
  ACCESS_AGENT_ID: agentId,
  ACCESS_AGENT_TENANT_ID: tenantId,
  ACCESS_EQUIPMENT_ID: equipmentId,
  ACCESS_EQUIPMENT_IDS: equipmentId,
  ACCESS_AGENT_TOKEN: agentToken,
  ACCESS_AGENT_REQUIRE_EQUIPMENT_HEADER: "true",
  ACCESS_AGENT_MAX_CLOCK_SKEW_MS: "300000"
};

const processo = spawn(process.execPath, [path.join(raiz, "server.mjs")], {
  cwd: temporario,
  env,
  stdio: ["ignore", "pipe", "pipe"]
});

let saida = "";
let encerrado = null;
processo.stdout.on("data", parte => { saida += parte; });
processo.stderr.on("data", parte => { saida += parte; });
processo.once("exit", (code, signal) => { encerrado = { code, signal }; });

async function esperarServidor() {
  for (let i = 0; i < 200; i += 1) {
    if (encerrado) {
      throw new Error(`Servidor encerrou antes do teste: ${JSON.stringify(encerrado)}.\n${saida}`);
    }
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/health`);
      if (resposta.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor não respondeu.\n${saida}`);
}

const adminToken = jwt.sign(
  {
    sub: "usr-p0-jornada",
    email: "admin-p0@example.local",
    perfil: "Administrador",
    permissoes: ["*"],
    tenantId
  },
  jwtSecret,
  { expiresIn: "1h" }
);

const adminHeaders = {
  "Content-Type": "application/json",
  authorization: `Bearer ${adminToken}`
};

function agentHeaders() {
  return {
    "Content-Type": "application/json",
    "x-agent-id": agentId,
    "x-agent-token": agentToken,
    "x-agent-tenant-id": tenantId,
    "x-agent-equipment-id": equipmentId,
    "x-agent-timestamp": new Date().toISOString(),
    "x-agent-nonce": crypto.randomUUID()
  };
}

async function chamar(caminho, { method = "GET", headers = adminHeaders, body } = {}) {
  const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const texto = await resposta.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch {}
  return { resposta, json, texto };
}

function statusNormalizado(valor) {
  return String(valor || "").trim().toLowerCase();
}

try {
  await esperarServidor();

  // 1. Matrícula nasce pela API, não por fixture pronta.
  let r = await chamar("/api/matriculas/integrar", {
    method: "POST",
    body: {
      alunoId: "alu-p0-jornada",
      planoId: "pla-p0-jornada",
      dataMatricula: "2026-08-12",
      diaVencimento: 15,
      gerarMensalidade: true,
      usuario: "teste-p0-jornada"
    }
  });

  assert.equal(r.resposta.status, 200, r.texto);
  assert.equal(r.json?.ok, true, r.texto);
  assert.equal(statusNormalizado(r.json?.matricula?.status), "pendente");
  assert.equal(r.json?.matricula?.valorTotalInicial, 70);
  assert.equal(statusNormalizado(r.json?.mensalidadeGerada?.status), "aberto");
  assert.equal(statusNormalizado(r.json?.financeiroInicial?.status), "aberto");
  assert.equal(r.json?.financeiroInicial?.valor, 70);
  assert.equal(r.json?.financeiroInicial?.ativarMatriculaAoReceber, true);

  const matriculaId = r.json.matricula.id;
  const numeroMatricula = r.json.matricula.numero;
  const financeiroInicialId = r.json.financeiroInicial.id;
  const mensalidadeInicialId = r.json.mensalidadeGerada.id;

  let matriculas = JSON.parse(await fs.readFile(path.join(data, "matriculas.json"), "utf8"));
  let alunos = JSON.parse(await fs.readFile(path.join(data, "alunos.json"), "utf8"));
  assert.equal(statusNormalizado(matriculas.find(x => x.id === matriculaId)?.status), "pendente");
  assert.equal(statusNormalizado(alunos.find(x => x.id === "alu-p0-jornada")?.status), "pre-matriculado");

  // 2. Caixa é requisito para recebimento em dinheiro.
  r = await chamar("/api/caixa/abrir", {
    method: "POST",
    body: { valorAbertura: 0, responsavel: "Teste P0 integrado" }
  });
  assert.equal(r.resposta.status, 201, r.texto);

  // 3. Baixa do título inicial deve ativar a matrícula.
  r = await chamar(`/api/financeiro/${financeiroInicialId}/baixar`, {
    method: "PATCH",
    body: {
      valor: 70,
      valorPago: 70,
      formaPagamento: "Dinheiro",
      operacaoId: "op-p0-jornada-fin-access",
      usuario: "teste-p0-jornada"
    }
  });
  assert.equal(r.resposta.ok, true, r.texto);

  matriculas = JSON.parse(await fs.readFile(path.join(data, "matriculas.json"), "utf8"));
  alunos = JSON.parse(await fs.readFile(path.join(data, "alunos.json"), "utf8"));
  let financeiro = JSON.parse(await fs.readFile(path.join(data, "financeiro.json"), "utf8"));
  let mensalidades = JSON.parse(await fs.readFile(path.join(data, "mensalidades.json"), "utf8"));
  const caixa = JSON.parse(await fs.readFile(path.join(data, "caixa.json"), "utf8"));
  const recibos = JSON.parse(await fs.readFile(path.join(data, "recibos.json"), "utf8"));

  assert.equal(statusNormalizado(matriculas.find(x => x.id === matriculaId)?.status), "ativa");
  assert.equal(statusNormalizado(alunos.find(x => x.id === "alu-p0-jornada")?.status), "ativo");
  assert.equal(statusNormalizado(financeiro.find(x => x.id === financeiroInicialId)?.status), "pago");
  assert.ok(
    ["pago", "recebido", "quitado", "baixado"].includes(
      statusNormalizado(mensalidades.find(x => x.id === mensalidadeInicialId)?.status)
    ),
    "Mensalidade inicial precisa ficar quitada após a baixa."
  );
  assert.equal(recibos.length, 1, "Pagamento inicial precisa gerar exatamente um recibo.");
  assert.equal(
    caixa.movimentos.some(x => statusNormalizado(x.tipo) === "entrada" && Number(x.valor) === 70),
    true,
    "Pagamento precisa gerar entrada no caixa."
  );

  const proxima = mensalidades.find(x =>
    x.matriculaId === matriculaId &&
    statusNormalizado(x.status) === "programada"
  );
  assert.ok(proxima, "Pagamento deve programar a próxima mensalidade.");
  assert.equal(proxima.vencimento, "2026-09-15");
  assert.equal(
    financeiro.some(x =>
      x.mensalidadeId === proxima.id &&
      ["aberto", "pendente", "vencido"].includes(statusNormalizado(x.status))
    ),
    false,
    "Mensalidade futura programada não pode gerar dívida antes do vencimento."
  );

  // 4. Aluno quitado e matrícula ativa deve ser autorizado no acesso.
  r = await chamar("/api/access-engine/simular-acesso", {
    method: "POST",
    body: {
      identificador: numeroMatricula,
      dispositivoId: equipmentId,
      direcao: "entrada",
      origem: "teste-p0-jornada"
    }
  });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.equal(r.json?.autorizado, true, r.texto);
  assert.equal(r.json?.catraca?.ok, true, r.texto);
  assert.equal(r.json?.catraca?.command?.tenantId, tenantId);
  assert.equal(r.json?.catraca?.command?.equipmentId, equipmentId);

  const commandId = r.json.catraca.commandId || r.json.catraca.command?.id;
  assert.ok(commandId, "A autorização deve enfileirar comando da catraca.");

  // 5. Agente realista: heartbeat -> claim -> conclusão.
  r = await chamar("/api/access-bridge/agent/heartbeat", {
    method: "POST",
    headers: agentHeaders(),
    body: {
      state: "polling",
      tenantId,
      equipmentId
    }
  });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.equal(r.json?.ok, true, r.texto);

  r = await chamar("/api/access-bridge/agent/next", {
    headers: agentHeaders()
  });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.equal(r.json?.command?.id, commandId, r.texto);
  assert.equal(statusNormalizado(r.json?.command?.status), "processing");

  r = await chamar(`/api/access-bridge/agent/commands/${commandId}/result`, {
    method: "POST",
    headers: agentHeaders(),
    body: {
      ok: true,
      result: {
        liberado: true,
        driver: "henry7x",
        origem: "agente-p0-simulado",
        equipamentoId: equipmentId
      }
    }
  });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.equal(statusNormalizado(r.json?.command?.status), "completed");
  assert.equal(r.json?.command?.result?.liberado, true);

  // 6. Backend administrativo precisa enxergar o mesmo comando finalizado no tenant.
  r = await chamar(`/api/access-engine/comandos/${commandId}`);
  assert.equal(r.resposta.status, 200, r.texto);
  assert.equal(statusNormalizado(r.json?.command?.status), "completed");
  assert.equal(r.json?.command?.tenantId, tenantId);
  assert.equal(r.json?.command?.equipmentId, equipmentId);

  const logs = JSON.parse(await fs.readFile(path.join(data, "access_logs.json"), "utf8"));
  const presentes = JSON.parse(await fs.readFile(path.join(data, "access_pessoas_presentes.json"), "utf8"));
  assert.equal(logs.some(x => x.autorizado === true && x.catraca?.commandId === commandId), true);
  assert.equal(presentes.some(x => x.alunoId === "alu-p0-jornada"), true);

  console.log(JSON.stringify({
    ok: true,
    jornada: [
      "matricula_criada",
      "cobranca_inicial_gerada",
      "caixa_aberto",
      "pagamento_baixado",
      "matricula_ativada",
      "proxima_mensalidade_programada",
      "acesso_autorizado",
      "comando_catraca_concluido"
    ],
    matricula: {
      id: matriculaId,
      numero: numeroMatricula,
      status: "Ativa"
    },
    financeiro: {
      tituloInicial: financeiroInicialId,
      valor: 70,
      proximoVencimento: proxima.vencimento
    },
    acesso: {
      tenantId,
      equipmentId,
      commandId,
      status: "completed"
    }
  }, null, 2));
} finally {
  processo.kill("SIGTERM");
  await Promise.race([
    new Promise(resolve => processo.once("exit", resolve)),
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);
  await fs.rm(temporario, { recursive: true, force: true });
}
