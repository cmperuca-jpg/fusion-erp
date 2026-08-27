// DASHBOARD FINANCEIRO OPERACIONAL 20260826
(() => {
  const INTERVALO_MS = 10000;
  let consultaEmAndamento = false;
  let timer = null;

  const $ = (id) => document.getElementById(id);

  function fetchAuth(url, opcoes = {}) {
    const opts = { cache: "no-store", ...opcoes };
    return window.FusionAuth?.fetchAuth
      ? window.FusionAuth.fetchAuth(url, opts)
      : fetch(url, opts);
  }

  async function obterJson(url) {
    const resp = await fetchAuth(url);
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json?.ok === false) {
      throw new Error(json?.mensagem || json?.erro || `HTTP ${resp.status}`);
    }
    return json;
  }

  function lista(payload, chaves = []) {
    if (Array.isArray(payload)) return payload;
    for (const chave of chaves) {
      if (Array.isArray(payload?.[chave])) return payload[chave];
    }
    if (payload?.data && typeof payload.data === "object") {
      const achada = lista(payload.data, chaves);
      if (achada.length) return achada;
    }
    if (payload?.resultado && typeof payload.resultado === "object") {
      const achada = lista(payload.resultado, chaves);
      if (achada.length) return achada;
    }
    return [];
  }

  function texto(v) {
    return String(v ?? "").trim();
  }

  function normalizar(v) {
    return texto(v)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function numero(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    let s = texto(v);
    if (!s) return 0;
    s = s.replace(/[R$\s]/g, "");
    if (s.includes(",") && s.includes(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",")) {
      s = s.replace(",", ".");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function moeda(v) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(numero(v));
  }

  function dataIso(item = {}) {
    return texto(
      item.vencimento ||
      item.dataVencimento ||
      item.data_vencimento ||
      item.data ||
      item.competencia
    ).slice(0, 10);
  }

  function dataHojeLocal() {
    const agora = new Date();
    const y = agora.getFullYear();
    const m = String(agora.getMonth() + 1).padStart(2, "0");
    const d = String(agora.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function dataBr(iso) {
    const s = texto(iso).slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || "-");
  }

  function status(item = {}) {
    return normalizar(
      item.status ||
      item.statusFinanceiro ||
      item.statusOriginal ||
      item.situacao ||
      item.estado ||
      item.situacaoFinanceira
    );
  }

  function statusEncerrado(item = {}) {
    const s = status(item);
    return [
      "pago",
      "recebido",
      "quitado",
      "cancelado",
      "cancelada",
      "estornado",
      "estornada",
      "inativo"
    ].some(x => s.includes(x));
  }

  function saldoPendente(item = {}) {
    const candidatos = [
      item.valorRestante,
      item.saldoRestante,
      item.saldo,
      item.valorAberto,
      item.valorPendente,
      item.restante
    ].map(numero);

    const direto = candidatos.find(v => v > 0);
    if (direto !== undefined) return direto;

    const bruto = numero(
      item.valorTotal ??
      item.total ??
      item.valorOriginal ??
      item.valorBruto ??
      item.valor ??
      item.valorMensal
    );

    const pago = numero(
      item.valorPago ??
      item.valorRecebido ??
      item.valorBaixado ??
      item.pago
    );

    return Math.max(0, bruto - pago);
  }

  function nomePessoa(item = {}) {
    return texto(
      item.alunoNome ||
      item.aluno ||
      item.cliente ||
      item.nomeCliente ||
      item.pessoa ||
      item.responsavel ||
      item.fornecedor ||
      "Pessoa"
    );
  }

  function descricao(item = {}) {
    return texto(
      item.descricao ||
      item.documento ||
      item.referencia ||
      item.competencia ||
      ""
    );
  }

  function alunoId(item = {}) {
    return texto(
      item.alunoId ||
      item.aluno_id ||
      item.pessoaId ||
      item.matriculaId ||
      ""
    );
  }

  function idRegistro(item = {}) {
    return texto(
      item.id ||
      item.recebimentoId ||
      item.lancamentoFinanceiroId ||
      item.financeiroId ||
      item.mensalidadeId ||
      ""
    );
  }

  function setText(id, valor) {
    const el = $(id);
    if (el) el.textContent = valor;
  }

  function criarLinha({ nome, detalhe, vencimento, valor, atrasado = false, href = "" }) {
    const linha = document.createElement(href ? "a" : "div");
    linha.className = "dashboard-fin-op-linha";
    if (href) {
      linha.href = href;
      linha.style.textDecoration = "none";
      linha.style.color = "inherit";
    }

    const blocoNome = document.createElement("div");
    blocoNome.className = "dashboard-fin-op-nome";

    const nomeEl = document.createElement("strong");
    nomeEl.textContent = nome || "Pessoa";
    blocoNome.appendChild(nomeEl);

    if (detalhe) {
      const detalheEl = document.createElement("small");
      detalheEl.textContent = detalhe;
      blocoNome.appendChild(detalheEl);
    }

    const dataEl = document.createElement("div");
    dataEl.className = `dashboard-fin-op-data${atrasado ? " dashboard-fin-op-atrasado" : ""}`;
    dataEl.textContent = dataBr(vencimento);

    const valorEl = document.createElement("div");
    valorEl.className = "dashboard-fin-op-valor";
    valorEl.textContent = moeda(valor);

    linha.append(blocoNome, dataEl, valorEl);
    return linha;
  }

  function renderVazio(container, mensagem) {
    container.replaceChildren();
    const em = document.createElement("em");
    em.textContent = mensagem;
    container.appendChild(em);
  }

  function calcularDebitos(mensalidades) {
    const hoje = dataHojeLocal();
    const mapa = new Map();

    mensalidades.forEach((item) => {
      if (statusEncerrado(item)) return;

      const vencimento = dataIso(item);
      const saldo = saldoPendente(item);
      if (!vencimento || vencimento >= hoje || saldo <= 0) return;

      const nome = nomePessoa(item);
      const id = alunoId(item);
      const chave = id || normalizar(nome);
      if (!chave) return;

      const atual = mapa.get(chave) || {
        id,
        nome,
        valor: 0,
        vencimento,
        titulos: 0
      };

      atual.valor += saldo;
      atual.titulos += 1;
      if (!atual.vencimento || vencimento < atual.vencimento) {
        atual.vencimento = vencimento;
      }
      if (nome && nome !== "Pessoa") atual.nome = nome;

      mapa.set(chave, atual);
    });

    return [...mapa.values()].sort((a, b) =>
      String(a.vencimento).localeCompare(String(b.vencimento)) ||
      b.valor - a.valor ||
      a.nome.localeCompare(b.nome, "pt-BR")
    );
  }

  function calcularRecebiveis(recebimentos) {
    const hoje = dataHojeLocal();

    return recebimentos
      .filter((item) => !statusEncerrado(item) && saldoPendente(item) > 0)
      .map((item) => ({
        id: idRegistro(item),
        nome: nomePessoa(item),
        detalhe: descricao(item),
        vencimento: dataIso(item),
        valor: saldoPendente(item),
        atrasado: Boolean(dataIso(item) && dataIso(item) < hoje)
      }))
      .sort((a, b) => {
        const dataA = a.vencimento || "9999-12-31";
        const dataB = b.vencimento || "9999-12-31";
        return (
          Number(b.atrasado) - Number(a.atrasado) ||
          dataA.localeCompare(dataB) ||
          b.valor - a.valor
        );
      });
  }

  function renderDebitos(debitos) {
    const container = $("dashboardFinListaDebitos");
    if (!container) return;

    setText("dashboardFinDebitoQtd", String(debitos.length));
    setText(
      "dashboardFinDebitoValor",
      moeda(debitos.reduce((s, item) => s + item.valor, 0))
    );

    if (!debitos.length) {
      renderVazio(container, "Nenhum aluno em débito.");
      return;
    }

    container.replaceChildren();
    debitos.forEach((item) => {
      const detalhe = item.titulos > 1
        ? `${item.titulos} cobranças vencidas`
        : "1 cobrança vencida";

      container.appendChild(criarLinha({
        nome: item.nome,
        detalhe,
        vencimento: item.vencimento,
        valor: item.valor,
        atrasado: true
      }));
    });
  }

  function renderReceber(recebiveis) {
    const container = $("dashboardFinListaReceber");
    if (!container) return;

    setText("dashboardFinReceberQtd", String(recebiveis.length));
    setText(
      "dashboardFinReceberValor",
      moeda(recebiveis.reduce((s, item) => s + item.valor, 0))
    );

    if (!recebiveis.length) {
      renderVazio(container, "Nenhuma conta a receber.");
      return;
    }

    container.replaceChildren();
    recebiveis.forEach((item) => {
      const href = item.id
        ? `/pages/recebimentos/index.html?recebimentoId=${encodeURIComponent(item.id)}`
        : "/pages/recebimentos/index.html";

      container.appendChild(criarLinha({
        nome: item.nome,
        detalhe: item.detalhe,
        vencimento: item.vencimento,
        valor: item.valor,
        atrasado: item.atrasado,
        href
      }));
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
      const [mensalidadesPayload, recebimentosPayload] = await Promise.all([
        obterJson("/api/mensalidades"),
        obterJson("/api/recebimentos")
      ]);

      const mensalidades = lista(mensalidadesPayload, [
        "mensalidades", "items", "dados", "data", "resultado"
      ]);

      const recebimentos = lista(recebimentosPayload, [
        "recebimentos", "lancamentos", "contasReceber", "items", "dados", "data", "resultado"
      ]);

      renderDebitos(calcularDebitos(mensalidades));
      renderReceber(calcularRecebiveis(recebimentos));

      setText("dashboardFinAtualizado", `Atualizado ${horarioAtualizacao()}`);
    } catch (erro) {
      console.error("Dashboard financeiro operacional:", erro);
      setText("dashboardFinAtualizado", "Falha ao atualizar");
    } finally {
      consultaEmAndamento = false;
    }
  }

  function iniciar() {
    if (!$("financeiroOperacionalDashboard")) return;

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

// REMOVER INFORMACOES DIA LEGADO DEFINITIVO 20260826
(() => {
  const removerInformacoesDiaLegado = () => {
    document.querySelectorAll("#informacoesDiaDashboard, .infos-dia-card")
      .forEach((el) => el.remove());
  };

  removerInformacoesDiaLegado();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", removerInformacoesDiaLegado, { once: true });
  }

  const observer = new MutationObserver(removerInformacoesDiaLegado);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
})();

