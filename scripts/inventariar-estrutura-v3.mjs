import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'data', 'auditoria-v3');
const TEXT_EXT = new Set(['.html','.htm','.css','.js','.mjs','.cjs','.json','.md','.txt','.webmanifest','.sql']);
const CODE_EXT = new Set(['.js','.mjs','.cjs']);
const ASSET_EXT = new Set(['.gif','.png','.jpg','.jpeg','.webp','.svg','.ico','.mp4','.webm','.mp3','.wav','.woff','.woff2','.ttf','.otf','.pdf']);
const IGNORE_DIRS = new Set(['.git','node_modules','dist','backups','backup_legado','.idea','.vscode']);
const IGNORE_FILES = [/\.zip$/i,/\.log$/i,/\.tmp$/i,/\.bak$/i,/~$/];

function rel(abs){ return path.relative(ROOT, abs).split(path.sep).join('/'); }
function normalizeWeb(value){
  if (!value) return '';
  let s = String(value).trim().replace(/[?#].*$/, '').replace(/\\/g,'/');
  try { s = decodeURIComponent(s); } catch {}
  return s;
}
function isExternal(value){ return /^(?:[a-z]+:)?\/\//i.test(value) || /^(?:data|mailto|tel|javascript):/i.test(value) || value.startsWith('#'); }
async function exists(abs){ try { await fs.access(abs); return true; } catch { return false; } }
async function walk(dir, out=[]){
  let entries=[];
  try { entries=await fs.readdir(dir,{withFileTypes:true}); } catch { return out; }
  for(const entry of entries){
    if(entry.isDirectory() && IGNORE_DIRS.has(entry.name)) continue;
    const abs=path.join(dir,entry.name);
    if(entry.isDirectory()) await walk(abs,out);
    else if(!IGNORE_FILES.some(r=>r.test(entry.name))) out.push(abs);
  }
  return out;
}
function resolveReference(sourceAbs, raw){
  const value=normalizeWeb(raw);
  if(!value || isExternal(value) || value.includes('${')) return null;
  let target;
  if(value.startsWith('/')) target=path.join(ROOT,'public',value.replace(/^\/+/,''));
  else target=path.resolve(path.dirname(sourceAbs),value);
  return target;
}
function extractRefs(text, ext){
  const refs=[];
  const patterns=[
    /(?:src|href|action|poster)\s*=\s*["']([^"']+)["']/gi,
    /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
    /(?:import\s+(?:[^"']+?\s+from\s+)?|export\s+[^"']*?\s+from\s+|require\s*\(|import\s*\()\s*["']([^"']+)["']/gi,
    /fetch\s*\(\s*["']([^"']+)["']/gi,
    /(?:location\.(?:href|replace)|window\.location(?:\.href)?)\s*=\s*["']([^"']+)["']/gi,
    /(?:href|src|url|path|arquivo|imagem|gif|foto)\s*:\s*["']([^"']+)["']/gi
  ];
  for(const re of patterns){ let m; while((m=re.exec(text))) refs.push(m[1]); }
  if(CODE_EXT.has(ext)){
    const routeRe=/\b(?:app|router)\.(?:use|get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/gi;
    let m; while((m=routeRe.exec(text))) refs.push({route:m[1]});
  }
  return refs;
}
function csvEscape(v){ const s=String(v??''); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }

const files=await walk(ROOT);
const records=[];
const byRel=new Map();
for(const abs of files){
  const stat=await fs.stat(abs); const r=rel(abs); const ext=path.extname(abs).toLowerCase();
  const rec={path:r,abs,ext,size:stat.size,type:ASSET_EXT.has(ext)?'asset':TEXT_EXT.has(ext)?'text':'other',references:[],referencedBy:new Set(),routes:[]};
  records.push(rec); byRel.set(r,rec);
}

const unresolved=[];
const routes=[];
for(const rec of records){
  if(rec.type!=='text') continue;
  let text=''; try{text=await fs.readFile(rec.abs,'utf8');}catch{continue;}
  for(const item of extractRefs(text,rec.ext)){
    if(typeof item==='object' && item.route){ routes.push({file:rec.path,route:item.route}); rec.routes.push(item.route); continue; }
    rec.references.push(item);
    const target=resolveReference(rec.abs,item);
    if(!target) continue;
    const candidates=[target];
    if(!path.extname(target)) candidates.push(`${target}.mjs`,`${target}.js`,`${target}.json`,path.join(target,'index.html'),path.join(target,'index.js'),path.join(target,'index.mjs'));
    let found=null;
    for(const c of candidates){ const rr=rel(c); if(byRel.has(rr)){found=byRel.get(rr);break;} }
    if(found) found.referencedBy.add(rec.path);
    else if(!String(item).startsWith('/api/')) unresolved.push({source:rec.path,reference:item,resolved:rel(target)});
  }
}

const entryRoots=new Set(['server.mjs','package.json']);
for(const rec of records){
  if(rec.path.startsWith('public/pages/') && /\/index\.html$/i.test(rec.path)) entryRoots.add(rec.path);
  if(rec.path.startsWith('public/') && ['.html','.webmanifest'].includes(rec.ext)) entryRoots.add(rec.path);
  if(rec.path.startsWith('scripts/') && CODE_EXT.has(rec.ext)) entryRoots.add(rec.path);
}
for(const p of entryRoots){ const rec=byRel.get(p); if(rec) rec.referencedBy.add('[entry-root]'); }

const modules=records.filter(r=>r.path.startsWith('modules/'));
const moduleDirs=new Map();
for(const rec of modules){ const name=rec.path.split('/')[1]; if(!moduleDirs.has(name)) moduleDirs.set(name,[]); moduleDirs.get(name).push(rec); }
const moduleSummary=[];
for(const [name,list] of [...moduleDirs.entries()].sort()){
  const refs=list.reduce((n,r)=>n+r.referencedBy.size,0);
  const serverMention=list.some(r=>r.referencedBy.has('server.mjs')) || list.some(r=>[...r.referencedBy].some(x=>x.startsWith('modules/core/')));
  moduleSummary.push({module:name,files:list.length,bytes:list.reduce((n,r)=>n+r.size,0),references:refs,serverOrCoreReferenced:serverMention,status:serverMention||refs>0?'used-or-compatible':'candidate-review'});
}

const candidates=[];
for(const rec of records){
  if(rec.referencedBy.size) continue;
  let confidence='low'; let reason='not referenced by scanned text';
  if(rec.type==='asset') {confidence='high'; reason='asset without textual reference';}
  else if(rec.path.startsWith('public/assets/') && ['.css','.js','.mjs'].includes(rec.ext)){confidence='medium'; reason='frontend asset not referenced by HTML/CSS/JS';}
  else if(rec.path.startsWith('modules/')){confidence='low'; reason='module file may be loaded dynamically';}
  else if(rec.path.startsWith('public/pages/')){confidence='low'; reason='page may be opened directly by URL';}
  candidates.push({path:rec.path,size:rec.size,type:rec.type,confidence,reason});
}

const hashGroups=new Map();
for(const rec of records){
  if(rec.size===0) continue;
  let hash; try{hash=crypto.createHash('sha256').update(await fs.readFile(rec.abs)).digest('hex');}catch{continue;}
  if(!hashGroups.has(hash)) hashGroups.set(hash,[]); hashGroups.get(hash).push(rec);
}
const duplicates=[...hashGroups.values()].filter(g=>g.length>1).map(g=>({count:g.length,sizeEach:g[0].size,recoverableBytes:(g.length-1)*g[0].size,files:g.map(x=>x.path)})).sort((a,b)=>b.recoverableBytes-a.recoverableBytes);

const summary={
  generatedAt:new Date().toISOString(),
  root:ROOT,
  files:records.length,
  totalBytes:records.reduce((n,r)=>n+r.size,0),
  textFiles:records.filter(r=>r.type==='text').length,
  assets:records.filter(r=>r.type==='asset').length,
  routesFound:routes.length,
  unresolvedReferences:unresolved.length,
  removalCandidates:candidates.length,
  highConfidenceCandidates:candidates.filter(c=>c.confidence==='high').length,
  duplicateGroups:duplicates.length,
  duplicateRecoverableBytes:duplicates.reduce((n,d)=>n+d.recoverableBytes,0),
  moduleCount:moduleSummary.length
};

await fs.mkdir(OUTPUT_DIR,{recursive:true});
await fs.writeFile(path.join(OUTPUT_DIR,'inventario-estrutura-v3.json'),JSON.stringify({summary,moduleSummary,routes,unresolved:unresolved.slice(0,5000),candidates,duplicates},null,2));
const csv=['path,size,type,confidence,reason',...candidates.map(c=>[c.path,c.size,c.type,c.confidence,c.reason].map(csvEscape).join(','))].join('\n');
await fs.writeFile(path.join(OUTPUT_DIR,'candidatos-remocao-v3.csv'),csv);
let md=`# Inventário estrutural Fusion ERP V3\n\nGerado em: ${summary.generatedAt}\n\n## Resumo\n\n`;
for(const [k,v] of Object.entries(summary)) md+=`- **${k}**: ${v}\n`;
md+='\n## Regra de segurança\n\nEste relatório não apaga arquivos. Itens de confiança alta ainda devem ser revisados antes da remoção. Páginas e módulos sem referência textual podem ser acessados dinamicamente ou diretamente por URL.\n\n## Módulos\n\n| Módulo | Arquivos | Tamanho | Referências | Situação |\n|---|---:|---:|---:|---|\n';
for(const m of moduleSummary) md+=`| ${m.module} | ${m.files} | ${(m.bytes/1024).toFixed(1)} KB | ${m.references} | ${m.status} |\n`;
md+='\n## Candidatos de confiança alta\n\n';
for(const c of candidates.filter(x=>x.confidence==='high').sort((a,b)=>b.size-a.size).slice(0,200)) md+=`- \`${c.path}\` — ${(c.size/1024).toFixed(1)} KB\n`;
md+='\n## Referências não resolvidas\n\n';
for(const u of unresolved.slice(0,200)) md+=`- \`${u.source}\` → \`${u.reference}\`\n`;
await fs.writeFile(path.join(OUTPUT_DIR,'INVENTARIO_ESTRUTURAL_V3.md'),md);
console.log(JSON.stringify({ok:true,output:path.relative(ROOT,OUTPUT_DIR),summary},null,2));
