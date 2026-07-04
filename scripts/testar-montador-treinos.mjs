import {
  statusMontadorTreinos,
  obterModelosDivisao,
  simularMontagem,
  montarTreino
} from "../modules/treinos-montador/treinos-montador.service.mjs";

const alunoId = process.argv[2] || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";

console.log(await statusMontadorTreinos());
console.log(await obterModelosDivisao());
console.log(await simularMontagem(alunoId, { objetivo: "Hipertrofia", tipoDivisao: "ABC", limitePorBloco: 4 }));
console.log(await montarTreino(alunoId, { objetivo: "Hipertrofia", tipoDivisao: "ABC", limitePorBloco: 4, arquivarAnteriores: false, usuario: "Teste montador 2.5-C" }));
