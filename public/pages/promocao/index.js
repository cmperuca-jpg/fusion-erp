(() => {
  "use strict";

  function texto(v = "") {
    return String(v ?? "").trim();
  }

  function slugDaRota() {
    const ctx = window.__FUSION_TENANT_CONTEXT__ || {};
    const slugCtx = texto(ctx.slug);
    if (slugCtx) return slugCtx;

    const partes = location.pathname.split("/").filter(Boolean);
    return texto(partes[0]);
  }

  function nomeAcademia() {
    const ctx = window.__FUSION_TENANT_CONTEXT__ || {};
    return texto(ctx.nome) ||
      texto(localStorage.getItem("fusionAcademiaNome")) ||
      "Academia";
  }

  const slug = slugDaRota();
  const nome = nomeAcademia();

  document.title = `${nome} | Página oficial`;

  ["academiaNomeTopo", "academiaNomeHero", "academiaNomeRodape"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = nome;
  });

  const matricula = `/${encodeURIComponent(slug)}/matricula`;
  document.getElementById("btnMatricula").href = matricula;
  document.getElementById("btnMatriculaRodape").href = matricula;

  document.querySelectorAll("[data-app]").forEach(link => {
    const perfil = texto(link.dataset.app);
    link.href = `/${encodeURIComponent(slug)}/apps/${encodeURIComponent(perfil)}`;
  });
})();
