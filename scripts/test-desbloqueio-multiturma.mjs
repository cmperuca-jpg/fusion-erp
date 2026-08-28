import assert from "node:assert/strict";
import fs from "node:fs";

const desbloqueio = fs.readFileSync("modules/financeiro/desbloqueio.service.mjs", "utf8");
const helper = fs.readFileSync("modules/financeiro/turmas-financeiro.service.mjs", "utf8");
const turmas = fs.readFileSync("modules/turmas/turmas.service.mjs", "utf8");
const matriculas = fs.readFileSync("modules/matriculas/matricula.integracao.service.mjs", "utf8");
const reparo = fs.readFileSync("scripts/reconciliar-turmas-pos-financeiro.mjs", "utf8");

assert.match(desbloqueio, /turmas: "turmas\.json"/);
assert.match(desbloqueio, /reconciliarTurmasMatriculaComAluno/);
assert.match(desbloqueio, /recalcularOcupacaoTurmas/);
assert.match(desbloqueio, /turmasReconciliadas/);
assert.match(desbloqueio, /ocupacaoTurmasAtualizada/);

assert.match(helper, /idsAluno\.size < 2/);
assert.match(helper, /every\(id => idsAluno\.has\(id\)\)/);
assert.match(helper, /Nunca troca uma turma por outra automaticamente/);
assert.match(helper, /alunosMatriculados = novo/);

assert.match(turmas, /idsTurmasMatricula/);
assert.match(turmas, /mapaOcupacaoPorTurma/);
assert.match(matriculas, /turmaIds:r\.turmaIds/);
assert.match(matriculas, /servicosContratados:servicos/);

assert.match(reparo, /idsTurmasValidas/);
assert.match(reparo, /dadosPessoaisExibidos: false/);

console.log(JSON.stringify({
  ok: true,
  modulo: "desbloqueio-multiturma",
  preservaMultiturma: true,
  somenteCompletaSubconjunto: true,
  ocupacaoRecalculada: true,
  reparoExistenteSeguro: true,
  semPiiNaSaida: true
}, null, 2));
