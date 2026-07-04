const API_FINANCEIRO = "/api/financeiro";
const API_ALUNOS = "/api/alunos";

let lancamentosOriginal = [];
let alunos = [];

async function carregarTudo() {
  const [financeiroRes, alunosRes] = await Promise.all([
    fetch(API_FINANCEIRO),
    fetch(API_ALUNOS)
  ]);

  lancamentosOriginal = await financeiroRes.json();
  alunos = await alunosRes.json();

  atualizarStatusVencidos();
  carregarCards();
  renderizarLancamentos(lancamentosOriginal);
}

async function atualizarStatusVencidos() {
  const hoje = new Date().toISOString().slice(0, 10);

  for (const item of lancamentosOriginal) {
    if (
      item.status === "pendente" &&
      item.data_vencimento &&
      item.data_vencimento < hoje
    ) {
      item.status = "vencido";

      await fetch(`${API_FINANCEIRO}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "vencido" })
      });
    }
  }
}

function carregarCards() {
  let receber = 0;
  let recebido = 0;
  let pagar = 0;
  let vencido = 0;

  lancamentosOriginal.forEach(item => {
    const valor = numero(item.valor);
    const valorPago = numero(item.valor_pago);

    if (item.tipo === "receber" && item.status !== "pago" && item.status !== "cancelado") receber += valor;
    if (item.tipo === "receber" && item.status === "pago") recebido += valorPago || valor;
    if (item.tipo === "pagar" && item.status !== "pago" && item.status !== "cancelado") pagar += valor;
    if (item.status === "vencido") vencido += valor;
  });

  document.getElementById("totalReceber").textContent = moeda(receber);
  document.getElementById("totalRecebido").textContent = moeda(recebido);
  document.getElementById("totalPagar").textContent = moeda(pagar);
  document.getElementById("totalVencido").textContent = moeda(vencido);
}

function renderizarLancamentos(lista) {
  const tabela = document.getElementById("tabelaFinanceiro");
  tabela.innerHTML = "";

  if (lista.length === 0) {
    tabela.innerHTML = `<tr><td colspan="8">Nenhum lançamento encontrado.</td></tr>`;
    return;
  }

  lista
    .sort((a, b) => (a.data_vencimento || "").localeCompare(b.data_vencimento || ""))
    .forEach(item => {
      const aluno = alunos.find(a => a.id === item.aluno_id);

      tabela.innerHTML += `
        <tr>
          <td>${item.tipo || ""}</td>
          <td>${item.descricao || ""}</td>
          <td>${aluno ? aluno.nome : "-"}</td>
          <td>${formatarData(item.data_vencimento)}</td>
          <td>${moeda(numero(item.valor))}</td>
          <td>${item.valor_pago ? moeda(numero(item.valor_pago)) : "-"}</td>
          <td>${item.status || ""}</td>
          <td>
            <a href="/pages/financeiro/cadastro.html?id=${item.id}">
              <button>Editar</button>
            </a>

            <a href="/pages/financeiro/ficha.html?id=${item.id}">
              <button>Ficha</button>
            </a>

            <button onclick="registrarPagamento('${item.id}')">Pagar</button>
            <button onclick="excluirLancamento('${item.id}')">Excluir</button>
          </td>
        </tr>
      `;
    });
}

function aplicarFiltros() {
  const descricao = valor("filtroDescricao").toLowerCase();
  const alunoFiltro = valor("filtroAluno").toLowerCase();
  const tipo = valor("filtroTipo");
  const status = valor("filtroStatus");
  const vencimento = valor("filtroVencimento");

  const filtrados = lancamentosOriginal.filter(item => {
    const aluno = alunos.find(a => a.id === item.aluno_id);

    return (
      (!descricao || (item.descricao || "").toLowerCase().includes(descricao)) &&
      (!alunoFiltro || (aluno?.nome || "").toLowerCase().includes(alunoFiltro)) &&
      (!tipo || item.tipo === tipo) &&
      (!status || item.status === status) &&
      (!vencimento || item.data_vencimento === vencimento)
    );
  });

  renderizarLancamentos(filtrados);
}

function limparFiltros() {
  document.getElementById("filtroDescricao").value = "";
  document.getElementById("filtroAluno").value = "";
  document.getElementById("filtroTipo").value = "";
  document.getElementById("filtroStatus").value = "";
  document.getElementById("filtroVencimento").value = "";

  renderizarLancamentos(lancamentosOriginal);
}

function registrarPagamento(id) {
  const item = lancamentosOriginal.find(l => l.id === id);

  if (!item) return;

  const hoje = new Date().toISOString().slice(0, 10);

  mostrarModal(
    "Registrar pagamento",
    "Deseja marcar este lançamento como pago?",
    async () => {
      const resposta = await fetch(`${API_FINANCEIRO}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "pago",
          data_pagamento: hoje,
          valor_pago: item.valor
        })
      });

      if (!resposta.ok) {
        mostrarAviso("Erro", "Erro ao registrar pagamento.");
        return;
      }

      mostrarAviso("Sucesso", "Pagamento registrado com sucesso.");
      carregarTudo();
    }
  );
}

function excluirLancamento(id) {
  mostrarModal(
    "Excluir lançamento",
    "Deseja realmente excluir este lançamento?",
    async () => {
      const resposta = await fetch(`${API_FINANCEIRO}/${id}`, {
        method: "DELETE"
      });

      if (!resposta.ok) {
        mostrarAviso("Erro", "Erro ao excluir lançamento.");
        return;
      }

      mostrarAviso("Sucesso", "Lançamento excluído com sucesso.");
      carregarTudo();
    }
  );
}

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}

function numero(valorCampo) {
  if (!valorCampo) return 0;
  return Number(String(valorCampo).replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function moeda(valorCampo) {
  return valorCampo.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarData(data) {
  if (!data) return "-";
  const partes = data.split("-");
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

window.aplicarFiltros = aplicarFiltros;
window.limparFiltros = limparFiltros;
window.registrarPagamento = registrarPagamento;
window.excluirLancamento = excluirLancamento;

carregarTudo();
