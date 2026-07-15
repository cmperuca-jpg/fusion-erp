import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'modules/comercial/comercial.routes.mjs',
  'modules/comercial/comercial.service.mjs',
  'modules/comercial/comercial.financeiro.service.mjs',
  'modules/comercial/crm/leads.routes.mjs',
  'modules/comercial/crm/leads.service.mjs',
  'modules/comercial/chat/site-chat.routes.mjs',
  'modules/comercial/chat/site-chat.service.mjs',
  'modules/comercial/matricula-online/matricula-online.routes.mjs',
  'modules/comercial/matricula-online/matricula-online.service.mjs',
  'public/pages/comercial/index.html',
  'public/pages/comercial-painel/index.html',
  'public/pages/matricula-online/index.html',
  'public/pages/site-chat/index.html'
];
const forbidden = ['modules/leads','modules/site-chat','modules/matricula-online'];
const missing = required.filter(file => !fs.existsSync(path.join(root,file)));
const oldTopLevel = forbidden.filter(file => fs.existsSync(path.join(root,file)));
const server = fs.readFileSync(path.join(root,'server.mjs'),'utf8');
const routes = fs.readFileSync(path.join(root,'modules/comercial/comercial.routes.mjs'),'utf8');
const checks = {
  requiredFiles: missing.length === 0,
  oldModulesRemoved: oldTopLevel.length === 0,
  crmCanonicalImport: server.includes('./modules/comercial/crm/leads.routes.mjs'),
  chatCanonicalImport: server.includes('./modules/comercial/chat/site-chat.routes.mjs'),
  matriculaCanonicalImport: server.includes('./modules/comercial/matricula-online/matricula-online.routes.mjs'),
  noDoubleCommercialMount: !server.includes('app.use("/api/comercial", comercialRoutes)'),
  statusRoute: routes.includes('/api/comercial/v3/status')
};
const failed = Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
const result = {ok: failed.length===0, version:'3.0.0-comercial-final', canonicalModule:'modules/comercial', checks, missing, oldTopLevel, failed};
console.log(JSON.stringify(result,null,2));
if(!result.ok) process.exit(1);
