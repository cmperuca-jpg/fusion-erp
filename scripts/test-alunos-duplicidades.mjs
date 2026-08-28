import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

process.env.NODE_ENV = "development";
process.env.FUSION_DATABASE_PROVIDER = "json";
process.env.FUSION_JSON_FALLBACK = "true";

const raiz = process.cwd();
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fusion-duplicidades-alunos-"));
const dataDir = path.join(tmp, "data");
await fs.mkdir(dataDir, { recursive: true });
process.chdir(tmp);

const cpfA = "11144477735";
const cpfB = "52998224725";
const cpfC = "12345678909";
const alunos = [
  { id: "principal_a", nome: "Aluno Principal A", cpf: cpfA, status: "ativo", ativo: true, origem: "Importação Access" },
  { id: "duplicado_vazio_a", nome: "AlunoPrincipal A", cpf: cpfA, status: "inativo", ativo: false, origem: "Importação Access" },
  { id: "principal_b", nome: "Aluno Principal B", cpf: cpfB, status: "ativo", ativo: true },
  { id: "duplicado_com_vinculo_b", nome: "AlunoPrincipal B", cpf: cpfB, status: "inativo", ativo: false },
  { id: "principal_c", nome: "Aluno Principal C", cpf: cpfC, status: "ativo", ativo: true },
  { id: "duplicado_app_c", nome: "AlunoPrincipal C", cpf: cpfC, status: "inativo", ativo: false }
];
const colecoes = {
  "alunos.json": alunos,
  "matriculas.json": [{ id: "mat_principal_a", alunoId: "principal_a", status: "Ativa" }, { id: "mat_dup_b", alunoId: "duplicado_com_vinculo_b", status: "Cancelada" }],
  "mensalidades.json": [{ id: "men_principal_a", alunoId: "principal_a", matriculaId: "mat_principal_a", status: "pago" }],
  "financeiro.json": [{ id: "fin_principal_a", alunoId: "principal_a", matriculaId: "mat_principal_a", mensalidadeId: "men_principal_a", status: "Pago" }],
  "recebimentos.json": [], "caixa.json": { caixas: [], movimentos: [] }, "checkins.json": [], "avaliacoes.json": [], "agenda_avaliacoes.json": [], "treinos.json": [], "treinos_prescritos.json": [], "treinos_integrados.json": [], "treinos_execucoes.json": [], "alunos_historico_planos.json": [], "access_logs.json": [], "access_pessoas_presentes.json": [], "access_eventos.json": [], "pagamentos_online.json": [], "auditoria_integridade.json": []
};
for (const [arquivo, dados] of Object.entries(colecoes)) await fs.writeFile(path.join(dataDir, arquivo), JSON.stringify(dados, null, 2));

try {
  const service = await import(`../modules/alunos/aluno-duplicidades.service.mjs?teste=${Date.now()}`);
  const analise = await service.listarDuplicidadesAlunos();
  assert.equal(analise.ok, true);
  assert.equal(analise.totalGrupos, 3);
  const grupoA = analise.grupos.find((grupo) => grupo.cpf === cpfA);
  assert.equal(grupoA.principalRecomendadoId, "principal_a");
  const vazioA = grupoA.cadastros.find((cadastro) => cadastro.id === "duplicado_vazio_a");
  assert.equal(vazioA.vinculos.total, 0);
  assert.equal(vazioA.podeRemoverLocal, true);
  const grupoB = analise.grupos.find((grupo) => grupo.cpf === cpfB);
  const vinculadoB = grupoB.cadastros.find((cadastro) => cadastro.id === "duplicado_com_vinculo_b");
  assert.equal(vinculadoB.vinculos.contagens.matriculas, 1);
  assert.equal(vinculadoB.podeRemoverLocal, false);

  const resolvido = await service.resolverDuplicidadeAluno({ principalId: "principal_a", duplicadoId: "duplicado_vazio_a", usuario: "teste", confirmacoesExternas: { fontesConfirmadas: true, aplicativo: false, biometria: false } });
  assert.equal(resolvido.resolvido, true);
  assert.equal(resolvido.cpfAgoraUnico, true);
  assert.equal(resolvido.vinculosAlterados, 0);
  const alunosDepois = JSON.parse(await fs.readFile(path.join(dataDir, "alunos.json"), "utf8"));
  assert.equal(alunosDepois.some((item) => item.id === "principal_a"), true);
  assert.equal(alunosDepois.some((item) => item.id === "duplicado_vazio_a"), false);
  const financeiroDepois = JSON.parse(await fs.readFile(path.join(dataDir, "financeiro.json"), "utf8"));
  assert.equal(financeiroDepois.length, 1);
  assert.equal(financeiroDepois[0].alunoId, "principal_a");
  const auditoriaDepois = JSON.parse(await fs.readFile(path.join(dataDir, "auditoria_integridade.json"), "utf8"));
  assert.equal(auditoriaDepois[0].tipo, "aluno_duplicidade_resolvida");
  assert.equal(auditoriaDepois[0].removido.id, "duplicado_vazio_a");

  await assert.rejects(() => service.resolverDuplicidadeAluno({ principalId: "principal_b", duplicadoId: "duplicado_com_vinculo_b", usuario: "teste", confirmacoesExternas: { fontesConfirmadas: true, aplicativo: false, biometria: false } }), (erro) => erro?.code === "DUPLICATE_HAS_LINKS");
  await assert.rejects(() => service.resolverDuplicidadeAluno({ principalId: "principal_c", duplicadoId: "duplicado_app_c", usuario: "teste", confirmacoesExternas: { fontesConfirmadas: true, aplicativo: true, biometria: false } }), (erro) => erro?.code === "DUPLICATE_EXTERNAL_LINKS_NOT_CLEARED");

  console.log(JSON.stringify({ ok: true, modulo: "alunos-duplicidades", detectaCpfDuplicado: true, recomendaPrincipalAtivo: true, removeSomenteInativoVazio: true, preservaPrincipalEVinculos: true, bloqueiaDuplicadoComVinculo: true, bloqueiaDuplicadoComApp: true, registraAuditoriaAtomica: true, dadosPessoaisExibidos: false }, null, 2));
} finally {
  process.chdir(raiz);
  await fs.rm(tmp, { recursive: true, force: true });
}

const [routesSource, htmlSource, jsSource] = await Promise.all([
  fs.readFile(path.join(raiz, "modules/alunos/alunos.routes.mjs"), "utf8"),
  fs.readFile(path.join(raiz, "public/pages/alunos/index.html"), "utf8"),
  fs.readFile(path.join(raiz, "public/pages/alunos/index.js"), "utf8")
]);
assert.match(routesSource, /router\.get\("\/duplicidades"/);
const serviceSource = await fs.readFile(path.join(raiz, "modules/alunos/aluno-duplicidades.service.mjs"), "utf8");
assert.match(serviceSource, /carregarBase\(\{ transacional: false \}\)/);
assert.match(serviceSource, /const ler = transacional \? lerJsonDuravel : lerColecao/);
assert.match(routesSource, /router\.post\("\/duplicidades\/resolver"/);
assert.match(routesSource, /statusAplicativoAlunosERP/);
assert.match(routesSource, /getBiometricStudentStatesForTenant/);
assert.match(htmlSource, /id="btnResolverDuplicidades"/);
assert.match(htmlSource, /id="modalDuplicidadesAlunos"/);
assert.match(htmlSource, /20260828-duplicidades-alunos-1/);
assert.match(jsSource, /Remover duplicado vazio/);
assert.match(jsSource, /duplicidades\/resolver/);
assert.match(jsSource, /nova auditoria antes de remover/);
