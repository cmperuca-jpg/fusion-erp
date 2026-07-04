import fs from "node:fs/promises";
import path from "node:path";

const SERVER = path.resolve(process.cwd(), "server.mjs");

async function main() {
  let txt = await fs.readFile(SERVER, "utf8");

  const importLine = 'import portalAlunoOperacionalRoutes from "./modules/portal-aluno-operacional/portal-aluno-operacional.routes.mjs";';
  if (!txt.includes(importLine)) {
    const marker = "import portalAlunoRoutes from './modules/portal-aluno/portal.routes.mjs';";
    txt = txt.includes(marker) ? txt.replace(marker, `${marker}\n${importLine}`) : `${importLine}\n${txt}`;
  }

  const useLine = 'app.use("/api/portal-aluno-operacional", portalAlunoOperacionalRoutes);';
  if (!txt.includes(useLine)) {
    const marker = "app.use('/api/portal-aluno', portalAlunoRoutes);";
    if (txt.includes(marker)) txt = txt.replace(marker, `${marker}\n${useLine}`);
    else txt = txt.replace("const PORT = process.env.PORT || 3000;", `${useLine}\n\nconst PORT = process.env.PORT || 3000;`);
  }

  await fs.writeFile(SERVER, txt, "utf8");
  console.log("Fusion ERP 2.4 instalado. Rota ativa: /api/portal-aluno-operacional");
  console.log("Tela: /pages/portal-aluno-operacional/index.html");
}

main().catch((err) => { console.error(err); process.exit(1); });
