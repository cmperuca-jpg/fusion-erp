import {
  statusAgendaOperacional,
  listarAgendaPorTurmas,
  listarAgendaPorProfessores,
  obterAgendaAluno,
  resumoAgendaOperacional
} from "../modules/agenda-operacional/agenda-operacional.service.mjs";

const alunoId = process.argv[2] || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";

console.log(await statusAgendaOperacional());
console.log(await resumoAgendaOperacional());
console.log(await listarAgendaPorTurmas({ apenasHoje: "true" }));
console.log(await listarAgendaPorProfessores({ apenasHoje: "true" }));
console.log(await obterAgendaAluno(alunoId));
