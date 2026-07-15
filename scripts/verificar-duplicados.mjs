import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root = process.cwd(); const ignored = new Set(["node_modules", ".git", "backups"]); const map = new Map();
function walk(dir){ for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(ignored.has(e.name)) continue; const f=path.join(dir,e.name); if(e.isDirectory()) walk(f); else { const s=fs.statSync(f); if(s.size<1) continue; const h=crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex"); if(!map.has(h)) map.set(h,[]); map.get(h).push(path.relative(root,f)); } } }
walk(root); const groups=[...map.values()].filter(g=>g.length>1).sort((a,b)=>b.length-a.length); console.log(JSON.stringify({duplicateGroups:groups.length,duplicateFiles:groups.reduce((n,g)=>n+g.length,0),groups:groups.slice(0,200)},null,2));
