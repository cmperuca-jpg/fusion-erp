import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "public/assets/js/fusion-layout.js",
  "public/assets/css/fusion-v3-variables.css",
  "public/assets/css/fusion-v3-layout.css",
  "public/assets/css/fusion-v3-components.css",
  "public/assets/css/fusion-v3-responsive.css"
];
const publicPages = new Set([
  "aluno-login","aluno-treinos","aluno-avaliacao","comercial","login",
  "matricula-online","professor-area","professor-login","promocao","promocao-90-dias"
]);
const pagesDir = path.join(root,"public","pages");
const missingLayout=[];
for (const entry of fs.readdirSync(pagesDir,{withFileTypes:true})) {
  if (!entry.isDirectory() || publicPages.has(entry.name)) continue;
  const file=path.join(pagesDir,entry.name,"index.html");
  if (!fs.existsSync(file)) continue;
  const html=fs.readFileSync(file,"utf8");
  if (!html.includes("fusion-layout.js")) missingLayout.push(path.relative(root,file));
}
const missing=required.filter(file=>!fs.existsSync(path.join(root,file)));
const result={ok:missing.length===0&&missingLayout.length===0,version:"3.0.0-frontend-final",missing,missingLayout};
console.log(JSON.stringify(result,null,2));
if(!result.ok) process.exitCode=1;
