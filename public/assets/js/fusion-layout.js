(function () {
  "use strict";

  const MENU_GRUPOS = [
    {
      id: "principal",
      label: "PRINCIPAL",
      itens: [
        { id: "dashboard", label: "Dashboard", href: "/pages/dashboard/index.html", perm: "dashboard" },
        { id: "bi-financeiro", label: "BI Financeiro", href: "/pages/bi-financeiro/index.html", perm: "relatorios" },
        { id: "admin", label: "Painel Administrativo", href: "/pages/admin/index.html", perm: "admin" }
      ]
    },
    {
      id: "academia",
      label: "ACADEMIA",
      itens: [
        { id: "alunos", label: "Alunos", href: "/pages/alunos/index.html", perm: "alunos" },
        { id: "professores", label: "Professores", href: "/pages/professores/index.html", perm: "professores" },
        { id: "modalidades", label: "Modalidades", href: "/pages/modalidades/index.html", perm: "modalidades" },
        { id: "planos", label: "Planos", href: "/pages/planos/index.html", perm: "planos" },
        { id: "turmas", label: "Turmas", href: "/pages/turmas/index.html", perm: "turmas" },
        { id: "agenda", label: "Agenda", href: "/pages/agenda/index.html", perm: "turmas" },
        { id: "checkin", label: "Check-in", href: "/pages/checkin/index.html", perm: "checkin" },
        { id: "access-engine", label: "Catracas", href: "/pages/access-engine/index.html", perm: "access-engine" },
        { id: "reconhecimento-facial", label: "Reconhecimento Facial", href: "/pages/reconhecimento-facial/admin.html", perm: "alunos", somentePagina: true }
      ]
    },
    {
      id: "comercial",
      label: "COMERCIAL",
      itens: [
        { id: "comercial-painel", label: "CRM Comercial", href: "/pages/comercial-painel/index.html", perm: "comercial-painel" },
        { id: "site-academia", label: "Site da Academia", href: "/pages/promocao/index.html", perm: "comercial", somentePagina: true, novaAba: true },
        { id: "matricula-online", label: "Matricula Online", href: "/pages/matricula-online/index.html", perm: "matricula-online", somentePagina: true, novaAba: true },
        { id: "matriculas-pendentes", label: "Matriculas Pendentes", href: "/pages/matriculas-pendentes/index.html", perm: "matriculas" },
        { id: "site-chat", label: "Chat do Site", href: "/pages/site-chat/index.html", perm: "site-chat" },
        { id: "matriculas", label: "Matriculas", href: "/pages/matriculas/index.html", perm: "matriculas" }
      ]
    },
    {
      id: "financeiro",
      label: "FINANCEIRO",
      itens: [
        { id: "financeiro", label: "Financeiro", href: "/pages/financeiro/index.html", perm: "financeiro" },
        { id: "mensalidades", label: "Mensalidades", href: "/pages/mensalidades/index.html", perm: "mensalidades" },
        { id: "recebimentos", label: "Recebimentos", href: "/pages/recebimentos/index.html", perm: "financeiro" },
        { id: "pagamentos", label: "Pagamentos", href: "/pages/financeiro/pagamentos/index.html", perm: "financeiro" },
        { id: "caixa", label: "Caixa", href: "/pages/caixa/index.html", perm: "caixa" },
        { id: "relatorios", label: "Relatorios de Caixa", href: "/pages/relatorios-caixa/index.html", perm: "relatorios" }
      ]
    },
    {
      id: "indicadores",
      label: "INDICADORES",
      itens: [
        { id: "bi-academia", label: "BI Academia", href: "/pages/bi-academia/index.html", perm: "relatorios" },
        { id: "bi-operacional", label: "BI Operacional", href: "/pages/bi-academia-operacional/index.html", perm: "relatorios" }
      ]
    },
    {
      id: "sistema",
      label: "SISTEMA",
      itens: [
        { id: "configuracoes", label: "Configuracoes", href: "/pages/configuracoes/index.html", perm: "admin" }
      ]
    }
  ];

  function garantirMarcaDocumento() {
    document.title = String(document.title || "Fusion Sistema").replace(/Fusion\s+ERP/gi, "Fusion Sistema");

    let favicon = document.querySelector('link[rel="icon"][data-fusion-brand]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      favicon.type = "image/svg+xml";
      favicon.dataset.fusionBrand = "true";
      document.head?.appendChild(favicon);
    }
    favicon.href = "/assets/brand/fusion-sistema-symbol.svg";

    let tema = document.querySelector('meta[name="theme-color"]');
    if (!tema) {
      tema = document.createElement("meta");
      tema.name = "theme-color";
      document.head?.appendChild(tema);
    }
    tema.content = "#22b8d2";
  }

  function garantirEstilosGlobais() {
    const estilos = [
      ["fusion-app-global", "/assets/css/fusion-app.css"],
      ["fusion-menu-global", "/assets/css/fusion-menu-global.css"],
      ["fusion-premium-final", "/assets/css/fusion-premium-final.css"],
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

  function garantirCentralNotificacoes() {
    const src = "/assets/js/fusion-notificacoes.js";
    const existente = Array.from(document.scripts).some(script => {
      try {
        return new URL(script.src, location.href).pathname === src;
      } catch {
        return false;
      }
    });

    if (existente) return;

    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset.fusionNotificacoes = "true";
    document.head.appendChild(script);
  }

  let observadorAlturaMenu = null;

  function sincronizarAlturaMenu() {
    const menu = document.getElementById("fusionTopMenu");
    if (!menu) return;

    const altura = Math.max(1, Math.round(menu.getBoundingClientRect().height || 0));
    if (!altura) return;

    document.documentElement.style.setProperty("--fusion-top-menu-height", `${altura}px`);
  }

  function observarAlturaMenu(menu) {
    observadorAlturaMenu?.disconnect?.();
    observadorAlturaMenu = null;

    if (!menu) return;

    sincronizarAlturaMenu();

    if (typeof ResizeObserver === "function") {
      observadorAlturaMenu = new ResizeObserver(sincronizarAlturaMenu);
      observadorAlturaMenu.observe(menu);
    }
  }

  function encerrarSessao() {
    try {
      if (window.FusionAuth && typeof FusionAuth.sair === "function") {
        FusionAuth.sair();
        return;
      }
    } catch {}

    [
      "fusionToken",
      "fusionUsuario",
      "usuarioLogado",
      "usuarioNome",
      "usuarioEmail",
      "usuarioPerfil"
    ].forEach(chave => localStorage.removeItem(chave));

    location.href = "/pages/login/index.html";
  }

  const SELETORES_MENU_LATERAL = [
    "#fusionSidebar",
    "#fusionMenuGlobal",
    ".fusion-menu-global",
    "body > .sidebar",
    "body > .fusion-sidebar",
    "body > .fusion-ui-sidebar",
    "body > .menu-global",
    "body > .nav-sidebar",
    "body > .app-sidebar",
    "body > .layout-sidebar",
    ".fusion-v3-menu-toggle",
    ".fusion-v3-menu-backdrop",
    ".fusion-mobile-final-bar",
    ".fusion-mobile-final-overlay",
    ".fusion-mobile-menu-button",
    ".fusion-mobile-overlay",
    ".fusion-breadcrumb"
  ].join(",");

  function normalizarPath(pathname) {
    let path = String(pathname || location.pathname || "/").split(/[?#]/)[0];
    const indicePages = path.indexOf("/pages/");
    if (indicePages >= 0) path = path.slice(indicePages);
    path = path.replace(/\/{2,}/g, "/");
    if (path.length > 1 && path.endsWith("/")) path += "index.html";
    return path;
  }

  function pastaDoHref(href) {
    return normalizarPath(href).replace(/\/[^/]+\.html$/i, "/");
  }

  function itemCorrespondeAoPath(item, pathname = location.pathname) {
    const atual = normalizarPath(pathname);
    const alvo = normalizarPath(item.href);
    if (atual === alvo) return true;
    if (item.somentePagina) return false;
    return atual.startsWith(pastaDoHref(item.href));
  }

  function normalizarPermissao(valor) {
    return String(valor || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function podeVer(item, user = usuario()) {
    if (!item?.perm) return true;
    const permissoes = Array.isArray(user?.permissoes) ? user.permissoes.map(normalizarPermissao) : [];
    const perfil = normalizarPermissao(user?.perfil || user?.perfilOriginal);
    if (permissoes.includes("*") || perfil === "admin" || perfil === "administrador") return true;
    return permissoes.includes(normalizarPermissao(item.perm)) || permissoes.includes(normalizarPermissao(item.id));
  }

  function gruposPermitidos(user = usuario()) {
    return MENU_GRUPOS.map(grupo => {
      const itens = grupo.itens.filter(item => podeVer(item, user));
      return itens.length ? { ...grupo, itens } : null;
    }).filter(Boolean);
  }

  function todosItens(grupos = MENU_GRUPOS) {
    return grupos.flatMap(grupo => grupo.itens.map(item => ({ ...item, grupoId: grupo.id, grupoLabel: grupo.label })));
  }

  function paginaComMenuSuperior() {
    return todosItens().some(item => itemCorrespondeAoPath(item));
  }

  function itemAtual(grupos = MENU_GRUPOS) {
    return todosItens(grupos).find(item => itemCorrespondeAoPath(item)) || null;
  }

  function removerMenusLegados(root = document) {
    root.querySelectorAll?.(SELETORES_MENU_LATERAL).forEach(elemento => elemento.remove());
    document.querySelectorAll("body > .topbar, body > .fusion-topbar").forEach(elemento => elemento.remove());

    [document.documentElement, document.body].filter(Boolean).forEach(elemento => {
      elemento.classList.remove("fusion-com-sidebar", "fusion-menu-open", "fusion-ui-menu-open");
      elemento.classList.add("fusion-sem-menu", "fusion-no-sidebar", "fusion-layout-fullwidth");
    });

    if (document.body) {
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-left");
      document.body.style.removeProperty("margin-left");

      // dashboard.css usa o body como contêiner flexível da antiga sidebar.
      // As quatro páginas de BI/Matrículas carregam esse arquivo depois do
      // tema global; por isso a correção precisa existir também inline.
      document.body.style.setProperty("display", "block", "important");
      document.body.style.setProperty("flex-direction", "column", "important");
      document.body.style.setProperty("align-items", "stretch", "important");
      document.body.style.setProperty("justify-content", "flex-start", "important");
      document.body.style.setProperty("width", "100%", "important");
      document.body.style.setProperty("max-width", "100%", "important");
      document.body.style.setProperty("min-height", "100vh", "important");
    }
  }

  function criarCaret() {
    const caret = document.createElement("span");
    caret.className = "fusion-top-menu__caret";
    caret.setAttribute("aria-hidden", "true");
    return caret;
  }

  function criarLink(item, contexto) {
    const link = document.createElement("a");
    link.className = `fusion-top-menu__link fusion-top-menu__link--${contexto}`;
    link.href = item.href;
    link.textContent = item.label;
    link.dataset.menuId = item.id;

    if (item.novaAba) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = item.label + " - abrir em nova aba";
    }

    if (itemCorrespondeAoPath(item)) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }

    link.addEventListener("click", fecharTudo);
    return link;
  }

  function criarGrupoDesktop(grupo) {
    const wrapper = document.createElement("div");
    wrapper.className = "fusion-top-menu__group";
    wrapper.dataset.groupId = grupo.id;

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "fusion-top-menu__group-trigger";
    botao.setAttribute("aria-expanded", "false");
    botao.setAttribute("aria-controls", `fusion-menu-dropdown-${grupo.id}`);
    botao.append(document.createTextNode(grupo.label), criarCaret());

    const dropdown = document.createElement("div");
    dropdown.className = "fusion-top-menu__dropdown";
    dropdown.id = `fusion-menu-dropdown-${grupo.id}`;
    dropdown.setAttribute("role", "menu");
    grupo.itens.forEach(item => dropdown.appendChild(criarLink(item, "dropdown")));

    if (grupo.itens.some(item => itemCorrespondeAoPath(item))) {
      wrapper.classList.add("is-current");
    }

    botao.addEventListener("click", evento => {
      evento.stopPropagation();
      const abrir = !wrapper.classList.contains("is-open");
      fecharTudo(wrapper);
      wrapper.classList.toggle("is-open", abrir);
      botao.setAttribute("aria-expanded", abrir ? "true" : "false");
    });

    wrapper.append(botao, dropdown);
    return wrapper;
  }

  function criarGrupoMega(grupo) {
    const section = document.createElement("section");
    section.className = "fusion-top-menu__mega-group";
    section.dataset.megaGroupId = grupo.id;

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "fusion-top-menu__mega-title";
    botao.setAttribute("aria-expanded", "false");
    botao.setAttribute("aria-controls", `fusion-menu-mega-${grupo.id}`);
    botao.append(document.createTextNode(grupo.label), criarCaret());

    const lista = document.createElement("div");
    lista.className = "fusion-top-menu__mega-links";
    lista.id = `fusion-menu-mega-${grupo.id}`;
    grupo.itens.forEach(item => lista.appendChild(criarLink(item, "mega")));

    if (grupo.itens.some(item => itemCorrespondeAoPath(item))) {
      section.classList.add("is-current");
    }

    botao.addEventListener("click", evento => {
      if (!window.matchMedia("(max-width: 900px)").matches) return;
      evento.stopPropagation();
      const abrir = !section.classList.contains("is-open");
      const painel = section.closest(".fusion-top-menu__mega");
      painel?.querySelectorAll(".fusion-top-menu__mega-group.is-open").forEach(outro => {
        if (outro === section) return;
        outro.classList.remove("is-open");
        outro.querySelector(".fusion-top-menu__mega-title")?.setAttribute("aria-expanded", "false");
      });
      section.classList.toggle("is-open", abrir);
      botao.setAttribute("aria-expanded", abrir ? "true" : "false");
    });

    section.append(botao, lista);
    return section;
  }

  function fecharTudo(excecao) {
    const menu = document.getElementById("fusionTopMenu");
    if (!menu) return;

    menu.querySelectorAll(".fusion-top-menu__group.is-open").forEach(grupo => {
      if (grupo === excecao) return;
      grupo.classList.remove("is-open");
      grupo.querySelector(".fusion-top-menu__group-trigger")?.setAttribute("aria-expanded", "false");
    });

    const mega = menu.querySelector(".fusion-top-menu__mega");
    if (mega !== excecao) {
      mega?.classList.remove("is-open");
      menu.querySelector(".fusion-top-menu__all-trigger")?.setAttribute("aria-expanded", "false");
    }

    if (!excecao) {
      menu.querySelectorAll(".fusion-top-menu__mega-group.is-open").forEach(grupo => {
        grupo.classList.remove("is-open");
        grupo.querySelector(".fusion-top-menu__mega-title")?.setAttribute("aria-expanded", "false");
      });
    }

    document.body?.classList.toggle("fusion-menu-superior-aberto", Boolean(excecao));
  }

  function montarMenuSuperior() {
    removerMenusLegados();

    if (!paginaComMenuSuperior()) {
      document.getElementById("fusionTopMenu")?.remove();
      document.documentElement.classList.remove("fusion-menu-superior-ativo");
      document.body?.classList.remove("fusion-menu-superior-ativo", "fusion-menu-superior-aberto");
      return;
    }

    if (document.getElementById("fusionTopMenu")) return;

    const user = usuario();
    const gruposMenu = gruposPermitidos(user);

    const header = document.createElement("header");
    header.id = "fusionTopMenu";
    header.className = "fusion-top-menu";

    const inner = document.createElement("div");
    inner.className = "fusion-top-menu__inner";

    const marca = document.createElement("a");
    marca.className = "fusion-top-menu__brand";
    marca.href = "/pages/dashboard/index.html";
    marca.setAttribute("aria-label", "Fusion Sistema — ir para o Dashboard");

    const marcaIcone = document.createElement("img");
    marcaIcone.className = "fusion-top-menu__brand-icon";
    marcaIcone.src = "/assets/brand/fusion-sistema-symbol.svg";
    marcaIcone.alt = "";
    marcaIcone.setAttribute("aria-hidden", "true");

    const marcaTexto = document.createElement("span");
    marcaTexto.className = "fusion-top-menu__brand-text";
    marcaTexto.textContent = "Fusion Sistema";
    marca.append(marcaIcone, marcaTexto);

    const allWrap = document.createElement("div");
    allWrap.className = "fusion-top-menu__all";

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "fusion-top-menu__all-trigger";
    allButton.setAttribute("aria-expanded", "false");
    allButton.setAttribute("aria-controls", "fusion-menu-todas-categorias");

    const hamburguer = document.createElement("span");
    hamburguer.className = "fusion-top-menu__hamburger";
    hamburguer.setAttribute("aria-hidden", "true");
    hamburguer.innerHTML = "<i></i><i></i><i></i>";

    const allLabel = document.createElement("span");
    allLabel.className = "fusion-top-menu__all-label";
    allLabel.textContent = "Todas as categorias";
    allButton.append(hamburguer, allLabel, criarCaret());

    const mega = document.createElement("div");
    mega.className = "fusion-top-menu__mega";
    mega.id = "fusion-menu-todas-categorias";

    const megaGrid = document.createElement("div");
    megaGrid.className = "fusion-top-menu__mega-grid";
    gruposMenu.forEach(grupo => megaGrid.appendChild(criarGrupoMega(grupo)));
    mega.appendChild(megaGrid);

    allButton.addEventListener("click", evento => {
      evento.stopPropagation();
      const abrir = !mega.classList.contains("is-open");
      fecharTudo(abrir ? mega : null);
      mega.classList.toggle("is-open", abrir);
      allButton.setAttribute("aria-expanded", abrir ? "true" : "false");
      document.body?.classList.toggle("fusion-menu-superior-aberto", abrir);
    });

    allWrap.append(allButton, mega);

    const nav = document.createElement("nav");
    nav.className = "fusion-top-menu__categories";
    nav.setAttribute("aria-label", "Navegação principal do Fusion Sistema");
    gruposMenu.forEach(grupo => nav.appendChild(criarGrupoDesktop(grupo)));

    const ferramentas = document.createElement("div");
    ferramentas.className = "fusion-top-menu__tools";
    ferramentas.setAttribute("aria-label", "Ferramentas do usuário");

    const notificacoes = document.createElement("div");
    notificacoes.className = "fusion-top-menu__notifications fusion-sidebar-notificacoes";
    notificacoes.setAttribute("aria-label", "Notificações do sistema");

    const sair = document.createElement("button");
    sair.type = "button";
    sair.className = "fusion-top-menu__logout";
    sair.setAttribute("aria-label", "Sair do Fusion Sistema");
    sair.title = usuario()?.nome ? `Sair — ${usuario().nome}` : "Sair";
    sair.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M18 12H9"/>
      </svg>
      <span>Sair</span>
    `;
    sair.addEventListener("click", evento => {
      evento.stopPropagation();
      fecharTudo();
      encerrarSessao();
    });

    const controleCatraca = montarControleCatraca(user);
    if (controleCatraca) ferramentas.appendChild(controleCatraca);
    ferramentas.append(notificacoes, sair);
    inner.append(marca, allWrap, nav, ferramentas);
    header.appendChild(inner);

    // Ativa as classes antes de inserir o cabeçalho. Isso impede que regras
    // legadas de body{display:flex} estiquem o menu durante a montagem.
    document.documentElement.classList.add("fusion-menu-superior-ativo");
    document.body.classList.add("fusion-menu-superior-ativo");
    document.body.prepend(header);
    observarAlturaMenu(header);
    requestAnimationFrame(sincronizarAlturaMenu);
    removerMenusLegados();
    garantirCentralNotificacoes();

    window.FusionMenuMobile = {
      abrir() {
        if (!mega.classList.contains("is-open")) allButton.click();
      },
      fechar() {
        fecharTudo();
      },
      alternar() {
        allButton.click();
      }
    };
  }

  function usuario() {
    try {
      if (window.FusionAuth && typeof FusionAuth.usuarioAtual === "function") {
        return FusionAuth.usuarioAtual();
      }
    } catch {}

    try {
      return JSON.parse(localStorage.getItem("fusionUsuario") || "null");
    } catch {
      return null;
    }
  }

  function preencherUsuarioTopo() {
    const user = usuario();
    document.querySelectorAll("[data-fusion-user]").forEach(elemento => {
      elemento.textContent = user?.nome || "Administrador";
    });
  }

  const CATRACA_STORAGE_KEY = "fusion_catraca_painel_ativa";

  function perfilPodeControlarCatraca(user) {
    const perfil = normalizarPermissao(user?.perfil || user?.perfilOriginal);
    return ["admin", "administrador", "gerente", "recepcao", "comercial"].includes(perfil);
  }

  function catracaAtiva() {
    return localStorage.getItem(CATRACA_STORAGE_KEY) !== "0";
  }

  function salvarCatracaAtiva(ativa) {
    localStorage.setItem(CATRACA_STORAGE_KEY, ativa ? "1" : "0");
  }

  function atualizarControleCatraca(controle, estado = {}) {
    if (!controle) return;
    const ativa = estado.ativa ?? catracaAtiva();
    const ocupada = estado.ocupada === true;
    const status = controle.querySelector("[data-catraca-status]");
    const alternar = controle.querySelector("[data-catraca-alternar]");

    controle.classList.toggle("catraca-ativa", ativa);
    controle.classList.toggle("catraca-inativa", !ativa);
    controle.classList.toggle("catraca-ocupada", ocupada);

    if (status) status.textContent = ocupada ? "Comunicando..." : (ativa ? "Catraca ligada" : "Controle desligado");
    if (alternar) {
      alternar.textContent = ativa ? "Desligar" : "Ligar";
      alternar.disabled = ocupada;
    }
  }

  function montarControleCatraca(user) {
    if (!perfilPodeControlarCatraca(user)) return null;

    const controle = document.createElement("div");
    controle.className = "fusion-catraca-controle";
    controle.innerHTML = '<span class="fusion-catraca-status" data-catraca-status>Catraca ligada</span><button type="button" class="fusion-catraca-toggle" data-catraca-alternar>Desligar</button>';

    controle.querySelector("[data-catraca-alternar]")?.addEventListener("click", () => {
      const vaiLigar = !catracaAtiva();
      atualizarControleCatraca(controle, { ativa: catracaAtiva(), ocupada: true });
      salvarCatracaAtiva(vaiLigar);
      atualizarControleCatraca(controle, { ativa: vaiLigar, ocupada: false });
    });

    atualizarControleCatraca(controle);
    return controle;
  }

  function prepararLinksPublicos(root = document) {
    const destinos = ["/pages/matricula-online/index.html", "/pages/promocao/index.html"];
    root.querySelectorAll?.("a[href]").forEach(link => {
      if (link.closest("#fusionTopMenu")) return;
      const href = normalizarPath(link.getAttribute("href"));
      if (!destinos.includes(href)) return;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  }

  function formatarDatasVisiveis(root = document) {
    const seletor = "td,th,span,small,p,strong,[data-date-br]";
    root.querySelectorAll?.(seletor).forEach(elemento => {
      if (elemento.closest("#fusionTopMenu")) return;
      if (elemento.children.length || elemento.closest("input,select,textarea,script,style")) return;
      const atual = String(elemento.textContent || "");
      const formatado = atual.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, "$3/$2/$1");
      if (formatado !== atual) elemento.textContent = formatado;
    });
  }

  function aplicarLayout() {
    garantirEstilosGlobais();
    garantirMarcaDocumento();
    removerMenusLegados();
    montarMenuSuperior();
    preencherUsuarioTopo();
  }

  window.carregarLayout = function carregarLayout() {
    aplicarLayout();
  };

  let atualizacaoPendente = false;
  function agendarAtualizacao() {
    if (atualizacaoPendente) return;
    atualizacaoPendente = true;
    requestAnimationFrame(() => {
      atualizacaoPendente = false;
      removerMenusLegados();
      if (paginaComMenuSuperior() && !document.getElementById("fusionTopMenu")) montarMenuSuperior();
      formatarDatasVisiveis(document);
    });
  }

  function iniciar() {
    prepararLinksPublicos(document);
    formatarDatasVisiveis(document);
    aplicarLayout();

    const observador = new MutationObserver(agendarAtualizacao);
    observador.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener("click", evento => {
      if (!evento.target.closest("#fusionTopMenu")) fecharTudo();
    });

    document.addEventListener("keydown", evento => {
      if (evento.key === "Escape") fecharTudo();
    });

    window.addEventListener("resize", () => {
      fecharTudo();
      sincronizarAlturaMenu();
    });
    window.addEventListener("pageshow", aplicarLayout);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
