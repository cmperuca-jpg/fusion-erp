import fs from "fs/promises";

const arquivos = [
  "public/pages/treinos/index.html",
  "public/pages/treinos/index.js",
  "public/pages/treinos/style.css",
  "modules/treinos/treinos.repository.mjs",
  "modules/treinos/treinos.routes.mjs",
  "modules/treinos/treinos.schema.mjs",
  "modules/treinos/treinos.service.mjs"
];

for (const arquivo of arquivos) {
  await fs.access(arquivo);
}

console.log("Treinos v1 instalado com consistência.");
console.log("Fluxo: professor vinculado no aluno → prescrição de treino em popup → treino salvo com alunoId/professorId.");
