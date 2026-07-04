import {
  statusBibliotecaExercicios,
  inicializarBiblioteca,
  listarExercicios,
  obterFiltros,
  sugerirExercicios
} from "../modules/exercicios-biblioteca/exercicios-biblioteca.service.mjs";

console.log(await statusBibliotecaExercicios());
console.log(await inicializarBiblioteca());
console.log(await listarExercicios({ grupoMuscular: "Peito" }));
console.log(await obterFiltros());
console.log(await sugerirExercicios({ objetivo: "Hipertrofia", nivel: "Iniciante", limite: 5 }));
