import {
  statusTreinoOperacional,
  portalTreinosAluno,
  painelProfessorTreinos,
  iniciarExecucaoTreino,
  atualizarExecucaoExercicio
} from "../modules/treinos-operacional/treinos-operacional.service.mjs";

const alunoId = process.argv[2] || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";
console.log(await statusTreinoOperacional());
const portal = await portalTreinosAluno(alunoId, { apenasAtivos: true });
console.log(portal);
console.log(await painelProfessorTreinos("Ana Paula", { apenasAtivos: true }));

const treino = portal.treinos?.[0];
if (treino) {
  const inicio = await iniciarExecucaoTreino(treino.id, { usuario: "Teste 2.5-E" });
  console.log(inicio);
  const ex = treino.exercicios?.[0];
  if (ex) console.log(await atualizarExecucaoExercicio(inicio.dados.id, ex.id, { concluido: true, carga: ex.carga || "", repeticoes: ex.repeticoes || "" }));
}
