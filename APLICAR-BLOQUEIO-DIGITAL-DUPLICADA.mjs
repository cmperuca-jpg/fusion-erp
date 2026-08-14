import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.cwd();
const file = path.join(repo, "scripts", "biometria", "FusionBiometriaFs80.cs");
const backupDir = path.join(repo, "data", "backup-fs80-duplicidade");

function fail(msg) {
  console.error("[ERRO] " + msg);
  process.exit(1);
}

if (!fs.existsSync(file)) fail("FusionBiometriaFs80.cs nao encontrado.");
fs.mkdirSync(backupDir, { recursive: true });

let text = fs.readFileSync(file, "utf8");

if (text.includes("digitalDuplicadaBloqueada") && text.includes("Esta digital ja esta cadastrada para outro aluno")) {
  console.log("[OK] Protecao contra digital duplicada ja aplicada.");
} else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(file, path.join(backupDir, `FusionBiometriaFs80-${stamp}.cs`));

  const oldBlock = `        using (var fs80 = new Fs80())
        {
            int quality;
            byte[] template = fs80.Enroll(out quality);
            byte[] plain = null;
            byte[] protectedBytes = null;
            try
            {
                plain = PackV2(tenantId, alunoId, template);
`;

  const newBlock = `        using (var fs80 = new Fs80())
        {
            int farMinimo = ResolveFarMin();
            var existentes = LoadAll(tenantId)
                .Where(item => !String.Equals(item.AlunoId, alunoId, StringComparison.Ordinal))
                .ToList();

            try
            {
                if (existentes.Count > 0)
                {
                    // Antes do cadastro, faz uma leitura 1:N contra todas as
                    // digitais dos OUTROS alunos. Se houver correspondencia
                    // forte, o cadastro e interrompido e nenhum template e salvo.
                    Tuple<string, int> duplicada = fs80.Identify(existentes, farMinimo);
                    if (!String.IsNullOrEmpty(duplicada.Item1))
                    {
                        Print(new Dictionary<string, object> {
                            {"ok", false},
                            {"acao", "enroll"},
                            {"tenantId", tenantId},
                            {"erro", "Esta digital ja esta cadastrada para outro aluno."},
                            {"digitalDuplicadaBloqueada", true},
                            {"farNumerico", duplicada.Item2},
                            {"farMinimo", farMinimo},
                            {"templateExposto", false},
                            {"versao", "2"}
                        });
                        return 3;
                    }
                }
            }
            finally
            {
                ClearTemplates(existentes);
            }

            int quality;
            byte[] template = fs80.Enroll(out quality);
            byte[] plain = null;
            byte[] protectedBytes = null;
            try
            {
                plain = PackV2(tenantId, alunoId, template);
`;

  if (!text.includes(oldBlock)) fail("Bloco de cadastro esperado nao foi encontrado.");
  text = text.replace(oldBlock, newBlock);

  fs.writeFileSync(file, text, "utf8");
  console.log("[OK] Bloqueio de digital duplicada aplicado.");
}

// Para somente a biometria; Henry/Access Agent continuam separados.
try { execFileSync("schtasks.exe", ["/End", "/TN", "Fusion Biometria FS80"], { stdio: "ignore" }); } catch {}
try {
  const csv = execFileSync(
    "wmic.exe",
    ["process", "where", "Name='node.exe'", "get", "ProcessId,CommandLine", "/format:csv"],
    { encoding: "utf8", windowsHide: true }
  );
  for (const line of csv.split(/\r?\n/)) {
    if (!line.includes("fusion-biometria-sidecar.mjs")) continue;
    const pid = line.split(",").at(-1)?.trim();
    if (/^\d+$/.test(pid || "")) {
      try { execFileSync("taskkill.exe", ["/PID", pid, "/F"], { stdio: "ignore" }); } catch {}
    }
  }
} catch {}

console.log("[1/4] Compilando FS80...");
try {
  execFileSync("cmd.exe", ["/d", "/c", "scripts\\biometria\\COMPILAR-BIOMETRIA-FS80.bat"], {
    cwd: repo,
    stdio: "inherit"
  });
} catch {
  fail("Compilacao do FusionBiometriaFs80.exe falhou.");
}

console.log("[2/4] Validando executavel...");
if (!fs.existsSync(path.join(repo, "scripts", "biometria", "FusionBiometriaFs80.exe")))
  fail("Executavel compilado nao encontrado.");

console.log("[3/4] Criando commit...");
try {
  execFileSync("git", ["add", "--", "scripts/biometria/FusionBiometriaFs80.cs"], { cwd: repo, stdio: "inherit" });
  execFileSync("git", ["diff", "--cached", "--check"], { cwd: repo, stdio: "inherit" });

  const names = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: repo, encoding: "utf8" });
  if (names.includes("scripts/biometria/FusionBiometriaFs80.cs")) {
    execFileSync("git", ["commit", "-m", "fix: bloqueia digital duplicada no cadastro FS80"], { cwd: repo, stdio: "inherit" });
    try {
      execFileSync("git", ["push"], { cwd: repo, stdio: "inherit" });
      console.log("[OK] Correcao enviada ao GitHub.");
    } catch {
      console.log("[AVISO] Commit local criado; git push falhou.");
    }
  } else {
    console.log("[OK] Nenhuma nova alteracao para commit.");
  }
} catch (e) {
  console.log("[AVISO] Falha no commit automatico: " + e.message);
}

console.log("[4/4] Rearmando biometria...");
try {
  execFileSync("schtasks.exe", ["/Run", "/TN", "Fusion Biometria FS80"], { stdio: "inherit" });
  console.log("[OK] Biometria reiniciada.");
} catch {
  console.log("[AVISO] Nao foi possivel iniciar automaticamente a tarefa biometrica.");
}

console.log("");
console.log("============================================================");
console.log("FS80_DUPLICIDADE_BLOQUEADA_OK");
console.log("Antes do cadastro: 1 leitura valida se o dedo ja pertence a outro aluno.");
console.log("Depois, se estiver livre: cadastro normal de 3 amostras.");
console.log("============================================================");
