if (typeof carregarLayout === "function") carregarLayout("Financeiro");

const API = "/api/financeiro";
const API_TAXAS = "/api/financeiro/taxas-cartao";

const TAXAS_CARTAO_TESTE = [
  { bandeira: "Mastercard", modalidade: "debito", parcelas: 1, percentual: 1.09, taxaFixa: 0, descricao: "Débito Mastercard" },
  { bandeira: "Mastercard", modalidade: "credito", parcelas: 1, percentual: 2.99, taxaFixa: 0, descricao: "Crédito Mastercard 1x" },
  { bandeira: "Mastercard", modalidade: "credito", parcelas: 2, percentual: 4.05, taxaFixa: 0, descricao: "Crédito Mastercard 2x" },
  { bandeira: "Visa", modalidade: "debito", parcelas: 1, percentual: 1.15, taxaFixa: 0, descricao: "Débito Visa" },
  { bandeira: "Visa", modalidade: "credito", parcelas: 1, percentual: 3.05, taxaFixa: 0, descricao: "Crédito Visa 1x" },
  { bandeira: "Visa", modalidade: "credito", parcelas: 2, percentual: 4.15, taxaFixa: 0, descricao: "Crédito Visa 2x" },
  { bandeira: "Elo", modalidade: "debito", parcelas: 1, percentual: 1.35, taxaFixa: 0, descricao: "Débito Elo" },
  { bandeira: "Elo", modalidade: "credito", parcelas: 1, percentual: 3.35, taxaFixa: 0, descricao: "Crédito Elo 1x" },
  { bandeira: "Elo", modalidade: "credito", parcelas: 2, percentual: 4.45, taxaFixa: 0, descricao: "Crédito Elo 2x" },
  { bandeira: "Hipercard", modalidade: "credito", parcelas: 1, percentual: 3.49, taxaFixa: 0, descricao: "Crédito Hipercard 1x" },
  { bandeira: "Hipercard", modalidade: "credito", parcelas: 2, percentual: 4.75, taxaFixa: 0, descricao: "Crédito Hipercard 2x" },
  { bandeira: "American Express", modalidade: "credito", parcelas: 1, percentual: 3.85, taxaFixa: 0, descricao: "Crédito Amex 1x" },
  { bandeira: "American Express", modalidade: "credito", parcelas: 2, percentual: 5.10, taxaFixa: 0, descricao: "Crédito Amex 2x" },
  { bandeira: "PIX", modalidade: "pix", parcelas: 1, percentual: 0.99, taxaFixa: 0, descricao: "PIX recebido" },
  { bandeira: "Boleto", modalidade: "boleto", parcelas: 1, percentual: 0, taxaFixa: 3.49, descricao: "Boleto emitido" }
];

const els = {
  tabela: document.getElementById("tabelaFinanceiro"),
  modal: document.getElementById("modalFinanceiro"),
  form: document.getElementById("formFinanceiro"),
  modalTitulo: document.getElementById("modalTitulo"),
  busca: document.getElementById("busca"),
  filtroTipo: document.getElementById("filtroTipo"),
  filtroStatus: document.getElementById("filtroStatus"),
  kpiReceitasPagas: document.getElementById("kpiReceitasPagas"),
  kpiReceitasAbertas: document.getElementById("kpiReceitasAbertas"),
  kpiDespesasAbertas: document.getElementById("kpiDespesasAbertas"),
  kpiSaldoPrevisto: document.getElementById("kpiSaldoPrevisto"),
  modalBaixa: document.getElementById("modalBaixaFinanceiro"),
  formBaixa: document.getElementById("formBaixaFinanceiro"),
  resumoBaixa: document.getElementById("resumoBaixa"),
  painelCartao: document.getElementById("painelCartao"),
  modalTaxas: document.getElementById("modalTaxasCartao"),
  tabelaTaxas: document.getElementById("tabelaTaxasCartao")
};

let lancamentos = [];
let taxasCartao = [];
let baixaAtual = null;
let baixaAutomaticaUrlProcessada = false;

function limparParametrosBaixaDaUrl() {
  const params = new URLSearchParams(location.search);
  const chaves = ["financeiroId", "financeiroid", "lancamentoId", "mensalidadeId", "mensalidadeid", "id", "receberAgora", "origem"];
  let alterou = false;
  chaves.forEach((chave) => {
    if (params.has(chave)) {
      params.delete(chave);
      alterou = true;
    }
  });
  if (!alterou) return;
  const novaUrl = `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}${location.hash || ""}`;
  history.replaceState({}, document.title, novaUrl);
}

function lancamentoPago(item) {
  const st = String(item?.status || "").toLowerCase();
  return ["pago", "recebido", "quitado", "baixado"].includes(st) || saldoLancamento(item) <= 0;
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function numero(valor) { const n = Number(String(valor ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; }
function valor(id) { return document.getElementById(id).value; }
function setValor(id, value) { const el = document.getElementById(id); if (el) el.value = value ?? ""; }
function statusClasse(status) { return String(status || "").toLowerCase(); }
function escapeHtml(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
async function obterMensagemErroResposta(resp, fallback = "Erro na operação.") {
  let texto = "";
  try { texto = await resp.text(); } catch { texto = ""; }

  if (texto) {
    try {
      const json = JSON.parse(texto);
      return json.mensagem || json.erro || json.message || fallback;
    } catch {
      const limpo = texto.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (limpo) return limpo.slice(0, 220);
    }
  }

  if (resp.status === 400) return "Operação não permitida. Verifique os dados e tente novamente.";
  if (resp.status === 404) return "Registro não encontrado. Atualize a tela e tente novamente.";
  if (resp.status >= 500) return "Erro interno no servidor. Verifique o terminal do npm start.";
  return fallback;
}

async function verificarCaixaAbertoAntesDaBaixa() {
  try {
    const resp = await fetch("/api/caixa/atual", { cache: "no-store" });
    if (!resp.ok) return { ok: true };
    const json = await resp.json().catch(() => ({}));
    if (json.aberto === false) {
      return {
        ok: false,
        mensagem: "Não existe caixa aberto. Abra o caixa antes de confirmar um recebimento."
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}


function formaEhCartao(forma) {
  return String(forma || "").toLowerCase().includes("cart");
}

function formaEhPix(forma) {
  return String(forma || "").toLowerCase().includes("pix");
}

function formaEhBoleto(forma) {
  return String(forma || "").toLowerCase().includes("boleto");
}

function formaTemTaxaOperadora(forma) {
  return formaEhCartao(forma) || formaEhPix(forma) || formaEhBoleto(forma);
}

function formaEhDinheiro(forma) {
  const f = normalizarTextoLocal(forma);
  return f.includes("dinheiro") || f.includes("especie");
}

function normalizarTextoLocal(valor) {
  return String(valor || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function saldoAtualBaixa() {
  return numero(valor("baixaValorDevido"));
}

function destinoDiferencaSelecionado() {
  const marcado = document.querySelector('input[name="destinoDiferenca"]:checked');
  return marcado?.value || "";
}

function normalizarModalidadePorForma(forma) {
  const f = String(forma || "").toLowerCase();
  if (f.includes("pix")) return "pix";
  if (f.includes("boleto")) return "boleto";
  if (f.includes("débito") || f.includes("debito")) return "debito";
  if (f.includes("crédito") || f.includes("credito")) return "credito";
  return "credito";
}

function bandeirasDisponiveis() {
  const modalidadeAtual = valor("baixaModalidadeCartao");
  const lista = taxasCartao.filter((t) => !modalidadeAtual || t.modalidade === modalidadeAtual);
  return [...new Set(lista.map((t) => t.bandeira).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function taxasFiltradas() {
  const bandeira = valor("baixaBandeiraCartao");
  const modalidade = valor("baixaModalidadeCartao");
  return taxasCartao.filter((t) => t.bandeira === bandeira && t.modalidade === modalidade)
    .sort((a, b) => Number(a.parcelas) - Number(b.parcelas));
}

async function carregarTaxasCartao() {
  try {
    const resp = await fetch(API_TAXAS, { cache: "no-store" });
    const json = resp.ok ? await resp.json().catch(() => ({})) : {};
    if (!resp.ok) throw new Error(await obterMensagemErroResposta(resp, `Erro HTTP ${resp.status}`));
    if (json.ok === false) throw new Error(json.mensagem || json.erro || "Não foi possível confirmar o recebimento.");
    taxasCartao = Array.isArray(json.taxas) && json.taxas.length ? json.taxas : TAXAS_CARTAO_TESTE;
  } catch {
    taxasCartao = TAXAS_CARTAO_TESTE;
  }
}

function preencherBandeirasCartao() {
  const select = document.getElementById("baixaBandeiraCartao");
  if (!select) return;
  const atual = select.value;
  const bandeiras = bandeirasDisponiveis();
  select.innerHTML = bandeiras.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
  select.value = atual && bandeiras.includes(atual) ? atual : (bandeiras[0] || "");
}

function preencherParcelasCartao() {
  const select = document.getElementById("baixaParcelasCartao");
  if (!select) return;
  const atual = Number(select.value || 1);
  const lista = taxasFiltradas();
  select.innerHTML = lista.map((t) => `<option value="${Number(t.parcelas)}">${Number(t.parcelas)}x - ${Number(t.percentual || 0).toFixed(2)}%${Number(t.taxaFixa || 0) > 0 ? ` + R$ ${Number(t.taxaFixa || 0).toFixed(2)}` : ""}</option>`).join("");
  const existe = lista.some((t) => Number(t.parcelas) === atual);
  select.value = existe ? String(atual) : String(lista[0]?.parcelas || 1);
  aplicarTaxaSelecionada();
}

function taxaSelecionadaCartao() {
  const bandeira = valor("baixaBandeiraCartao");
  const modalidade = valor("baixaModalidadeCartao");
  const parcelas = Number(valor("baixaParcelasCartao") || 1);
  return taxasCartao.find((t) => t.bandeira === bandeira && t.modalidade === modalidade && Number(t.parcelas) === parcelas) || null;
}

function aplicarTaxaSelecionada() {
  const taxa = taxaSelecionadaCartao();
  if (taxa) {
    setValor("baixaTaxaPercentual", Number(taxa.percentual || 0).toFixed(2));
    setValor("baixaTaxaFixa", Number(taxa.taxaFixa || 0).toFixed(2));
  }
  calcularPreviewCartao();
}

function calcularDadosCartao() {
  const bruto = numero(valor("baixaValorPago"));
  const percentual = numero(valor("baixaTaxaPercentual"));
  const taxaFixa = numero(valor("baixaTaxaFixa"));
  const taxaPercentualValor = Number((bruto * percentual / 100).toFixed(2));
  const taxaValor = Number((taxaPercentualValor + taxaFixa).toFixed(2));
  const liquido = Number(Math.max(0, bruto - taxaValor).toFixed(2));
  return { bruto, percentual, taxaFixa, taxaPercentualValor, taxaValor, liquido };
}

function calcularPreviewCartao() {
  const dados = calcularDadosCartao();
  const elBruto = document.getElementById("calcValorBruto");
  const elTaxa = document.getElementById("calcTaxaValor");
  const elLiquido = document.getElementById("calcValorLiquido");
  if (elBruto) elBruto.textContent = moeda(dados.bruto);
  if (elTaxa) elTaxa.textContent = moeda(dados.taxaValor);
  if (elLiquido) elLiquido.textContent = moeda(dados.liquido);
  atualizarPainelDiferencaRecebimento();
}

function atualizarPainelDiferencaRecebimento() {
  const painel = document.getElementById("painelDiferencaRecebimento");
  if (!painel) return;

  const pago = numero(valor("baixaValorPago"));
  const devido = saldoAtualBaixa();
  const diferenca = Math.max(0, Number((pago - devido).toFixed(2)));
  const forma = valor("baixaFormaPagamento");
  const dinheiro = formaEhDinheiro(forma);

  painel.classList.toggle("hidden", !(diferenca > 0));
  const texto = document.getElementById("textoDiferencaRecebimento");
  if (texto) texto.textContent = `Valor recebido acima do saldo: ${moeda(diferenca)}.`;

  const opcaoTroco = document.getElementById("opcaoTrocoRecebimento");
  const radioTroco = document.getElementById("baixaDestinoTroco");
  const radioCredito = document.getElementById("baixaDestinoCredito");

  if (opcaoTroco) opcaoTroco.style.display = dinheiro ? "" : "none";

  if (diferenca > 0) {
    if (!dinheiro && radioCredito) radioCredito.checked = true;
    if (dinheiro && radioTroco && radioCredito && !radioTroco.checked && !radioCredito.checked) radioTroco.checked = true;
  }
}

function atualizarPainelCartao() {
  const forma = valor("baixaFormaPagamento");
  const ativo = formaTemTaxaOperadora(forma);
  if (els.painelCartao) els.painelCartao.hidden = !ativo;
  atualizarPainelDiferencaRecebimento();
  if (!ativo) return;
  setValor("baixaModalidadeCartao", normalizarModalidadePorForma(forma));
  preencherBandeirasCartao();
  preencherParcelasCartao();
  calcularPreviewCartao();
}

function abrirModalTaxas() {
  renderizarTabelaTaxas();
  els.modalTaxas.classList.add("ativo");
}

function fecharModalTaxas() {
  els.modalTaxas.classList.remove("ativo");
}

function renderizarTabelaTaxas() {
  if (!els.tabelaTaxas) return;
  const lista = taxasCartao.length ? taxasCartao : TAXAS_CARTAO_TESTE;
  els.tabelaTaxas.innerHTML = lista.map((taxa, i) => `<tr>
    <td><input data-taxa-campo="bandeira" data-taxa-index="${i}" value="${escapeHtml(taxa.bandeira)}"></td>
    <td><select data-taxa-campo="modalidade" data-taxa-index="${i}">
      <option value="debito" ${taxa.modalidade === "debito" ? "selected" : ""}>Débito</option>
      <option value="credito" ${taxa.modalidade === "credito" ? "selected" : ""}>Crédito</option>
      <option value="pix" ${taxa.modalidade === "pix" ? "selected" : ""}>PIX</option>
      <option value="boleto" ${taxa.modalidade === "boleto" ? "selected" : ""}>Boleto</option>
    </select></td>
    <td><input data-taxa-campo="parcelas" data-taxa-index="${i}" type="number" min="1" step="1" value="${Number(taxa.parcelas || 1)}"></td>
    <td><input data-taxa-campo="percentual" data-taxa-index="${i}" type="number" min="0" step="0.01" value="${Number(taxa.percentual || 0).toFixed(2)}"></td>
    <td><input data-taxa-campo="taxaFixa" data-taxa-index="${i}" type="number" min="0" step="0.01" value="${Number(taxa.taxaFixa || 0).toFixed(2)}"></td>
    <td><input data-taxa-campo="descricao" data-taxa-index="${i}" value="${escapeHtml(taxa.descricao || "")}"></td>
    <td><button type="button" class="btn-danger" onclick="removerTaxaCartao(${i})">Remover</button></td>
  </tr>`).join("");
}

function coletarTaxasDaTabela() {
  const mapa = new Map();
  document.querySelectorAll("[data-taxa-index]").forEach((el) => {
    const i = Number(el.dataset.taxaIndex);
    const campo = el.dataset.taxaCampo;
    const atual = mapa.get(i) || {};
    atual[campo] = el.value;
    mapa.set(i, atual);
  });
  return [...mapa.values()].map((t) => ({
    bandeira: String(t.bandeira || "").trim(),
    modalidade: String(t.modalidade || "credito").trim().toLowerCase(),
    parcelas: Math.max(1, Number(t.parcelas || 1)),
    percentual: numero(t.percentual),
    taxaFixa: numero(t.taxaFixa),
    descricao: String(t.descricao || "").trim()
  })).filter((t) => t.bandeira && t.percentual >= 0);
}

window.removerTaxaCartao = function removerTaxaCartao(index) {
  taxasCartao.splice(index, 1);
  renderizarTabelaTaxas();
};

async function salvarTaxasCartaoTela() {
  const lista = coletarTaxasDaTabela();
  if (!lista.length) return alert("Informe ao menos uma taxa válida.");
  try {
    const resp = await fetch(API_TAXAS, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taxas: lista }) });
    const json = resp.ok ? await resp.json().catch(() => ({})) : {};
    if (!resp.ok) throw new Error(await obterMensagemErroResposta(resp, `Erro HTTP ${resp.status}`));
    if (json.ok === false) throw new Error(json.mensagem || json.erro || "Não foi possível confirmar o recebimento.");
    taxasCartao = json.taxas || lista;
    fecharModalTaxas();
    atualizarPainelCartao();
    alert("Taxas de recebimento salvas.");
  } catch (erro) {
    alert(erro.message || "Erro ao salvar taxas de recebimento.");
  }
}

function abrirModal(lancamento = null) {
  els.form.reset();
  if (lancamento) {
    els.modalTitulo.textContent = "Editar Lançamento";
    setValor("lancamentoId", lancamento.id);
    setValor("tipo", lancamento.tipo);
    setValor("status", lancamento.status);
    setValor("descricao", lancamento.descricao);
    setValor("categoria", lancamento.categoria);
    setValor("centroCusto", lancamento.centroCusto);
    setValor("alunoFornecedor", lancamento.alunoFornecedor || lancamento.pessoa || lancamento.pessoaFornecedor);
    setValor("valor", lancamento.valor);
    setValor("vencimento", lancamento.vencimento);
    setValor("pagamento", lancamento.pagamento || lancamento.dataPagamento);
    setValor("formaPagamento", lancamento.formaPagamento);
    setValor("observacoes", lancamento.observacoes || lancamento.observacao);
  } else {
    els.modalTitulo.textContent = "Novo Lançamento";
    setValor("lancamentoId", "");
    setValor("tipo", "receber");
    setValor("status", "Aberto");
  }
  els.modal.classList.add("ativo");
}

function fecharModal() { els.modal.classList.remove("ativo"); }

function valorBrutoRecebidoLancamento(item) { return numero(item.valorBrutoRecebido ?? item.valorPago ?? item.valorRecebido ?? item.valor ?? item.valorBruto ?? 0); }
function taxaOperadoraLancamento(item) { return numero(item.taxaOperadoraValor ?? item.taxaValor ?? 0); }
function valorLiquidoRecebidoLancamento(item) {
  const liquido = numero(item.valorLiquido ?? item.valorRecebidoLiquido ?? 0);
  if (liquido > 0) return liquido;
  const bruto = valorBrutoRecebidoLancamento(item);
  const taxa = taxaOperadoraLancamento(item);
  return Math.max(0, Number((bruto - taxa).toFixed(2)));
}
function valorPagoLancamento(item) { return numero(item.valorPago ?? item.valorRecebido ?? item.valorLiquido ?? 0); }
function valorTotalLancamento(item) { return numero(item.valor ?? item.valorBruto ?? item.total ?? 0); }
function saldoLancamento(item) {
  if (item.valorRestante !== undefined && item.valorRestante !== null) return Math.max(0, numero(item.valorRestante));
  const status = String(item.status || "").toLowerCase();
  if (["pago", "recebido"].includes(status)) return 0;
  return Math.max(0, valorTotalLancamento(item) - valorPagoLancamento(item));
}

function renderizarTabela() {
  if (!lancamentos.length) {
    els.tabela.innerHTML = `<tr><td colspan="10">Nenhum lançamento encontrado.</td></tr>`;
    return;
  }
  els.tabela.innerHTML = lancamentos.map((item) => {
    const st = statusClasse(item.status);
    const jaPago = lancamentoPago(item);
    return `<tr>
      <td><span class="tipo ${escapeHtml(item.tipo)}">${item.tipo === "receber" ? "Receber" : "Pagar"}</span></td>
      <td>${escapeHtml(item.descricao)}</td>
      <td>${escapeHtml(item.categoria || "-")}</td>
      <td>${escapeHtml(item.alunoFornecedor || item.pessoa || item.pessoaFornecedor || "-")}</td>
      <td>${escapeHtml(item.vencimento || "-")}</td>
      <td>${moeda(valorTotalLancamento(item))}</td>
      <td>${lancamentoPago(item) ? moeda(valorBrutoRecebidoLancamento(item)) : "-"}</td>
      <td>${lancamentoPago(item) ? moeda(taxaOperadoraLancamento(item)) : "-"}</td>
      <td><strong>${lancamentoPago(item) ? moeda(valorLiquidoRecebidoLancamento(item)) : "-"}</strong></td>
      <td><span class="badge ${escapeHtml(st)}">${escapeHtml(item.status || "Aberto")}</span></td>
      <td><div class="acoes">
        <button class="btn-secondary" onclick="editarLancamento('${escapeHtml(item.id)}')">Editar</button>
        <button class="btn-light" ${jaPago ? "disabled" : ""} onclick="baixarLancamento('${escapeHtml(item.id)}')">Baixar</button>
        <button class="btn-danger" onclick="excluirLancamento('${escapeHtml(item.id)}')">Excluir</button>
      </div></td>
    </tr>`;
  }).join("");
}

async function carregarResumo() {
  const resp = await fetch(`${API}/resumo`, { cache: "no-store" });
  const json = await resp.json();
  if (!json.ok) return;
  els.kpiReceitasPagas.textContent = moeda(json.resumo.receitasLiquidasPagas ?? json.resumo.receitasPagas);
  els.kpiReceitasAbertas.textContent = moeda(json.resumo.receitasAbertas);
  els.kpiDespesasAbertas.textContent = moeda(json.resumo.taxasFinanceiras ?? json.resumo.despesasAbertas);
  els.kpiSaldoPrevisto.textContent = moeda(json.resumo.saldoLiquidoPrevisto ?? json.resumo.saldoPrevisto);
}

async function carregarLancamentos() {
  const params = new URLSearchParams();
  if (els.busca.value) params.set("busca", els.busca.value);
  if (els.filtroTipo.value) params.set("tipo", els.filtroTipo.value);
  if (els.filtroStatus.value) params.set("status", els.filtroStatus.value);
  const resp = await fetch(`${API}?${params.toString()}`, { cache: "no-store" });
  const json = await resp.json();
  lancamentos = json.lancamentos || [];
  renderizarTabela();
  await carregarResumo();
  abrirBaixaPorUrlSeExistir();
}

async function salvarLancamento(event) {
  event.preventDefault();
  const id = valor("lancamentoId");
  const payload = {
    tipo: valor("tipo"), status: valor("status"), descricao: valor("descricao"), categoria: valor("categoria"),
    centroCusto: valor("centroCusto"), alunoFornecedor: valor("alunoFornecedor"), valor: valor("valor"),
    vencimento: valor("vencimento"), pagamento: valor("pagamento"), formaPagamento: valor("formaPagamento"),
    observacoes: valor("observacoes")
  };
  await fetch(id ? `${API}/${encodeURIComponent(id)}` : API, {
    method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  fecharModal();
  await (async function iniciarFinanceiro() {
  await carregarTaxasCartao();
  await carregarLancamentos();
})();
}

window.editarLancamento = function editarLancamento(id) {
  const lancamento = lancamentos.find((item) => String(item.id) === String(id));
  if (lancamento) abrirModal(lancamento);
};

function abrirModalBaixa(lancamento) {
  baixaAtual = lancamento;
  const total = valorTotalLancamento(lancamento);
  const saldo = saldoLancamento(lancamento) || total;
  setValor("baixaLancamentoId", lancamento.id);
  setValor("baixaMensalidadeId", lancamento.mensalidadeId || "");
  setValor("baixaValorDevido", saldo.toFixed(2));
  setValor("baixaValorPago", saldo.toFixed(2));
  setValor("baixaDataPagamento", hojeISO());
  setValor("baixaFormaPagamento", lancamento.formaPagamento || "Dinheiro");
  setValor("baixaDesconto", "0");
  setValor("baixaJuros", "0");
  setValor("baixaObservacao", "");
  els.resumoBaixa.innerHTML = `<div><strong>${escapeHtml(lancamento.descricao || "Recebimento")}</strong></div>
    <div>Aluno/cliente: ${escapeHtml(lancamento.alunoFornecedor || lancamento.pessoa || "-")}</div>
    <div>Vencimento: ${escapeHtml(lancamento.vencimento || "-")}</div>
    <div>Valor original: <strong>${moeda(total)}</strong></div>
    <div>Saldo para baixa: <strong>${moeda(saldo)}</strong></div>`;
  atualizarPainelCartao();
  calcularPreviewCartao();
  els.modalBaixa.classList.add("ativo");
  setTimeout(() => document.getElementById("baixaValorPago")?.focus(), 80);
}

function fecharModalBaixa() {
  els.modalBaixa.classList.remove("ativo");
  baixaAtual = null;
}

window.baixarLancamento = function baixarLancamento(id) {
  const lancamento = lancamentos.find((item) => String(item.id) === String(id));
  if (!lancamento) return alert("Lançamento não encontrado na listagem atual.");
  abrirModalBaixa(lancamento);
};

async function confirmarBaixa(event) {
  event.preventDefault();
  const id = valor("baixaLancamentoId");
  const valorPago = numero(valor("baixaValorPago"));
  if (!id) return alert("Lançamento não informado.");
  if (valorPago <= 0) return alert("Informe um valor pago maior que zero.");
  const btn = document.getElementById("btnConfirmarBaixa");
  btn.disabled = true;
  btn.textContent = "Confirmando...";
  try {
    // O motor financeiro abre o caixa oficial automaticamente quando necessário.
    const dadosCartao = calcularDadosCartao();
    const formaPagamento = valor("baixaFormaPagamento");
    const payload = {
      valorPago,
      valorRecebido: valorPago,
      valorBaixa: valorPago,
      valor: valorPago,
      pagamento: valor("baixaDataPagamento"),
      dataPagamento: valor("baixaDataPagamento"),
      formaPagamento,
      desconto: numero(valor("baixaDesconto")),
      juros: numero(valor("baixaJuros")),
      acrescimo: numero(valor("baixaJuros")),
      observacao: valor("baixaObservacao"),
      bandeiraCartao: formaTemTaxaOperadora(formaPagamento) ? valor("baixaBandeiraCartao") : "",
      modalidadeCartao: formaTemTaxaOperadora(formaPagamento) ? valor("baixaModalidadeCartao") : "",
      parcelasCartao: formaTemTaxaOperadora(formaPagamento) ? Number(valor("baixaParcelasCartao") || 1) : "",
      taxaOperadoraPercentual: formaTemTaxaOperadora(formaPagamento) ? dadosCartao.percentual : 0,
      taxaOperadoraFixa: formaTemTaxaOperadora(formaPagamento) ? dadosCartao.taxaFixa : 0,
      taxaOperadoraValor: formaTemTaxaOperadora(formaPagamento) ? dadosCartao.taxaValor : 0,
      valorBrutoRecebido: valorPago,
      valorLiquido: formaTemTaxaOperadora(formaPagamento) ? dadosCartao.liquido : valorPago,
      destinoDiferenca: valorPago > numero(valor("baixaValorDevido")) ? (destinoDiferencaSelecionado() || (formaEhDinheiro(formaPagamento) ? 'troco' : 'credito')) : '',
      tratamentoDiferenca: valorPago > numero(valor("baixaValorDevido")) ? (destinoDiferencaSelecionado() || (formaEhDinheiro(formaPagamento) ? 'troco' : 'credito')) : ''
    };
    const resp = await fetch(`${API}/${encodeURIComponent(id)}/baixar`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const json = resp.ok ? await resp.json().catch(() => ({})) : {};
    if (!resp.ok) throw new Error(await obterMensagemErroResposta(resp, `Erro HTTP ${resp.status}`));
    if (json.ok === false) throw new Error(json.mensagem || json.erro || "Não foi possível confirmar o recebimento.");

    const motor = json?.cobrancaAutomatica || {};
    let mensagemMotor = "";
    if (motor.gerada) mensagemMotor = `\n\nPróxima mensalidade gerada automaticamente: ${motor.proximoVencimento || ""}`;
    else if (motor.aviso && motor.motivo) mensagemMotor = `\n\nAtenção na recorrência: ${motor.motivo}`;

    fecharModalBaixa();
    limparParametrosBaixaDaUrl();
    alert(`Pagamento confirmado e registrado.${mensagemMotor}`);
    await (async function iniciarFinanceiro() {
  await carregarTaxasCartao();
  await carregarLancamentos();
})();
  } catch (erro) {
    alert(erro.message || "Erro ao confirmar pagamento.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar pagamento";
  }
}

window.excluirLancamento = async function excluirLancamento(id) {
  if (!confirm("Deseja excluir este lançamento?")) return;
  await fetch(`${API}/${encodeURIComponent(id)}`, { method: "DELETE" });
  await (async function iniciarFinanceiro() {
  await carregarTaxasCartao();
  await carregarLancamentos();
})();
};

function abrirBaixaPorUrlSeExistir() {
  if (baixaAutomaticaUrlProcessada) return;
  const params = new URLSearchParams(location.search);
  const financeiroId = params.get("financeiroId") || params.get("financeiroid") || params.get("lancamentoId") || params.get("id");
  const mensalidadeId = params.get("mensalidadeId") || params.get("mensalidadeid");
  if (!financeiroId && !mensalidadeId) return;

  baixaAutomaticaUrlProcessada = true;

  let lancamento = null;
  if (financeiroId) lancamento = lancamentos.find((item) => String(item.id) === String(financeiroId));
  if (!lancamento && mensalidadeId) lancamento = lancamentos.find((item) => String(item.mensalidadeId) === String(mensalidadeId));

  // Remove os parâmetros logo depois de processar a chamada automática.
  // Assim, se o operador atualizar a página, o modal não abre novamente.
  limparParametrosBaixaDaUrl();

  if (!lancamento) {
    alert("Lançamento financeiro da matrícula não foi encontrado. Atualize a página ou confira se o financeiroId existe.");
    return;
  }

  if (lancamentoPago(lancamento)) {
    alert("Este lançamento já está pago. A baixa automática não será aberta novamente.");
    return;
  }

  abrirModalBaixa(lancamento);
}

document.getElementById("btnNovoLancamento")?.addEventListener("click", () => abrirModal());
document.getElementById("btnTaxasCartao")?.addEventListener("click", abrirModalTaxas);
document.getElementById("btnAbrirTaxasNoRecebimento")?.addEventListener("click", abrirModalTaxas);
document.getElementById("btnFecharTaxas")?.addEventListener("click", fecharModalTaxas);
document.getElementById("btnCancelarTaxas")?.addEventListener("click", fecharModalTaxas);
document.getElementById("btnAdicionarTaxa")?.addEventListener("click", () => { taxasCartao.push({ bandeira: "Nova taxa", modalidade: "credito", parcelas: 1, percentual: 0, taxaFixa: 0, descricao: "" }); renderizarTabelaTaxas(); });
document.getElementById("btnRestaurarTaxas")?.addEventListener("click", () => { taxasCartao = TAXAS_CARTAO_TESTE.map((t) => ({ ...t })); renderizarTabelaTaxas(); });
document.getElementById("btnSalvarTaxas")?.addEventListener("click", salvarTaxasCartaoTela);
document.getElementById("baixaFormaPagamento")?.addEventListener("change", atualizarPainelCartao);
document.getElementById("baixaBandeiraCartao")?.addEventListener("change", preencherParcelasCartao);
document.getElementById("baixaModalidadeCartao")?.addEventListener("change", preencherParcelasCartao);
document.getElementById("baixaParcelasCartao")?.addEventListener("change", aplicarTaxaSelecionada);
document.getElementById("baixaTaxaPercentual")?.addEventListener("input", calcularPreviewCartao);
document.getElementById("baixaTaxaFixa")?.addEventListener("input", calcularPreviewCartao);
document.getElementById("baixaValorPago")?.addEventListener("input", calcularPreviewCartao);
document.getElementById("baixaDestinoTroco")?.addEventListener("change", atualizarPainelDiferencaRecebimento);
document.getElementById("baixaDestinoCredito")?.addEventListener("change", atualizarPainelDiferencaRecebimento);
document.getElementById("btnFecharModal")?.addEventListener("click", fecharModal);
document.getElementById("btnCancelar")?.addEventListener("click", fecharModal);
document.getElementById("btnFiltrar")?.addEventListener("click", carregarLancamentos);
document.getElementById("btnLimpar").addEventListener("click", () => { els.busca.value = ""; els.filtroTipo.value = ""; els.filtroStatus.value = ""; (async function iniciarFinanceiro() {
  await carregarTaxasCartao();
  await carregarLancamentos();
})(); });
document.getElementById("btnFecharBaixa")?.addEventListener("click", fecharModalBaixa);
document.getElementById("btnCancelarBaixa")?.addEventListener("click", fecharModalBaixa);
els.form.addEventListener("submit", salvarLancamento);
els.formBaixa.addEventListener("submit", confirmarBaixa);

(async function iniciarFinanceiro() {
  await carregarTaxasCartao();
  await carregarLancamentos();
})();
