// DASHBOARD CHECKIN OPERACIONAL 6 COLUNAS 20260826
(() => {
  const INTERVALO_MS = 5000;
  let consultaEmAndamento = false;
  let timer = null;

  const porId = (id) => document.getElementById(id);

  function fetchAuth(url, opcoes = {}) {
    const opts = { cache: "no-store", ...opcoes };
    return window.FusionAuth?.fetchAuth
      ? window.FusionAuth.fetchAuth(url, opts)
      : fetch(url, opts);
  }

  function texto(id, valor) {
    const el = porId(id);
    if (el) el.textContent = String(valor ?? 0);
  }

  function renderLista(id, itens) {
    const container = porId(id);
    if (!container) return;

    container.replaceChildren();

    const lista = Array.isArray(itens) ? itens : [];
    if (!lista.length) {
      const vazio = document.createElement("em");
      vazio.textContent = "Nenhuma pessoa";
      container.appendChild(vazio);
      return;
    }

    lista.forEach((item) => {
      const linha = document.createElement("div");
      linha.textContent = String(item?.nome || item?.aluno || item?.pessoa || "Pessoa");
      container.appendChild(linha);
    });
  }

  function horarioAtualizacao() {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date());
    } catch {
      return new Date().toLocaleTimeString();
    }
  }

  async function atualizar() {
    if (document.hidden || consultaEmAndamento) return;

    consultaEmAndamento = true;
    try {
      const resp = await fetchAuth("/api/checkin/resumo");
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.ok === false) {
        throw new Error(json?.mensagem || `HTTP ${resp.status}`);
      }

      const resumo = json?.resumo || json || {};
      const listas = resumo?.listas || {};

      texto("dashboardCheckinEntradasHoje", resumo.entradasHoje ?? 0);
      texto("dashboardCheckinAlunosPresentes", resumo.alunosPresentesAgora ?? 0);
      texto("dashboardCheckinFuncionariosPresentes", resumo.funcionariosPresentesAgora ?? 0);
      texto("dashboardCheckinSaidasHoje", resumo.saidasHoje ?? 0);
      texto("dashboardCheckinBloqueadosHoje", resumo.bloqueadosHoje ?? 0);
      texto("dashboardCheckinPessoasMes", resumo.pessoasMes ?? 0);

      renderLista("dashboardCheckinListaEntradas", listas.entradasHoje);
      renderLista("dashboardCheckinListaAlunosPresentes", listas.alunosPresentes);
      renderLista("dashboardCheckinListaFuncionariosPresentes", listas.funcionariosPresentes);
      renderLista("dashboardCheckinListaSaidas", listas.saidasHoje);
      renderLista("dashboardCheckinListaBloqueados", listas.bloqueadosHoje);
      renderLista("dashboardCheckinListaPessoasMes", listas.pessoasMes);

      const atualizado = porId("dashboardCheckinAtualizado");
      if (atualizado) atualizado.textContent = `Atualizado ${horarioAtualizacao()}`;
    } catch (erro) {
      console.error("Dashboard/Check-in operacional:", erro);
      const atualizado = porId("dashboardCheckinAtualizado");
      if (atualizado) atualizado.textContent = "Falha ao atualizar";
    } finally {
      consultaEmAndamento = false;
    }
  }

  function iniciar() {
    if (!porId("movimentoHojeDashboard")) return;

    atualizar();
    timer = window.setInterval(atualizar, INTERVALO_MS);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) atualizar();
    });

    window.addEventListener("pagehide", () => {
      if (timer) window.clearInterval(timer);
    }, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
