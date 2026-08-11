(() => {
  "use strict";

  const context = window.__FUSION_TENANT_CONTEXT__ || {};
  const tenant = String(context.tenantId || localStorage.getItem("fusionTenantId") || "").trim();
  const slug = String(context.slug || sessionStorage.getItem("fusionAcademiaSlug") || localStorage.getItem("fusionAcademiaSlug") || tenant).trim();
  let nome = String(context.nome || sessionStorage.getItem("fusionAcademiaSelecionadaNome") || localStorage.getItem("fusionAcademiaNome") || tenant).trim();
  let logoUrl = "";
  let corPrincipal = "";

  const PAGE_MAP = Object.freeze({
    "/pages/login/index.html": "login",
    "/pages/configuracao-inicial/index.html": "configuracao-inicial",
    "/pages/dashboard/index.html": "dashboard",
    "/pages/admin/index.html": "admin",
    "/pages/alunos/index.html": "alunos",
    "/pages/professores/index.html": "professores",
    "/pages/modalidades/index.html": "modalidades",
    "/pages/planos/index.html": "planos",
    "/pages/turmas/index.html": "turmas",
    "/pages/agenda/index.html": "agenda",
    "/pages/checkin/index.html": "checkin",
    "/pages/access-engine/index.html": "catracas",
    "/pages/reconhecimento-facial/admin.html": "reconhecimento-facial",
    "/pages/comercial-painel/index.html": "crm",
    "/pages/matriculas-pendentes/index.html": "matriculas-pendentes",
    "/pages/site-chat/index.html": "site-chat",
    "/pages/matriculas/index.html": "matriculas",
    "/pages/financeiro/index.html": "financeiro",
    "/pages/mensalidades/index.html": "mensalidades",
    "/pages/recebimentos/index.html": "recebimentos",
    "/pages/financeiro/pagamentos/index.html": "pagamentos",
    "/pages/caixa/index.html": "caixa",
    "/pages/relatorios-caixa/index.html": "relatorios-caixa",
    "/pages/bi-financeiro/index.html": "bi-financeiro",
    "/pages/bi-academia/index.html": "bi-academia",
    "/pages/bi-academia-operacional/index.html": "bi-operacional",
    "/pages/configuracoes/index.html": "configuracoes",
    "/pages/avaliacoes/index.html": "avaliacoes",
    "/pages/treinos/index.html": "treinos",
    "/pages/professor-area/index.html": "professor",
    "/pages/recepcao-app/index.html": "recepcao",
    "/pages/administracao-app/index.html": "administracao"
  });

  const APPS_MAP = Object.freeze({
    "/pages/aluno-login/index.html": "aluno",
    "/pages/professor-login/index.html": "professor",
    "/pages/recepcao-app/index.html": "recepcao",
    "/pages/administracao-app/index.html": "administracao"
  });

  function urlLimpa(href = "") {
    if (!slug || !href) return href;
    let url;
    try { url = new URL(href, location.origin); }
    catch { return href; }

    if (url.origin !== location.origin) return href;
    const path = url.pathname.replace(/\/{2,}/g, "/");

    if (path === "/pages/promocao/index.html" || path === "/pages/promocao/") {
      return `/${encodeURIComponent(slug)}${url.search}${url.hash}`;
    }
    if (path.startsWith("/pages/matricula-online/")) {
      return `/${encodeURIComponent(slug)}/matricula${url.search}${url.hash}`;
    }
    if (path === "/pages/apps-academia/index.html" || path === "/pages/apps-academia/") {
      return `/${encodeURIComponent(slug)}/apps${url.search}${url.hash}`;
    }
    if (APPS_MAP[path]) {
      return `/${encodeURIComponent(slug)}/apps/${APPS_MAP[path]}${url.search}${url.hash}`;
    }
    if (PAGE_MAP[path]) {
      return `/${encodeURIComponent(slug)}/app/${PAGE_MAP[path]}${url.search}${url.hash}`;
    }
    return href;
  }

  function aplicarLinks(root = document) {
    root.querySelectorAll?.("a[href]").forEach(a => {
      const original = a.getAttribute("href") || "";
      const limpo = urlLimpa(original);
      if (limpo && limpo !== original) a.setAttribute("href", limpo);
    });
  }

  function tituloComAcademia() {
    if (!nome) return;
    let base = String(document.title || "").trim();
    base = base
      .replace(/\s*[-|]\s*Fusion\s*(ERP|Sistema)?\s*$/i, "")
      .replace(/^Fusion\s*(ERP|Sistema)?\s*[-|]\s*/i, "")
      .trim();
    document.title = base ? `${base} | ${nome}` : nome;
  }

  function aplicarMarca(root = document) {
    if (!nome) return;

    tituloComAcademia();

    root.querySelectorAll?.(".fusion-top-menu__brand-text").forEach(el => {
      el.textContent = nome;
    });

    root.querySelectorAll?.(".fusion-top-menu__brand").forEach(el => {
      el.href = `/${encodeURIComponent(slug)}/app/dashboard`;
      el.setAttribute("aria-label", `${nome} — ir para o Dashboard`);
      el.title = "Tecnologia Fusion Sistema";
    });

    if (logoUrl) {
      root.querySelectorAll?.(".fusion-top-menu__brand-icon").forEach(img => {
        img.src = logoUrl;
        img.alt = `Logo ${nome}`;
        img.removeAttribute("aria-hidden");
      });
    }

    root.querySelectorAll?.("#academiaNome,[data-fusion-academia-name]").forEach(el => {
      el.textContent = nome;
    });

    const promoBrand = root.querySelector?.(".promo-hero .brand strong");
    if (promoBrand) promoBrand.textContent = nome;

    const hubBrand = root.querySelector?.(".hub .brand strong");
    if (hubBrand) hubBrand.textContent = nome;

    if (corPrincipal && /^#[0-9a-f]{6}$/i.test(corPrincipal)) {
      document.documentElement.style.setProperty("--fusion-tenant-primary", corPrincipal);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", corPrincipal);
    }
  }

  async function carregarIdentidade() {
    if (!tenant) return;

    try {
      const headers = {};
      const token = localStorage.getItem("fusionToken") || "";
      if (token) headers.Authorization = `Bearer ${token}`;
      headers["X-Fusion-Tenant"] = tenant;

      const resp = await fetch("/api/modalidades/onboarding/aparencia", {
        cache: "no-store",
        headers
      });

      if (resp.ok) {
        const json = await resp.json().catch(() => ({}));
        const aparencia = json.aparencia || json.dados || {};
        const marca = aparencia.marca || {};
        const tema = aparencia.tema || {};

        if (String(marca.nome || "").trim() && String(marca.nome).toLowerCase() !== "fusion erp") {
          nome = String(marca.nome).trim();
        }
        logoUrl = String(marca.logoUrl || "").trim();
        corPrincipal = String(tema.corPrimaria || "").trim();
      }
    } catch {}

    try {
      if (nome) {
        sessionStorage.setItem("fusionAcademiaSelecionadaNome", nome);
        localStorage.setItem("fusionAcademiaNome", nome);
      }
    } catch {}

    aplicarMarca(document);
  }

  function init() {
    aplicarLinks(document);
    aplicarMarca(document);
    carregarIdentidade();

    const observer = new MutationObserver(() => {
      aplicarLinks(document);
      aplicarMarca(document);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener("click", event => {
      const a = event.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const limpo = urlLimpa(href);
      if (limpo && limpo !== href) a.setAttribute("href", limpo);
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.FusionTenantExperience = { tenant, slug, nome: () => nome, urlLimpa };
})();
