const $ = (id) => document.getElementById(id);
let painelTimer = null;

async function api(url, opt = {}) {
  const resp = await fetch(url, { ...opt, headers: { "Content-Type": "application/json", ...(opt.headers || {}) } });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `Erro HTTP ${resp.status}`);
  return json;
}

function escapeHtml(v) { return String(v ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }
function statusCadastro(texto, tipo = "") { $("status").textContent = texto; $("status").dataset.tipo = tipo; }
function statusAcesso(texto, tipo = "") { $("acessoStatus").textContent = texto; $("acessoStatus").dataset.tipo = tipo; }

function renderAcesso(resultado) {
  const box = $("acessoResultado");
  if (!resultado) {
    box.className = "acesso-resultado neutro";
    box.innerHTML = "<strong>AGUARDANDO DIGITAL</strong><span>O motor funciona no servidor, mesmo com esta página fechada.</span>";
    return;
  }
  const aluno = resultado.aluno || resultado.acesso?.aluno;
  box.className = `acesso-resultado ${resultado.autorizado ? "liberado" : "negado"}`;
  box.innerHTML = resultado.autorizado
    ? `<strong>ACESSO LIBERADO</strong><span>${escapeHtml(aluno?.nome || "Aluno identificado")} · Henry 7X acionada</span>`
    : `<strong>ACESSO NEGADO</strong><span>${escapeHtml(resultado.motivo || "Digital não reconhecida")}</span>`;
}

async function atualizarPainel() {
  try {
    const estado = await api("/api/biometria/motor/status");
    const mensagem = estado.ativo
      ? (estado.ultimoErro || (estado.processando ? "Leitor armado. Encoste o dedo." : "Leitura continua ativa. Aguardando digital..."))
      : "Motor biometrico parado.";
    statusAcesso(estado.ativo ? "Leitura contínua ativa. Aguardando digital..." : "Motor biométrico parado.", estado.ativo ? "ok" : "erro");
    statusAcesso(mensagem, estado.ativo && !estado.ultimoErro ? "ok" : "erro");
    renderAcesso(estado.ultimoResultado);
    $("btnIniciarAcesso").disabled = estado.ativo;
    $("btnPararAcesso").disabled = !estado.ativo;
  } catch (e) { statusAcesso(e.message, "erro"); }
}

async function iniciarAcesso() { try { await api("/api/biometria/motor/iniciar", { method: "POST", body: "{}" }); await atualizarPainel(); } catch (e) { statusAcesso(e.message, "erro"); } }
async function pararAcesso() { try { await api("/api/biometria/motor/parar", { method: "POST", body: "{}" }); await atualizarPainel(); } catch (e) { statusAcesso(e.message, "erro"); } }
async function testarLeitor() { try { const r = await api("/api/biometria/status"); const conectado = Boolean(r.local?.conectado ?? r.local?.ok); statusAcesso(conectado ? "Leitor Futronic conectado." : "Leitor Futronic não conectado.", conectado ? "ok" : "erro"); } catch (e) { statusAcesso(e.message, "erro"); } }

async function carregarAlunoDaUrl() {
  const qs = new URLSearchParams(location.search);
  $("alunoId").value = qs.get("alunoId") || "";
  $("alunoNome").value = qs.get("alunoNome") || qs.get("nome") || "";
  if (!$("alunoId").value) return;
  try { const r = await api(`/api/biometria/aluno/${encodeURIComponent($("alunoId").value)}`); if (r.biometria) statusCadastro("Este aluno já possui biometria cadastrada.", "ok"); } catch {}
}

async function cadastrar() {
  try {
    const alunoId = $("alunoId").value.trim();
    if (!alunoId) throw new Error("Informe o ID do aluno.");
    $("btnCadastrar").disabled = true;
    statusCadastro("Coloque e retire o mesmo dedo conforme solicitado pelo leitor...");
    await api("/api/biometria/sdk/cadastrar", { method: "POST", body: JSON.stringify({ alunoId, alunoNome: $("alunoNome").value.trim() }) });
    statusCadastro("Biometria cadastrada. O motor contínuo foi reativado.", "ok");
  } catch (e) { statusCadastro(e.message, "erro"); }
  finally { $("btnCadastrar").disabled = false; }
}

async function excluir() {
  try {
    const alunoId = $("alunoId").value.trim();
    if (!alunoId) throw new Error("Informe o ID do aluno.");
    if (!confirm("Excluir a biometria deste aluno?")) return;
    await api(`/api/biometria/aluno/${encodeURIComponent(alunoId)}`, { method: "DELETE" });
    statusCadastro("Biometria removida do aluno.", "ok");
  } catch (e) { statusCadastro(e.message, "erro"); }
}

$("btnIniciarAcesso").addEventListener("click", iniciarAcesso);
$("btnPararAcesso").addEventListener("click", pararAcesso);
$("btnTestarLeitor").addEventListener("click", testarLeitor);
$("btnCadastrar").addEventListener("click", cadastrar);
$("btnExcluir").addEventListener("click", excluir);

(async function inicializarPagina() {
  await carregarAlunoDaUrl();
  await atualizarPainel();
  painelTimer = setInterval(atualizarPainel, 1000);
})();
