const $ = (id) => document.getElementById(id);

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
  return next.startsWith("/pages/") ? next : padrao;
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, senha })
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
      perfil: professor.perfil || "professor",
      acessoTodosAlunos: professor.acessoTodosAlunos === true,
      permissoes: Array.isArray(payload.usuario?.permissoes) ? payload.usuario.permissoes : [],
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
