import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { aplicarAccessLogNaFrequencia } from "../modules/access-engine/access-frequency-sync.mjs";
import { resumirFrequenciaRegistros } from "../modules/treinos/aluno-app-frequencia.mjs";

const aluno = { id: "aluno-1", nome: "Aluno Teste", matriculaId: "mat-1", numeroMatricula: "MAT-1" };
const matricula = { id: "mat-1", alunoId: "aluno-1", numero: "MAT-1", plano: "MUSCULAÇÃO", status: "Ativa" };
const vinculo = {
  id: "vinc-1",
  tipo: "vinculo_matricula",
  alunoId: "aluno-1",
  matriculaId: "mat-1",
  criadoEm: "2026-08-12T10:00:00.000Z"
};

const checkin = [];
const checkins = [vinculo];

const entrada = {
  id: "log-entrada",
  alunoId: "aluno-1",
  alunoNome: "Aluno Teste",
  matriculaId: "mat-1",
  autorizado: true,
  direcao: "entrada",
  origem: "portal-aluno-botao",
  criadoEm: "2026-08-12T12:00:00.000Z",
  catraca: { commandId: "cmd-entrada" }
};

const saida = {
  id: "log-saida",
  alunoId: "aluno-1",
  alunoNome: "Aluno Teste",
  matriculaId: "mat-1",
  autorizado: true,
  direcao: "saida",
  origem: "portal-aluno-botao",
  criadoEm: "2026-08-12T13:30:00.000Z",
  catraca: { commandId: "cmd-saida" }
};

let r = aplicarAccessLogNaFrequencia({
  log: entrada, alunos: [aluno], matriculas: [matricula], checkin, checkins
});
assert.equal(r.movimento, "entrada");
assert.equal(checkin.length, 1);
assert.equal(checkin[0].horaSaida, "");
assert.equal(checkins[0].ultimoAcessoMovimento, "entrada");

r = aplicarAccessLogNaFrequencia({
  log: saida, alunos: [aluno], matriculas: [matricula], checkin, checkins
});
assert.equal(r.movimento, "saida");
assert.equal(checkin.length, 1, "Saída não pode criar uma segunda frequência.");
assert.notEqual(checkin[0].horaSaida, "");
assert.equal(checkin[0].accessExitLogId, "log-saida");
assert.equal(checkins[0].ultimoAcessoMovimento, "saida");
assert.equal(checkins[0].ultimoAccessLogId, "log-saida");

const resumo = resumirFrequenciaRegistros({
  accessLogs: [
    { record_id: entrada.id, payload: entrada },
    { record_id: saida.id, payload: saida }
  ],
  checkin: [{ record_id: checkin[0].id, payload: checkin[0] }],
  checkins: [{ record_id: vinculo.id, payload: vinculo }]
}, { agora: new Date("2026-08-12T14:00:00.000Z") });

assert.equal(resumo.ultimos_30_dias, 1, "Entrada + saída devem representar uma visita/frequência.");

const actionsService = await fs.readFile(new URL("../modules/treinos/aluno-app-actions.service.mjs", import.meta.url), "utf8");
const actionsJs = await fs.readFile(new URL("../public/pages/aluno-login/actions.js", import.meta.url), "utf8");
const treinosService = await fs.readFile(new URL("../modules/treinos/treinos.service.mjs", import.meta.url), "utf8");

assert.match(actionsService, /proximaDirecao: presente \? "saida" : "entrada"/);
assert.match(actionsService, /access_pessoas_presentes\.json/);
assert.match(actionsJs, /Liberar saída/);
assert.match(actionsJs, /Liberar entrada/);
assert.match(actionsJs, /direcao: "auto"/);
assert.match(treinosService, /direcaoNormalizada !== "saida" && controleAntes\.limiteAtingido/);

console.log(JSON.stringify({
  ok: true,
  entradaCriaCheckin: true,
  saidaFechaMesmoCheckin: true,
  doisGirosUmaFrequencia: true,
  direcaoAutomatica: true,
  botaoMudaEntradaSaida: true,
  saidaNaoConsomeLimiteDiario: true,
  saidaNaoBloqueadaPorLimiteDeEntradas: true
}, null, 2));
