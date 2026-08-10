(() => {
  "use strict";

  const APPS = [
    { nome: "Aluno", descricao: "Treinos, avaliação e financeiro", href: "/pages/aluno-login/index.html?app=fusion-aluno", apk: "/downloads/fusion-aluno.apk" },
    { nome: "Professor", descricao: "Treinos e avaliações", href: "/pages/professor-login/index.html?app=fusion-professor", apk: "/downloads/fusion-professor.apk" },
    { nome: "Recepção", descricao: "Atendimento, caixa e matrículas", href: "/pages/recepcao-app/index.html?app=fusion-recepcao", apk: "/downloads/fusion-recepcao.apk" },
    { nome: "Administração", descricao: "Gestão e financeiro", href: "/pages/administracao-app/index.html?app=fusion-administracao", apk: "/downloads/fusion-administracao.apk" }
  ];

  function slugDaPagina() {
    const primeiro = location.pathname.split("/").filter(Boolean)[0] || "";
    const reservados = new Set(["api", "pages", "assets", "uploads", "downloads"]);
    return primeiro && !reservados.has(primeiro.toLowerCase()) ? primeiro : "";
  }

  async function contexto(host) {
    const params = new URLSearchParams(location.search);
    let nome = String(host.dataset.academiaNome || params.get("nome") || "").trim();
    let tenant = String(host.dataset.academiaId || params.get("tenant") || "").trim();
    let slug = slugDaPagina();

    if (window.FusionPublicTenant?.slug) {
      slug = window.FusionPublicTenant.slug || slug;
      try {
        const resolvido = await window.FusionPublicTenant.ready();
        nome = nome || String(resolvido?.academia?.nome || "").trim();
        tenant = tenant || String(resolvido?.tenantId || "").trim();
        slug = String(resolvido?.academia?.slug || slug).trim();
      } catch {}
    }

    if (!nome) nome = String(sessionStorage.getItem("fusionAcademiaSelecionadaNome") || "").trim();
    if (!tenant) tenant = String(localStorage.getItem("fusionTenantId") || "").trim();

    return { nome, tenant, slug };
  }

  function urlApp(app, ctx) {
    const url = new URL(app.href, location.origin);
    if (ctx.nome) url.searchParams.set("nome", ctx.nome);
    if (ctx.tenant) url.searchParams.set("tenant", ctx.tenant);
    if (ctx.slug) url.searchParams.set("academia", ctx.slug);
    return url.pathname + url.search;
  }

  async function apkExiste(url) {
    try {
      const resp = await fetch(url, { method: "HEAD", cache: "no-store", credentials: "same-origin" });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async function render(host) {
    if (host.dataset.fusionAppsReady === "1") return;
    host.dataset.fusionAppsReady = "1";
    const ctx = await contexto(host);

    // Na página institucional genérica, sem academia resolvida, não exibe o bloco.
    if (!ctx.slug && !ctx.tenant) {
      host.hidden = true;
      return;
    }

    const root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    const style = document.createElement("style");
    style.textContent = `
      :host{display:block;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      *{box-sizing:border-box}.box{border:1px solid #d8e5e2;border-radius:20px;background:#f7fbfa;padding:18px;color:#102b35}
      h2{margin:0 0 5px;font-size:22px}.sub{margin:0 0 14px;color:#5a7179}
      .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
      .card{background:#fff;border:1px solid #d8e5e2;border-radius:14px;padding:13px;min-width:0}
      .name{font-weight:900}.desc{display:block;color:#637981;font-size:12px;margin-top:4px;line-height:1.35}
      .actions{display:grid;gap:6px;margin-top:10px}.open,.apk{display:block;text-decoration:none;border-radius:9px;padding:8px 9px;text-align:center;font-size:12px;font-weight:900}
      .open{background:#0f766e;color:#fff}.apk{background:#edf5f3;color:#0b514c;border:1px solid #c9dcd8}
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
    p.textContent = ctx.nome
      ? `Aplicativos oficiais de ${ctx.nome}.`
      : "Instale o aplicativo correspondente ao seu perfil.";
    box.append(h2, p);

    const grid = document.createElement("div");
    grid.className = "grid";

    for (const app of APPS) {
      const card = document.createElement("article");
      card.className = "card";

      const nome = document.createElement("span");
      nome.className = "name";
      nome.textContent = `Fusion ${app.nome}`;

      const desc = document.createElement("span");
      desc.className = "desc";
      desc.textContent = app.descricao;

      const actions = document.createElement("div");
      actions.className = "actions";

      const abrir = document.createElement("a");
      abrir.className = "open";
      abrir.href = urlApp(app, ctx);
      abrir.textContent = "Instalar / abrir";
      actions.appendChild(abrir);

      card.append(nome, desc, actions);
      grid.appendChild(card);

      apkExiste(app.apk).then(existe => {
        if (!existe) return;
        const apk = document.createElement("a");
        apk.className = "apk";
        apk.href = app.apk;
        apk.download = "";
        apk.textContent = "Baixar Android (.apk)";
        actions.appendChild(apk);
      });
    }

    box.appendChild(grid);

    const all = document.createElement("a");
    all.className = "all";
    const allUrl = new URL("/pages/apps-academia/index.html", location.origin);
    if (ctx.nome) allUrl.searchParams.set("nome", ctx.nome);
    if (ctx.tenant) allUrl.searchParams.set("tenant", ctx.tenant);
    all.href = allUrl.pathname + allUrl.search;
    all.textContent = "Ver página completa de aplicativos →";
    box.appendChild(all);

    root.appendChild(box);
  }

  function init() {
    document.querySelectorAll("[data-fusion-academia-apps]").forEach(host => render(host));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
