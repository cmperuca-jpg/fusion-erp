import {
  criarCicloTreino,
  obterEvolucaoAluno,
  processarVencimentos,
  relatorioEvolucaoGeral,
  statusCicloTreino
} from "../modules/treinos-ciclo/treinos-ciclo.service.mjs";

const alunoId = process.argv[2] || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";

console.log(await statusCicloTreino());
console.log(await obterEvolucaoAluno(alunoId));
console.log(await criarCicloTreino(alunoId, { nome: "Ciclo inicial", objetivo: "Hipertrofia", duracaoDias: 45, usuario: "Teste 2.5-F" }));
console.log(await processarVencimentos());
console.log(await relatorioEvolucaoGeral());
