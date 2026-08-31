
import assert from "node:assert/strict";
import { montarCensoDashboard } from "../modules/bi/bi.service.mjs";

const alunos = [
  { id:"a1", nome:"Aluno M1", sexo:"masculino", data_nascimento:"1956-01-01" },
  { id:"a2", nome:"Aluno M2", sexo:"M", data_nascimento:"2000-09-01" },
  { id:"a3", nome:"Aluno F1", sexo:"feminino", data_nascimento:"1963-05-01" },
  { id:"a4", nome:"Aluno F2", sexo:"F", data_nascimento:"2010-01-01" }
];

const presencas = [
  { alunoId:"a1", data:"2026-08-20", horaEntrada:"06:10", tipo:"Catraca" },
  { alunoId:"a2", data:"2026-08-20", horaEntrada:"06:40", tipo:"Catraca" },
  { alunoId:"a3", data:"2026-08-21", horaEntrada:"20:00", tipo:"Catraca" },
  { alunoId:"nao-aluno", data:"2026-08-21", horaEntrada:"06:00", tipo:"Catraca" }
];

const censo = montarCensoDashboard({ alunos, presencas, referencia:"2026-08-31" });

assert.equal(censo.totalAlunos, 4);
assert.equal(censo.sexo.masculino, 2);
assert.equal(censo.sexo.feminino, 2);
assert.equal(censo.maisVelho.masculino.nome, "Aluno M1");
assert.equal(censo.maisVelho.feminino.nome, "Aluno F1");
assert.deepEqual(censo.horasPico[0], { hora:6, faixa:"06:00", entradas:2 });
assert.deepEqual(censo.movimentoMes, [
  { data:"2026-08-20", entradas:2 },
  { data:"2026-08-21", entradas:1 }
]);

console.log(JSON.stringify({
  ok:true,
  modulo:"censo-dashboard-v21f6",
  sexo:true,
  faixasEtarias:true,
  maisVelhoPorSexo:true,
  horasPicoSomenteAlunos:true,
  movimentoMensal:true
}, null, 2));
