import {
  statusPainelProfessor,
  listarProfessoresPainel,
  obterPainelProfessor,
  registrarPresencaProfessor
} from "../modules/professor-painel/professor-painel.service.mjs";

const professor = process.argv[2] || "Carlos Henrique";
const alunoId = process.argv[3] || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";
const turmaId = process.argv[4] || "101";

console.log(await statusPainelProfessor());
console.log(await listarProfessoresPainel());
console.log(await obterPainelProfessor(professor, { apenasHoje: "true" }));
console.log(await registrarPresencaProfessor(professor, { alunoId, turmaId, status: "Presente", usuario: "Teste painel professor" }));
