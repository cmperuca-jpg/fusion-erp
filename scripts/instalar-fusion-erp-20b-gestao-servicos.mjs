import fs from 'fs/promises';
import path from 'path';
const root = process.cwd();
const server = path.join(root, 'server.mjs');
async function exists(p){ try{ await fs.access(p); return true; }catch{return false;} }
async function patchServer(){ if(!(await exists(server))) return; let txt = await fs.readFile(server,'utf8'); if(!txt.includes('comercialRoutes')){ const anchor = 'import presencasRoutes from "./modules/presencas/presencas.routes.mjs";'; if(txt.includes(anchor)) txt = txt.replace(anchor, `${anchor}\nimport comercialRoutes from "./modules/comercial/comercial.routes.mjs";`); else txt = `import comercialRoutes from "./modules/comercial/comercial.routes.mjs";\n${txt}`; } if(!txt.includes('app.use(comercialRoutes)')){ const anchorUse = 'app.use("/api/presencas", presencasRoutes);'; if(txt.includes(anchorUse)) txt = txt.replace(anchorUse, `${anchorUse}\napp.use(comercialRoutes);`); else txt = txt.replace('app.listen(PORT', 'app.use(comercialRoutes);\n\napp.listen(PORT'); } await fs.writeFile(server, txt, 'utf8'); }
await patchServer();
console.log('Fusion ERP 2.0-B instalado. Rotas comerciais editáveis disponíveis.');
