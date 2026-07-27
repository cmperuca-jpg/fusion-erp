(() => {
  let fotoPendente = "";

  function montar() {
    const painel = document.getElementById("tab-cadastro");
    if (!painel || document.getElementById("fotoProfessorCadastro")) return;

    const bloco = document.createElement("div");
    bloco.className = "field";
    bloco.style.marginBottom = "14px";
    bloco.innerHTML = `
      <label>Foto do professor</label>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <img id="fotoProfessorCadastro" alt="Foto do professor" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:1px solid #cbd5e1">
        <div>
          <button id="btnEscolherFotoProfessor" class="btn-light" type="button">Escolher foto</button>
          <button id="btnSalvarFotoProfessor" class="btn-light" type="button">Salvar foto</button>
          <input id="arquivoFotoProfessorCadastro" type="file" accept="image/jpeg,image/png,image/webp" hidden>
          <small style="display:block;margin-top:7px">Para professor novo, salve o cadastro primeiro e depois clique em Salvar foto.</small>
        </div>
      </div>`;
    painel.prepend(bloco);

    const img = bloco.querySelector("img");
    const input = bloco.querySelector("input");
    const escolher = bloco.querySelector("#btnEscolherFotoProfessor");
    const salvar = bloco.querySelector("#btnSalvarFotoProfessor");
    FusionFotoPerfil.aplicarImagem(img, "");

    escolher.onclick = () => input.click();
    img.style.cursor = "pointer";
    img.onclick = () => input.click();

    input.onchange = async () => {
      const arq = input.files?.[0];
      if (!arq) return;
      try {
        fotoPendente = await FusionFotoPerfil.comprimir(arq);
        FusionFotoPerfil.aplicarImagem(img, fotoPendente);
      } catch (e) { alert(e.message); }
    };

    salvar.onclick = async () => {
      const id = document.getElementById("id")?.value || "";
      if (!id) return alert("Salve o professor primeiro.");
      if (!fotoPendente) return alert("Escolha uma foto.");
      salvar.disabled = true;
      try {
        const fetchFn = window.FusionAuth?.fetchAuth ? window.FusionAuth.fetchAuth.bind(window.FusionAuth) : fetch;
        const resp = await fetchFn(`/api/professores/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ foto: fotoPendente, foto_base64: fotoPendente })
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || "Erro ao salvar foto.");
        alert("Foto do professor salva.");
      } catch (e) { alert(e.message); }
      finally { salvar.disabled = false; }
    };

    document.addEventListener("click", (ev) => {
      const editar = ev.target.closest('[onclick^="editar("]');
      if (!editar) return;
      setTimeout(() => {
        const id = document.getElementById("id")?.value || "";
        const lista = Array.isArray(window.professores) ? window.professores : [];
        const p = lista.find(x => String(x.id || x._id || x.codigo) === String(id));
        fotoPendente = p?.foto || p?.foto_base64 || "";
        FusionFotoPerfil.aplicarImagem(img, fotoPendente);
      }, 100);
    }, true);

    document.getElementById("btnNovo")?.addEventListener("click", () => {
      fotoPendente = "";
      FusionFotoPerfil.aplicarImagem(img, "");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar, { once: true });
  else montar();
})();
