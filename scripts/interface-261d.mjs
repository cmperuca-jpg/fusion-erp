import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, "logs");
const PUBLIC_DIR = path.join(ROOT, "public", "pages");

const paginasCriticas = [
  { nome: "login", arquivo: "login/index.html", tipo: "core" },
  { nome: "dashboard", arquivo: "dashboard/index.html", tipo: "core" },
  { nome: "checkin", arquivo: "checkin/index.html", tipo: "operacional" },
  { nome: "treinos", arquivo: "treinos/index.html", tipo: "operacional" },
  { nome: "professor-painel", arquivo: "professor-painel/index.html", tipo: "operacional" },
  { nome: "portal-aluno", arquivo: "portal-aluno/index.html", tipo: "portal" },
  { nome: "alunos", arquivo: "alunos/index.html", tipo: "cadastro" },
  { nome: "matriculas", arquivo: "matriculas/index.html", tipo: "comercial" },
  { nome: "financeiro", arquivo: "financeiro/index.html", tipo: "financeiro" }
];

function existe(relativo) {
  return fs.existsSync(path.join(PUBLIC_DIR, relativo));
}

function ler(relativo) {
  try { return fs.readFileSync(path.join(PUBLIC_DIR, relativo), "utf8"); }
  catch { return ""; }
}

function verificarPagina(pagina) {
  const html = ler(pagina.arquivo);
  const base = path.dirname(pagina.arquivo);
  const jsRel = path.join(base, "index.js").replaceAll("\\", "/");
  const cssRel = path.join(base, "style.css").replaceAll("\\", "/");
  const checkinCssRel = path.join(base, "checkin.css").replaceAll("\\", "/");
  const checkinJsRel = path.join(base, "checkin.js").replaceAll("\\", "/");

  const paginaExiste = Boolean(html);
  const temFusionAuth = html.includes("FusionAuth.proteger") || pagina.nome === "portal-aluno" || pagina.nome === "login";
  const temViewport = html.includes('name="viewport"') || html.includes("name='viewport'");
  const temTitulo = /<title>[^<]+<\/title>/i.test(html);
  const temCss = existe(cssRel) || existe(checkinCssRel) || html.includes("fusion-app.css");
  const temJs = existe(jsRel) || existe(checkinJsRel) || html.includes("<script");

  const avisos = [];
  const falhas = [];
  if (!paginaExiste) falhas.push("Página não encontrada.");
  if (paginaExiste && !temViewport) avisos.push("Viewport não encontrado.");
  if (paginaExiste && !temTitulo) avisos.push("Title não encontrado.");
  if (paginaExiste && !temCss) avisos.push("CSS local ou padrão não localizado.");
  if (paginaExiste && !temJs) avisos.push("JavaScript local ou inline não localizado.");
  if (paginaExiste && !temFusionAuth) avisos.push("Página sem proteção FusionAuth ou exceção explícita.");

  return {
    ...pagina,
    existe: paginaExiste,
    temViewport,
    temTitulo,
    temCss,
    temJs,
    temFusionAuth,
    falhas,
    avisos
  };
}

async function main() {
  const inicio = performance.now();
  await fsp.mkdir(LOG_DIR, { recursive: true });
  const paginas = paginasCriticas.map(verificarPagina);
  const falhas = paginas.flatMap((p) => p.falhas.map((mensagem) => ({ pagina: p.nome, mensagem })));
  const avisos = paginas.flatMap((p) => p.avisos.map((mensagem) => ({ pagina: p.nome, mensagem })));
  const relatorio = {
    ok: falhas.length === 0,
    versao: "2.6.1-D",
    modulo: "interface",
    geradoEm: new Date().toISOString(),
    resumo: {
      paginasVerificadas: paginas.length,
      falhas: falhas.length,
      avisos: avisos.length,
      tempoMs: Number((performance.now() - inicio).toFixed(3))
    },
    paginas,
    falhas,
    avisos,
    recomendacao: falhas.length === 0
      ? "Interface aprovada para piloto local. Revisar avisos antes de produção externa."
      : "Corrigir falhas antes do piloto."
  };

  const saida = path.join(LOG_DIR, "interface-261d.json");
  await fsp.writeFile(saida, JSON.stringify(relatorio, null, 2), "utf8");

  console.log("Fusion ERP 2.6.1-D — Interface");
  console.log(`Páginas verificadas: ${relatorio.resumo.paginasVerificadas}`);
  console.log(`Falhas: ${relatorio.resumo.falhas}`);
  console.log(`Avisos: ${relatorio.resumo.avisos}`);
  console.log(`Relatório: ${saida}`);

  if (falhas.length > 0) process.exitCode = 1;
}

main().catch((erro) => {
  console.error("Erro na auditoria de interface:", erro.message);
  process.exitCode = 1;
});
