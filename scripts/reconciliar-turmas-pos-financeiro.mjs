import { executarComTenant } from "../modules/core/persistence/tenant-context.mjs";
import { lerJsonDuravel, salvarJsonMultiplosAtomico } from "../modules/core/persistence/durable-json.mjs";
import {
  idsTurmasRegistro,
  reconciliarTurmasMatriculaComAluno,
  recalcularOcupacaoTurmas
} from "../modules/financeiro/turmas-financeiro.service.mjs";

const tenant = String(process.env.FUSION_RECONCILIAR_TENANT || "").trim();
if (!tenant) throw new Error("Tenant nao informado.");

const txt = v => String(v ?? "").trim();
const norm = v => txt(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function ativa(m = {}) {
  return ["ativa","ativo","active","pendente","pending","trancada","trancado","suspensa","suspenso"]
    .includes(norm(m.status ?? m.situacao ?? m.statusMatricula));
}

await executarComTenant(tenant, async () => {
  const [alunosRaw, matriculasRaw, turmasRaw] = await Promise.all([
    lerJsonDuravel("alunos.json", []),
    lerJsonDuravel("matriculas.json", []),
    lerJsonDuravel("turmas.json", [])
  ]);

  const alunos = Array.isArray(alunosRaw) ? alunosRaw : [];
  const matriculas = Array.isArray(matriculasRaw) ? matriculasRaw : [];
  const turmas = Array.isArray(turmasRaw) ? turmasRaw : [];
  const idsTurmasValidas = new Set(
    turmas.map(t => txt(t.id ?? t.turmaId ?? t.turma_id ?? t.codigo)).filter(Boolean)
  );

  let matriculasCorrigidas = 0;
  let turmasAdicionadas = 0;

  for (const aluno of alunos) {
    const matriculaId = txt(aluno.matriculaId ?? aluno.matricula_id);
    if (!matriculaId) continue;

    const matricula = matriculas.find(m => txt(m.id ?? m.matriculaId) === matriculaId);
    if (!matricula || !ativa(matricula)) continue;

    const idsAluno = idsTurmasRegistro(aluno);
    if (![...idsAluno].every(id => idsTurmasValidas.has(id))) continue;

    const resultado = reconciliarTurmasMatriculaComAluno(aluno, matricula);
    if (resultado.alterado) {
      matriculasCorrigidas += 1;
      turmasAdicionadas += resultado.adicionadas;
    }
  }

  const ocupacao = recalcularOcupacaoTurmas(turmas, matriculas);

  if (matriculasCorrigidas || ocupacao.alteradas) {
    await salvarJsonMultiplosAtomico({
      "matriculas.json": matriculas,
      "turmas.json": turmas
    });
  }

  console.log(JSON.stringify({
    ok: true,
    matriculasCorrigidas,
    turmasAdicionadas,
    contadoresTurmasCorrigidos: ocupacao.alteradas,
    dadosPessoaisExibidos: false
  }, null, 2));
});
