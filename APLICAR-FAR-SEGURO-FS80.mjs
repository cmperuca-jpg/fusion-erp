import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.cwd();
const file = path.join(repo, "scripts", "biometria", "FusionBiometriaFs80.cs");
const backupDir = path.join(repo, "data", "backup-fs80-far-seguro");

function fail(msg) {
  console.error("[ERRO] " + msg);
  process.exit(1);
}

if (!fs.existsSync(file)) fail("FusionBiometriaFs80.cs nao encontrado.");
fs.mkdirSync(backupDir, { recursive: true });

let text = fs.readFileSync(file, "utf8");

if (text.includes("FUSION_BIOMETRIA_FAR_MIN") && text.includes("farMinimo")) {
  console.log("[OK] Protecao FAR ja aplicada.");
} else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(file, path.join(backupDir, `FusionBiometriaFs80-${stamp}.cs`));

  const sigOld = `    public Tuple<string, int> Identify(IReadOnlyList<TemplateEntry> templates)
`;
  const sigNew = `    public Tuple<string, int> Identify(IReadOnlyList<TemplateEntry> templates, int minFarAttained)
`;
  if (!text.includes(sigOld)) fail("Assinatura Identify nao encontrada.");
  text = text.replace(sigOld, sigNew);

  const bestOld = `            if (matchCount == 0) return Tuple.Create<string, int>(null, 0);

            var best = (Native.FTR_MATCHED_X_RECORD)Marshal.PtrToStructure(
                matchesMem,
                typeof(Native.FTR_MATCHED_X_RECORD)
            );

            string keyHex = Program.Hex(best.KeyValue);
            TemplateEntry found;
            if (!keyMap.TryGetValue(keyHex, out found)) return Tuple.Create<string, int>(null, best.FarAttained);

            return Tuple.Create(found.AlunoId, best.FarAttained);
`;

  const bestNew = `            if (matchCount == 0) return Tuple.Create<string, int>(null, 0);

            int returned = Math.Min((int)matchCount, maxMatches);
            bool hasBest = false;
            Native.FTR_MATCHED_X_RECORD best = new Native.FTR_MATCHED_X_RECORD();

            for (int i = 0; i < returned; i++)
            {
                var candidate = (Native.FTR_MATCHED_X_RECORD)Marshal.PtrToStructure(
                    IntPtr.Add(matchesMem, i * matchSize),
                    typeof(Native.FTR_MATCHED_X_RECORD)
                );

                if (!hasBest || candidate.FarAttained > best.FarAttained)
                {
                    best = candidate;
                    hasBest = true;
                }
            }

            if (!hasBest) return Tuple.Create<string, int>(null, 0);

            // Calibracao fisica da Academia Piloto em 13/08/2026:
            // cadastrados: FAR 469..806; nao cadastrados candidatos: FAR 82..170.
            // O limite padrao 400 mantem margem para variacao genuina e rejeita
            // todos os falsos candidatos observados. Pode ser elevado por env.
            if (best.FarAttained < minFarAttained)
                return Tuple.Create<string, int>(null, best.FarAttained);

            string keyHex = Program.Hex(best.KeyValue);
            TemplateEntry found;
            if (!keyMap.TryGetValue(keyHex, out found)) return Tuple.Create<string, int>(null, best.FarAttained);

            return Tuple.Create(found.AlunoId, best.FarAttained);
`;

  if (!text.includes(bestOld)) fail("Bloco de escolha de candidato nao encontrado.");
  text = text.replace(bestOld, bestNew);

  const tenantAnchor = `    private static string ResolveTenant(string explicitTenant)
    {
        string value = explicitTenant;
        if (String.IsNullOrWhiteSpace(value)) value = Environment.GetEnvironmentVariable("FUSION_BIOMETRIA_TENANT_ID");
        if (String.IsNullOrWhiteSpace(value)) value = Environment.GetEnvironmentVariable("ACCESS_AGENT_TENANT_ID");
        if (String.IsNullOrWhiteSpace(value)) value = Environment.GetEnvironmentVariable("FUSION_TENANT_ID");
        return NormalizeTenantId(value);
    }
`;

  const tenantNew = tenantAnchor + `
    private static int ResolveFarMin()
    {
        const int defaultFar = 400;
        string raw = Environment.GetEnvironmentVariable("FUSION_BIOMETRIA_FAR_MIN");
        int parsed;
        if (!String.IsNullOrWhiteSpace(raw) && Int32.TryParse(raw, out parsed))
            return Math.Max(1, Math.Min(5000, parsed));
        return defaultFar;
    }
`;

  if (!text.includes(tenantAnchor)) fail("ResolveTenant nao encontrado.");
  text = text.replace(tenantAnchor, tenantNew);

  const monitorStartOld = `    private static int Monitor(string tenantId)
    {
        tenantId = ResolveTenant(tenantId);
        Print(new Dictionary<string, object> {
`;
  const monitorStartNew = `    private static int Monitor(string tenantId)
    {
        tenantId = ResolveTenant(tenantId);
        int farMinimo = ResolveFarMin();
        Print(new Dictionary<string, object> {
`;
  if (!text.includes(monitorStartOld)) fail("Inicio do Monitor nao encontrado.");
  text = text.replace(monitorStartOld, monitorStartNew);

  const monitorStatusOld = `            {"tenantIsolado", true},
            {"versao", "2"}
        });
`;
  const monitorStatusNew = `            {"tenantIsolado", true},
            {"farMinimo", farMinimo},
            {"versao", "2"}
        });
`;
  // Replace only the first matching status inside Monitor by locating after Monitor start.
  const monitorIdx = text.indexOf("    private static int Monitor(string tenantId)");
  const statusIdx = text.indexOf(monitorStatusOld, monitorIdx);
  if (statusIdx < 0) fail("Status inicial do Monitor nao encontrado.");
  text = text.slice(0, statusIdx) + monitorStatusNew + text.slice(statusIdx + monitorStatusOld.length);

  const callOld = `                    Tuple<string, int> result = fs80.Identify(items);
`;
  const callNew = `                    Tuple<string, int> result = fs80.Identify(items, farMinimo);
`;
  if (!text.includes(callOld)) fail("Chamada Identify nao encontrada.");
  text = text.replace(callOld, callNew);

  const identifiedOld = `                            {"farNumerico", result.Item2},
                            {"templateExposto", false}
`;
  const identifiedNew = `                            {"farNumerico", result.Item2},
                            {"farMinimo", farMinimo},
                            {"templateExposto", false}
`;
  if (!text.includes(identifiedOld)) fail("Evento identified nao encontrado.");
  text = text.replace(identifiedOld, identifiedNew);

  const noMatchOld = `                        Print(new Dictionary<string, object> {
                            {"event", "no-match"},
                            {"tenantId", tenantId},
                            {"templateExposto", false}
                        });
`;
  const noMatchNew = `                        Print(new Dictionary<string, object> {
                            {"event", "no-match"},
                            {"tenantId", tenantId},
                            {"farNumerico", result.Item2},
                            {"farMinimo", farMinimo},
                            {"motivo", result.Item2 > 0 ? "abaixo-limite-seguranca" : "sem-correspondencia"},
                            {"templateExposto", false}
                        });
`;
  if (!text.includes(noMatchOld)) fail("Evento no-match nao encontrado.");
  text = text.replace(noMatchOld, noMatchNew);

  fs.writeFileSync(file, text, "utf8");
  console.log("[OK] FAR minimo 400 aplicado.");
  console.log("[OK] Melhor candidato agora e escolhido pelo maior FarAttained.");
}

// Para somente a biometria; catraca/Henry continuam independentes.
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
    stdio: "inherit",
    windowsHide: false
  });
} catch {
  fail("Compilacao do FusionBiometriaFs80.exe falhou.");
}

console.log("[2/4] Validando fonte...");
if (!fs.existsSync(path.join(repo, "scripts", "biometria", "FusionBiometriaFs80.exe")))
  fail("Executavel compilado nao encontrado.");

console.log("[3/4] Criando commit...");
try {
  execFileSync("git", ["add", "--", "scripts/biometria/FusionBiometriaFs80.cs"], { cwd: repo, stdio: "inherit" });
  execFileSync("git", ["diff", "--cached", "--check"], { cwd: repo, stdio: "inherit" });

  const names = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: repo, encoding: "utf8" });
  if (names.includes("scripts/biometria/FusionBiometriaFs80.cs")) {
    execFileSync("git", ["commit", "-m", "fix: endurece reconhecimento biometrico FS80"], { cwd: repo, stdio: "inherit" });
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

console.log("[4/4] Rearmando modo acesso...");
try {
  execFileSync("schtasks.exe", ["/Run", "/TN", "Fusion Biometria FS80"], { stdio: "inherit" });
  console.log("[OK] Biometria reiniciada.");
} catch {
  console.log("[AVISO] Nao foi possivel iniciar automaticamente a tarefa biometrica.");
}

console.log("");
console.log("============================================================");
console.log("FS80_FAR_SEGURO_OK");
console.log("FAR_MINIMO=400");
console.log("FALSOS_CALIBRADOS_MAX=170");
console.log("VERDADEIROS_CALIBRADOS_MIN=469");
console.log("============================================================");
