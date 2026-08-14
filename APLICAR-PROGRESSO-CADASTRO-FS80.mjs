import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.cwd();
const P = (...parts) => path.join(repo, ...parts);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = P("data", "backup-fs80-progresso-cadastro", stamp);

function fail(message) {
  console.error("[ERRO] " + message);
  process.exit(1);
}
function read(rel) {
  const file = P(...rel.split("/"));
  if (!fs.existsSync(file)) fail(`Arquivo nao encontrado: ${rel}`);
  return fs.readFileSync(file, "utf8");
}
function write(rel, content) {
  const file = P(...rel.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
function backup(rel) {
  const file = P(...rel.split("/"));
  if (!fs.existsSync(file)) return;
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(file, path.join(backupDir, rel.replace(/[\\/]/g, "__")));
}
function replaceOnce(text, oldText, newText, label) {
  if (!text.includes(oldText)) fail(`Patch incompativel em: ${label}`);
  return text.replace(oldText, newText);
}
function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, { cwd: repo, stdio: "inherit", ...options });
}
function stopBiometria() {
  try { execFileSync("schtasks.exe", ["/End", "/TN", "Fusion Biometria FS80"], { stdio: "ignore" }); } catch {}
  try {
    execFileSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*fusion-biometria-sidecar.mjs*') -or $_.Name -eq 'FusionBiometriaFs80.exe' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    ], { stdio: "ignore", windowsHide: true });
  } catch {}
}

console.log("============================================================");
console.log("FUSION ERP - PROGRESSO VISUAL CADASTRO FS80");
console.log("============================================================");

const targets = [
  "modules/access-bridge/access-bridge.repository.mjs",
  "modules/access-bridge/access-bridge.service.mjs",
  "modules/access-bridge/access-bridge.routes.mjs",
  "modules/biometria/biometria-bridge.service.mjs",
  "modules/biometria/biometria.routes.mjs",
  "scripts/fusion-biometria-sidecar.mjs",
  "scripts/biometria/FusionBiometriaFs80.cs",
  "public/pages/alunos/index.js",
  "public/pages/alunos/style.css",
  "public/pages/alunos/index.html"
];

console.log("[1/10] Parando somente a biometria...");
stopBiometria();

console.log("[2/10] Salvando backup...");
for (const rel of targets) backup(rel);

console.log("[3/10] Adicionando progresso ao Access Bridge...");
let repoText = read("modules/access-bridge/access-bridge.repository.mjs");

if (!repoText.includes("export async function updateCommandProgress(")) {
  const anchor = `export async function getCommand(id) {`;
  const fn = `export async function updateCommandProgress(id, agentId, progress = {}) {
  const safe = progress && typeof progress === 'object' && !Array.isArray(progress)
    ? {
        percentual: Math.max(0, Math.min(99, Number(progress.percentual || 0))),
        etapa: String(progress.etapa || '').slice(0, 80),
        mensagem: String(progress.mensagem || '').slice(0, 220),
        atividade: Math.max(0, Math.min(3, Number(progress.atividade || 0))),
        atualizadoEm: isoDate()
      }
    : {};

  const result = { progress: safe };
  const supabase = await supabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('access_bridge_commands')
      .update({ result })
      .eq('id', id)
      .eq('agent_id', agentId)
      .eq('status', 'processing')
      .select()
      .maybeSingle();
    if (error) throw error;
    return normalize(data);
  }

  const rows = await readJson(FILE, []);
  const row = rows.find(item => item.id === id && item.agentId === agentId && item.status === 'processing');
  if (!row) return null;
  row.result = result;
  await writeJson(FILE, rows);
  return row;
}

${anchor}`;
  repoText = replaceOnce(repoText, anchor, fn, "repository progress");
}
write("modules/access-bridge/access-bridge.repository.mjs", repoText);

let serviceText = read("modules/access-bridge/access-bridge.service.mjs");
serviceText = serviceText.replace(
  "import { createCommand, claimNext, finishCommand, getCommand, saveHeartbeat, getAgent } from './access-bridge.repository.mjs';",
  "import { createCommand, claimNext, finishCommand, getCommand, saveHeartbeat, getAgent, updateCommandProgress } from './access-bridge.repository.mjs';"
);
serviceText = serviceText.replace(
  "export { claimNext, finishCommand, getCommand, saveHeartbeat, getAgent };",
  "export { claimNext, finishCommand, getCommand, saveHeartbeat, getAgent, updateCommandProgress };"
);
write("modules/access-bridge/access-bridge.service.mjs", serviceText);

let bridgeRoutes = read("modules/access-bridge/access-bridge.routes.mjs");
bridgeRoutes = bridgeRoutes.replace(
  "import { validateAgent, validateCommandApi, queueRelease, claimNext, finishCommand, getCommand, saveHeartbeat, getAgent } from './access-bridge.service.mjs';",
  "import { validateAgent, validateCommandApi, queueRelease, claimNext, finishCommand, getCommand, saveHeartbeat, getAgent, updateCommandProgress } from './access-bridge.service.mjs';"
);

if (!bridgeRoutes.includes("router.post('/agent/commands/:id/progress'")) {
  const anchor = `router.post('/agent/commands/:id/result', wrap(async (req, res) => {`;
  const route = `router.post('/agent/commands/:id/progress', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  const command = await updateCommandProgress(req.params.id, agent.agentId, req.body || {});
  if (!command) return res.status(404).json({ ok: false, erro: 'Comando em processamento nao encontrado' });
  res.json({ ok: true });
}));

${anchor}`;
  bridgeRoutes = replaceOnce(bridgeRoutes, anchor, route, "agent progress route");
}
write("modules/access-bridge/access-bridge.routes.mjs", bridgeRoutes);

console.log("[4/10] Transformando cadastro web em comando assincrono...");
let bridgeService = read("modules/biometria/biometria-bridge.service.mjs");

if (!bridgeService.includes("export async function consultarComandoBiometria(")) {
  bridgeService += `

export async function consultarComandoBiometria(commandId) {
  const id = texto(commandId, 160);
  if (!id) throw erro('commandId obrigatorio.', 400);

  const command = await getCommand(id);
  if (!command) throw erro('Comando biometrico nao encontrado.', 404);

  const tenantId = tenantAtual();
  if (command.tenantId !== tenantId) throw erro('Comando pertence a outro tenant.', 403);
  if (command.action !== 'biometria_enroll') throw erro('Comando nao pertence ao cadastro biometrico.', 400);

  return command;
}
`;
}
write("modules/biometria/biometria-bridge.service.mjs", bridgeService);

let bioRoutes = read("modules/biometria/biometria.routes.mjs");
bioRoutes = bioRoutes.replace(
  "import { executarBiometria } from './biometria-bridge.service.mjs';",
  "import { executarBiometria, enfileirarBiometria, consultarComandoBiometria } from './biometria-bridge.service.mjs';"
);

const oldEnrollRoute = `router.post('/sdk/cadastrar', async (req, res) => {
  try {
    const alunoId = String(req.body?.alunoId || '').trim();
    const { command, result } = await executarBiometria('biometria_enroll', { alunoId }, { ttlSeconds: 120, timeoutMs: 95000 });
    res.status(201).json({
      ok: true,
      biometria: {
        alunoId,
        cadastrada: true,
        qualidade: Number(result?.qualidade || 0) || undefined,
        qualidadeMedia: Number(result?.qualidade || 0) || undefined,
        armazenamento: 'local-dpapi',
        tenantIsolado: true,
        templateExposto: false
      },
      commandId: command.id,
      mensagem: 'Biometria Futronic cadastrada no computador da academia.'
    });
  } catch (error) {
    tratar(res, error);
  }
});`;

const newEnrollRoute = `router.post('/sdk/cadastrar', async (req, res) => {
  try {
    const alunoId = String(req.body?.alunoId || '').trim();
    if (!alunoId) return res.status(400).json({ ok: false, mensagem: 'alunoId obrigatorio.' });

    const command = await enfileirarBiometria('biometria_enroll', { alunoId }, 120);
    res.status(202).json({
      ok: true,
      commandId: command.id,
      status: command.status,
      progresso: {
        percentual: 2,
        etapa: 'fila',
        mensagem: 'Cadastro enviado ao computador da academia.',
        atividade: 0
      }
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.get('/sdk/comandos/:commandId', async (req, res) => {
  try {
    const command = await consultarComandoBiometria(req.params.commandId);
    const result = command.result && typeof command.result === 'object' ? command.result : {};
    const progress = result.progress && typeof result.progress === 'object' ? result.progress : null;

    if (command.status === 'completed') {
      const qualidade = Number(result.qualidade || 0);
      return res.json({
        ok: true,
        status: command.status,
        commandId: command.id,
        progresso: {
          percentual: 100,
          etapa: 'concluido',
          mensagem: 'Biometria cadastrada e salva.',
          atividade: 3
        },
        biometria: {
          alunoId: String(result.alunoId || ''),
          cadastrada: true,
          qualidade: qualidade > 0 ? qualidade : undefined,
          qualidadeMedia: qualidade > 0 ? qualidade : undefined,
          armazenamento: 'local-dpapi',
          tenantIsolado: true,
          templateExposto: false
        },
        mensagem: 'Biometria Futronic cadastrada no computador da academia.'
      });
    }

    return res.json({
      ok: true,
      status: command.status,
      commandId: command.id,
      progresso: progress,
      erro: command.status === 'failed' ? (command.error || 'Falha no cadastro biometrico.') : '',
      mensagem: command.status === 'failed' ? (command.error || 'Falha no cadastro biometrico.') : ''
    });
  } catch (error) {
    tratar(res, error);
  }
});`;

if (!bioRoutes.includes("router.get('/sdk/comandos/:commandId'")) {
  bioRoutes = replaceOnce(bioRoutes, oldEnrollRoute, newEnrollRoute, "async biometric route");
}
write("modules/biometria/biometria.routes.mjs", bioRoutes);

console.log("[5/10] Fazendo o sidecar transmitir progresso...");
let sidecar = read("scripts/fusion-biometria-sidecar.mjs");

const oldRunExe = `function runExe(args, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd: path.dirname(exe), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { try { child.kill(); } catch {} reject(new Error('Tempo limite da operacao biometrica excedido.')); }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => {
      clearTimeout(timer);
      const lines = out.split(/\\r?\\n/).map(s => s.trim()).filter(Boolean);
      let payload = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        try { payload = JSON.parse(lines[i]); break; } catch {}
      }
      if (!payload) return reject(new Error(err.trim() || \`Operacao biometrica encerrou sem resposta valida (code=\${code}).\`));
      if (code !== 0 || payload.ok === false) return reject(new Error(payload.erro || err.trim() || 'Falha na operacao biometrica.'));
      resolve(payload);
    });
  });
}`;

const newRunExe = `function runExe(args, timeoutMs = 90000, onEvent = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd: path.dirname(exe), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    let liveBuffer = '';

    const emitLine = line => {
      const text = String(line || '').trim();
      if (!text || typeof onEvent !== 'function') return;
      try { onEvent(JSON.parse(text)); } catch {}
    };

    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      reject(new Error('Tempo limite da operacao biometrica excedido.'));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      const text = String(chunk || '');
      out += text;
      liveBuffer += text;
      let pos;
      while ((pos = liveBuffer.indexOf('\\n')) >= 0) {
        emitLine(liveBuffer.slice(0, pos));
        liveBuffer = liveBuffer.slice(pos + 1);
      }
    });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => {
      clearTimeout(timer);
      if (liveBuffer.trim()) emitLine(liveBuffer);
      const lines = out.split(/\\r?\\n/).map(s => s.trim()).filter(Boolean);
      let payload = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const candidate = JSON.parse(lines[i]);
          if (candidate && (Object.prototype.hasOwnProperty.call(candidate, 'ok') || candidate.acao)) {
            payload = candidate;
            break;
          }
        } catch {}
      }
      if (!payload) return reject(new Error(err.trim() || \`Operacao biometrica encerrou sem resposta valida (code=\${code}).\`));
      if (code !== 0 || payload.ok === false) return reject(new Error(payload.erro || err.trim() || 'Falha na operacao biometrica.'));
      resolve(payload);
    });
  });
}`;

if (!sidecar.includes("function runExe(args, timeoutMs = 90000, onEvent = null)")) {
  sidecar = replaceOnce(sidecar, oldRunExe, newRunExe, "sidecar live stdout");
}

if (!sidecar.includes("async function sendAdminProgress(")) {
  const anchor = `async function finishAdminCommand(commandId, outcome) {`;
  const fn = `async function sendAdminProgress(commandId, progress = {}) {
  try {
    const response = await fetch(\`\${server}/api/access-bridge/agent/commands/\${encodeURIComponent(commandId)}/progress\`, {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify(progress),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok && response.status !== 404) {
      console.error(\`[BIOMETRIA] progresso HTTP \${response.status}\`);
    }
  } catch (error) {
    console.error(\`[BIOMETRIA] falha ao enviar progresso: \${error.message}\`);
  }
}

${anchor}`;
  sidecar = replaceOnce(sidecar, anchor, fn, "send progress");
}

const oldEnrollSidecar = `    } else if (action === 'biometria_enroll') {
      // Um unico dono do FS80 por vez:
      // acesso OFF -> aguarda SDK liberar -> cadastro ON.
      setBiometricMode('cadastro');
      await stopMonitorForAdmin();
      result = await runExe(['enroll', alunoId, tenantId], 90000);
      // Garante que o processo de cadastro fechou FTRAPI antes do rearmamento.
      await sleep(sdkReleaseMs);`;

const newEnrollSidecar = `    } else if (action === 'biometria_enroll') {
      // Um unico dono do FS80 por vez:
      // acesso OFF -> aguarda SDK liberar -> cadastro ON.
      setBiometricMode('cadastro');
      await sendAdminProgress(command.id, {
        percentual: 5,
        etapa: 'preparando',
        mensagem: 'Preparando o leitor Futronic para cadastro.',
        atividade: 0
      });

      await stopMonitorForAdmin();

      await sendAdminProgress(command.id, {
        percentual: 12,
        etapa: 'leitor_exclusivo',
        mensagem: 'Leitor reservado para o cadastro. Verificando a digital.',
        atividade: 0
      });

      result = await runExe(['enroll', alunoId, tenantId], 90000, evt => {
        if (evt?.event !== 'enroll-progress') return;
        void sendAdminProgress(command.id, {
          percentual: Number(evt.percentual || 0),
          etapa: String(evt.etapa || 'capturando'),
          mensagem: String(evt.mensagem || 'Capturando amostras no Futronic.'),
          atividade: Number(evt.atividade || 0)
        });
      });

      await sendAdminProgress(command.id, {
        percentual: 97,
        etapa: 'finalizando',
        mensagem: 'Template protegido e salvo. Finalizando cadastro.',
        atividade: 3
      });

      // Garante que o processo de cadastro fechou FTRAPI antes do rearmamento.
      await sleep(sdkReleaseMs);`;

if (!sidecar.includes("etapa: 'leitor_exclusivo'")) {
  sidecar = replaceOnce(sidecar, oldEnrollSidecar, newEnrollSidecar, "sidecar enroll progress");
}
write("scripts/fusion-biometria-sidecar.mjs", sidecar);

console.log("[6/10] Instrumentando atividade do SDK Futronic...");
let cs = read("scripts/biometria/FusionBiometriaFs80.cs");

if (!cs.includes("public Action<int> EnrollmentActivity")) {
  cs = replaceOnce(
    cs,
    `    private readonly Native.StateControl callback;
    private bool initialized;`,
    `    private readonly Native.StateControl callback;
    private bool initialized;
    private DateTime lastEnrollmentActivityAt = DateTime.MinValue;
    private int enrollmentActivitySequence = 0;
    public Action<int> EnrollmentActivity { get; set; }`,
    "C# enrollment fields"
  );

  cs = replaceOnce(
    cs,
    `    private void Callback(IntPtr context, uint stateMask, ref uint response, uint signal, IntPtr bitmap)
    {
        response = Native.CONTINUE;
    }`,
    `    private void Callback(IntPtr context, uint stateMask, ref uint response, uint signal, IntPtr bitmap)
    {
        response = Native.CONTINUE;

        // Este evento e apenas telemetria visual para o operador. Ele NAO decide
        // se uma amostra foi aceita e NAO altera o algoritmo Futronic.
        // Agrupa atividade do callback em no maximo 3 etapas visuais.
        Action<int> progress = EnrollmentActivity;
        if (progress != null)
        {
            DateTime now = DateTime.UtcNow;
            if (lastEnrollmentActivityAt == DateTime.MinValue ||
                (now - lastEnrollmentActivityAt).TotalMilliseconds >= 1200)
            {
                lastEnrollmentActivityAt = now;
                if (enrollmentActivitySequence < 3)
                {
                    enrollmentActivitySequence += 1;
                    try { progress(enrollmentActivitySequence); } catch {}
                }
            }
        }
    }`,
    "C# callback telemetry"
  );
}

if (!cs.includes('{"event", "enroll-progress"}')) {
  const afterExisting = `            finally
            {
                ClearTemplates(existentes);
            }

            int quality;
            byte[] template = fs80.Enroll(out quality);`;

  const withProgress = `            finally
            {
                ClearTemplates(existentes);
            }

            Print(new Dictionary<string, object> {
                {"event", "enroll-progress"},
                {"etapa", "aguardando_amostras"},
                {"percentual", 22},
                {"atividade", 0},
                {"mensagem", "Leitor pronto. Posicione o mesmo dedo e siga as tres leituras."},
                {"tenantId", tenantId}
            });

            fs80.EnrollmentActivity = delegate(int atividade) {
                int percentual = atividade == 1 ? 38 : (atividade == 2 ? 58 : 78);
                Print(new Dictionary<string, object> {
                    {"event", "enroll-progress"},
                    {"etapa", "capturando"},
                    {"percentual", percentual},
                    {"atividade", atividade},
                    {"mensagem", "Futronic recebeu atividade do dedo. Continue seguindo as solicitacoes do leitor."},
                    {"tenantId", tenantId}
                });
            };

            int quality;
            byte[] template = fs80.Enroll(out quality);
            fs80.EnrollmentActivity = null;

            Print(new Dictionary<string, object> {
                {"event", "enroll-progress"},
                {"etapa", "protegendo"},
                {"percentual", 90},
                {"atividade", 3},
                {"mensagem", "Tres amostras concluidas. Protegendo e salvando a biometria."},
                {"tenantId", tenantId}
            });`;

  cs = replaceOnce(cs, afterExisting, withProgress, "C# progress events");
}
write("scripts/biometria/FusionBiometriaFs80.cs", cs);

console.log("[7/10] Atualizando a tela do operador...");
let ui = read("public/pages/alunos/index.js");

const oldRender = `  function renderAmostras(concluidas = false, qualidade = 0) {
    document.querySelectorAll("#biometriaCapturas [data-captura]").forEach((card, indice) => {
      card.classList.toggle("aceita", concluidas);
      card.classList.remove("rejeitada");
      const strong = card.querySelector("strong");
      if (strong) strong.textContent = concluidas ? \`\${qualidade}% — aceita\` : "Aguardando";
    });
    const salvar = el("btnBiometriaSalvar");
    if (salvar) { salvar.disabled = true; salvar.textContent = "Salvo automaticamente"; }
  }`;

const newRender = `  function garantirPainelProgresso() {
    let painel = el("biometriaProgresso");
    if (painel) return painel;
    const mensagemBox = el("biometriaMensagem");
    if (!mensagemBox) return null;

    painel = document.createElement("div");
    painel.id = "biometriaProgresso";
    painel.className = "biometria-progresso";
    painel.innerHTML = \`
      <div class="biometria-progresso-topo">
        <span id="biometriaProgressoEtapa">Pronto para iniciar</span>
        <strong id="biometriaProgressoPercentual">0%</strong>
      </div>
      <div class="biometria-progresso-barra" aria-hidden="true"><i id="biometriaProgressoBarra"></i></div>
      <small id="biometriaProgressoDetalhe">O progresso aparece aqui durante o cadastro.</small>
    \`;
    mensagemBox.insertAdjacentElement("afterend", painel);
    return painel;
  }

  function atualizarProgresso(progresso = {}) {
    garantirPainelProgresso();
    const percentual = Math.max(0, Math.min(100, Number(progresso.percentual || 0)));
    const etapa = String(progresso.etapa || "").replaceAll("_", " ");
    const detalhe = String(progresso.mensagem || "");
    const atividade = Math.max(0, Math.min(3, Number(progresso.atividade || 0)));

    if (el("biometriaProgressoPercentual")) el("biometriaProgressoPercentual").textContent = \`\${Math.round(percentual)}%\`;
    if (el("biometriaProgressoEtapa")) el("biometriaProgressoEtapa").textContent = etapa || "Processando cadastro";
    if (el("biometriaProgressoDetalhe")) el("biometriaProgressoDetalhe").textContent = detalhe || "Cadastro biométrico em andamento.";
    if (el("biometriaProgressoBarra")) el("biometriaProgressoBarra").style.width = \`\${percentual}%\`;

    if (atividade > 0 && percentual < 100) {
      document.querySelectorAll("#biometriaCapturas [data-captura]").forEach((card, indice) => {
        card.classList.remove("aceita", "rejeitada");
        const strong = card.querySelector("strong");
        if (!strong) return;
        if (indice + 1 < atividade) strong.textContent = "Processada";
        else if (indice + 1 === atividade) strong.textContent = "Em leitura...";
        else strong.textContent = "Aguardando";
      });
    }
  }

  function renderAmostras(concluidas = false, qualidade = 0) {
    const q = Number(qualidade || 0);
    document.querySelectorAll("#biometriaCapturas [data-captura]").forEach((card) => {
      card.classList.toggle("aceita", concluidas);
      card.classList.remove("rejeitada");
      const strong = card.querySelector("strong");
      if (strong) strong.textContent = concluidas
        ? (q > 0 ? \`Aceita · qualidade \${q}%\` : "Aceita")
        : "Aguardando";
    });
    const salvar = el("btnBiometriaSalvar");
    if (salvar) { salvar.disabled = true; salvar.textContent = "Salvo automaticamente"; }
  }`;

if (!ui.includes("function garantirPainelProgresso()")) {
  ui = replaceOnce(ui, oldRender, newRender, "operator progress UI");
}

const oldCadastrar = `  async function cadastrar() {
    if (estado.ocupada) return;
    const aluno = atualizarVinculo();
    if (!aluno.id) return mensagem("Salve o aluno antes de cadastrar a biometria.", "erro");
    estado.ocupada = true;
    const botao = el("btnBiometriaCapturar");
    if (botao) { botao.disabled = true; botao.textContent = "Aguardando as 3 amostras..."; }
    renderAmostras(false);
    mensagem("Coloque o mesmo dedo no leitor. O SDK solicitará três amostras; retire e recoloque quando indicado.");
    try {
      const r = await bioApi("/sdk/cadastrar", {
        method: "POST",
        body: JSON.stringify({ alunoId: aluno.id, alunoNome: aluno.nome })
      });
      const bio = r.biometria || {};
      renderAmostras(true, bio.qualidadeMedia || bio.qualidade || 0);
      mensagem(r.mensagem || "Biometria cadastrada e vinculada ao aluno.", "sucesso");
      await carregarCadastro();
      if (typeof carregarAlunos === "function") await carregarAlunos();
    } catch (e) {
      renderAmostras(false);
      mensagem(e.message, "erro");
    } finally {
      estado.ocupada = false;
      if (botao) { botao.disabled = false; botao.textContent = "Cadastrar biometria"; }
    }
  }`;

const newCadastrar = `  function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function acompanharCadastro(commandId) {
    const inicio = Date.now();
    while (Date.now() - inicio < 100000) {
      const r = await bioApi(\`/sdk/comandos/\${encodeURIComponent(commandId)}\`, { method: "GET" });
      if (r.progresso) atualizarProgresso(r.progresso);

      if (r.status === "completed") return r;
      if (r.status === "failed" || r.status === "expired") {
        throw new Error(r.erro || r.mensagem || "Falha no cadastro biométrico.");
      }
      await esperar(300);
    }
    throw new Error("Tempo limite aguardando o cadastro biométrico.");
  }

  async function cadastrar() {
    if (estado.ocupada) return;
    const aluno = atualizarVinculo();
    if (!aluno.id) return mensagem("Salve o aluno antes de cadastrar a biometria.", "erro");
    estado.ocupada = true;
    const botao = el("btnBiometriaCapturar");
    if (botao) { botao.disabled = true; botao.textContent = "Cadastro em andamento..."; }

    garantirPainelProgresso();
    renderAmostras(false);
    atualizarProgresso({
      percentual: 1,
      etapa: "iniciando",
      mensagem: "Enviando o cadastro ao computador da academia.",
      atividade: 0
    });
    mensagem("Cadastro iniciado. Acompanhe abaixo o andamento do leitor.");

    try {
      const inicio = await bioApi("/sdk/cadastrar", {
        method: "POST",
        body: JSON.stringify({ alunoId: aluno.id, alunoNome: aluno.nome })
      });

      if (!inicio.commandId) throw new Error("O servidor não retornou o identificador do cadastro.");
      if (inicio.progresso) atualizarProgresso(inicio.progresso);

      const r = await acompanharCadastro(inicio.commandId);
      const bio = r.biometria || {};
      atualizarProgresso(r.progresso || {
        percentual: 100,
        etapa: "concluído",
        mensagem: "Biometria cadastrada e salva.",
        atividade: 3
      });
      renderAmostras(true, bio.qualidadeMedia || bio.qualidade || 0);
      mensagem(r.mensagem || "Biometria cadastrada e vinculada ao aluno.", "sucesso");
      await carregarCadastro();
      if (typeof carregarAlunos === "function") await carregarAlunos();
    } catch (e) {
      mensagem(e.message, "erro");
      document.querySelectorAll("#biometriaCapturas [data-captura]").forEach(card => {
        if (!card.classList.contains("aceita")) card.classList.add("rejeitada");
      });
      if (el("biometriaProgressoEtapa")) el("biometriaProgressoEtapa").textContent = "Cadastro interrompido";
    } finally {
      estado.ocupada = false;
      if (botao) { botao.disabled = false; botao.textContent = "Cadastrar biometria"; }
    }
  }`;

if (!ui.includes("async function acompanharCadastro(commandId)")) {
  ui = replaceOnce(ui, oldCadastrar, newCadastrar, "async operator enrollment");
}

if (!ui.includes("garantirPainelProgresso();\n    el(\"btnBiometriaTestar\")")) {
  ui = ui.replace(
    `  document.addEventListener("DOMContentLoaded", () => {
    el("btnBiometriaTestar")`,
    `  document.addEventListener("DOMContentLoaded", () => {
    garantirPainelProgresso();
    el("btnBiometriaTestar")`
  );
}
write("public/pages/alunos/index.js", ui);

let css = read("public/pages/alunos/style.css");
if (!css.includes(".biometria-progresso{")) {
  css += `

/* Progresso operacional do cadastro Futronic.
   O percentual representa o andamento do processo, nao uma nota biometrica inventada. */
.biometria-progresso{display:grid;gap:8px;border:1px solid #bae6fd;background:#f0f9ff;border-radius:11px;padding:12px}
.biometria-progresso-topo{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#0c4a6e}
.biometria-progresso-topo span{font-weight:800;text-transform:capitalize}
.biometria-progresso-topo strong{font-size:18px}
.biometria-progresso-barra{height:10px;overflow:hidden;border-radius:999px;background:#dbeafe}
.biometria-progresso-barra i{display:block;width:0;height:100%;background:#06b6d4;border-radius:999px;transition:width .22s ease}
.biometria-progresso small{color:#475569}
.biometria-capturas>div:not(.aceita):not(.rejeitada) strong{color:#0f172a}
`;
}
write("public/pages/alunos/style.css", css);

let html = read("public/pages/alunos/index.html");
html = html.replace(
  /href="\.\/style\.css\?v=[^"]+"/,
  'href="./style.css?v=20260813-fs80-progress-1"'
);
html = html.replace(
  /src="\.\/index\.js\?v=[^"]+"/,
  'src="./index.js?v=20260813-fs80-progress-1"'
);
write("public/pages/alunos/index.html", html);

console.log("[8/10] Validando JavaScript...");
for (const rel of [
  "modules/access-bridge/access-bridge.repository.mjs",
  "modules/access-bridge/access-bridge.service.mjs",
  "modules/access-bridge/access-bridge.routes.mjs",
  "modules/biometria/biometria-bridge.service.mjs",
  "modules/biometria/biometria.routes.mjs",
  "scripts/fusion-biometria-sidecar.mjs",
  "public/pages/alunos/index.js"
]) {
  run(process.execPath, ["--check", P(...rel.split("/"))]);
}

console.log("[9/10] Compilando FS80...");
try {
  run("cmd.exe", ["/d", "/c", "scripts\\biometria\\COMPILAR-BIOMETRIA-FS80.bat"]);
} catch {
  fail("Falha ao compilar FusionBiometriaFs80.exe. Backup em: " + backupDir);
}

console.log("[10/10] Commit/push e rearmamento...");
const tracked = [
  "modules/access-bridge/access-bridge.repository.mjs",
  "modules/access-bridge/access-bridge.service.mjs",
  "modules/access-bridge/access-bridge.routes.mjs",
  "modules/biometria/biometria-bridge.service.mjs",
  "modules/biometria/biometria.routes.mjs",
  "scripts/fusion-biometria-sidecar.mjs",
  "scripts/biometria/FusionBiometriaFs80.cs",
  "public/pages/alunos/index.js",
  "public/pages/alunos/style.css",
  "public/pages/alunos/index.html"
];

run("git", ["add", "--", ...tracked]);
run("git", ["diff", "--cached", "--check"]);

const changed = execFileSync("git", ["diff", "--cached", "--name-only"], {
  cwd: repo,
  encoding: "utf8"
}).trim();

if (changed) {
  run("git", ["commit", "-m", "fix: mostra progresso do cadastro biometrico FS80"]);
  try {
    run("git", ["push"]);
    console.log("[OK] Codigo enviado ao GitHub.");
  } catch {
    console.log("[AVISO] Commit criado, mas git push falhou.");
  }
} else {
  console.log("[OK] Correcao ja estava aplicada.");
}

try {
  execFileSync("schtasks.exe", ["/Run", "/TN", "Fusion Biometria FS80"], { stdio: "inherit" });
  console.log("[OK] Biometria rearmada.");
} catch {
  console.log("[AVISO] Nao foi possivel rearmar automaticamente a tarefa biometrica.");
}

console.log("");
console.log("============================================================");
console.log("FS80_PROGRESSO_CADASTRO_OK");
console.log("Tela mostra percentual e andamento somente durante o cadastro.");
console.log("Capturas ficam verdes somente apos confirmacao final do SDK.");
console.log("Qualidade 0 nao sera mais exibida como 0%% - aceita.");
console.log("============================================================");
