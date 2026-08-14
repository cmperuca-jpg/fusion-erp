import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = process.cwd();
const file = path.join(repo, 'scripts', 'biometria', 'FusionBiometriaFs80.cs');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(repo, 'data', 'backup-caminho-dpapi', stamp);

function fail(message) {
  console.error('[ERRO] ' + message);
  process.exit(1);
}

function stopBiometria() {
  try {
    execFileSync('schtasks.exe', ['/End', '/TN', 'Fusion Biometria FS80'], { stdio: 'ignore' });
  } catch {}
  try {
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*fusion-biometria-sidecar.mjs*') -or $_.Name -eq 'FusionBiometriaFs80.exe' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    ], { stdio: 'ignore', windowsHide: true });
  } catch {}
}

console.log('============================================================');
console.log('FUSION ERP - CORRECAO CAMINHO DPAPI FS80');
console.log('============================================================');

if (!fs.existsSync(file)) fail('FusionBiometriaFs80.cs nao encontrado.');

console.log('[1/6] Parando somente a biometria...');
stopBiometria();

console.log('[2/6] Salvando backup do fonte atual...');
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(file, path.join(backupDir, 'FusionBiometriaFs80.cs'));

let text = fs.readFileSync(file, 'utf8');

const oldAtomic = `    private static void AtomicWriteTemplate(string tenantId, string alunoId, byte[] protectedBytes)
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
    }`;

const newAtomic = `    private static void AtomicWriteTemplate(string tenantId, string alunoId, byte[] protectedBytes)
    {
        string target = FileFor(tenantId, alunoId);
        string targetDir = Path.GetDirectoryName(target);
        Directory.CreateDirectory(targetDir);

        // Nao concatena GUID ao nome completo do template. O caminho do repo +
        // hashes de tenant/aluno ja e longo e pode ultrapassar MAX_PATH no Windows.
        string temp = Path.Combine(
            targetDir,
            "w-" + Guid.NewGuid().ToString("N").Substring(0, 8) + ".tmp"
        );

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

                string targetHash = Path.GetFileNameWithoutExtension(target);
                if (targetHash.Length > 12) targetHash = targetHash.Substring(0, 12);

                string backup = Path.Combine(
                    backupDir,
                    "b-" + targetHash + "-" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff") + ".bak"
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
    }`;

const oldDelete = `    private static void ArchiveDeletedTemplate(string tenantId, string source)
    {
        string dir = Path.Combine(BaseStoreDir, "deleted-backups", "tenants", TenantHash(tenantId));
        Directory.CreateDirectory(dir);
        string destination = Path.Combine(
            dir,
            Path.GetFileName(source) + "." + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff") + "." + Guid.NewGuid().ToString("N").Substring(0, 8) + ".bak"
        );
        File.Move(source, destination);
    }`;

const newDelete = `    private static void ArchiveDeletedTemplate(string tenantId, string source)
    {
        string dir = Path.Combine(BaseStoreDir, "deleted-backups", "tenants", TenantHash(tenantId));
        Directory.CreateDirectory(dir);

        string sourceHash = Path.GetFileNameWithoutExtension(source);
        if (sourceHash.Length > 12) sourceHash = sourceHash.Substring(0, 12);

        string destination = Path.Combine(
            dir,
            "d-" + sourceHash + "-" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff") + "-" + Guid.NewGuid().ToString("N").Substring(0, 6) + ".bak"
        );
        File.Move(source, destination);
    }`;

console.log('[3/6] Aplicando nomes curtos para temporarios e backups...');

if (text.includes(oldAtomic)) {
  text = text.replace(oldAtomic, newAtomic);
} else if (!text.includes('"w-" + Guid.NewGuid().ToString("N").Substring(0, 8) + ".tmp"')) {
  fail('Bloco AtomicWriteTemplate nao corresponde a versao esperada. Nada foi gravado.');
}

if (text.includes(oldDelete)) {
  text = text.replace(oldDelete, newDelete);
} else if (!text.includes('"d-" + sourceHash')) {
  fail('Bloco ArchiveDeletedTemplate nao corresponde a versao esperada. Nada foi gravado.');
}

fs.writeFileSync(file, text, 'utf8');

console.log('[4/6] Compilando FS80...');
try {
  execFileSync('cmd.exe', ['/d', '/c', 'scripts\\biometria\\COMPILAR-BIOMETRIA-FS80.bat'], {
    cwd: repo,
    stdio: 'inherit'
  });
} catch {
  fail('Falha ao compilar. Fonte anterior preservado em: ' + backupDir);
}

console.log('[5/6] Criando commit/push...');
try {
  execFileSync('git', ['add', '--', 'scripts/biometria/FusionBiometriaFs80.cs'], {
    cwd: repo, stdio: 'inherit'
  });
  execFileSync('git', ['diff', '--cached', '--check'], { cwd: repo, stdio: 'inherit' });

  const changed = execFileSync(
    'git',
    ['diff', '--cached', '--name-only'],
    { cwd: repo, encoding: 'utf8' }
  ).trim();

  if (changed) {
    execFileSync(
      'git',
      ['commit', '-m', 'fix: encurta caminhos de backup biometrico FS80'],
      { cwd: repo, stdio: 'inherit' }
    );
    try {
      execFileSync('git', ['push'], { cwd: repo, stdio: 'inherit' });
      console.log('[OK] Correcao enviada ao GitHub.');
    } catch {
      console.log('[AVISO] Commit criado, mas git push falhou.');
    }
  } else {
    console.log('[OK] Correcao ja estava aplicada.');
  }
} catch (error) {
  console.log('[AVISO] Falha no commit automatico: ' + error.message);
}

console.log('[6/6] Rearmando biometria...');
try {
  execFileSync('schtasks.exe', ['/Run', '/TN', 'Fusion Biometria FS80'], { stdio: 'inherit' });
  console.log('[OK] Biometria rearmada.');
} catch {
  console.log('[AVISO] Tarefa biometrica nao iniciou automaticamente.');
}

console.log('');
console.log('============================================================');
console.log('CAMINHO_DPAPI_FS80_CORRIGIDO_OK');
console.log('Templates existentes preservados.');
console.log('Temporarios e backups agora usam nomes curtos.');
console.log('============================================================');
