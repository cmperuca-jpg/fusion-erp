import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const BACKUP_DIR = path.join(ROOT, 'backups', `data-reset-${new Date().toISOString().replace(/[:.]/g, '-')}`);

const arquivosParaLimpar = {
  'alunos.json': [],
  'matriculas.json': [],
  'mensalidades.json': [],
  'financeiro.json': [],
  'recebimentos.json': [],
  'cobranca_log.json': [],
  'alunos_historico_planos.json': [],
  'avaliacoes.json': [],
  'treinos.json': [],
  'checkins.json': []
};

const arquivosObjetoParaResetar = {
  'caixa.json': { caixas: [], movimentos: [] }
};

async function existe(caminho) {
  try { await fs.access(caminho); return true; } catch { return false; }
}

async function copiarPasta(origem, destino) {
  await fs.mkdir(destino, { recursive: true });
  if (!(await existe(origem))) return;
  const itens = await fs.readdir(origem, { withFileTypes: true });
  for (const item of itens) {
    const origemItem = path.join(origem, item.name);
    const destinoItem = path.join(destino, item.name);
    if (item.isDirectory()) await copiarPasta(origemItem, destinoItem);
    else await fs.copyFile(origemItem, destinoItem);
  }
}

async function escreverJson(nome, conteudo) {
  const arquivo = path.join(DATA_DIR, nome);
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(conteudo, null, 2), 'utf8');
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await copiarPasta(DATA_DIR, BACKUP_DIR);

  for (const [nome, conteudo] of Object.entries(arquivosParaLimpar)) {
    await escreverJson(nome, conteudo);
  }

  for (const [nome, conteudo] of Object.entries(arquivosObjetoParaResetar)) {
    await escreverJson(nome, conteudo);
  }

  console.log('Reset concluído com segurança.');
  console.log(JSON.stringify({
    backupCriadoEm: BACKUP_DIR,
    arquivosZerados: [...Object.keys(arquivosParaLimpar), ...Object.keys(arquivosObjetoParaResetar)],
    preservados: ['planos.json', 'modalidades.json', 'professores.json', 'turmas.json', 'agenda.json', 'exercicios.json', 'taxas_cartao.json']
  }, null, 2));
}

main().catch((erro) => {
  console.error('Erro ao executar reset:', erro);
  process.exit(1);
});
