import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'public/assets/js/fusion-professor-obrigatorio.js');
const pages = [
  'public/pages/alunos/index.html',
  'public/pages/avaliacoes/index.html',
  'public/pages/avaliacoes/index.html',
  'public/pages/treinos/index.html'
];

async function exists(p){ try{ await fs.access(p); return true; } catch { return false; } }
async function inject(page){
  const file = path.join(ROOT, page);
  if (!(await exists(file))) return false;
  let html = await fs.readFile(file, 'utf8');
  if (html.includes('/assets/js/fusion-professor-obrigatorio.js')) return false;
  const tag = '  <script src="/assets/js/fusion-professor-obrigatorio.js"></script>\n';
  if (html.includes('</body>')) html = html.replace('</body>', `${tag}</body>`);
  else html += `\n${tag}`;
  await fs.writeFile(file, html, 'utf8');
  return true;
}
async function patchSchema(fileRel){
  const file = path.join(ROOT, fileRel);
  if (!(await exists(file))) return false;
  let txt = await fs.readFile(file, 'utf8');
  if (txt.includes('professorId:') || !txt.includes('z.object({')) return false;
  txt = txt.replace('z.object({', 'z.object({\n  professorId: z.string().optional().or(z.literal("")),\n  professorNome: z.string().optional().or(z.literal("")),');
  await fs.writeFile(file, txt, 'utf8');
  return true;
}
async function main(){
  await fs.mkdir(path.dirname(SRC), { recursive: true });
  // arquivo já vem no ZIP; nada a copiar aqui se já estiver no local.
  const resultados = [];
  for (const p of [...new Set(pages)]) resultados.push([p, await inject(p)]);
  const schemas = [
    'modules/alunos/alunos.schema.mjs',
    'modules/avaliacoes/avaliacoes.schema.mjs',
    'modules/treinos/treinos.schema.mjs'
  ];
  const schemaRes = [];
  for (const s of schemas) schemaRes.push([s, await patchSchema(s)]);
  console.log('Instalação professor obrigatório concluída.');
  console.log({ paginas: resultados, schemas: schemaRes });
}
main().catch(err => { console.error(err); process.exit(1); });
