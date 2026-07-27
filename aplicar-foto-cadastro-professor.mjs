import fs from "node:fs";
const arquivo = "public/pages/professores/index.html";
let html = fs.readFileSync(arquivo, "utf8");
const marcador = '<script src="/assets/pwa/fusion-pwa-install.js" defer></script>';
const scripts = `  <script src="/assets/js/fusion-foto-perfil.js?v=20260727-1"></script>
  <script src="/assets/js/fusion-professores-foto-cadastro.js?v=20260727-1"></script>
`;
if (!html.includes("fusion-professores-foto-cadastro.js")) {
  if (!html.includes(marcador)) throw new Error("Marcador do cadastro de professores não encontrado.");
  html = html.replace(marcador, scripts + marcador);
  fs.writeFileSync(arquivo, html, "utf8");
  console.log("Cadastro de professores atualizado.");
} else {
  console.log("Cadastro de professores já estava atualizado.");
}
