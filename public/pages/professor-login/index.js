const $ = (id) => document.getElementById(id);

const TENANT_KEY = "fusion_professor_tenant";
function tenantAtual() {
  const params = new URLSearchParams(location.search);
  const daUrl = String(params.get("tenant") || params.get("tenantId") || "").trim().toLowerCase();
  if (daUrl) localStorage.setItem(TENANT_KEY, daUrl);
  return daUrl || localStorage.getItem(TENANT_KEY) || "";
}

function texto(v) {
  return String(v ?? "").trim();
}

function mensagem(textoMsg, tipo = "") {
  const el = $("mensagem");
  el.textContent = textoMsg || "";
  el.className = `msg ${tipo}`.trim();
}

function destinoAposLogin(padrao) {
  const next = new URLSearchParams(location.search).get("next") || "";
  const rotasProfessor = [
    "/pages/professor-area/",
    "/pages/professor-painel/",
    "/pages/avaliacoes/",
    "/pages/treinos/",
    "/pages/treinos-v3/",
    "/pages/treinos-v4/",
    "/pages/natacao-professor/"
  ];
  try {
    const destino = new URL(next, location.origin);
    const permitido = destino.origin === location.origin
      && rotasProfessor.some((rota) => destino.pathname.startsWith(rota));
    return permitido ? `${destino.pathname}${destino.search}${destino.hash}` : padrao;
  } catch {
    return padrao;
  }
}

async function entrar() {
  const login = texto($("login").value);
  const senha = texto($("senha").value);

  if (!login || !senha) {
    mensagem("Informe login e senha.", "erro");
    return;
  }

  $("entrar").disabled = true;
  mensagem("Validando acesso...", "");

  try {
    const resp = await fetch("/api/professores/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(tenantAtual() ? { "X-Fusion-Tenant": tenantAtual() } : {}) },
      body: JSON.stringify({ login, senha, tenantId: tenantAtual() || undefined })
    });

    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok || payload.ok === false) {
      throw new Error(payload.mensagem || payload.erro || `Erro HTTP ${resp.status}`);
    }

    const professor = payload.professor || payload.usuario || {};
    const sessao = {
      token: payload.token || "",
      professorId: String(professor.id || professor.professorId || ""),
      professorNome: professor.nome || "Professor",
      cref: professor.cref || "",
      email: professor.email || "",
      foto: professor.foto || professor.foto_base64 || "",
      foto_base64: professor.foto_base64 || professor.foto || "",
      perfil: professor.perfil || "professor",
      acessoTodosAlunos: professor.acessoTodosAlunos === true,
      permissoes: Array.isArray(payload.usuario?.permissoes) ? payload.usuario.permissoes : [],
      tenantId: payload.tenantId || tenantAtual(),
      criadoEm: new Date().toISOString()
    };

    localStorage.setItem("fusion_professor_sessao", JSON.stringify(sessao));
    mensagem("Acesso liberado.", "ok");
    location.href = destinoAposLogin("/pages/professor-area/index.html");
  } catch (erro) {
    mensagem(erro.message || "Erro ao entrar.", "erro");
  } finally {
    $("entrar").disabled = false;
  }
}

$("entrar").onclick = entrar;
["login", "senha"].forEach((id) => {
  $(id).addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") entrar();
  });
});
