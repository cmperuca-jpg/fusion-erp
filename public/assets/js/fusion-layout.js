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

    "/pages/aluno-treinos/",
    "/pages/aluno-treinos/index.html",

    "/pages/aluno-login/",
    "/pages/aluno-login/index.html",

    "/pages/professor-login/",
    "/pages/professor-login/index.html"
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
      { id: "comercial", label: "Site comercial", href: "/pages/comercial/index.html", perm: "comercial" },
      { id: "matricula-online", label: "Matricula online", href: "/pages/matricula-online/index.html", perm: "comercial" },
      { id: "matriculas-pendentes", label: "Matriculas pendentes", href: "/pages/matriculas-pendentes/index.html", perm: "matriculas" },
      { id: "site-chat", label: "Chat do site", href: "/pages/site-chat/index.html", perm: "site-chat" },
      { id: "matriculas", label: "Matriculas", href: "/pages/matriculas/index.html", perm: "matriculas" }
    ]},
    { grupo: "Financeiro", itens: [
      { id: "financeiro", label: "Financeiro", href: "/pages/financeiro/index.html", perm: "financeiro" },
      { id: "mensalidades", label: "Mensalidades", href: "/pages/mensalidades/index.html", perm: "mensalidades" },
      { id: "recebimentos", label: "Recebimentos", href: "/pages/recebimentos/index.html", perm: "financeiro" },
      { id: "pagamentos", label: "Pagamentos", href: "/pages/financeiro/pagamentos/index.html", perm: "financeiro" },
      { id: "caixa", label: "Caixa", href: "/pages/caixa/index.html", perm: "caixa" },
      { id: "relatorios", label: "Relatorios de caixa", href: "/pages/relatorios-caixa/index.html", perm: "relatorios" }
    ]},
    { grupo: "Indicadores", itens: [
      { id: "bi-academia", label: "BI Academia", href: "/pages/bi-academia/index.html", perm: "relatorios" },
      { id: "bi-operacional", label: "BI Operacional", href: "/pages/bi-academia-operacional/index.html", perm: "relatorios" }
    ]},
    { grupo: "Sistema", itens: [
      { id: "configuracoes", label: "Configuracoes", href: "/pages/configuracoes/index.html", perm: "admin" }
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
        if (vaiLigar) {
          await requisicaoCatraca("/api/henry7x/raw", {
            host: CATRACA_HOST,
            port: CATRACA_PORT,
            hex: "FE8A7100010100050000"
          });
          salvarCatracaAtiva(true);
        } else {
          salvarCatracaAtiva(false);
        }
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
        await requisicaoCatraca("/api/henry7x/liberar-sca", {
          host: CATRACA_HOST,
          port: CATRACA_PORT,
          tempoSegundos: 5,
          direcao: "ambos",
          operadorId: user?.id || "",
          origem: "topbar",
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


  let biometriaHeartbeat = null;

  function paginaDashboard() {
    const atual = normalizarPath(location.pathname);
    return atual === normalizarPath("/pages/dashboard/") ||
      atual === normalizarPath("/pages/dashboard/index.html");
  }

  async function ativarBiometriaAcesso() {
    try {
      const opcoes = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      };

      const resp = window.FusionAuth?.fetchAuth
        ? await FusionAuth.fetchAuth("/api/biometria/modo/acesso", opcoes)
        : await fetch("/api/biometria/modo/acesso", opcoes);

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json.ok === false) {
        throw new Error(json.mensagem || json.erro || `Erro HTTP ${resp.status}`);
      }

      document.documentElement.dataset.biometriaAcesso = "ativa";
      return true;
    } catch (erro) {
      document.documentElement.dataset.biometriaAcesso = "indisponivel";
      console.warn("Biometria em modo acesso indisponível:", erro.message || erro);
      return false;
    }
  }

  async function verificarBiometriaAtiva() {
    try {
      const resp = window.FusionAuth?.fetchAuth
        ? await FusionAuth.fetchAuth("/api/biometria/status", { cache: "no-store" })
        : await fetch("/api/biometria/status", { cache: "no-store" });

      const json = await resp.json().catch(() => ({}));
      const local = json.local || {};
      const conectada = resp.ok && json.ok !== false && local.conectado === true;

      document.documentElement.dataset.biometriaLeitor =
        conectada ? "conectado" : "desconectado";

      const modo = String(local.modo || local.modoServidor || "").toLowerCase();
      if (!conectada || modo !== "acesso") {
        await ativarBiometriaAcesso();
      }

      return conectada;
    } catch {
      document.documentElement.dataset.biometriaLeitor = "indisponivel";
      return false;
    }
  }

  function iniciarBiometriaSempreAtiva() {
    if (!paginaDashboard()) return;

    ativarBiometriaAcesso().then(() => verificarBiometriaAtiva());

    if (biometriaHeartbeat) clearInterval(biometriaHeartbeat);
    biometriaHeartbeat = setInterval(() => {
      verificarBiometriaAtiva();
    }, 15000);
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
    iniciarBiometriaSempreAtiva();
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
