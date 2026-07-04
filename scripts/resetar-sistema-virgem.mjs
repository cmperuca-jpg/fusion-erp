import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const LOGS = path.join(ROOT, "logs");
const BACKUPS = path.join(ROOT, "backups");

const limparArrays = [
  "agenda.json",
  "agenda_operacional.json",
  "alunos.json",
  "alunos_historico_planos.json",
  "auditoria_integridade.json",
  "avaliacoes.json",
  "caixa.json",
  "checkin.json",
  "checkins.json",
  "cobranca_log.json",
  "crm.json",
  "exercicios.json",
  "financeiro.json",
  "frequencia.json",
  "leads.json",
  "matriculas.json",
  "mensalidades.json",
  "modalidades.json",
  "modelos-treino.json",
  "pagamentos.json",
  "presencas.json",
  "professores.json",
  "recebimentos.json",
  "relatorios.json",
  "treinos.json",
  "treinos_ciclos.json",
  "treinos_execucoes.json",
  "treinos_integrados.json",
  "turmas.json"
];

const limparObjetos = {
  "caixa.json": { caixas: [], movimentos: [] },
  "db.json": {}
};

const preservar = new Set([
  "usuarios.json",
  "auth.json",
  "configuracoes.json",
  "permissoes.json",
  "taxas_cartao.json"
]);

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function existe(p) {
  try { await fs.access(p); return true; }
  catch { return false; }
}

async function copiarDir(src, dest) {
  if (!(await existe(src))) return;
  await fs.mkdir(dest, { recursive: true });
  const itens = await fs.readdir(src, { withFileTypes: true });
  for (const item of itens) {
    const s = path.join(src, item.name);
    const d = path.join(dest, item.name);
    if (item.isDirectory()) await copiarDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function salvarJson(file, conteudo) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(conteudo, null, 2), "utf8");
}

async function main() {
  await fs.mkdir(DATA, { recursive: true });
  await fs.mkdir(LOGS, { recursive: true });
  await fs.mkdir(BACKUPS, { recursive: true });

  const backupDir = path.join(BACKUPS, `piloto-reset-${stamp()}`);
  await copiarDir(DATA, path.join(backupDir, "data"));
  await copiarDir(LOGS, path.join(backupDir, "logs"));

  const alterados = [];

  for (const nome of limparArrays) {
    if (preservar.has(nome)) continue;
    const file = path.join(DATA, nome);
    const conteudo = limparObjetos[nome] ?? [];
    await salvarJson(file, conteudo);
    alterados.push(nome);
  }

  for (const [nome, conteudo] of Object.entries(limparObjetos)) {
    if (preservar.has(nome)) continue;
    const file = path.join(DATA, nome);
    await salvarJson(file, conteudo);
    if (!alterados.includes(nome)) alterados.push(nome);
  }

  const relatorio = {
    ok: true,
    versao: "2.6.1-piloto",
    operacao: "reset_sistema_virgem_para_piloto",
    data: new Date().toISOString(),
    backup: backupDir,
    arquivosLimpos: alterados,
    preservados: [...preservar],
    observacao: "Reset limpa dados operacionais e preserva arquivos de configuração/acesso quando existirem."
  };

  await salvarJson(path.join(LOGS, "reset-sistema-virgem-piloto.json"), relatorio);

  console.log("Fusion ERP — Reset Virgem para Piloto");
  console.log(`Backup criado em: ${backupDir}`);
  console.log(`Arquivos limpos: ${alterados.length}`);
  console.log("Relatório: logs/reset-sistema-virgem-piloto.json");
}

main().catch((erro) => {
  console.error("Falha no reset:", erro.message);
  process.exit(1);
});
