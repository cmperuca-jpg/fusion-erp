(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const nomeUrl = String(params.get("nome") || params.get("academia") || "").trim();
  const nomeSessao = String(sessionStorage.getItem("fusionAcademiaSelecionadaNome") || "").trim();
  const tenant = String(params.get("tenant") || localStorage.getItem("fusionTenantId") || "").trim();
  const nome = nomeUrl || nomeSessao;

  const titulo = document.getElementById("academiaNome");
  titulo.textContent = nome
    ? `Aplicativos oficiais de ${nome}.`
    : "Escolha o aplicativo conforme seu perfil.";

  // Preserva a referência visual da academia nos novos wrappers.
  document.querySelectorAll("[data-app-link]").forEach(link => {
    const url = new URL(link.href, location.origin);
    if (nome) url.searchParams.set("nome", nome);
    if (tenant) url.searchParams.set("tenant", tenant);
    link.href = url.pathname + url.search;
  });

  // APKs são opcionais. O botão só aparece quando o arquivo REAL existir.
  document.querySelectorAll("[data-apk]").forEach(async link => {
    try {
      const resp = await fetch(link.getAttribute("href"), {
        method: "HEAD",
        cache: "no-store",
        credentials: "same-origin"
      });
      if (resp.ok) link.classList.remove("hidden");
    } catch {}
  });
})();