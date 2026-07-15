(function () {
  function garantirEstilosGlobais() {
    const estilos = [
      ["fusion-premium-final", "/assets/css/fusion-premium-final.css"],
      ["fusion-correcoes-visuais", "/assets/css/fusion-correcoes-visuais.css"]
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
    "/pages/comercial/",
    "/pages/comercial/index.html",
    "/pages/promocao/",
    "/pages/promocao/index.html",
    "/pages/matricula-online/",
    "/pages/matricula-online/index.html",
    "/pages/login/",
    "/pages/login/index.html"
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
      { id: "access-engine", label: "Catracas", href: "/pages/access-engine/index.html", perm: "access-engine" }
    ]},
    { grupo: "Comercial", itens: [
      { id: "site-fusion", label: "Site do Fusion ERP", href: "/pages/comercial/index.html", perm: "comercial", novaAba: true },
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
    document.querySelectorAll(".sidebar,.fusion-sidebar,#fusionSidebar,#fusionMenuGlobal,.fusion-menu-global").forEach(el => el.remove());
    document.body.classList.add("fusion-sem-menu");
    document.body.classList.remove("fusion-com-sidebar");
    document.documentElement.classList.add("fusion-sem-menu");
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
    return atual === normalizarPath(href);
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
    marca.innerHTML = "<strong>Fusion ERP</strong><small>Menu inteligente</small>";
    sidebar.appendChild(marca);

    ITENS_MENU.forEach(grupo => {
      const itens = grupo.itens.filter(item => podeVer(item, user));
      if (!itens.length) return;

      const box = document.createElement("div");
      box.className = "menu-grupo fusion-menu-section open";

      const titulo = document.createElement("span");
      titulo.className = "menu-titulo fusion-menu-group";
      titulo.textContent = grupo.grupo;
      box.appendChild(titulo);

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
        if (itemAtivo(item.href)) a.classList.add("active");
        box.appendChild(a);
      });

      sidebar.appendChild(box);
    });

    removerMenusExistentes();
    document.body.classList.remove("fusion-sem-menu");
    document.documentElement.classList.remove("fusion-sem-menu");
    document.body.classList.add("fusion-com-sidebar");
    document.documentElement.classList.add("fusion-com-sidebar");
    document.body.prepend(sidebar);
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
      <button type="button" class="fusion-catraca-liberar" data-catraca-liberar>Liberar</button>
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

    liberar.addEventListener("click", async () => {
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
    const destinos = ["/pages/comercial/index.html", "/pages/matricula-online/index.html", "/pages/promocao/index.html"];
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

    const main = document.querySelector(".fusion-main,.main,main");
    if (!main || main.querySelector(".topbar")) return;

    const user = usuario();
    const topbar = document.createElement("header");
    topbar.className = "topbar";
    topbar.innerHTML = `
      <div>
        <h1>${titulo || document.title.replace("Fusion ERP - ", "").replace(" - Fusion ERP", "") || "Fusion ERP"}</h1>
        <small>${user?.perfilOriginal || user?.perfil || "Administrador"}</small>
      </div>
      <div class="usuario-topo">
        <div data-catraca-slot></div>
        <span>${user?.nome || "Administrador"}</span>
        <button type="button" class="btn-sair">Sair</button>
      </div>
    `;
    const slotCatraca = topbar.querySelector("[data-catraca-slot]");
    const controleCatraca = montarControleCatraca(user);
    if (slotCatraca && controleCatraca) slotCatraca.appendChild(controleCatraca);
    else slotCatraca?.remove();

    topbar.querySelector(".btn-sair")?.addEventListener("click", () => {
      if (window.FusionAuth && typeof FusionAuth.sair === "function") FusionAuth.sair();
      else location.href = "/pages/login/index.html";
    });
    main.prepend(topbar);
  };

  document.addEventListener("DOMContentLoaded", () => {
    prepararLinksPublicos(document);
    formatarDatasVisiveis(document);
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
    if (paginaSemMenu()) removerMenusExistentes();
  });

  let formatacaoPendente = false;
  new MutationObserver(() => {
    if (formatacaoPendente) return;
    formatacaoPendente = true;
    requestAnimationFrame(() => {
      formatacaoPendente = false;
      formatarDatasVisiveis(document);
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
