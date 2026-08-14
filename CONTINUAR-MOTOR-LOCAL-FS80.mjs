import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = process.cwd();
const sidecarPath = path.join(repo, 'scripts', 'fusion-biometria-sidecar.mjs');
const csPath = path.join(repo, 'scripts', 'biometria', 'FusionBiometriaFs80.cs');

function fail(message) {
  console.error('[ERRO] ' + message);
  process.exit(1);
}

function stopBiometria() {
  try { execFileSync('schtasks.exe', ['/End', '/TN', 'Fusion Biometria FS80'], { stdio: 'ignore' }); } catch {}
  try {
    const csv = execFileSync(
      'wmic.exe',
      ['process', 'where', "Name='node.exe' or Name='FusionBiometriaFs80.exe'", 'get', 'ProcessId,CommandLine,Name', '/format:csv'],
      { encoding: 'utf8', windowsHide: true }
    );
    for (const line of csv.split(/\r?\n/)) {
      if (!line.trim()) continue;
      if (!line.includes('fusion-biometria-sidecar.mjs') && !line.includes('FusionBiometriaFs80.exe')) continue;
      const parts = line.split(',');
      const pid = parts.at(-1)?.trim();
      if (/^\d+$/.test(pid || '')) {
        try { execFileSync('taskkill.exe', ['/PID', pid, '/F'], { stdio: 'ignore' }); } catch {}
      }
    }
  } catch {}
}

function removeDuplicateLocalEngineDeclarations(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let seen = false;
  let removed = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isDecl = /^\s*const\s+localAccessEngine\s*=\s*createLocalAccessEngine\s*\(\s*\{\s*$/.test(line);

    if (!isDecl) {
      out.push(line);
      continue;
    }

    if (!seen) {
      seen = true;
      out.push(line);
      continue;
    }

    // Remove apenas a declaração duplicada e seu objeto de configuração,
    // até o fechamento "});".
    removed++;
    while (i + 1 < lines.length) {
      i++;
      if (/^\s*\}\s*\)\s*;\s*$/.test(lines[i])) break;
      if (/^\s*\}\s*\)\s*;?\s*$/.test(lines[i])) break;
      if (/^\s*\}\s*\);\s*$/.test(lines[i])) break;
    }
  }

  if (!seen) throw new Error('Declaracao localAccessEngine nao encontrada.');
  return { text: out.join('\n'), removed };
}

function dedupeImport(text) {
  const lines = text.split(/\r?\n/);
  let seen = false;
  let removed = 0;
  const out = [];
  for (const line of lines) {
    const isImport = line.includes("createLocalAccessEngine") && line.includes("fusion-access-local-engine.mjs");
    if (!isImport) {
      out.push(line);
      continue;
    }
    if (!seen) {
      seen = true;
      out.push(line);
    } else {
      removed++;
    }
  }
  return { text: out.join('\n'), removed };
}

console.log('============================================================');
console.log('FUSION ERP - CONTINUAR MOTOR LOCAL FS80');
console.log('============================================================');

console.log('[1/6] Parando somente biometria...');
stopBiometria();

if (!fs.existsSync(sidecarPath)) fail('scripts/fusion-biometria-sidecar.mjs nao encontrado.');
if (!fs.existsSync(csPath)) fail('scripts/biometria/FusionBiometriaFs80.cs nao encontrado.');

console.log('[2/6] Corrigindo declaracao duplicada...');
let sidecar = fs.readFileSync(sidecarPath, 'utf8');

const backupDir = path.join(repo, 'data', 'backup-motor-local-fs80-reparo');
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(path.join(backupDir, `fusion-biometria-sidecar-${stamp}.mjs`), sidecar, 'utf8');

const imp = dedupeImport(sidecar);
sidecar = imp.text;

const decl = removeDuplicateLocalEngineDeclarations(sidecar);
sidecar = decl.text;

fs.writeFileSync(sidecarPath, sidecar, 'utf8');
console.log(`[OK] Imports duplicados removidos: ${imp.removed}`);
console.log(`[OK] Declaracoes localAccessEngine duplicadas removidas: ${decl.removed}`);

console.log('[3/6] Validando JavaScript...');
const checks = [
  'modules/access-bridge/access-bridge.repository.mjs',
  'modules/access-bridge/access-bridge.routes.mjs',
  'scripts/fusion-access-local-engine.mjs',
  'scripts/fusion-biometria-sidecar.mjs'
];
for (const rel of checks) {
  const file = path.join(repo, ...rel.split('/'));
  if (!fs.existsSync(file)) fail(`Arquivo esperado nao encontrado: ${rel}`);
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
console.log('[OK] Sintaxe JavaScript valida.');

console.log('[4/6] Compilando FS80...');
try {
  execFileSync('cmd.exe', ['/d', '/c', 'scripts\\biometria\\COMPILAR-BIOMETRIA-FS80.bat'], {
    cwd: repo,
    stdio: 'inherit'
  });
} catch {
  fail('Compilacao do FusionBiometriaFs80.exe falhou.');
}
console.log('[OK] FS80 compilado.');

console.log('[5/6] Criando commit/push...');
const tracked = [
  'modules/access-bridge/access-bridge.repository.mjs',
  'modules/access-bridge/access-bridge.routes.mjs',
  'scripts/fusion-access-local-engine.mjs',
  'scripts/fusion-biometria-sidecar.mjs',
  'scripts/biometria/FusionBiometriaFs80.cs'
];

try {
  execFileSync('git', ['add', '--', ...tracked], { cwd: repo, stdio: 'inherit' });
  execFileSync('git', ['diff', '--cached', '--check'], { cwd: repo, stdio: 'inherit' });
  const names = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: repo, encoding: 'utf8' }).trim();

  if (names) {
    execFileSync('git', ['commit', '-m', 'feat: adiciona motor local offline para biometria'], { cwd: repo, stdio: 'inherit' });
    try {
      execFileSync('git', ['push'], { cwd: repo, stdio: 'inherit' });
      console.log('[OK] Alteracoes enviadas ao GitHub.');
    } catch {
      console.log('[AVISO] Commit criado, mas o git push falhou.');
    }
  } else {
    console.log('[OK] Nao havia nova alteracao para commit.');
  }
} catch (error) {
  console.log('[AVISO] Falha no commit automatico: ' + error.message);
}

console.log('[6/6] Rearmando biometria...');
try {
  execFileSync('schtasks.exe', ['/Run', '/TN', 'Fusion Biometria FS80'], { stdio: 'inherit' });
  console.log('[OK] Biometria reiniciada.');
} catch {
  console.log('[AVISO] Nao foi possivel iniciar automaticamente a tarefa biometrica.');
}

console.log('');
console.log('============================================================');
console.log('MOTOR_LOCAL_FS80_V1_CONTINUADO_OK');
console.log('Duplicidade localAccessEngine corrigida.');
console.log('Motor local validado e FS80 recompilado.');
console.log('============================================================');
