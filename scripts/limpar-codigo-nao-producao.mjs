import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const archiveRoot = path.join(ROOT, `_arquivados_fora_producao_${stamp}`);

const itensParaArquivar = [
  'backup_layout_global_componentizado_2026-07-02T02-37-13-954Z',
  'backups',
  path.join('data', 'backups'),
  'data - Copia',
  'backend',
  'frontend',
  'routes',
  'fusion_reset_base_teste_v1.zip',
  'server.zip',
  'server.mjs.backup-relatorio-1782939417088',
  'AJUSTE_SERVER_SE_NECESSARIO.txt',
  'INSTRUCOES_RESET_BASE_TESTE.txt',
  'LEIA-ME-ETAPA1.txt',
  'LEIA-ME_LAYOUT_UNICO_V3.txt',
  'LEIA-ME_LAYOUT_UNICO_V4.txt',
  'LEIA_CORRECOES_PRIMARIAS.txt',
  'README.txt',
  'README_LAYOUT_GLOBAL.txt',
  'README_LAYOUT_LOGIN_PUBLICO_V1.txt',
  'README_MENU_V3.txt',
  'README_MENU_V4.txt'
];

const padroesArquivosSoltos = [
  /^public\/assets\/css\/fusion-app\.css\.bak/i,
  /^public\/assets\/js\/fusion-layout\.js\.bak/i,
  /\.bak($|[-_.])/i,
  /\.backup($|[-_.])/i
];

async function existe(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function listarArquivos(dir) {
  const out = [];
  async function walk(atual) {
    if (!(await existe(atual))) return;
    const entries = await fs.readdir(atual, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(atual, e.name);
      const rel = path.relative(ROOT, p).replace(/\\/g, '/');
      if (rel.startsWith('node_modules/')) continue;
      if (rel.startsWith('_arquivados_fora_producao_')) continue;
      if (e.isDirectory()) await walk(p);
      else out.push(rel);
    }
  }
  await walk(dir);
  return out;
}

async function moverRel(rel) {
  const origem = path.join(ROOT, rel);
  if (!(await existe(origem))) return null;
  const destino = path.join(archiveRoot, rel);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.rename(origem, destino);
  return rel;
}

async function main() {
  if (!(await existe(path.join(ROOT, 'server.mjs'))) || !(await existe(path.join(ROOT, 'package.json')))) {
    console.error('Execute este script na raiz do projeto Fusion ERP, onde existem server.mjs e package.json.');
    process.exit(1);
  }

  const antes = await listarArquivos(ROOT);
  await fs.mkdir(archiveRoot, { recursive: true });
  const movidos = [];

  for (const rel of itensParaArquivar) {
    const moved = await moverRel(rel);
    if (moved) movidos.push(moved);
  }

  const restantes = await listarArquivos(ROOT);
  for (const rel of restantes) {
    if (padroesArquivosSoltos.some((rx) => rx.test(rel))) {
      const moved = await moverRel(rel);
      if (moved) movidos.push(moved);
    }
  }

  const depois = await listarArquivos(ROOT);
  const report = {
    ok: true,
    criadoEm: new Date().toISOString(),
    raizProjeto: ROOT,
    pastaArquivada: path.basename(archiveRoot),
    arquivosAntes: antes.length,
    arquivosDepois: depois.length,
    itensMovidos: movidos.sort()
  };

  await fs.mkdir(path.join(ROOT, 'docs'), { recursive: true });
  await fs.writeFile(
    path.join(ROOT, 'docs', `relatorio-limpeza-producao-${stamp}.json`),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  console.log('Limpeza concluída.');
  console.log(`Itens arquivados: ${movidos.length}`);
  console.log(`Pasta de segurança: ${path.basename(archiveRoot)}`);
  console.log(`Arquivos antes: ${antes.length}`);
  console.log(`Arquivos depois: ${depois.length}`);
  console.log('Nada foi apagado permanentemente; o código não produtivo foi movido para a pasta de segurança.');
}

main().catch((err) => {
  console.error('Falha na limpeza:', err);
  process.exit(1);
});
