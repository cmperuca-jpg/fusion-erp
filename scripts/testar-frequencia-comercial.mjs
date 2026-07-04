import {
  statusFrequenciaComercial,
  listarAlunosDaTurma,
  registrar,
  resumo
} from "../modules/frequencia/frequencia.service.mjs";

const alunoId = process.argv[2] || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";
const turmaId = process.argv[3] || "101";

console.log(await statusFrequenciaComercial());
console.log(await listarAlunosDaTurma(turmaId));
console.log(await registrar({ alunoId, turmaId, status: "Presente", usuario: "Teste automático" }));
console.log(await resumo());
