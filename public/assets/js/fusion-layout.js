(function () {
  const PAGINAS_SEM_MENU = [
    "/pages/avaliacoes/",
    "/pages/avaliacoes/index.html",

    "/pages/treinos/",
    "/pages/treinos/index.html",

    "/pages/comercial-painel/",
    "/pages/comercial-painel/index.html",

    "/pages/matricula-online/",
    "/pages/matricula-online/index.html",

    "/pages/aluno-avaliacao/",
    "/pages/aluno-avaliacao/index.html",

    "/pages/aluno-treino/",
    "/pages/aluno-treino/index.html",

    "/pages/aluno-login/",
    "/pages/aluno-login/index.html",

    "/pages/professor-login/",
    "/pages/professor-login/index.html"
];

  const ITENS_MENU = [
    { grupo: "Principal", itens: [
      { id: "dashboard", label: "🏠 Dashboard", href: "/pages/dashboard/index.html", perm: "dashboard" },
      { id: "admin", label: "⚙️ Painel Administrativo", href: "/pages/admin/index.html", perm: "admin" }
    ]},
    { grupo: "Academia", itens: [
      { id: "alunos", label: "👥 Alunos", href: "/pages/alunos/index.html", perm: "alunos" },
      { id: "professores", label: "🧑‍🏫 Professores", href: "/pages/professores/index.html", perm: "professores" },
      { id: "planos", label: "🏷️ Planos", href: "/pages/planos/index.html", perm: "planos" },
      { id: "turmas", label: "📅 Turmas", href: "/pages/turmas/index.html", perm: "turmas" },
      { id: "checkin", label: "✅ Check-in", href: "/pages/checkin/index.html", perm: "checkin" }
    ]},
    { grupo: "Financeiro", itens: [
      { id: "financeiro", label: "💰 Financeiro", href: "/pages/financeiro/index.html", perm: "financeiro" },
      { id: "mensalidades", label: "🧾 Mensalidades", href: "/pages/mensalidades/index.html", perm: "mensalidades" },
      { id: "caixa", label: "🏦 Caixa", href: "/pages/caixa/index.html", perm: "caixa" },
      { id: "relatorios", label: "📊 Relatórios", href: "/pages/relatorios-caixa/index.html", perm: "relatorios" }
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
    sidebar.className = "sidebar";
    sidebar.id = "fusionSidebar";

    const marca = document.createElement("div");
    marca.className = "brand";
    marca.innerHTML = "<strong>Fusion ERP</strong><small>Menu inteligente</small>";
    sidebar.appendChild(marca);

    ITENS_MENU.forEach(grupo => {
      const itens = grupo.itens.filter(item => podeVer(item, user));
      if (!itens.length) return;

      const box = document.createElement("div");
      box.className = "menu-grupo";

      const titulo = document.createElement("span");
      titulo.className = "menu-titulo";
      titulo.textContent = grupo.grupo;
      box.appendChild(titulo);

      itens.forEach(item => {
        const a = document.createElement("a");
        a.href = item.href;
        a.dataset.menuId = item.id;
        a.textContent = item.label;
        if (itemAtivo(item.href)) a.classList.add("active");
        box.appendChild(a);
      });

      sidebar.appendChild(box);
    });

    removerMenusExistentes();
    document.body.classList.remove("fusion-sem-menu");
    document.documentElement.classList.remove("fusion-sem-menu");
    document.body.prepend(sidebar);
  }

  function preencherUsuarioTopo() {
    const user = usuario();
    document.querySelectorAll("[data-fusion-user]").forEach(el => {
      el.textContent = user?.nome || "Administrador";
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
        <span>${user?.nome || "Administrador"}</span>
        <button type="button" class="btn-sair">Sair</button>
      </div>
    `;
    topbar.querySelector("button").addEventListener("click", () => {
      if (window.FusionAuth && typeof FusionAuth.sair === "function") FusionAuth.sair();
      else location.href = "/pages/login/index.html";
    });
    main.prepend(topbar);
  };

  document.addEventListener("DOMContentLoaded", () => {
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
    if (paginaSemMenu()) removerMenusExistentes();
  });
})();
