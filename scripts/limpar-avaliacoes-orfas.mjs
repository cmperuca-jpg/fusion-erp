import { lerJsonDuravel, salvarJsonDuravel } from "../modules/core/persistence/durable-json.mjs";

function idAluno(item = {}) {
  return String(item.id ?? item._id ?? item.alunoId ?? item.aluno_id ?? "").trim();
}

function alunoDaAvaliacao(item = {}) {
  return String(item.alunoId ?? item.aluno_id ?? item.idAluno ?? "").trim();
}

const alunos = await lerJsonDuravel("alunos.json", []);
const avaliacoes = await lerJsonDuravel("avaliacoes.json", []);

const listaAlunos = Array.isArray(alunos) ? alunos : [];
const listaAvaliacoes = Array.isArray(avaliacoes) ? avaliacoes : [];

const idsValidos = new Set(listaAlunos.map(idAluno).filter(Boolean));
const validas = listaAvaliacoes.filter(item => {
  const id = alunoDaAvaliacao(item);
  return id && idsValidos.has(id);
});
const orfas = listaAvaliacoes.filter(item => !validas.includes(item));

await salvarJsonDuravel("avaliacoes.json", validas);

console.log(JSON.stringify({
  ok: true,
  alunos: listaAlunos.length,
  avaliacoesAntes: listaAvaliacoes.length,
  avaliacoesOrfasRemovidas: orfas.length,
  avaliacoesDepois: validas.length
}, null, 2));
