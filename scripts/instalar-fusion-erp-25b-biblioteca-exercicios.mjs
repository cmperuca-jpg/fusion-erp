import fs from "node:fs/promises";
import path from "node:path";
import { inicializarBiblioteca } from "../modules/exercicios-biblioteca/exercicios-biblioteca.service.mjs";

const SERVER = path.resolve(process.cwd(), "server.mjs");

async function main() {
  let txt = await fs.readFile(SERVER, "utf8");

  const importLine = 'import exerciciosBibliotecaRoutes from "./modules/exercicios-biblioteca/exercicios-biblioteca.routes.mjs";';
  if (!txt.includes(importLine)) {
    const marker = 'import exerciciosRoutes from "./modules/exercicios/exercicios.routes.mjs";';
    txt = txt.includes(marker) ? txt.replace(marker, `${marker}\n${importLine}`) : `${importLine}\n${txt}`;
  }

  const useLine = 'app.use("/api/exercicios-biblioteca", exerciciosBibliotecaRoutes);';
  if (!txt.includes(useLine)) {
    const marker = 'app.use("/api/exercicios", exerciciosRoutes);';
    if (txt.includes(marker)) txt = txt.replace(marker, `${marker}\n${useLine}`);
    else txt = txt.replace("const PORT = process.env.PORT || 3000;", `${useLine}\n\nconst PORT = process.env.PORT || 3000;`);
  }

  await fs.writeFile(SERVER, txt, "utf8");
  const resumo = await inicializarBiblioteca();
  console.log("Fusion ERP 2.5-B instalado. Rota ativa: /api/exercicios-biblioteca");
  console.log(`Exercícios na biblioteca: ${resumo.total}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
