import {
  statusMotorTreinos,
  obterContextoTreinoAluno,
  gerarTreinoAutomatico,
  listarTreinosIntegrados
} from "../modules/treinos-integrado/treinos-integrado.service.mjs";

const alunoId = process.argv[2] || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";

console.log(await statusMotorTreinos());
console.log(await obterContextoTreinoAluno(alunoId));
console.log(await gerarTreinoAutomatico(alunoId, { objetivo: "Condicionamento físico", usuario: "Teste motor 2.5-A" }));
console.log(await listarTreinosIntegrados({ alunoId }));
