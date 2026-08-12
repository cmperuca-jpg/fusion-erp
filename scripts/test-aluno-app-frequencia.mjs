import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { resumirFrequenciaRegistros } from "../modules/treinos/aluno-app-frequencia.mjs";

const agora = new Date("2026-08-12T14:40:00.000Z");
const access = {
  id: "log-paulo-1",
  alunoId: "aluno-paulo",
  autorizado: true,
  direcao: "entrada",
  origem: "portal-aluno-botao",
  criadoEm: "2026-08-12T14:36:50.719Z",
  dispositivoNome: "Catraca Henry 7X"
};
const checkin = {
  id: "chk-paulo-1",
  alunoId: "aluno-paulo",
  accessLogId: "log-paulo-1",
  status: "Liberado",
  tipo: "Catraca pelo App de Treino",
  origem: "portal-aluno-botao",
  criadoEm: "2026-08-12T14:36:50.719Z"
};

let resumo = resumirFrequenciaRegistros({
  accessLogs: [{ record_id: access.id, payload: access }],
  checkin: [{ record_id: checkin.id, payload: checkin }],
  checkins: [{ record_id: "v1", payload: { tipo: "vinculo_matricula", alunoId: "aluno-paulo" } }]
}, { agora });

assert.equal(resumo.ultimos_30_dias, 1);
assert.equal(resumo.acessos[0].fonte, "checkin");
assert.equal(resumo.fallback_access_logs, false);

// Se o espelho ainda não ocorreu, access_logs mantém a UI correta como fallback.
resumo = resumirFrequenciaRegistros({
  accessLogs: [{ record_id: access.id, payload: access }],
  checkin: [],
  checkins: []
}, { agora });
assert.equal(resumo.ultimos_30_dias, 1);
assert.equal(resumo.acessos[0].fonte, "access_logs_fallback");
assert.equal(resumo.fallback_access_logs, true);

const routes = await fs.readFile(new URL("../modules/treinos/treinos.routes.mjs", import.meta.url), "utf8");
const actions = await fs.readFile(new URL("../public/pages/aluno-login/actions.js", import.meta.url), "utf8");
const service = await fs.readFile(new URL("../modules/treinos/aluno-app-actions.service.mjs", import.meta.url), "utf8");
const repo = await fs.readFile(new URL("../modules/access-engine/access-engine.repository.mjs", import.meta.url), "utf8");

assert.match(routes, /aluno-app\/frequencia/);
assert.match(actions, /request\("\/frequencia"/);
assert.match(service, /reconciliarAccessLogsFrequenciaDuravel/);
assert.match(repo, /access-frequency-sync\.runtime\.mjs/);

console.log(JSON.stringify({
  ok: true,
  fontePrincipal: "checkin",
  accessLogsFallback: true,
  reconciliacaoAutomatica: true,
  atualizacaoAposCatraca: true
}, null, 2));
