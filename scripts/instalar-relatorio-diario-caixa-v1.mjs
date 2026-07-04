import fs from 'node:fs/promises';
import path from 'node:path';

const serverPath = path.resolve(process.cwd(), 'server.mjs');
let txt = await fs.readFile(serverPath, 'utf8');
let alterado = false;

const importLine = 'import relatoriosFinanceirosRoutes from "./modules/financeiro/relatorios.routes.mjs";';
if (!txt.includes(importLine)) {
  const alvo = 'import financeiroRoutes from "./modules/financeiro/financeiro.routes.mjs";';
  if (txt.includes(alvo)) {
    txt = txt.replace(alvo, `${alvo}\n${importLine}`);
    alterado = true;
  } else {
    throw new Error('Não encontrei a importação de financeiroRoutes no server.mjs. Faça a importação manualmente.');
  }
}

const useLine = 'app.use("/api/financeiro/relatorios", relatoriosFinanceirosRoutes);';
if (!txt.includes(useLine)) {
  const alvo = 'app.use("/api/financeiro", financeiroRoutes);';
  if (txt.includes(alvo)) {
    txt = txt.replace(alvo, `${useLine}\n${alvo}`);
    alterado = true;
  } else {
    throw new Error('Não encontrei app.use("/api/financeiro", financeiroRoutes) no server.mjs. Faça o app.use manualmente.');
  }
}

if (alterado) {
  const backup = path.resolve(process.cwd(), `server.mjs.backup-relatorio-${Date.now()}`);
  await fs.copyFile(serverPath, backup);
  await fs.writeFile(serverPath, txt, 'utf8');
  console.log('Relatório diário instalado no server.mjs. Backup:', backup);
} else {
  console.log('Relatório diário já estava instalado no server.mjs.');
}
