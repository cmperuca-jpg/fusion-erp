import { carregarBaseEditor } from "../modules/treinos-editor/treinos-editor.repository.mjs";
import {
  adicionarExercicio,
  atualizarExercicio,
  obterTreino,
  progressaoCarga,
  statusEditorTreinos
} from "../modules/treinos-editor/treinos-editor.service.mjs";

const base = await carregarBaseEditor();
const treino = base.treinos.find(t => t.status === "Ativo") || base.treinos[0];

console.log(await statusEditorTreinos());

if (!treino) {
  console.log({ ok: false, mensagem: "Nenhum treino integrado encontrado. Rode o montador 2.5-C primeiro." });
  process.exit(0);
}

console.log(await obterTreino(treino.id));
const add = await adicionarExercicio(treino.id, { nome: "Elevação lateral", grupoMuscular: "Ombros", series: 3, repeticoes: "12", descanso: "45s", usuario: "Teste editor 2.5-D" });
console.log(add);
const ex = add.exercicio;
console.log(await atualizarExercicio(treino.id, ex.id, { carga: "5 kg", usuario: "Teste editor 2.5-D" }));
console.log(await progressaoCarga(treino.id, ex.id, { incremento: 2, usuario: "Teste progressão" }));
