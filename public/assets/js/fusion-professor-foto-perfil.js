(() => {
  function sessao() {
    try { return JSON.parse(localStorage.getItem("fusion_professor_sessao") || "null"); }
    catch { return null; }
  }
  const atual = sessao();
  if (!atual?.professorId) return;

  function montar() {
    const hero = document.querySelector(".prof-hero > div");
    if (!hero || document.getElementById("fotoProfessorPortal")) return;

    const bloco = document.createElement("div");
    bloco.className = "fusion-professor-perfil-foto";
    bloco.innerHTML = `
      <img id="fotoProfessorPortal" alt="Foto do professor"
        style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.75);display:block;margin-bottom:8px">
      <button id="btnFotoProfessorPortal" class="btn" type="button">Alterar foto</button>
      <input id="arquivoFotoProfessorPortal" type="file" accept="image/jpeg,image/png,image/webp" capture="user" hidden>`;
    hero.prepend(bloco);

    const img = bloco.querySelector("img");
    const btn = bloco.querySelector("button");
    const input = bloco.querySelector("input");
    FusionFotoPerfil.aplicarImagem(img, atual.foto || atual.foto_base64 || "");

    img.style.cursor = "pointer";
    img.onclick = () => input.click();
    btn.onclick = () => input.click();

    input.onchange = async () => {
      const arquivo = input.files?.[0];
      if (!arquivo) return;
      btn.disabled = true;
      btn.textContent = "Salvando...";
      try {
        const foto = await FusionFotoPerfil.comprimir(arquivo);
        const resp = await fetch(`/api/professores/${encodeURIComponent(atual.professorId)}/foto`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${atual.token || ""}` },
          body: JSON.stringify({ foto, foto_base64: foto })
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || "Não foi possível salvar a foto.");
        FusionFotoPerfil.aplicarImagem(img, foto);
        const nova = { ...atual, foto, foto_base64: foto };
        localStorage.setItem("fusion_professor_sessao", JSON.stringify(nova));
        alert("Foto atualizada.");
      } catch (erro) {
        alert(erro.message || "Erro ao atualizar a foto.");
      } finally {
        btn.disabled = false;
        btn.textContent = "Alterar foto";
        input.value = "";
      }
    };

    fetch("/api/professores/sessao", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${atual.token || ""}` }
    }).then(r => r.json()).then(p => {
      const prof = p.professor || p.dados || p;
      const foto = prof.foto || prof.foto_base64 || atual.foto || "";
      FusionFotoPerfil.aplicarImagem(img, foto);
      if (foto) localStorage.setItem("fusion_professor_sessao", JSON.stringify({ ...atual, foto, foto_base64: foto }));
    }).catch(() => {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar, { once: true });
  else montar();
})();
