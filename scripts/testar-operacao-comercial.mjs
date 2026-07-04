import { obterOperacaoAluno, listarAlunosDaTurma, statusOperacao } from "../modules/operacao/operacao.service.mjs";

const alunoId = process.argv[2] || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";
const turmaId = process.argv[3] || "101";

console.log(await statusOperacao());
console.log(await obterOperacaoAluno(alunoId, { turmaId }));
console.log(await listarAlunosDaTurma(turmaId));
