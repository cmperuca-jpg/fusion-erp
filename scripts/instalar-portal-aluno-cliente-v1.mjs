import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const serverPath = path.join(ROOT, 'server.mjs');

async function existe(p){try{await fs.access(p);return true;}catch{return false;}}

async function patchServer(){
  if (!(await existe(serverPath))) {
    console.log('server.mjs não encontrado. Copie os arquivos e adicione manualmente a rota /api/portal-aluno.');
    return;
  }
  let txt = await fs.readFile(serverPath, 'utf8');
  if (!txt.includes("./modules/portal-aluno/portal.routes.mjs")) {
    const importLine = "import portalAlunoRoutes from './modules/portal-aluno/portal.routes.mjs';\n";
    const lastImport = [...txt.matchAll(/^import .+;\s*$/gm)].pop();
    if (lastImport) {
      const idx = lastImport.index + lastImport[0].length;
      txt = txt.slice(0, idx) + '\n' + importLine + txt.slice(idx);
    } else {
      txt = importLine + txt;
    }
  }
  if (!txt.includes("/api/portal-aluno")) {
    const routeLine = "app.use('/api/portal-aluno', portalAlunoRoutes);\n";
    const listen = txt.search(/\n\s*app\.listen\s*\(/);
    if (listen >= 0) txt = txt.slice(0, listen + 1) + routeLine + txt.slice(listen + 1);
    else txt += '\n' + routeLine;
  }
  await fs.writeFile(serverPath, txt, 'utf8');
  console.log('Rota /api/portal-aluno instalada no server.mjs.');
}

await patchServer();
console.log('Portal do aluno instalado. Acesse: http://localhost:3000/pages/portal-aluno/');
