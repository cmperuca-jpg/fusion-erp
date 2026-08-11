import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), "fusion-cobranca-http-"));
const data = path.join(temporario, "data");
await fs.mkdir(data, { recursive: true });
const escrever = (nome, valor) => fs.writeFile(path.join(data, `${nome}.json`), JSON.stringify(valor));
const jwtSecret = "cobranca-http-test-secret-with-32-chars";
await escrever("usuarios", [{
  id: "usr_admin_http",
  nome: "Admin Teste",
  email: "admin-http@example.local",
  perfil: "Administrador",
  status: "ativo",
  senhaHash: await bcrypt.hash("senha-teste-http", 10),
  permissoes: ["*"]
}]);
await escrever("alunos", [{ id: "alu_http", nome: "Aluno Automático", cpf: "98765432100", status: "pre-matriculado", planoId: "pla_http" }]);
await escrever("planos", [{ id: "pla_http", nome: "Mensal Automático", valorMensal: 65, periodicidade: "Mensal", renovacaoAutomatica: true }]);
await escrever("matriculas", [{ id: "mat_http", alunoId: "alu_http", numero: "MAT-HTTP", planoId: "pla_http", plano: "Mensal Automático", valorMensal: 65, diaVencimento: 21, vencimentoInicial: "2026-07-21", dataMatricula: "2026-07-21", status: "Pendente", renovacaoAutomatica: true }]);
await escrever("mensalidades", [{ id: "men_http", alunoId: "alu_http", matriculaId: "mat_http", planoId: "pla_http", vencimento: "2026-07-21", valor: 65, valorRestante: 65, status: "aberto", origem: "matricula_inicial_unificada", ativarMatriculaAoReceber: true, lancamentoFinanceiroId: "fin_http" }]);
await escrever("financeiro", [{ id: "fin_http", tipo: "receber", alunoId: "alu_http", matriculaId: "mat_http", mensalidadeId: "men_http", planoId: "pla_http", descricao: "Entrada matrícula", categoria: "Matrícula e mensalidade", vencimento: "2026-07-21", valor: 65, valorRestante: 65, status: "Aberto", origem: "matricula_inicial_unificada", ativarMatriculaAoReceber: true }]);
await escrever("caixa", { caixas: [], movimentos: [] });

const porta = 3299;
const processo = spawn(process.execPath, [path.join(raiz, "server.mjs")], { cwd: temporario, env: { ...process.env, PORT: String(porta), NODE_ENV: "development", JWT_SECRET: jwtSecret, FUSION_DATABASE_PROVIDER: "json", FUSION_JSON_FALLBACK: "true", FUSION_SYNC_DATA_ON_LOCAL: "false", FUSION_REQUIRE_SUPABASE_DATA: "false", FUSION_BACKUP_AUTO_ON_LOCAL: "false" }, stdio: ["ignore", "pipe", "pipe"] });
let saida = "";
let encerrado = null;
processo.stdout.on("data", (p) => { saida += p; });
processo.stderr.on("data", (p) => { saida += p; });
processo.once("exit", (code, signal) => { encerrado = { code, signal }; });

async function esperar() {
  for (let i = 0; i < 200; i += 1) {
    if (encerrado) throw new Error(`Servidor encerrou antes do teste: ${JSON.stringify(encerrado)}.\n${saida}`);
    try { const r = await fetch(`http://127.0.0.1:${porta}/api/health`); if (r.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor não respondeu.\n${saida}`);
}

try {
  await esperar();
  const token = jwt.sign(
    { sub: "usr_admin_http", email: "admin-http@example.local", perfil: "Administrador", permissoes: ["*"], tenantId: "academia-piloto" },
    jwtSecret,
    { expiresIn: "1h" }
  );
  const headers = { "Content-Type": "application/json", authorization: `Bearer ${token}` };
  let resposta = await fetch(`http://127.0.0.1:${porta}/api/caixa/abrir`, { method: "POST", headers, body: JSON.stringify({ valorAbertura: 0, responsavel: "Teste" }) });
  assert.equal(resposta.status, 201);
  resposta = await fetch(`http://127.0.0.1:${porta}/api/financeiro/fin_http/baixar`, { method: "PATCH", headers, body: JSON.stringify({ valor: 65, valorPago: 65, formaPagamento: "Dinheiro", operacaoId: "op_http_auto", usuario: "teste" }) });
  const json = await resposta.json();
  assert.equal(resposta.ok, true, JSON.stringify(json));
  assert.equal(json.cobrancaAutomatica?.programada, true, JSON.stringify(json.cobrancaAutomatica));
  const matriculas = JSON.parse(await fs.readFile(path.join(data, "matriculas.json"), "utf8"));
  let financeiro = JSON.parse(await fs.readFile(path.join(data, "financeiro.json"), "utf8"));
  let mensalidades = JSON.parse(await fs.readFile(path.join(data, "mensalidades.json"), "utf8"));
  assert.equal(matriculas[0].status, "Ativa");
  assert.equal(mensalidades.some((x) => x.origem === "recorrencia_programada" && String(x.status).toLowerCase() === "programada"), true);
  assert.equal(financeiro.some((x) => x.origem === "mensalidade_automatica" && String(x.status).toLowerCase() === "aberto"), false);

  resposta = await fetch(`http://127.0.0.1:${porta}/api/cobranca/executar`, { method: "POST", headers, body: JSON.stringify({ dataReferencia: "2026-08-21", usuario: "teste" }) });
  const execucao = await resposta.json();
  assert.equal(resposta.ok, true, JSON.stringify(execucao));
  assert.equal(execucao.geradas, 1, JSON.stringify(execucao));
  financeiro = JSON.parse(await fs.readFile(path.join(data, "financeiro.json"), "utf8"));
  mensalidades = JSON.parse(await fs.readFile(path.join(data, "mensalidades.json"), "utf8"));
  assert.equal(financeiro.some((x) => x.origem === "mensalidade_automatica" && String(x.status).toLowerCase() === "aberto"), true);
  assert.equal(mensalidades.some((x) => x.origem === "mensalidade_automatica" && String(x.status).toLowerCase() === "aberto"), true);
  console.log(JSON.stringify({ ok: true, recibo: json.lancamento?.recibo?.numero, proximaMensalidade: json.cobrancaAutomatica?.proximoVencimento, geradas: execucao.geradas, matricula: matriculas[0].status }, null, 2));
} finally {
  processo.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => processo.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 2000))]);
  await fs.rm(temporario, { recursive: true, force: true });
}
