import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const required=['scripts/inventariar-estrutura-v3.mjs','scripts/verificar-inventario-v3.mjs','docs/INVENTARIO_ESTRUTURAL_V3.md'];
const checks=[];
for(const file of required){try{await fs.access(path.join(root,file));checks.push({file,ok:true});}catch{checks.push({file,ok:false});}}
const failed=checks.filter(x=>!x.ok);
console.log(JSON.stringify({ok:failed.length===0,version:'3.0.0-structural-inventory',checks,failed},null,2));
if(failed.length) process.exitCode=1;
