(() => {
  "use strict";

  const contexto = window.__FUSION_TENANT_CONTEXT__ || {};
  const partes = location.pathname.split("/").filter(Boolean);
  const slug = String(contexto.slug || (partes[1] === "apps" ? partes[0] : "") || "").trim();
  const tenant = String(contexto.tenantId || "").trim();
  const nome = String(contexto.nome || "").trim();

  const titulo = document.getElementById("academiaNome");
  titulo.textContent = nome
    ? `Aplicativos oficiais de ${nome}.`
    : "Escolha o aplicativo conforme seu perfil.";

  const mapa = {
    aluno: `/${encodeURIComponent(slug)}/apps/aluno`,
    professor: `/${encodeURIComponent(slug)}/apps/professor`,
    recepcao: `/${encodeURIComponent(slug)}/apps/recepcao`,
    administracao: `/${encodeURIComponent(slug)}/apps/administracao`
  };

  document.querySelectorAll("[data-app-link]").forEach(link => {
    const perfil = link.dataset.appLink;
    if (mapa[perfil]) link.href = mapa[perfil];
  });

  document.getElementById("paginaPublicaLink").href = `/${encodeURIComponent(slug)}`;
  document.getElementById("matriculaLink").href = `/${encodeURIComponent(slug)}/matricula`;
  document.getElementById("trocarAcademiaLink").href =
    `/pages/comecar/?trocar=1&academia=${encodeURIComponent(slug || tenant)}`;

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
