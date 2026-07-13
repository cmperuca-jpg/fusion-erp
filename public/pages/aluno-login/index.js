const $ = (id) => document.getElementById(id);

function mensagem(texto, tipo = "") {
  const el = $("mensagem");
  el.textContent = texto || "";
  el.className = `msg ${tipo}`.trim();
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, senha })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.mensagem || "Login inválido.");

    localStorage.setItem("fusion_aluno_treino_login", JSON.stringify(data.dados));
    localStorage.setItem("fusion_aluno_treino_selecionado", JSON.stringify({
      alunoId: data.dados.alunoId,
      alunoNome: data.dados.alunoNome
    }));
    mensagem("Acesso liberado.", "ok");
    location.href = `/pages/aluno-treinos/index.html?alunoId=${encodeURIComponent(data.dados.alunoId)}`;
  } catch (erro) {
    mensagem(erro.message || "Erro ao entrar.", "erro");
  } finally {
    $("entrar").disabled = false;
  }
}

$("entrar").onclick = entrar;
["login", "senha"].forEach((id) => {
  $(id).addEventListener("keydown", (ev) => { if (ev.key === "Enter") entrar(); });
});
