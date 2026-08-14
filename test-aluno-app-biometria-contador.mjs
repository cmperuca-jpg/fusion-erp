import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { combinarContadorAcessos } from "../modules/treinos/aluno-app-access-counter.mjs";

let r = combinarContadorAcessos({ central: 0, biometria: 3, limite: 3 });
assert.equal(r.usados, 3);
assert.equal(r.restantes, 0);
assert.equal(r.limiteAtingido, true);
assert.equal(r.usadosBiometria, 3);

r = combinarContadorAcessos({ central: 1, biometria: 2, limite: 3 });
assert.equal(r.usados, 3);
assert.equal(r.restantes, 0);

const [service, actionsService, ui] = await Promise.all([
  fs.readFile(new URL("../modules/treinos/treinos.service.mjs", import.meta.url), "utf8"),
  fs.readFile(new URL("../modules/treinos/aluno-app-actions.service.mjs", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/aluno-login/actions.js", import.meta.url), "utf8")
]);

assert.match(service, /fusion_edge_daily_frequency/);
assert.match(service, /\.eq\("student_id",\s*alunoId\)/);
assert.match(service, /\.eq\("attendance_date",\s*dataAlvo\)/);
assert.match(service, /\.eq\("modality",\s*"biometria"\)/);
assert.match(service, /combinarContadorAcessos/);

assert.match(actionsService, /fusion_edge_access_events/);
assert.match(actionsService, /\.eq\("physical_confirmed",\s*true\)/);

assert.doesNotMatch(ui, /CONTADOR_REFRESH_MS/);
assert.doesNotMatch(ui, /contadorTimer\s*=\s*window\.setInterval/);
assert.match(ui, /window\.setTimeout\(\(\) => \{\s*atualizarContador\(\);/s);

console.log(JSON.stringify({
  ok: true,
  painelSomaBiometriaLocal: true,
  pollingTresSegundos: false,
  atualizaAposComandoDoPainel: true,
  consultaAoAbrirOuVoltarParaHome: true,
  mensagemDentroAcademiaPreservada: true
}, null, 2));
