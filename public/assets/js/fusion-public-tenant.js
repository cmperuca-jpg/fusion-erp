(() => {
  "use strict";

  const fetchOriginal = window.fetch.bind(window);
  const reservados = new Set([
    "api", "pages", "assets", "uploads", "downloads",
    "favicon.ico", "manifest.json", "robots.txt"
  ]);

  function normalizar(valor = "") {
    return String(valor || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function slugDaPagina() {
    const primeiro = location.pathname.split("/").filter(Boolean)[0] || "";
    const slug = normalizar(primeiro);
    if (!slug || reservados.has(slug)) return "";
    return slug;
  }

  const slug = slugDaPagina();
  let dados = null;
  let promise = null;

  function chaveCache() {
    return slug ? `fusion_public_tenant_${slug}` : "";
  }

  function lerCache() {
    if (!slug) return null;
    try {
      const bruto = sessionStorage.getItem(chaveCache());
      if (!bruto) return null;
      const json = JSON.parse(bruto);
      if (json?.tenantId && json?.academia?.slug) return json;
    } catch {}
    return null;
  }

  function salvarCache(json) {
    if (!slug || !json?.tenantId) return;
    try { sessionStorage.setItem(chaveCache(), JSON.stringify(json)); } catch {}
  }

  async function resolver() {
    if (!slug) return null;
    if (dados) return dados;
    const cache = lerCache();
    if (cache) {
      dados = cache;
      return dados;
    }
    if (!promise) {
      promise = fetchOriginal(`/api/saas/publico/${encodeURIComponent(slug)}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" }
      }).then(async resp => {
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json.ok || !json.tenantId) {
          throw new Error(json.mensagem || "Academia não encontrada.");
        }
        dados = json;
        salvarCache(json);
        document.documentElement.dataset.fusionTenant = json.tenantId;
        document.documentElement.dataset.fusionAcademiaSlug = json.academia?.slug || slug;
        return dados;
      });
    }
    return promise;
  }

  function apiInterna(input) {
    try {
      const raw = typeof input === "string" ? input : input?.url;
      const url = new URL(raw, location.origin);
      return url.origin === location.origin && url.pathname.startsWith("/api/");
    } catch {
      return false;
    }
  }

  function resolverPublico(input) {
    try {
      const raw = typeof input === "string" ? input : input?.url;
      const url = new URL(raw, location.origin);
      return url.origin === location.origin && url.pathname.startsWith("/api/saas/publico/");
    } catch {
      return false;
    }
  }

  window.fetch = async function fusionPublicFetch(input, opcoes = {}) {
    if (!slug || !apiInterna(input) || resolverPublico(input)) {
      return fetchOriginal(input, opcoes);
    }

    const tenant = await resolver();
    if (!tenant?.tenantId) return fetchOriginal(input, opcoes);

    const headers = new Headers(
      opcoes.headers || (input instanceof Request ? input.headers : undefined)
    );
    if (!headers.has("X-Fusion-Tenant")) {
      headers.set("X-Fusion-Tenant", tenant.tenantId);
    }

    return fetchOriginal(input, { ...opcoes, headers });
  };

  function urlMatricula(urlAtual = "") {
    if (!slug) return urlAtual;
    const url = new URL(urlAtual || "/pages/matricula-online/index.html", location.origin);
    if (url.pathname.startsWith("/pages/matricula-online")) {
      return `/${encodeURIComponent(slug)}/matricula${url.search}${url.hash}`;
    }
    return urlAtual;
  }

  document.addEventListener("click", event => {
    const a = event.target.closest("a[href]");
    if (!a || !slug) return;
    const href = a.getAttribute("href") || "";
    if (!href.includes("/pages/matricula-online")) return;
    event.preventDefault();
    location.href = urlMatricula(a.href);
  });

  window.FusionPublicTenant = {
    slug,
    ready: resolver,
    tenantId: () => dados?.tenantId || "",
    academia: () => dados?.academia || null,
    urlMatricula
  };

  if (slug) {
    resolver().catch(error => {
      console.error("[Fusion público]", error);
      document.documentElement.dataset.fusionTenantErro = "1";
    });
  }
})();
