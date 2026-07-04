function carregarLayout(tituloPagina = "Fusion ERP") {
  const usuarioNome =
    localStorage.getItem("usuarioNome") || "Administrador";

  document.body.insertAdjacentHTML(
    "afterbegin",
    `
    <aside class="sidebar">

      <h2>Fusion ERP</h2>

      <div class="menu-grupo">
        <span class="menu-titulo">Principal</span>
        <a href="/pages/dashboard/">🏠 Dashboard</a>
      </div>

      <div class="menu-grupo">
        <span class="menu-titulo">Pessoas</span>
        <a href="/pages/alunos/">👥 Alunos</a>
        <a href="/pages/professores/">🧑‍🏫 Professores</a>
      </div>

      <div class="menu-grupo">
        <span class="menu-titulo">Academia</span>
        <a href="/pages/modalidades/">🏊 Modalidades</a>
        <a href="/pages/planos/">📦 Planos</a>
        <a href="/pages/turmas/">🏫 Turmas</a>
        <a href="/pages/agenda/">📅 Agenda</a>
        <a href="/pages/checkin/">✅ Check-in</a>
        <a href="/pages/avaliacoes/">📊 Avaliações</a>
        <a href="/pages/treinos/">💪 Treinos</a>
        <a href="/pages/exercicios/">🏋️ Exercícios</a>
      </div>

      <div class="menu-grupo">
        <span class="menu-titulo">Financeiro</span>
        <a href="/pages/financeiro/">💰 Financeiro</a>
        <a href="/pages/mensalidades/">🧾 Mensalidades</a>
        <a href="/pages/caixa/">🏦 Caixa</a>
      </div>

      <div class="menu-grupo">
        <span class="menu-titulo">Business Intelligence</span>
        <a href="/pages/bi-dashboard/">📈 Dashboard Executivo</a>
        <a href="/pages/bi-financeiro/">💰 BI Financeiro</a>
        <a href="/pages/bi-academia-operacional/">👨‍🏫 BI Operacional</a>
        <a href="/pages/bi-comercial/">📊 BI Comercial</a>
      </div>

      <div class="menu-grupo">
        <span class="menu-titulo">Sistema</span>
        <a href="/pages/relatorios/">📑 Relatórios</a>
        <a href="/pages/configuracoes/">⚙️ Configurações</a>
      </div>

    </aside>
  `
  );

  const main = document.querySelector(".main");

  if (main) {
    main.insertAdjacentHTML(
      "afterbegin",
      `
      <header class="topbar">

        <h1>${tituloPagina}</h1>

        <div class="usuario-topo">
          <span id="nomeUsuario">${usuarioNome}</span>

          <button class="btn-sair" onclick="sair()">
            Sair
          </button>
        </div>

      </header>
    `
    );
  }
}

function sair() {
  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("usuarioNome");
  window.location.href = "/pages/login/";
}
