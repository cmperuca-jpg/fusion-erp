function iniciarAbas() {
  document.querySelectorAll(".tab").forEach(botao => {
    botao.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      botao.classList.add("active");

      const conteudo = document.getElementById("tab-" + botao.dataset.tab);

      if (conteudo) {
        conteudo.classList.add("active");
      }
    });
  });
}