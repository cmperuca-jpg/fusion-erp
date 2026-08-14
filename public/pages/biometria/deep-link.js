(() => {
  const params = new URLSearchParams(location.search);
  const id = String(params.get("id") || params.get("pessoaId") || "").trim();
  if (!id) return;

  let concluido = false;

  function tentar() {
    if (concluido) return;
    const lista = document.getElementById("listaPessoas");
    if (!lista) return;

    const botoes = [...lista.querySelectorAll(".pessoa-item[data-id]")];
    const alvo = botoes.find(btn => String(btn.dataset.id || "") === id);

    if (alvo) {
      concluido = true;
      alvo.click();
      alvo.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  const lista = document.getElementById("listaPessoas");
  if (lista) {
    new MutationObserver(tentar).observe(lista, { childList: true, subtree: true });
  }

  window.addEventListener("load", () => setTimeout(tentar, 100));
  setTimeout(tentar, 350);
  setTimeout(tentar, 1000);
})();
