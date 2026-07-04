import {
  statusConsolidacaoTreino,
  iniciarCicloLimpo,
  painelConsolidadoAluno,
  relatorioConsolidado
} from "../modules/treinos-consolidacao/treinos-consolidacao.service.mjs";

const alunoId = process.argv[2] || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";

console.log(await statusConsolidacaoTreino());
console.log(await painelConsolidadoAluno(alunoId));
console.log(await iniciarCicloLimpo(alunoId, {
  nome: "Ciclo limpo principal",
  objetivo: "Hipertrofia",
  tipoDivisao: "ABC",
  duracaoDias: 45,
  limitePorBloco: 5,
  modalidade: "Musculação",
  usuario: "Teste 2.5-G"
}));
console.log(await painelConsolidadoAluno(alunoId));
console.log(await relatorioConsolidado());
