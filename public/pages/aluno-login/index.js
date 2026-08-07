const $ = (id) => document.getElementById(id);

const TENANT_KEY = "fusion_aluno_tenant";
function tenantAtual() {
  const params = new URLSearchParams(location.search);
  const daUrl = String(params.get("tenant") || params.get("tenantId") || "").trim().toLowerCase();
  if (daUrl) localStorage.setItem(TENANT_KEY, daUrl);
  return daUrl || localStorage.getItem(TENANT_KEY) || "";
}

function mensagem(texto, tipo = "") {
  const el = $("mensagem");
  el.textContent = texto || "";
  el.className = `msg ${tipo}`.trim();
}

function destinoAposLogin(padrao) {
  const next = new URLSearchParams(location.search).get("next") || "";
  const rotasAluno = [
    "/pages/aluno-treinos/",
    "/pages/aluno-avaliacao/",
    "/pages/promocao-90-dias/",
    "/pages/portal-aluno-emergencial/"
  ];
  try {
    const destino = new URL(next, location.origin);
    const permitido = destino.origin === location.origin
      && rotasAluno.some((rota) => destino.pathname.startsWith(rota));
    return permitido ? `${destino.pathname}${destino.search}${destino.hash}` : padrao;
  } catch {
    return padrao;
  }
}

async function entrar() {
  const login = $("login").value.trim();
  const senha = $("senha").value.trim();
  if (!login || !senha) {
    mensagem("Informe login e senha.", "erro");
    return;
  }

  $("entrar").disabled = true;
  mensagem("Validando acesso...", "");

  try {
    const r = await fetch("/api/treinos/aluno-login", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(tenantAtual() ? { "X-Fusion-Tenant": tenantAtual() } : {}) },
      body: JSON.stringify({ login, senha, tenantId: tenantAtual() || undefined })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.mensagem || "Login inválido.");

    localStorage.setItem("fusion_aluno_treino_login", JSON.stringify({ ...data.dados, tenantId: data.dados?.tenantId || tenantAtual() }));
    localStorage.setItem("fusion_aluno_treino_selecionado", JSON.stringify({
      alunoId: data.dados.alunoId,
      alunoNome: data.dados.alunoNome
    }));
    window.FusionAlunoSessao?.registrarLogin(data.dados);
    mensagem("Acesso liberado.", "ok");
    location.href = destinoAposLogin(`/pages/portal-aluno-emergencial/index.html?alunoId=${encodeURIComponent(data.dados.alunoId)}`);
  } catch (erro) {
    mensagem(erro.message || "Erro ao entrar.", "erro");
  } finally {
    $("entrar").disabled = false;
  }
}

const motivo = new URLSearchParams(location.search).get("motivo");
if (motivo === "outro_acesso") {
  mensagem("Este aluno entrou em outro aparelho ou janela. Faça login novamente.", "erro");
}

$("entrar").onclick = entrar;
["login", "senha"].forEach((id) => {
  $(id).addEventListener("keydown", (ev) => { if (ev.key === "Enter") entrar(); });
});
