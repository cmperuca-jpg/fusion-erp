import assert from "node:assert/strict";
import { aplicarAccessLogNaFrequencia } from "../modules/access-engine/access-frequency-sync.mjs";
import { resumirFrequenciaRegistros } from "../modules/treinos/aluno-app-frequencia.mjs";

const aluno = {
  id: "aluno-paulo",
  nome: "PAULO",
  numeroMatricula: "MAT-001",
  matriculaId: "mat-paulo",
  modalidade: "MUSCULAÇÃO"
};
const matricula = {
  id: "mat-paulo",
  alunoId: "aluno-paulo",
  numero: "MAT-001",
  plano: "MUSCULAÇÃO",
  modalidade: "MUSCULAÇÃO",
  status: "Ativa"
};
const vinculo = {
  id: "chk_vinc_paulo",
  tipo: "vinculo_matricula",
  alunoId: "aluno-paulo",
  matriculaId: "mat-paulo",
  status: "Bloqueado",
  criadoEm: "2026-08-01T10:00:00.000Z"
};
const log = {
  id: "log-paulo-real",
  alunoId: "aluno-paulo",
  alunoNome: "PAULO",
  matriculaId: "mat-paulo",
  numeroMatricula: "MAT-001",
  autorizado: true,
  direcao: "entrada",
  origem: "portal-aluno-botao",
  criadoEm: "2026-08-12T14:36:50.719Z",
  dispositivoNome: "Catraca Henry 7X",
  catraca: { commandId: "cmd-paulo" }
};

const checkin = [];
const checkins = [vinculo];

let r = aplicarAccessLogNaFrequencia({
  log,
  alunos: [aluno],
  matriculas: [matricula],
  checkin,
  checkins
});

assert.equal(r.alteradoCheckin, true);
assert.equal(r.alteradoVinculo, true);
assert.equal(checkin.length, 1);
assert.equal(checkin[0].accessLogId, "log-paulo-real");
assert.equal(checkin[0].status, "Liberado");
assert.equal(checkins.length, 1, "Não deve criar presença duplicada em checkins.");
assert.equal(checkins[0].tipo, "vinculo_matricula");
assert.equal(checkins[0].ultimoAccessLogId, "log-paulo-real");
assert.equal(checkins[0].ultimoCheckinId, checkin[0].id);
assert.equal(checkins[0].ultimaEntradaData, "2026-08-12");

// Idempotência: mesmo log de novo não cria outro checkin.
r = aplicarAccessLogNaFrequencia({
  log,
  alunos: [aluno],
  matriculas: [matricula],
  checkin,
  checkins
});
assert.equal(checkin.length, 1);

// Negado não vira frequência.
const negado = aplicarAccessLogNaFrequencia({
  log: { ...log, id: "log-negado", autorizado: false },
  alunos: [aluno],
  matriculas: [matricula],
  checkin,
  checkins
});
assert.equal(negado.alterado, false);

// O card prioriza checkin; access_log duplicado vira apenas fallback descartado.
const resumo = resumirFrequenciaRegistros({
  accessLogs: [{ record_id: log.id, payload: log }],
  checkin: [{ record_id: checkin[0].id, payload: checkin[0] }],
  checkins: [{ record_id: vinculo.id, payload: vinculo }]
}, { agora: new Date("2026-08-12T14:40:00.000Z") });

assert.equal(resumo.ultimos_30_dias, 1);
assert.equal(resumo.fonte_principal, "checkin");
assert.equal(resumo.fallback_access_logs, false);
assert.equal(resumo.acessos[0].fonte, "checkin");

console.log(JSON.stringify({
  ok: true,
  fluxo: "access_logs -> checkin + checkins(vinculo)",
  checkinRecebePresenca: true,
  checkinsRecebeUltimoAcessoSemDuplicarPresenca: true,
  idempotentePorAccessLogId: true,
  negadoNaoViraFrequencia: true,
  cardUsaCheckinComoFontePrincipal: true,
  accessLogsApenasFallback: true
}, null, 2));
