import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { deduplicarEventosBiometricos, resolverJanelaReleituraBiometricaMs } from "../modules/treinos/biometric-access-dedupe.mjs";

const base = Date.parse("2026-08-13T13:18:36.336Z");
const eventos = [
  { student_id:"paulo", occurred_at:new Date(base).toISOString(), payload:{localDate:"2026-08-13"} },
  { student_id:"paulo", occurred_at:new Date(base+7759).toISOString(), payload:{localDate:"2026-08-13"} },
  { student_id:"paulo", occurred_at:new Date(base+116474).toISOString(), payload:{localDate:"2026-08-13"} }
];
assert.equal(deduplicarEventosBiometricos(eventos).length, 2);
assert.equal(resolverJanelaReleituraBiometricaMs(), 12000);

const marcado = [
  eventos[0],
  { ...eventos[1], payload:{localDate:"2026-08-13",frequencyIgnored:true} },
  eventos[2]
];
assert.equal(deduplicarEventosBiometricos(marcado).length, 2);

const [engine, appService, actions, contrast] = await Promise.all([
  fs.readFile(new URL("../scripts/fusion-access-local-engine.mjs", import.meta.url), "utf8"),
  fs.readFile(new URL("../modules/treinos/aluno-app-actions.service.mjs", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/aluno-login/actions.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/alunos/prontuario-contraste-v2.css", import.meta.url), "utf8")
]);

assert.match(engine, /reReadCooldownMs/);
assert.match(engine, /Releitura biometrica ignorada/);
assert.match(engine, /rebuildLocalCountsFromEvents/);
assert.match(appService, /deduplicarEventosBiometricos/);
assert.match(appService, /payload/);
assert.match(actions, /visibilitychange/);
assert.match(actions, /window\.addEventListener\("focus"/);
assert.doesNotMatch(actions, /setInterval/);
assert.match(contrast, /\.prontuario-page \.prontuario-header \.chip/);
assert.match(contrast, /color:#123943!important/);

console.log(JSON.stringify({
  ok:true,
  releituraRapidaNaoConsomeAcesso:true,
  pauloTresEventosViraramDoisAcessosValidos:true,
  frequenciaAtualizaAoVoltarParaAba:true,
  semPollingContinuo:true,
  contrasteChipsProntuario:true
}, null, 2));
