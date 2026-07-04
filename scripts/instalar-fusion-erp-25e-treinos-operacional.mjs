import fs from "node:fs/promises";
import path from "node:path";

const SERVER = path.resolve(process.cwd(), "server.mjs");

async function main() {
  let txt = await fs.readFile(SERVER, "utf8");

  const importLine = 'import treinosOperacionalRoutes from "./modules/treinos-operacional/treinos-operacional.routes.mjs";';
  if (!txt.includes(importLine)) {
    const marker = 'import treinosEditorRoutes from "./modules/treinos-editor/treinos-editor.routes.mjs";';
    txt = txt.includes(marker) ? txt.replace(marker, `${marker}\n${importLine}`) : `${importLine}\n${txt}`;
  }

  const useLine = 'app.use("/api/treinos-operacional", treinosOperacionalRoutes);';
  if (!txt.includes(useLine)) {
    const marker = 'app.use("/api/treinos-editor", treinosEditorRoutes);';
    if (txt.includes(marker)) txt = txt.replace(marker, `${marker}\n${useLine}`);
    else txt = txt.replace("const PORT = process.env.PORT || 3000;", `${useLine}\n\nconst PORT = process.env.PORT || 3000;`);
  }

  await fs.writeFile(SERVER, txt, "utf8");
  console.log("Fusion ERP 2.5-E instalado. Rota ativa: /api/treinos-operacional");
  console.log("Tela: /pages/portal-treinos/index.html");
}

main().catch((err) => { console.error(err); process.exit(1); });
