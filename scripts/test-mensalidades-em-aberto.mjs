import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

process.env.NODE_ENV = "development";
process.env.FUSION_DATABASE_PROVIDER = "json";
process.env.FUSION_JSON_FALLBACK = "true";

const raizOriginal = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), "fusion-mensalidades-test-"));
const dataDir = path.join(temporario, "data");
await fs.mkdir(dataDir, { recursive: true });

function hojeISO() {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date()).reduce((acc, parte) => {
    if (parte.type !== "literal") acc[parte.type] = parte.value;
    return acc;
  }, {});
  return `${partes.year}-${partes.month}-${partes.day}`;
}

function deslocarDias(dataISO, dias) {
  const data = new Date(`${dataISO}T12:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

const hoje = hojeISO();
const competencia = hoje.slice(0, 7);
const ontem = deslocarDias(hoje, -1);
const amanha = deslocarDias(hoje, 1);

const alunos = ["aberto", "atrasado", "parcial", "pago", "cancelado", "programada"].map((id) => ({
  id: `aluno_${id}`,
  nome: `Aluno ${id}`
}));

const matriculas = alunos.map((aluno) => ({
  id: `mat_${aluno.id}`,
  alunoId: aluno.id,
  planoId: "plano_mensal",
  diaVencimento: 10
}));

await fs.writeFile(path.join(dataDir, "alunos.json"), JSON.stringify(alunos));
await fs.writeFile(path.join(dataDir, "matriculas.json"), JSON.stringify(matriculas));
await fs.writeFile(path.join(dataDir, "planos.json"), JSON.stringify([{ id: "plano_mensal", nome: "Plano Mensal", valorMensal: 65 }]));
await fs.writeFile(path.join(dataDir, "financeiro.json"), JSON.stringify([]));
await fs.writeFile(path.join(dataDir, "mensalidades.json"), JSON.stringify([
  { id: "men_aberto", alunoId: "aluno_aberto", matriculaId: "mat_aluno_aberto", planoId: "plano_mensal", competencia, vencimento: hoje, valor: 65, status: "aberto", origem: "mensalidades" },
  { id: "men_atrasado", alunoId: "aluno_atrasado", matriculaId: "mat_aluno_atrasado", planoId: "plano_mensal", competencia, vencimento: ontem, valor: 65, status: "aberto", origem: "mensalidades" },
  { id: "men_parcial", alunoId: "aluno_parcial", matriculaId: "mat_aluno_parcial", planoId: "plano_mensal", competencia, vencimento: ontem, valor: 65, status: "parcial", valorPago: 20, valorRestante: 45, origem: "mensalidades" },
  { id: "men_pago", alunoId: "aluno_pago", matriculaId: "mat_aluno_pago", planoId: "plano_mensal", competencia, vencimento: ontem, valor: 65, status: "pago", origem: "mensalidades" },
  { id: "men_cancelado", alunoId: "aluno_cancelado", matriculaId: "mat_aluno_cancelado", planoId: "plano_mensal", competencia, vencimento: ontem, valor: 65, status: "cancelado", origem: "mensalidades" },
  { id: "men_programada", alunoId: "aluno_programada", matriculaId: "mat_aluno_programada", planoId: "plano_mensal", competencia, vencimento: amanha, valor: 65, valorOriginal: 65, status: "programada", origem: "mensalidades" }
]));

process.chdir(temporario);

try {
  const service = await import(`../modules/financeiro/mensalidades.service.mjs?teste=${Date.now()}`);

  const emAberto = await service.listarMensalidades({ status: "em_aberto", competencia });
  assert.deepEqual(emAberto.map((item) => item.status).sort(), ["aberto", "atrasado", "parcial"]);

  const abertasAlias = await service.listarMensalidades({ status: "abertas", competencia });
  assert.equal(abertasAlias.length, 3);

  const abertoNoPrazo = await service.listarMensalidades({ status: "aberto", competencia });
  assert.deepEqual(abertoNoPrazo.map((item) => item.id), ["men_aberto"]);

  const resumo = await service.resumoMensalidades({ status: "em_aberto", competencia });
  assert.equal(resumo.total, 3);
  assert.equal(resumo.abertas, 1);
  assert.equal(resumo.atrasadas, 1);
  assert.equal(resumo.parciais, 1);
  assert.equal(resumo.recorrentesAbertas, 3);

  const editada = await service.atualizarMensalidade("men_programada", {
    alunoId: "aluno_programada",
    vencimento: amanha,
    valor: 1
  });

  assert.equal(editada.valor, 1);
  assert.equal(editada.valorOriginal, 1);

  const programadas = await service.listarMensalidades({
    status: "programada"
  });
  const programadaEditada = programadas.find(
    (item) => item.id === "men_programada"
  );
  assert.equal(programadaEditada.valorBase, 1);
  assert.equal(programadaEditada.valorAtualizado, 1);

  const financeiroDepois = JSON.parse(
    await fs.readFile(path.join(dataDir, "financeiro.json"), "utf8")
  );
  const tituloEditado = financeiroDepois.find(
    (item) => item.mensalidadeId === "men_programada"
  );
  assert.equal(tituloEditado.valor, 1);
  assert.equal(tituloEditado.valorBruto, 1);

  console.log(JSON.stringify({ ok: true, totalEmAberto: resumo.total, recorrentesAbertas: resumo.recorrentesAbertas }, null, 2));
} finally {
  process.chdir(raizOriginal);
  await fs.rm(temporario, { recursive: true, force: true });
}
