import fs from "node:fs";
import path from "node:path";
import pkg from "../package.json" with { type: "json" };

const root = process.cwd();
const required = [
  "modules/financeiro/financeiro.routes.mjs",
  "modules/financeiro/financeiro.service.mjs",
  "modules/financeiro/mensalidades.routes.mjs",
  "modules/financeiro/mensalidades.service.mjs",
  "modules/financeiro/caixa.routes.mjs",
  "modules/financeiro/recebimentos.routes.mjs",
  "public/pages/financeiro/index.html",
  "public/pages/mensalidades/index.html",
  "public/pages/caixa/index.html",
  "public/pages/recebimentos/index.html"
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
const forbidden = [
  "modules/mensalidades",
  "public/js/financeiro/cadastro.js",
  "public/js/financeiro/ficha.js"
].filter(file => fs.existsSync(path.join(root, file)));
const server = fs.readFileSync(path.join(root, "server.mjs"), "utf8");
const mounts = [
  'app.use("/api/financeiro", financeiroRoutes)',
  'app.use("/api/mensalidades", mensalidadesRoutes)',
  'app.use("/api/caixa", caixaRoutes)',
  'app.use("/api/recebimentos", recebimentosRoutes)'
];
const missingMounts = mounts.filter(value => !server.includes(value));
const redirects = ["cadastro.html", "ficha.html"].map(name => {
  const file = path.join(root, "public/pages/financeiro", name);
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  return { file: name, ok: text.includes("/pages/financeiro/index.html") && text.includes("location.search") };
});
const failedRedirects = redirects.filter(item => !item.ok);
const ok = !missing.length && !forbidden.length && !missingMounts.length && !failedRedirects.length;
console.log(JSON.stringify({
  ok,
  version: pkg.version,
  canonicalModule: "modules/financeiro",
  missing,
  forbidden,
  missingMounts,
  redirects,
  failed: [...missing, ...forbidden, ...missingMounts, ...failedRedirects.map(x => x.file)]
}, null, 2));
process.exitCode = ok ? 0 : 1;
