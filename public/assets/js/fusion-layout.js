(function () {
  const __FUSION_V3_NAVIGATION_FINAL__ = true;

  function garantirEstilosGlobais() {
    const estilos = [
      ["fusion-app-global", "/assets/css/fusion-app.css"],
      ["fusion-menu-global", "/assets/css/fusion-menu-global.css"],
      ["fusion-mobile-final", "/assets/css/fusion-mobile-final.css"],
      ["fusion-premium-final", "/assets/css/fusion-premium-final.css"],
      ["fusion-correcoes-visuais", "/assets/css/fusion-correcoes-visuais.css"],
      ["fusion-notificacoes", "/assets/css/fusion-notificacoes.css"]
    ];
    estilos.forEach(([id, href]) => {
      if (document.getElementById(id) || document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    });
  }

  garantirEstilosGlobais();

  function garantirCentralNotificacoes() {
    if (document.querySelector('script[src="/assets/js/fusion-notificacoes.js"]')) return;
    const script = document.createElement("script");
    script.src = "/assets/js/fusion-notificacoes.js";
    script.defer = true;
    document.head.appendChild(script);
  }

  /* Sino e catraca ficam concentrados na barra lateral, sem poluir as páginas. */

  const PAGINAS_SEM_MENU = [
    "/pages/aluno-avaliacao/",
    "/pages/aluno-avaliacao/index.html",
    "/pages/aluno-treinos/",
    "/pages/aluno-treinos/index.html",
    "/pages/aluno-login/",
    "/pages/aluno-login/index.html",
    "/pages/professor-area/",
    "/pages/professor-area/index.html",
    "/pages/professor-login/",
    "/pages/professor-login/index.html",
    "/pages/treinos/",
    "/pages/treinos/index.html",
    "/pages/avaliacoes/",
    "/pages/avaliacoes/index.html",
    "/pages/promocao/",
    "/pages/promocao/index.html",
    "/pages/matricula-online/",
    "/pages/matricula-online/index.html",
    "/pages/login/",
    "/pages/login/index.html",
    "/pages/reconhecimento-facial/",
    "/pages/reconhecimento-facial/index.html"
  ];

  const ITENS_MENU = [
    { grupo: "Principal", itens: [
      { id: "dashboard", label: "Dashboard", href: "/pages/dashboard/index.html", perm: "dashboard" },
      { id: "bi-financeiro", label: "BI Financeiro", href: "/pages/bi-financeiro/index.html", perm: "relatorios" },
      { id: "admin", label: "Painel administrativo", href: "/pages/admin/index.html", perm: "admin" }
    ]},
    { grupo: "Academia", itens: [
      { id: "alunos", label: "Alunos", href: "/pages/alunos/index.html", perm: "alunos" },
      { id: "professores", label: "Professores", href: "/pages/professores/index.html", perm: "professores" },
      { id: "modalidades", label: "Modalidades", href: "/pages/modalidades/index.html", perm: "modalidades" },
      { id: "planos", label: "Planos", href: "/pages/planos/index.html", perm: "planos" },
      { id: "turmas", label: "Turmas", href: "/pages/turmas/index.html", perm: "turmas" },
      { id: "agenda", label: "Agenda", href: "/pages/agenda/index.html", perm: "turmas" },
      { id: "checkin", label: "Check-in", href: "/pages/checkin/index.html", perm: "checkin" },
      { id: "access-engine", label: "Catracas", href: "/pages/access-engine/index.html", perm: "access-engine" },
      { id: "reconhecimento-facial", label: "Reconhecimento facial", href: "/pages/reconhecimento-facial/admin.html", perm: "alunos" }
    ]},
    { grupo: "Comercial", itens: [
      { id: "comercial-painel", label: "CRM Comercial", href: "/pages/comercial-painel/index.html", perm: "comercial-painel" },
      { id: "site-academia", label: "Site da academia", href: "/pages/promocao/index.html", perm: "comercial", novaAba: true },
      { id: "matricula-online", label: "Matrícula Online", href: "/pages/matricula-online/index.html", perm: "matricula-online", novaAba: true },
      { id: "matriculas-pendentes", label: "Matrículas pendentes", href: "/pages/matriculas-pendentes/index.html", perm: "matriculas" },
      { id: "site-chat", label: "Chat do site", href: "/pages/site-chat/index.html", perm: "site-chat" },
      { id: "matriculas", label: "Matrículas", href: "/pages/matriculas/index.html", perm: "matriculas" }
    ]},
    { grupo: "Financeiro", itens: [
      { id: "financeiro", label: "Financeiro", href: "/pages/financeiro/index.html", perm: "financeiro" },
      { id: "mensalidades", label: "Mensalidades", href: "/pages/mensalidades/index.html", perm: "mensalidades" },
      { id: "recebimentos", label: "Recebimentos", href: "/pages/recebimentos/index.html", perm: "financeiro" },
      { id: "pagamentos", label: "Pagamentos", href: "/pages/financeiro/pagamentos/index.html", perm: "financeiro" },
      { id: "caixa", label: "Caixa", href: "/pages/caixa/index.html", perm: "caixa" },
      { id: "relatorios", label: "Relatórios de caixa", href: "/pages/relatorios-caixa/index.html", perm: "relatorios" }
    ]},
    { grupo: "Indicadores", itens: [
      { id: "bi-academia", label: "BI Academia", href: "/pages/bi-academia/index.html", perm: "relatorios" },
      { id: "bi-operacional", label: "BI Operacional", href: "/pages/bi-academia-operacional/index.html", perm: "relatorios" }
    ]},
    { grupo: "Sistema", itens: [
      { id: "configuracoes", label: "Configurações", href: "/pages/configuracoes/index.html", perm: "admin" }
    ]}
  ];

  function normalizarPath(pathname) {
    return String(pathname || location.pathname).replace(/\/+$/, "/");
  }

  function paginaSemMenu() {
    const atual = normalizarPath(location.pathname);
    return PAGINAS_SEM_MENU.some(p => atual === normalizarPath(p));
  }

  function removerMenusExistentes() {
    document.querySelectorAll(".sidebar,.fusion-sidebar,#fusionSidebar,#fusionMenuGlobal,.fusion-menu-global,.fusion-v3-menu-toggle,.fusion-v3-menu-backdrop,.fusion-mobile-final-bar,.fusion-mobile-final-overlay,.fusion-breadcrumb,.topbar,.fusion-topbar").forEach(el => el.remove());
    document.body.classList.add("fusion-sem-menu");
    document.body.classList.remove("fusion-menu-open");
    document.body.classList.remove("fusion-com-sidebar");
    document.documentElement.classList.add("fusion-sem-menu");
  }

  function removerBarrasSuperiores() {
    document.querySelectorAll(".topbar,.fusion-topbar").forEach(el => el.remove());
  }

  function usuario() {
    try {
      if (window.FusionAuth && typeof FusionAuth.usuarioAtual === "function") return FusionAuth.usuarioAtual();
    } catch {}
    try {
      return JSON.parse(localStorage.getItem("fusionUsuario") || "null");
    } catch {
      return null;
    }
  }

  function podeVer(item, user) {
    const permissoes = Array.isArray(user?.permissoes) ? user.permissoes : [];
    const perfil = String(user?.perfil || user?.perfilOriginal || "").toLowerCase();
    if (permissoes.includes("*") || perfil === "admin" || perfil === "administrador") return true;
    return permissoes.includes(item.perm) || permissoes.includes(item.id);
  }

  function itemAtivo(href) {
    const atual = normalizarPath(location.pathname);
    const alvo = normalizarPath(href);
    return atual === alvo || atual === alvo.replace(/\/$/, "/index.html/");
  }

  function todosItensMenu() {
    return ITENS_MENU.flatMap(grupo => grupo.itens.map(item => ({ ...item, grupo: grupo.grupo })));
  }

  function itemMenuAtual() {
    return todosItensMenu().find(item => itemAtivo(item.href)) || null;
  }

  function montarBreadcrumb() {
    if (paginaSemMenu()) return;
    document.querySelectorAll(".fusion-breadcrumb").forEach(el => el.remove());
    const item = itemMenuAtual();
    if (!item) return;
    const destino = document.querySelector(".fusion-content,.content,.page-content,.crm,main");
    if (!destino) return;

    const nav = document.createElement("nav");
    nav.className = "fusion-breadcrumb";
    nav.setAttribute("aria-label", "Caminho da pagina");
    nav.innerHTML = `<a href="/pages/dashboard/index.html">Inicio</a><span>/</span><span>${item.grupo}</span><span>/</span><strong>${item.label}</strong>`;
    destino.prepend(nav);
  }

  function montarMenuMobile() {
    document.querySelectorAll(".fusion-v3-menu-toggle,.fusion-v3-menu-backdrop,.fusion-mobile-final-bar,.fusion-mobile-final-overlay").forEach(el => el.remove());
    document.body.classList.remove("fusion-menu-open");

    const barra = document.createElement("div");
    barra.className = "fusion-mobile-final-bar";
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "fusion-mobile-final-menu-btn";
    botao.setAttribute("aria-label", "Abrir menu");
    botao.setAttribute("aria-expanded", "false");
    botao.setAttribute("aria-controls", "fusionSidebar");
    botao.textContent = "☰";
    const titulo = document.createElement("div");
    titulo.className = "fusion-mobile-final-title";
    titulo.textContent = itemMenuAtual()?.label || document.title.replace(/\s*[-|].*$/, "").trim() || "Fusion ERP";
    barra.append(botao, titulo);

    const fundo = document.createElement("div");
    fundo.className = "fusion-mobile-final-overlay";
    fundo.setAttribute("aria-hidden", "true");

    function alternarMenu(forcar) {
      const aberto = typeof forcar === "boolean" ? forcar : !document.body.classList.contains("fusion-menu-open");
      document.body.classList.toggle("fusion-menu-open", aberto);
      botao.setAttribute("aria-expanded", aberto ? "true" : "false");
      botao.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
      botao.textContent = aberto ? "×" : "☰";
      fundo.setAttribute("aria-hidden", aberto ? "false" : "true");
    }

    botao.addEventListener("click", () => alternarMenu());
    fundo.addEventListener("click", () => alternarMenu(false));
    document.querySelector("#fusionSidebar [data-fusion-menu-close]")?.addEventListener("click", () => alternarMenu(false));
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") alternarMenu(false);
    });
    window.addEventListener("pageshow", () => alternarMenu(false));
    window.addEventListener("pagehide", () => alternarMenu(false));
    window.addEventListener("orientationchange", () => alternarMenu(false));
    window.matchMedia("(min-width: 901px)").addEventListener?.("change", ev => {
      if (ev.matches) alternarMenu(false);
    });

    window.FusionMenuMobile = { fechar: () => alternarMenu(false), abrir: () => alternarMenu(true), alternar: alternarMenu };
    document.body.prepend(fundo);
    document.body.prepend(barra);
  }

  function montarMenu() {
    if (paginaSemMenu()) {
      removerMenusExistentes();
      return;
    }

    const user = usuario();
    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar fusion-sidebar";
    sidebar.id = "fusionSidebar";

    const marca = document.createElement("div");
    marca.className = "brand fusion-brand";
    marca.innerHTML = `
      <span class="fusion-brand-texto"><strong>Fusion ERP</strong><small>Menu inteligente</small></span>
      <button class="fusion-menu-fechar" data-fusion-menu-close type="button" aria-label="Fechar menu">×</button>
      <button class="fusion-menu-sair" type="button" aria-label="Sair do Fusion ERP">Sair</button>
    `;
    marca.querySelector(".fusion-menu-sair")?.addEventListener("click", () => {
      if (window.FusionAuth && typeof FusionAuth.sair === "function") FusionAuth.sair();
      else location.href = "/pages/login/index.html";
    });
    sidebar.appendChild(marca);

    const ferramentas = document.createElement("div");
    ferramentas.className = "fusion-sidebar-ferramentas";
    ferramentas.innerHTML = '<div class="fusion-sidebar-notificacoes" aria-label="Notificações do sistema"></div>';
    const controleCatraca = montarControleCatraca(user);
    if (controleCatraca) ferramentas.prepend(controleCatraca);
    sidebar.appendChild(ferramentas);

    ITENS_MENU.forEach((grupo, indiceGrupo) => {
      const itens = grupo.itens.filter(item => podeVer(item, user));
      if (!itens.length) return;

      const box = document.createElement("div");
      box.className = "menu-grupo fusion-menu-section open";
      box.id = `fusion_menu_grupo_${indiceGrupo}`;

      const titulo = document.createElement("button");
      titulo.type = "button";
      titulo.className = "menu-titulo fusion-menu-group";
      titulo.setAttribute("aria-expanded", "true");
      titulo.setAttribute("aria-controls", `${box.id}_itens`);
      titulo.innerHTML = `<span>${grupo.grupo}</span><span class="fusion-menu-group-caret" aria-hidden="true">&rsaquo;</span>`;
      titulo.addEventListener("click", () => {
        const recolhido = box.classList.toggle("collapsed");
        box.classList.toggle("open", !recolhido);
        titulo.setAttribute("aria-expanded", recolhido ? "false" : "true");
      });
      box.appendChild(titulo);

      const lista = document.createElement("div");
      lista.className = "fusion-menu-items";
      lista.id = `${box.id}_itens`;

      itens.forEach(item => {
        const a = document.createElement("a");
        a.href = item.href;
        a.dataset.menuId = item.id;
        a.textContent = item.label;
        if (item.novaAba) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.title = `${item.label} — abrir em nova aba`;
        }
        a.addEventListener("click", () => window.FusionMenuMobile?.fechar?.());
        if (itemAtivo(item.href)) {
          a.classList.add("active");
          a.setAttribute("aria-current", "page");
        }
        lista.appendChild(a);
      });

      box.appendChild(lista);
      sidebar.appendChild(box);
    });

    removerMenusExistentes();
    document.body.classList.remove("fusion-sem-menu");
    document.documentElement.classList.remove("fusion-sem-menu");
    document.body.classList.add("fusion-com-sidebar");
    document.documentElement.classList.add("fusion-com-sidebar");
    document.body.prepend(sidebar);
    montarMenuMobile();
    montarBreadcrumb();
    garantirCentralNotificacoes();
  }

  function preencherUsuarioTopo() {
    const user = usuario();
    document.querySelectorAll("[data-fusion-user]").forEach(el => {
      el.textContent = user?.nome || "Administrador";
    });
  }


  const CATRACA_STORAGE_KEY = "fusion_catraca_painel_ativa";
  const CATRACA_HOST = "10.0.0.236";
  const CATRACA_PORT = 3000;

  function perfilPodeControlarCatraca(user) {
    const perfil = String(user?.perfil || user?.perfilOriginal || "")
      .trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return ["admin", "administrador", "gerente", "recepcao", "recepção", "comercial"].includes(perfil);
  }

  function catracaAtiva() {
    return localStorage.getItem(CATRACA_STORAGE_KEY) !== "0";
  }

  function salvarCatracaAtiva(ativa) {
    localStorage.setItem(CATRACA_STORAGE_KEY, ativa ? "1" : "0");
  }

  async function requisicaoCatraca(url, body) {
    const opcoes = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    };
    const resp = window.FusionAuth?.fetchAuth
      ? await FusionAuth.fetchAuth(url, opcoes)
      : await fetch(url, opcoes);
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) {
      throw new Error(json.mensagem || json.erro || `Erro HTTP ${resp.status}`);
    }
    return json;
  }

  function atualizarControleCatraca(controle, estado = {}) {
    if (!controle) return;
    const ativa = estado.ativa ?? catracaAtiva();
    const ocupada = estado.ocupada === true;
    const status = controle.querySelector("[data-catraca-status]");
    const alternar = controle.querySelector("[data-catraca-alternar]");
    const liberar = controle.querySelector("[data-catraca-liberar]");

    controle.classList.toggle("catraca-ativa", ativa);
    controle.classList.toggle("catraca-inativa", !ativa);
    controle.classList.toggle("catraca-ocupada", ocupada);

    if (status) {
      status.textContent = ocupada ? "Comunicando..." : (ativa ? "Catraca ligada" : "Controle desligado");
    }
    if (alternar) {
      alternar.textContent = ativa ? "Desligar" : "Ligar";
      alternar.disabled = ocupada;
    }
    if (liberar) liberar.disabled = ocupada || !ativa;
  }

  function montarControleCatraca(user) {
    if (!perfilPodeControlarCatraca(user)) return null;

    const controle = document.createElement("div");
    controle.className = "fusion-catraca-controle";
    controle.innerHTML = `
      <span class="fusion-catraca-status" data-catraca-status>Catraca ligada</span>
      <button type="button" class="fusion-catraca-toggle" data-catraca-alternar>Desligar</button>
    `;

    const alternar = controle.querySelector("[data-catraca-alternar]");
    const liberar = controle.querySelector("[data-catraca-liberar]");

    alternar.addEventListener("click", async () => {
      const vaiLigar = !catracaAtiva();
      atualizarControleCatraca(controle, { ativa: catracaAtiva(), ocupada: true });
      try {
        // Este controle apenas habilita/desabilita o botão no painel.
        // A Henry física é controlada exclusivamente pelo Fusion Access Agent.
        salvarCatracaAtiva(vaiLigar);
        atualizarControleCatraca(controle, { ativa: vaiLigar, ocupada: false });
      } catch (erro) {
        atualizarControleCatraca(controle, { ativa: catracaAtiva(), ocupada: false });
        alert(erro.message || "Não foi possível alterar o estado da catraca.");
      }
    });

    liberar?.addEventListener("click", async () => {
      if (!catracaAtiva()) return;
      atualizarControleCatraca(controle, { ativa: true, ocupada: true });
      try {
        await requisicaoCatraca("/api/access-engine/liberar-remoto", {
          dispositivoId: "disp_henry7x_01",
          direcao: "ambos",
          tempoSegundos: 5,
          operadorId: user?.id || "",
          operadorNome: user?.nome || "",
          origem: "topbar-liberacao-manual",
          motivo: "Liberação manual pelo painel"
        });
        atualizarControleCatraca(controle, { ativa: true, ocupada: false });
      } catch (erro) {
        atualizarControleCatraca(controle, { ativa: true, ocupada: false });
        alert(erro.message || "Falha ao liberar a catraca.");
      }
    });

    atualizarControleCatraca(controle);
    return controle;
  }


  function prepararLinksPublicos(root = document) {
    const destinos = ["/pages/matricula-online/index.html", "/pages/promocao/index.html"];
    root.querySelectorAll("a[href]").forEach((link) => {
      const href = String(link.getAttribute("href") || "").split("?")[0];
      if (destinos.includes(href)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    });
  }

  function formatarDatasVisiveis(root = document) {
    const seletor = "td,th,span,small,p,strong,[data-date-br]";
    root.querySelectorAll?.(seletor).forEach((el) => {
      if (el.children.length || el.closest("input,select,textarea,script,style")) return;
      const atual = String(el.textContent || "");
      const formatado = atual.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, "$3/$2/$1");
      if (formatado !== atual) el.textContent = formatado;
    });
  }

  window.carregarLayout = function carregarLayout(titulo) {

    if (paginaSemMenu()) {
        removerMenusExistentes();
        return;
    }

    montarMenu();
    preencherUsuarioTopo();
    removerBarrasSuperiores();
  };

  document.addEventListener("DOMContentLoaded", () => {
    prepararLinksPublicos(document);
    formatarDatasVisiveis(document);
    removerBarrasSuperiores();
    if (paginaSemMenu()) {
      removerMenusExistentes();
      preencherUsuarioTopo();
      return;
    }

    if (!document.querySelector(".sidebar,#fusionSidebar")) {
      window.carregarLayout();
    } else {
      preencherUsuarioTopo();
    }
  });

  window.addEventListener("load", () => {
    formatarDatasVisiveis(document);
    removerBarrasSuperiores();
    if (paginaSemMenu()) removerMenusExistentes();
  });

  let formatacaoPendente = false;
  new MutationObserver(() => {
    if (formatacaoPendente) return;
    formatacaoPendente = true;
    requestAnimationFrame(() => {
      formatacaoPendente = false;
      formatarDatasVisiveis(document);
      removerBarrasSuperiores();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
