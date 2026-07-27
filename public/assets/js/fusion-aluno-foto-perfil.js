(() => {
  const login = (() => {
    try { return JSON.parse(localStorage.getItem("fusion_aluno_treino_login") || "null"); }
    catch { return null; }
  })();
  if (!login?.alunoId) return;

  window.FusionAlunoSessao?.iniciarPortal();

  function criarControles() {
    const foto = document.getElementById("fotoAluno");
    if (!foto || document.getElementById("alterarFotoAluno")) return;
    foto.style.cursor = "pointer";
    foto.title = "Alterar foto do perfil";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.capture = "user";
    input.id = "arquivoFotoAluno";
    input.hidden = true;

    const botao = document.createElement("button");
    botao.type = "button";
    botao.id = "alterarFotoAluno";
    botao.className = "btn ghost";
    botao.textContent = "Alterar foto";
    botao.style.marginTop = "7px";

    const texto = foto.closest(".perfil-card")?.querySelector(".perfil-texto");
    texto?.appendChild(botao);
    document.body.appendChild(input);
    foto.onclick = () => input.click();
    botao.onclick = () => input.click();

    input.onchange = async () => {
      const arquivo = input.files?.[0];
      if (!arquivo) return;
      botao.disabled = true;
      botao.textContent = "Salvando...";
      try {
        const fotoBase64 = await FusionFotoPerfil.comprimir(arquivo);
        const resp = await fetch(`/api/alunos/${encodeURIComponent(login.alunoId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.token || ""}` },
          body: JSON.stringify({ foto: fotoBase64, foto_base64: fotoBase64 })
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || "Não foi possível salvar a foto.");
        FusionFotoPerfil.aplicarImagem(foto, fotoBase64);
        const atualizado = { ...login, foto: fotoBase64 };
        localStorage.setItem("fusion_aluno_treino_login", JSON.stringify(atualizado));
        alert("Foto atualizada.");
      } catch (erro) {
        alert(erro.message || "Erro ao atualizar a foto.");
      } finally {
        botao.disabled = false;
        botao.textContent = "Alterar foto";
        input.value = "";
      }
    };
  }

  async function carregarFoto() {
    try {
      const resp = await fetch(`/api/alunos/${encodeURIComponent(login.alunoId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${login.token || ""}` }
      });
      const json = await resp.json().catch(() => ({}));
      const aluno = json.aluno || json.dados || json;
      const foto = aluno.foto || aluno.foto_base64 || login.foto || "";
      FusionFotoPerfil.aplicarImagem(document.getElementById("fotoAluno"), foto);
    } catch {}
  }

  const iniciar = () => { criarControles(); carregarFoto(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
