import assert from "node:assert/strict";
import {
  alunoAtivoNavegacao,
  filtrarAlunosNavegacao,
  destinoNavegacao,
  resumirIndicadoresRapidos
} from "../public/pages/alunos/prontuario-navegacao-status-v21g3c.mjs";

const alunos = [
  { id:"i2", nome:"Bruno Inativo", status:"Inativo", ativo:false },
  { id:"a2", nome:"Carlos Ativo", status:"Ativo", ativo:true },
  { id:"i1", nome:"Ana Inativa", status:"Cancelada" },
  { id:"a1", nome:"Alice Ativa", status:"Ativa" },
  { id:"b1", nome:"Bloqueio Financeiro", status:"Ativo", ativo:true, bloqueado:true }
];

assert.equal(alunoAtivoNavegacao(alunos[0]), false);
assert.equal(alunoAtivoNavegacao(alunos[1]), true);
assert.equal(
  alunoAtivoNavegacao(alunos[4]),
  true,
  "bloqueio financeiro não deve transformar aluno ativo em inativo"
);

assert.deepEqual(
  filtrarAlunosNavegacao(alunos, "ativos").map(x => x.id),
  ["a1","b1","a2"]
);

assert.deepEqual(
  filtrarAlunosNavegacao(alunos, "inativos").map(x => x.id),
  ["i1","i2"]
);

assert.deepEqual(
  filtrarAlunosNavegacao(alunos, "todos").map(x => x.id),
  ["a1","b1","a2","i1","i2"]
);

assert.equal(destinoNavegacao(alunos, "a1", "ativos", 1)?.id, "b1");
assert.equal(destinoNavegacao(alunos, "a1", "ativos", -1)?.id, "a2");

// Atual inativo + filtro padrão ativos: entra imediatamente na lista de ativos.
assert.equal(destinoNavegacao(alunos, "i1", "ativos", 1)?.id, "a1");
assert.equal(destinoNavegacao(alunos, "i1", "ativos", -1)?.id, "a2");

assert.equal(destinoNavegacao(alunos, "i1", "inativos", 1)?.id, "i2");
assert.equal(destinoNavegacao(alunos, "i1", "todos", -1)?.id, "a2");

const indicadoresRapidos = resumirIndicadoresRapidos({
  alunoId:"a1",
  indicadores:{
    indicadores:{
      a1:{
        treino:true,
        avaliacao:false,
        aplicativo:true,
        biometria:true
      }
    }
  }
});
assert.deepEqual(indicadoresRapidos, {
  treino:true,
  avaliacao:false,
  app:true,
  biometria:true
});

const indisponivel = resumirIndicadoresRapidos({
  alunoId:"a1",
  indicadores:{ indicadores:{ a1:{ treino:null, avaliacao:null, aplicativo:null, biometria:null } } }
});
assert.deepEqual(indisponivel, {
  treino:null,
  avaliacao:null,
  app:null,
  biometria:null
});

console.log(JSON.stringify({
  ok:true,
  modulo:"prontuario-navegacao-status-v21g3c",
  padraoAtivos:true,
  filtroAtivos:true,
  filtroInativos:true,
  bloqueioFinanceiroPermaneceAtivo:true,
  filtroTodos:true,
  ativosPrimeiroEmTodos:true,
  proximoAnterior:true,
  atualForaDoFiltro:true,
  painelTreino:true,
  painelAvaliacao:true,
  painelApp:true,
  painelBiometria:true
}, null, 2));
