import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = process.cwd();
const P = (...parts) => path.join(repo, ...parts);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = P('data', 'backup-motor-local-fs80-reconstrucao', stamp);
fs.mkdirSync(backupDir, { recursive: true });

function fail(message) {
  console.error('[ERRO] ' + message);
  process.exit(1);
}
function read(rel) {
  const file = P(...rel.split('/'));
  if (!fs.existsSync(file)) fail(`Arquivo nao encontrado: ${rel}`);
  return fs.readFileSync(file, 'utf8');
}
function write(rel, content) {
  const file = P(...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}
function replaceOnce(text, oldText, newText, label) {
  if (!text.includes(oldText)) fail(`Base Git incompatível no ponto: ${label}`);
  return text.replace(oldText, newText);
}
function backup(rel) {
  const file = P(...rel.split('/'));
  if (!fs.existsSync(file)) return;
  fs.copyFileSync(file, path.join(backupDir, rel.replace(/[\\/]/g, '__')));
}
function gitHead(rel) {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], { cwd: repo, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } catch {
    fail(`Nao foi possivel restaurar ${rel} a partir do Git HEAD.`);
  }
}
function stopBiometria() {
  try { execFileSync('schtasks.exe', ['/End', '/TN', 'Fusion Biometria FS80'], { stdio: 'ignore' }); } catch {}
  try {
    const ps = [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*fusion-biometria-sidecar.mjs*') -or $_.Name -eq 'FusionBiometriaFs80.exe' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    ];
    execFileSync('powershell.exe', ps, { stdio: 'ignore', windowsHide: true });
  } catch {}
}

console.log('============================================================');
console.log('FUSION ERP - RECONSTRUCAO LIMPA MOTOR LOCAL FS80 V1');
console.log('============================================================');

console.log('[1/9] Parando somente a biometria...');
stopBiometria();

console.log('[2/9] Validando Node SQLite...');
try {
  execFileSync(process.execPath, ['-e', "import('node:sqlite').then(()=>process.exit(0)).catch(()=>process.exit(2))"], { stdio: 'ignore' });
} catch {
  fail('Esta versao do Node nao possui node:sqlite.');
}
console.log('[OK] node:sqlite disponivel.');

const baseFiles = [
  'modules/access-bridge/access-bridge.repository.mjs',
  'modules/access-bridge/access-bridge.routes.mjs',
  'scripts/fusion-biometria-sidecar.mjs',
  'scripts/biometria/FusionBiometriaFs80.cs'
];

console.log('[3/9] Salvando estado atual e restaurando base limpa do Git...');
for (const rel of baseFiles) {
  backup(rel);
  write(rel, gitHead(rel));
}
console.log('[OK] Duplicidades parciais removidas pela restauracao da base Git.');

console.log('[4/9] Instalando motor local SQLite...');
fs.copyFileSync(
  P('_patch', 'scripts', 'fusion-access-local-engine.mjs'),
  P('scripts', 'fusion-access-local-engine.mjs')
);

console.log('[5/9] Ligando credencial Edge ao heartbeat autenticado...');
let repository = read('modules/access-bridge/access-bridge.repository.mjs');
repository += `

export async function saveEdgeDeviceCredential({ agentId, tenantId, equipmentId, secretHash } = {}) {
  const safeHash = String(secretHash || '').trim().toLowerCase();
  if (!agentId || !tenantId || !/^[a-f0-9]{64}$/.test(safeHash)) return null;
  const supabase = await supabaseClient();
  if (!supabase) return null;

  const { data: existing, error: readError } = await supabase
    .from('fusion_edge_devices')
    .select('device_id,name,timezone,details,created_at')
    .eq('tenant_id', tenantId)
    .eq('agent_id', agentId)
    .maybeSingle();
  if (readError) throw readError;

  const row = {
    tenant_id: tenantId,
    agent_id: agentId,
    device_id: existing?.device_id || \`\${agentId}-edge\`,
    name: existing?.name || 'Fusion Edge',
    secret_hash: safeHash,
    timezone: existing?.timezone || 'America/Maceio',
    status: 'active',
    last_seen_at: isoDate(),
    updated_at: isoDate(),
    details: {
      ...(existing?.details && typeof existing.details === 'object' ? existing.details : {}),
      equipmentId: equipmentId || undefined,
      source: 'fusion-access-agent',
      biometricOffline: true
    }
  };
  if (existing?.created_at) row.created_at = existing.created_at;

  const { data, error } = await supabase
    .from('fusion_edge_devices')
    .upsert(row, { onConflict: 'tenant_id,agent_id' })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
`;
write('modules/access-bridge/access-bridge.repository.mjs', repository);

let routes = read('modules/access-bridge/access-bridge.routes.mjs');
routes = "import crypto from 'node:crypto';\n" + routes;

const tenantImport = "import { executarComTenant } from '../core/persistence/tenant-context.mjs';";
routes = replaceOnce(
  routes,
  tenantImport,
  tenantImport + "\nimport { saveEdgeDeviceCredential } from './access-bridge.repository.mjs';",
  'import saveEdgeDeviceCredential'
);

const detailHelper = `function agentEquipmentDetails(agent = {}) {
  const equipmentIds = Array.isArray(agent.equipmentIds) ? agent.equipmentIds.filter(Boolean) : [];
  const equipmentId = agent.equipmentId || (equipmentIds.length === 1 ? equipmentIds[0] : '');
  return {
    equipmentId: equipmentId || undefined,
    equipmentIds: equipmentIds.length ? equipmentIds : (equipmentId ? [equipmentId] : undefined)
  };
}`;

routes = replaceOnce(
  routes,
  detailHelper,
  detailHelper + `

async function syncEdgeCredential(req, agent) {
  const rawToken = String(req.get('x-agent-token') || '');
  if (!rawToken || !agent?.tenantId || !agent?.agentId) return;
  await saveEdgeDeviceCredential({
    agentId: agent.agentId,
    tenantId: agent.tenantId,
    equipmentId: agent.equipmentId || agent.equipmentIds?.[0] || '',
    secretHash: crypto.createHash('sha256').update(rawToken).digest('hex')
  });
}`,
  'syncEdgeCredential'
);

routes = replaceOnce(
  routes,
  `router.post('/agent/heartbeat', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  await saveHeartbeat`,
  `router.post('/agent/heartbeat', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  await syncEdgeCredential(req, agent);
  await saveHeartbeat`,
  'heartbeat edge'
);

routes = replaceOnce(
  routes,
  `router.get('/agent/next', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  const consumer`,
  `router.get('/agent/next', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  await syncEdgeCredential(req, agent);
  const consumer`,
  'poll edge'
);
write('modules/access-bridge/access-bridge.routes.mjs', routes);

console.log('[6/9] Reconstruindo sidecar FS80 sem duplicidades...');
let side = read('scripts/fusion-biometria-sidecar.mjs');

side = replaceOnce(
  side,
  "import { spawn } from 'node:child_process';",
  "import { spawn } from 'node:child_process';\nimport { createLocalAccessEngine } from './fusion-access-local-engine.mjs';",
  'import local engine'
);

const enabledAnchor = "if (!enabled) fail('FUSION_BIOMETRIA_ENABLED esta desativada. Nenhum monitor foi iniciado.', 3);";
side = replaceOnce(
  side,
  enabledAnchor,
  enabledAnchor + `

const localAccessEngine = createLocalAccessEngine({
  tenantId,
  agentId,
  token,
  equipmentId,
  host: process.env.ACCESS_HOST || process.env.HENRY7X_HOST || '10.0.0.236',
  port: Number(process.env.ACCESS_PORT || process.env.HENRY7X_PORT || 3000)
});`,
  'init local engine'
);

side = replaceOnce(
  side,
  'async function sendIdentified(evt) {',
  'async function sendIdentifiedOnline(evt, skipCooldown = false) {',
  'rename online handler'
);

side = replaceOnce(
  side,
  'if (!alunoId || requestInFlight || adminCommandInFlight || inCooldown(alunoId)) return;',
  'if (!alunoId || requestInFlight || adminCommandInFlight || (!skipCooldown && inCooldown(alunoId))) return;',
  'online cooldown'
);

const processAnchor = 'function processLine(line) {';
side = replaceOnce(
  side,
  processAnchor,
  `async function sendIdentified(evt) {
  const alunoId = String(evt?.alunoId || '').trim().slice(0, 160);
  if (!alunoId || requestInFlight || adminCommandInFlight || inCooldown(alunoId)) return;

  if (String(evt?.tenantId || '').trim().toLowerCase() !== tenantId) {
    console.error('[BIOMETRIA] Evento rejeitado: tenant do monitor diverge do tenant do Agent.');
    return;
  }

  requestInFlight = true;
  try {
    const local = await localAccessEngine.handleIdentified(alunoId, evt?.farNumerico ?? null);
    if (local?.handled) {
      console.log(JSON.stringify({
        event: 'local-access-result',
        tenantId,
        aluno: maskId(alunoId),
        autorizado: local.autorizado === true,
        motivo: local.motivo || '',
        modo: 'local',
        acessosHoje: local.acessosHoje ?? null,
        templateEnviadoAoServidor: false
      }));
      if (once) stop(local.autorizado ? 0 : 4);
      return;
    }
  } catch (error) {
    console.error(\`[BIOMETRIA] motor local falhou; usando fallback online: \${error.message}\`);
  } finally {
    requestInFlight = false;
  }

  // Antes do primeiro snapshot, ou se o motor local ainda nao conhece a pessoa,
  // preserva o fluxo online ja validado.
  await sendIdentifiedOnline(evt, true);
}

${processAnchor}`,
  'local wrapper'
);

const statusOld = `result = { ok: true, conectado: Boolean(monitor) || biometricMode === 'cadastro', monitorAtivo: Boolean(monitor), monitorSaudavel: monitorHealthy, modo: biometricMode, cadastroEmAndamento: biometricMode === 'cadastro', modoExclusivo: modoCadastroExclusivo, sensor: 'Futronic FS80', tenantId, templateExposto: false };`;
side = replaceOnce(
  side,
  statusOld,
  `result = { ok: true, conectado: Boolean(monitor) || biometricMode === 'cadastro', monitorAtivo: Boolean(monitor), monitorSaudavel: monitorHealthy, modo: biometricMode, cadastroEmAndamento: biometricMode === 'cadastro', modoExclusivo: modoCadastroExclusivo, sensor: 'Futronic FS80', tenantId, templateExposto: false, motorLocal: localAccessEngine.status() };`,
  'status local'
);

side = replaceOnce(
  side,
  `  try { monitor?.kill(); } catch {}
  setTimeout(() => process.exit(code), 50);`,
  `  try { monitor?.kill(); } catch {}
  try { localAccessEngine.stop(); } catch {}
  setTimeout(() => process.exit(code), 50);`,
  'stop local engine'
);
write('scripts/fusion-biometria-sidecar.mjs', side);

console.log('[7/9] Aplicando protecao persistente dos templates DPAPI...');
let cs = read('scripts/biometria/FusionBiometriaFs80.cs');

const fileForAnchor = `    private static string FileFor(string tenantId, string alunoId)
    {
        using (var sha = SHA256.Create())
        {
            string name = Hex(sha.ComputeHash(Encoding.UTF8.GetBytes(alunoId))) + ".dpapi";
            return Path.Combine(StoreDirForTenant(tenantId), name);
        }
    }`;

cs = replaceOnce(
  cs,
  fileForAnchor,
  fileForAnchor + `

    private static string BackupDirForTenant(string tenantId)
    {
        return Path.Combine(BaseStoreDir, "backups", "tenants", TenantHash(tenantId));
    }

    private static void AtomicWriteTemplate(string tenantId, string alunoId, byte[] protectedBytes)
    {
        string target = FileFor(tenantId, alunoId);
        Directory.CreateDirectory(Path.GetDirectoryName(target));
        string temp = target + ".tmp-" + Guid.NewGuid().ToString("N");

        try
        {
            using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
            {
                stream.Write(protectedBytes, 0, protectedBytes.Length);
                stream.Flush(true);
            }

            if (File.Exists(target))
            {
                string backupDir = BackupDirForTenant(tenantId);
                Directory.CreateDirectory(backupDir);
                string backup = Path.Combine(
                    backupDir,
                    Path.GetFileName(target) + "." + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff") + ".bak"
                );
                File.Replace(temp, target, backup, true);
            }
            else
            {
                File.Move(temp, target);
            }
        }
        finally
        {
            if (File.Exists(temp)) File.Delete(temp);
        }
    }

    private static void ArchiveDeletedTemplate(string tenantId, string source)
    {
        string dir = Path.Combine(BaseStoreDir, "deleted-backups", "tenants", TenantHash(tenantId));
        Directory.CreateDirectory(dir);
        string destination = Path.Combine(
            dir,
            Path.GetFileName(source) + "." + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff") + "." + Guid.NewGuid().ToString("N").Substring(0, 8) + ".bak"
        );
        File.Move(source, destination);
    }`,
  'DPAPI helpers'
);

cs = replaceOnce(
  cs,
  '                File.WriteAllBytes(FileFor(tenantId, alunoId), protectedBytes);',
  '                AtomicWriteTemplate(tenantId, alunoId, protectedBytes);',
  'atomic template write'
);

cs = replaceOnce(
  cs,
  `        bool removido = File.Exists(file);
        if (removido) File.Delete(file);`,
  `        bool removido = File.Exists(file);
        if (removido) ArchiveDeletedTemplate(tenantId, file);`,
  'safe template delete'
);
write('scripts/biometria/FusionBiometriaFs80.cs', cs);

console.log('[8/9] Validando tudo e compilando FS80...');
for (const rel of [
  'modules/access-bridge/access-bridge.repository.mjs',
  'modules/access-bridge/access-bridge.routes.mjs',
  'scripts/fusion-access-local-engine.mjs',
  'scripts/fusion-biometria-sidecar.mjs'
]) {
  execFileSync(process.execPath, ['--check', P(...rel.split('/'))], { stdio: 'inherit' });
}
execFileSync('cmd.exe', ['/d', '/c', 'scripts\\biometria\\COMPILAR-BIOMETRIA-FS80.bat'], {
  cwd: repo,
  stdio: 'inherit'
});
console.log('[OK] JavaScript valido e FusionBiometriaFs80.exe compilado.');

console.log('[9/9] Criando commit/push e rearmando biometria...');
const tracked = [
  'modules/access-bridge/access-bridge.repository.mjs',
  'modules/access-bridge/access-bridge.routes.mjs',
  'scripts/fusion-access-local-engine.mjs',
  'scripts/fusion-biometria-sidecar.mjs',
  'scripts/biometria/FusionBiometriaFs80.cs'
];
execFileSync('git', ['add', '--', ...tracked], { cwd: repo, stdio: 'inherit' });
execFileSync('git', ['diff', '--cached', '--check'], { cwd: repo, stdio: 'inherit' });

const changed = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: repo, encoding: 'utf8' }).trim();
if (changed) {
  execFileSync('git', ['commit', '-m', 'feat: adiciona motor local offline para biometria'], { cwd: repo, stdio: 'inherit' });
  try {
    execFileSync('git', ['push'], { cwd: repo, stdio: 'inherit' });
    console.log('[OK] Codigo enviado ao GitHub.');
  } catch {
    console.log('[AVISO] Commit criado localmente, mas git push falhou.');
  }
} else {
  console.log('[OK] Nenhuma alteracao nova para commit.');
}

try {
  execFileSync('schtasks.exe', ['/Run', '/TN', 'Fusion Biometria FS80'], { stdio: 'inherit' });
  console.log('[OK] Biometria rearmada.');
} catch {
  console.log('[AVISO] Nao foi possivel rearmar automaticamente a biometria.');
}

console.log('');
console.log('============================================================');
console.log('MOTOR_LOCAL_FS80_V1_RECONSTRUIDO_OK');
console.log('Sidecar reconstruido do Git HEAD: sem duplicidades.');
console.log('SQLite local habilitado.');
console.log('Aluno: maximo 3 acessos biometricos/dia.');
console.log('Admin/Professor/Recepcao/Gerente: sem limite diario.');
console.log('Bloqueio explicito sempre prevalece.');
console.log('Templates DPAPI persistentes + backup atomico.');
console.log('============================================================');
