import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");

async function lerJson(nome, padrao) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, nome), "utf8");
    if (!raw.trim()) return padrao;
    return JSON.parse(raw);
  } catch {
    return padrao;
  }
}

function id(v) { return String(v || ""); }
function st(v) { return String(v || "").trim().toLowerCase(); }
function ativoAluno(a = {}) { return !["inativo", "excluido", "excluído", "cancelado"].includes(st(a.status)); }
function cancelado(s) { return ["cancelado", "cancelada", "estornado", "estornada"].includes(st(s)); }
function pago(s) { return ["pago", "recebido", "quitado", "baixado"].includes(st(s)); }

const [alunos, matriculas, mensalidades, financeiro, recebimentos, caixa] = await Promise.all([
  lerJson("alunos.json", []),
  lerJson("matriculas.json", []),
  lerJson("mensalidades.json", []),
  lerJson("financeiro.json", []),
  lerJson("recebimentos.json", []),
  lerJson("caixa.json", { caixas: [], movimentos: [] })
]);

const alunosIds = new Set((Array.isArray(alunos) ? alunos : []).map(a => id(a.id)).filter(Boolean));
const alunosAtivosIds = new Set((Array.isArray(alunos) ? alunos : []).filter(ativoAluno).map(a => id(a.id)).filter(Boolean));
const matriculasIds = new Set((Array.isArray(matriculas) ? matriculas : []).map(m => id(m.id)).filter(Boolean));
const mensalidadesIds = new Set((Array.isArray(mensalidades) ? mensalidades : []).map(m => id(m.id)).filter(Boolean));
const financeiroIds = new Set((Array.isArray(financeiro) ? financeiro : []).map(f => id(f.id)).filter(Boolean));

const relatorio = {
  totais: {
    alunos: alunos.length,
    alunosAtivos: alunosAtivosIds.size,
    matriculas: matriculas.length,
    mensalidades: mensalidades.length,
    financeiro: financeiro.length,
    recebimentos: recebimentos.length,
    movimentosCaixa: Array.isArray(caixa?.movimentos) ? caixa.movimentos.length : 0
  },
  problemas: {
    mensalidadesSemAluno: [],
    mensalidadesDeAlunoInativoAbertas: [],
    mensalidadesSemMatricula: [],
    financeiroSemAluno: [],
    financeiroDeAlunoInativoAberto: [],
    financeiroSemMensalidade: [],
    recebimentosSemAluno: [],
    duplicidadeMensalidadeCompetencia: []
  }
};

for (const m of mensalidades) {
  const alunoId = id(m.alunoId);
  if (alunoId && !alunosIds.has(alunoId)) relatorio.problemas.mensalidadesSemAluno.push({ id: m.id, alunoId, competencia: m.competencia, status: m.status });
  if (alunoId && !alunosAtivosIds.has(alunoId) && !cancelado(m.status) && !pago(m.status)) relatorio.problemas.mensalidadesDeAlunoInativoAbertas.push({ id: m.id, alunoId, competencia: m.competencia, status: m.status });
  if (m.matriculaId && !matriculasIds.has(id(m.matriculaId))) relatorio.problemas.mensalidadesSemMatricula.push({ id: m.id, matriculaId: m.matriculaId, competencia: m.competencia });
}

for (const f of financeiro) {
  const alunoId = id(f.alunoId);
  if (alunoId && !alunosIds.has(alunoId)) relatorio.problemas.financeiroSemAluno.push({ id: f.id, alunoId, descricao: f.descricao, status: f.status });
  if (alunoId && !alunosAtivosIds.has(alunoId) && !cancelado(f.status) && !pago(f.status)) relatorio.problemas.financeiroDeAlunoInativoAberto.push({ id: f.id, alunoId, descricao: f.descricao, status: f.status });
  if (f.mensalidadeId && !mensalidadesIds.has(id(f.mensalidadeId))) relatorio.problemas.financeiroSemMensalidade.push({ id: f.id, mensalidadeId: f.mensalidadeId, status: f.status });
}

for (const r of recebimentos) {
  const alunoId = id(r.alunoId);
  if (alunoId && !alunosIds.has(alunoId)) relatorio.problemas.recebimentosSemAluno.push({ id: r.id, alunoId, status: r.status });
}

const porAlunoCompetencia = new Map();
for (const m of mensalidades) {
  if (!m.alunoId || !m.competencia || cancelado(m.status)) continue;
  const chave = `${m.alunoId}::${m.competencia}`;
  const lista = porAlunoCompetencia.get(chave) || [];
  lista.push(m);
  porAlunoCompetencia.set(chave, lista);
}
for (const [chave, lista] of porAlunoCompetencia) {
  if (lista.length > 1) {
    const [alunoId, competencia] = chave.split("::");
    relatorio.problemas.duplicidadeMensalidadeCompetencia.push({ alunoId, competencia, ids: lista.map(m => m.id), status: lista.map(m => m.status) });
  }
}

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.writeFile(path.join(DATA_DIR, "auditoria_integridade_ultimo_relatorio.json"), JSON.stringify(relatorio, null, 2), "utf8");

console.log("Auditoria de integridade concluída:");
console.log(JSON.stringify(relatorio, null, 2));
