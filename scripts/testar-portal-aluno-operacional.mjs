import {
  obterAgendaAluno,
  obterFinanceiroAluno,
  obterPortalAluno,
  statusPortalAlunoOperacional
} from "../modules/portal-aluno-operacional/portal-aluno-operacional.service.mjs";

const alunoId = process.argv[2] || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";

console.log(await statusPortalAlunoOperacional());
console.log(await obterPortalAluno(alunoId));
console.log(await obterAgendaAluno(alunoId));
console.log(await obterFinanceiroAluno(alunoId));
