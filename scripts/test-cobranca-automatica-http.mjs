import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), "fusion-cobranca-http-"));
const data = path.join(temporario, "data");
await fs.mkdir(data, { recursive: true });
const escrever = (nome, valor) => fs.writeFile(path.join(data, `${nome}.json`), JSON.stringify(valor));
await escrever("alunos", [{ id: "alu_http", nome: "Aluno Automático", cpf: "98765432100", status: "pre-matriculado", planoId: "pla_http" }]);
await escrever("planos", [{ id: "pla_http", nome: "Mensal Automático", valorMensal: 65, periodicidade: "Mensal", renovacaoAutomatica: true }]);
await escrever("matriculas", [{ id: "mat_http", alunoId: "alu_http", numero: "MAT-HTTP", planoId: "pla_http", plano: "Mensal Automático", valorMensal: 65, diaVencimento: 21, vencimentoInicial: "2026-07-21", dataMatricula: "2026-07-21", status: "Pendente", renovacaoAutomatica: true }]);
await escrever("mensalidades", [{ id: "men_http", alunoId: "alu_http", matriculaId: "mat_http", planoId: "pla_http", vencimento: "2026-07-21", valor: 65, valorRestante: 65, status: "aberto", origem: "matricula_inicial_unificada", ativarMatriculaAoReceber: true, lancamentoFinanceiroId: "fin_http" }]);
await escrever("financeiro", [{ id: "fin_http", tipo: "receber", alunoId: "alu_http", matriculaId: "mat_http", mensalidadeId: "men_http", planoId: "pla_http", descricao: "Entrada matrícula", categoria: "Matrícula e mensalidade", vencimento: "2026-07-21", valor: 65, valorRestante: 65, status: "Aberto", origem: "matricula_inicial_unificada", ativarMatriculaAoReceber: true }]);
await escrever("caixa", { caixas: [], movimentos: [] });

const porta = 3299;
const processo = spawn(process.execPath, [path.join(raiz, "server.mjs")], { cwd: temporario, env: { ...process.env, PORT: String(porta), NODE_ENV: "development", FUSION_DATABASE_PROVIDER: "json", FUSION_JSON_FALLBACK: "true", FUSION_SYNC_DATA_ON_LOCAL: "false", FUSION_REQUIRE_SUPABASE_DATA: "false", FUSION_BACKUP_AUTO_ON_LOCAL: "false" }, stdio: ["ignore", "pipe", "pipe"] });
let saida = "";
processo.stdout.on("data", (p) => { saida += p; });
processo.stderr.on("data", (p) => { saida += p; });

async function esperar() {
  for (let i = 0; i < 50; i += 1) {
    try { const r = await fetch(`http://127.0.0.1:${porta}/api/financeiro`); if (r.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor não respondeu.\n${saida}`);
}

try {
  await esperar();
  let resposta = await fetch(`http://127.0.0.1:${porta}/api/caixa/abrir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valorAbertura: 0, responsavel: "Teste" }) });
  assert.equal(resposta.status, 201);
  resposta = await fetch(`http://127.0.0.1:${porta}/api/financeiro/fin_http/baixar`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valor: 65, valorPago: 65, formaPagamento: "Dinheiro", operacaoId: "op_http_auto", usuario: "teste" }) });
  const json = await resposta.json();
  assert.equal(resposta.ok, true, JSON.stringify(json));
  assert.equal(json.cobrancaAutomatica?.gerada, true, JSON.stringify(json.cobrancaAutomatica));
  const matriculas = JSON.parse(await fs.readFile(path.join(data, "matriculas.json"), "utf8"));
  const financeiro = JSON.parse(await fs.readFile(path.join(data, "financeiro.json"), "utf8"));
  assert.equal(matriculas[0].status, "Ativa");
  assert.equal(financeiro.some((x) => x.origem === "mensalidade_automatica" && String(x.status).toLowerCase() === "aberto"), true);
  console.log(JSON.stringify({ ok: true, recibo: json.lancamento?.recibo?.numero, proximaMensalidade: json.cobrancaAutomatica?.proximoVencimento, matricula: matriculas[0].status }, null, 2));
} finally {
  processo.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => processo.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 2000))]);
  await fs.rm(temporario, { recursive: true, force: true });
}
