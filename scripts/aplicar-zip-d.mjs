import { promises as fs } from 'fs';
import path from 'path';

const root = process.cwd();
const markerImport = "import matriculasRoutes from './routes/matriculas.routes.mjs';";
const markerUse = "app.use(matriculasRoutes);";

async function existe(p) { try { await fs.access(p); return true; } catch { return false; } }

async function patchServer() {
  const file = path.join(root, 'server.mjs');
  if (!(await existe(file))) return console.log('server.mjs não encontrado; aplique manualmente a rota de matrícula.');
  let txt = await fs.readFile(file, 'utf8');
  if (!txt.includes(markerImport)) {
    const imports = [...txt.matchAll(/^import .+$/gm)];
    const pos = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : 0;
    txt = txt.slice(0, pos) + `\n${markerImport}` + txt.slice(pos);
  }
  if (!txt.includes(markerUse)) {
    const m = txt.match(/app\.use\((express\.json\(|cors\(|[^\n]+)\);/);
    if (m) {
      const insertAt = m.index + m[0].length;
      txt = txt.slice(0, insertAt) + `\n${markerUse}` + txt.slice(insertAt);
    } else {
      txt += `\n${markerUse}\n`;
    }
  }
  await fs.writeFile(file, txt, 'utf8');
  console.log('server.mjs atualizado com rotas do ZIP D.');
}

async function patchAlunosHtml() {
  const candidates = [
    'public/pages/alunos/index.html',
    'public/alunos/index.html',
    'public/pages/alunos.html'
  ].map(p => path.join(root, p));
  for (const file of candidates) {
    if (!(await existe(file))) continue;
    let txt = await fs.readFile(file, 'utf8');
    const script = '<script src="/assets/js/alunos-matricula-integracao.js"></script>';
    if (!txt.includes(script)) {
      txt = txt.includes('</body>') ? txt.replace('</body>', `${script}\n</body>`) : `${txt}\n${script}\n`;
      await fs.writeFile(file, txt, 'utf8');
      console.log(`HTML de alunos atualizado: ${path.relative(root, file)}`);
    }
    return;
  }
  console.log('HTML de alunos não localizado; inclua manualmente /assets/js/alunos-matricula-integracao.js.');
}

await patchServer();
await patchAlunosHtml();
