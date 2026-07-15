import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const required=[
  'public/assets/css/fusion-v3-variables.css',
  'public/assets/css/fusion-v3-layout.css',
  'public/assets/css/fusion-v3-components.css',
  'public/assets/css/fusion-v3-responsive.css',
  'public/assets/css/fusion-v3-standard.css',
  'public/assets/js/fusion-layout.js'
];
const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
const layout=fs.readFileSync(path.join(root,'public/assets/js/fusion-layout.js'),'utf8');
const checks={
  requiredFiles:missing.length===0,
  canonicalStyles:required.slice(0,5).every(f=>layout.includes('/assets/css/'+path.basename(f))),
  removesLegacyLayers:layout.includes('LEGACY_GLOBAL_STYLES')&&layout.includes('removerCamadasGlobaisDuplicadas'),
  componentRuntime:layout.includes('padronizarInterface'),
  responsiveTables:layout.includes('prepararTabelasResponsivas'),
  mobileMenu:layout.includes('prepararMenuMobile')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);
const out={ok:missing.length===0&&failed.length===0,version:'3.0.0-components-final',canonicalAssets:required,checks,missing,failed};
console.log(JSON.stringify(out,null,2));
if(!out.ok) process.exit(1);
