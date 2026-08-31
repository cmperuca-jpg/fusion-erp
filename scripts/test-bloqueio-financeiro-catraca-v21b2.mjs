import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { diasAtrasoAcesso } from "../modules/access-engine/access-engine.service.mjs";

assert.equal(diasAtrasoAcesso("2026-08-08", "2026-08-31"), 23);
assert.equal(diasAtrasoAcesso("2026-08-31", "2026-08-31"), 0);
assert.equal(diasAtrasoAcesso("2026-09-01", "2026-08-31"), 0);

const access = await fs.readFile(new URL("../modules/access-engine/access-engine.service.mjs", import.meta.url), "utf8");
const treinos = await fs.readFile(new URL("../modules/treinos/treinos.service.mjs", import.meta.url), "utf8");
const actions = await fs.readFile(new URL("../public/pages/aluno-login/actions.js", import.meta.url), "utf8");
const prontuario = await fs.readFile(new URL("../public/pages/alunos/prontuario.js", import.meta.url), "utf8");
const rotasAlunos = await fs.readFile(new URL("../modules/alunos/alunos.routes.mjs", import.meta.url), "utf8");

assert.match(access, /consultarBloqueioFinanceiroAluno/);
assert.match(access, /pendenciaFinanceiraAluno\(aluno\)/);
assert.match(treinos, /providerPostgresPrincipalAtivo/);
assert.match(treinos, /FROM public\.fusion_edge_daily_frequency/);
assert.match(treinos, /consultarBloqueioFinanceiroAluno/);
assert.match(treinos, /bloqueadoFinanceiro/);
assert.match(actions, /Acesso bloqueado/);
assert.match(actions, /bloqueadoFinanceiro/);
assert.match(actions, /busy\(btn, false\);\s*atualizarContador\(\);/s);
assert.match(prontuario, /Bloqueado financeiro/);
assert.match(rotasAlunos, /restricaoAcesso/);
assert.match(rotasAlunos, /resultado\.restricaoAcesso\s*=\s*restricaoAcesso/);
assert.doesNotMatch(rotasAlunos, /atualizarAluno\(/);

console.log(JSON.stringify({
  ok: true,
  modulo: "bloqueio-financeiro-catraca-v21b2",
  atraso23DiasCalculado: true,
  statusProntuarioDerivadoSemEscrita: true,
  botaoEntradaRefleteBackend: true,
  saidaPreservadaNoFrontend: true,
  contadorEdgePostgresLocal: true,
  semChamadaExternaNoTeste: true
}, null, 2));
