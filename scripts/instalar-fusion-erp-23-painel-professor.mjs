import fs from "node:fs/promises";
import path from "node:path";
const SERVER = path.resolve(process.cwd(), "server.mjs");

async function main() {
  let txt = await fs.readFile(SERVER, "utf8");
  const importLine = 'import professorPainelRoutes from "./modules/professor-painel/professor-painel.routes.mjs";';
  if (!txt.includes(importLine)) {
    const marker = 'import professoresRoutes from "./modules/professores/professores.routes.mjs";';
    txt = txt.includes(marker) ? txt.replace(marker, `${marker}\n${importLine}`) : `${importLine}\n${txt}`;
  }
  const useLine = 'app.use("/api/professor-painel", professorPainelRoutes);';
  if (!txt.includes(useLine)) {
    const marker = 'app.use("/api/professores", professoresRoutes);';
    if (txt.includes(marker)) txt = txt.replace(marker, `${marker}\n${useLine}`);
    else txt = txt.replace("const PORT = process.env.PORT || 3000;", `${useLine}\n\nconst PORT = process.env.PORT || 3000;`);
  }
  await fs.writeFile(SERVER, txt, "utf8");
  console.log("Fusion ERP 2.3 instalado. Rota ativa: /api/professor-painel");
  console.log("Tela: /pages/professor-painel/index.html");
}
main().catch((err) => { console.error(err); process.exit(1); });
