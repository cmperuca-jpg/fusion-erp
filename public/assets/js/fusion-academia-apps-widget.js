(() => {
  "use strict";

  const APPS = [
    ["Aluno", "Treinos, avaliação e financeiro", "/pages/aluno-login/index.html?app=fusion-aluno"],
    ["Professor", "Treinos e avaliações", "/pages/professor-login/index.html?app=fusion-professor"],
    ["Recepção", "Atendimento, caixa e matrículas", "/pages/recepcao-app/index.html?app=fusion-recepcao"],
    ["Administração", "Gestão e financeiro", "/pages/administracao-app/index.html?app=fusion-administracao"]
  ];

  function render(host) {
    if (host.dataset.fusionAppsReady === "1") return;
    host.dataset.fusionAppsReady = "1";

    const params = new URLSearchParams(location.search);
    const nome =
      String(host.dataset.academiaNome || "").trim() ||
      String(params.get("nome") || params.get("academia") || "").trim() ||
      String(sessionStorage.getItem("fusionAcademiaSelecionadaNome") || "").trim();

    const tenant =
      String(host.dataset.academiaId || "").trim() ||
      String(params.get("tenant") || localStorage.getItem("fusionTenantId") || "").trim();

    const root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    const style = document.createElement("style");
    style.textContent = `
      :host{display:block;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      *{box-sizing:border-box}.box{border:1px solid #d8e5e2;border-radius:20px;background:#f7fbfa;padding:18px;color:#102b35}
      h2{margin:0 0 5px;font-size:22px}.sub{margin:0 0 14px;color:#5a7179}
      .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
      a.card{text-decoration:none;color:#102b35;background:white;border:1px solid #d8e5e2;border-radius:14px;padding:13px;min-width:0}
      .name{font-weight:900}.desc{display:block;color:#637981;font-size:12px;margin-top:4px;line-height:1.35}
      .open{display:block;color:#0f766e;font-size:12px;font-weight:900;margin-top:9px}
      .all{display:inline-block;margin-top:13px;color:#0f766e;font-weight:900;text-decoration:none}
      @media(max-width:800px){.grid{grid-template-columns:1fr 1fr}}
      @media(max-width:480px){.grid{grid-template-columns:1fr}}
    `;
    root.appendChild(style);

    const box = document.createElement("section");
    box.className = "box";
    const h2 = document.createElement("h2");
    h2.textContent = "Aplicativos da academia";
    const p = document.createElement("p");
    p.className = "sub";
    p.textContent = nome ? `Aplicativos oficiais de ${nome}.` : "Baixe ou instale o aplicativo do seu perfil.";
    box.append(h2, p);

    const grid = document.createElement("div");
    grid.className = "grid";

    APPS.forEach(([nomeApp, desc, href]) => {
      const a = document.createElement("a");
      a.className = "card";
      const url = new URL(href, location.origin);
      if (nome) url.searchParams.set("nome", nome);
      if (tenant) url.searchParams.set("tenant", tenant);
      a.href = url.pathname + url.search;

      const n = document.createElement("span");
      n.className = "name";
      n.textContent = `Fusion ${nomeApp}`;
      const d = document.createElement("span");
      d.className = "desc";
      d.textContent = desc;
      const o = document.createElement("span");
      o.className = "open";
      o.textContent = "Instalar / abrir";
      a.append(n, d, o);
      grid.appendChild(a);
    });

    box.appendChild(grid);

    const all = document.createElement("a");
    all.className = "all";
    const allUrl = new URL("/pages/apps-academia/index.html", location.origin);
    if (nome) allUrl.searchParams.set("nome", nome);
    if (tenant) allUrl.searchParams.set("tenant", tenant);
    all.href = allUrl.pathname + allUrl.search;
    all.textContent = "Ver página completa de aplicativos →";
    box.appendChild(all);
    root.appendChild(box);
  }

  function init() {
    document.querySelectorAll("[data-fusion-academia-apps]").forEach(render);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();