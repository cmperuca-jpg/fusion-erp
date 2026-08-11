(() => {
  "use strict";

  const APPS = [
    ["Aluno", "Treinos, avaliação e financeiro", "aluno"],
    ["Professor", "Treinos e avaliações", "professor"],
    ["Recepção", "Atendimento, caixa e matrículas", "recepcao"],
    ["Administração", "Gestão e financeiro", "administracao"]
  ];

  function slugDaPagina() {
    const primeiro = location.pathname.split("/").filter(Boolean)[0] || "";
    const reservados = new Set(["api","pages","assets","uploads","downloads"]);
    return primeiro && !reservados.has(primeiro.toLowerCase()) ? primeiro : "";
  }

  async function contexto(host) {
    let slug = String(host.dataset.academiaSlug || slugDaPagina()).trim();
    let nome = String(host.dataset.academiaNome || "").trim();
    let tenant = String(host.dataset.academiaId || "").trim();

    if (window.FusionPublicTenant?.ready) {
      try {
        const resolvido = await window.FusionPublicTenant.ready();
        slug = String(resolvido?.academia?.slug || slug).trim();
        nome = String(resolvido?.academia?.nome || nome).trim();
        tenant = String(resolvido?.tenantId || tenant).trim();
      } catch {}
    }

    return { slug, nome, tenant };
  }

  async function render(host) {
    if (host.dataset.fusionAppsReady === "1") return;
    host.dataset.fusionAppsReady = "1";

    const ctx = await contexto(host);
    if (!ctx.slug) {
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
    p.textContent = ctx.nome
      ? `Aplicativos oficiais de ${ctx.nome}.`
      : "Baixe ou instale o aplicativo do seu perfil.";
    box.append(h2,p);

    const grid = document.createElement("div");
    grid.className = "grid";

    APPS.forEach(([nomeApp,desc,perfil]) => {
      const a = document.createElement("a");
      a.className = "card";
      a.href = `/${encodeURIComponent(ctx.slug)}/apps/${perfil}`;

      const n = document.createElement("span");
      n.className = "name";
      n.textContent = `Fusion ${nomeApp}`;
      const d = document.createElement("span");
      d.className = "desc";
      d.textContent = desc;
      const o = document.createElement("span");
      o.className = "open";
      o.textContent = "Instalar / abrir";
      a.append(n,d,o);
      grid.appendChild(a);
    });

    box.appendChild(grid);

    const all = document.createElement("a");
    all.className = "all";
    all.href = `/${encodeURIComponent(ctx.slug)}/apps`;
    all.textContent = "Ver página completa de aplicativos →";
    box.appendChild(all);
    root.appendChild(box);
  }

  function init() {
    document.querySelectorAll("[data-fusion-academia-apps]").forEach(render);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init);
  else init();
})();
