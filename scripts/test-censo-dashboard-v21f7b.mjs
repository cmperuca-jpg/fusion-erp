import assert from "node:assert/strict";
import { montarCensoDashboard } from "../modules/bi/bi.service.mjs";

const alunos = [
  { id:"a1", nome:"M Ativo", sexo:"masculino", status:"Ativo", ativo:true, data_nascimento:"2001-02-01" },
  { id:"a2", nome:"M Inativo", sexo:"masculino", status:"Inativo", ativo:false, data_nascimento:"2002-02-01" },
  { id:"a3", nome:"F Ativa", sexo:"feminino", status:"Ativa", ativo:true, data_nascimento:"1995-02-01" },
  { id:"a4", nome:"F Bloqueada", sexo:"feminino", status:"Bloqueada", bloqueado:true, data_nascimento:"1996-02-01" }
];

const presencas = [
  { alunoId:"a1", data:"2026-08-20", horaEntrada:"06:10", tipo:"Catraca" },
  { alunoId:"a2", data:"2026-08-20", horaEntrada:"06:40", tipo:"Catraca" },
  { alunoId:"a3", data:"2026-08-21", horaEntrada:"08:00", tipo:"Catraca" },
  { alunoId:"a4", data:"2026-08-21", horaEntrada:"08:30", tipo:"Catraca" }
];

const censo = montarCensoDashboard({ alunos, presencas, referencia:"2026-08-31" });

assert.deepEqual(censo.situacao, { ativo:2, inativo:2 });
assert.deepEqual(censo.statusPorSexo.masculino, { ativo:1, inativo:1 });
assert.deepEqual(censo.statusPorSexo.feminino, { ativo:1, inativo:1 });

const faixa20 = censo.faixasEtarias.find(x => x.inicio === 20);
assert.equal(faixa20.total, 2);
assert.equal(faixa20.ativos, 1);
assert.equal(faixa20.inativos, 1);

assert.deepEqual(censo.horasPico[0], {
  hora:6, faixa:"06:00", entradas:2
});
assert.deepEqual(censo.horasPico[1], {
  hora:8, faixa:"08:00", entradas:2
});
assert.deepEqual(censo.horasPicoStatus[0], {
  hora:6, faixa:"06:00", entradas:2, ativos:1, inativos:1
});
assert.deepEqual(censo.horasPicoStatus[1], {
  hora:8, faixa:"08:00", entradas:2, ativos:1, inativos:1
});

console.log(JSON.stringify({
  ok:true,
  modulo:"censo-dashboard-v21f7b",
  ativosInativos:true,
  sexoPorStatus:true,
  faixasPorStatus:true,
  horasPicoPorStatusAtual:true
}, null, 2));
