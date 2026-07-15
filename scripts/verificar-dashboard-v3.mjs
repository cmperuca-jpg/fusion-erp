import fs from 'node:fs';
const files=['public/pages/dashboard/index.html','public/pages/dashboard/index.js','public/pages/dashboard/style.css'];
const missing=files.filter(f=>!fs.existsSync(f));
const html=missing.length?'':fs.readFileSync(files[0],'utf8');const js=missing.length?'':fs.readFileSync(files[1],'utf8');const css=missing.length?'':fs.readFileSync(files[2],'utf8');
const checks={requiredFiles:missing.length===0,globalTitle:html.includes('Dashboard Global'),sixKpis:['kpiAlunos','kpiReceita','kpiAbertas','kpiAvaliacoes','kpiCheckins','kpiProfessores'].every(x=>html.includes(x)),quickLinks:html.includes('dashboard-shortcuts'),serviceStatus:html.includes('dashboard-status-list')&&js.includes('/api/v3/access/status'),accessControl:js.includes('/api/v3/access/liberar'),responsive:css.includes('@media(max-width:640px)')};
const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({ok:!failed.length,version:'3.0.0-dashboard-global-final',checks,missing,failed},null,2));process.exit(failed.length?1:0);
