import {
  obterCaixaAtual,
  listarMovimentos,
  abrirCaixa,
  fecharCaixa,
  criarMovimento,
  cancelarMovimento,
  excluirMovimento
} from './api.js';

const $ = seletor => document.querySelector(seletor);

const estado = {
  caixa: null,
  totais: null,
  movimentos: []
};

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function numero(valor, padrao = 0) {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : padrao;
}

function valorBrutoMovimento(movimento = {}) {
  return numero(movimento.valorBruto ?? movimento.valor, 0);
}

function taxaMovimento(movimento = {}) {
  if (Number.isInteger(movimento.taxaCentavos)) return numero(movimento.taxaCentavos / 100, 0);
  if (Number.isInteger(movimento.taxaOperadoraValorCentavos)) return numero(movimento.taxaOperadoraValorCentavos / 100, 0);
  const taxa = numero(movimento.taxaOperadoraValor ?? movimento.taxaValor ?? movimento.taxa, 0);
  if (taxa > 0) return taxa;

  const bruto = valorBrutoMovimento(movimento);
  const liquido = numero(movimento.valorLiquido ?? movimento.valorRecebidoLiquido, bruto);
  return Math.max(0, Number((bruto - liquido).toFixed(2)));
}

function valorLiquidoMovimento(movimento = {}) {
  const bruto = valorBrutoMovimento(movimento);
  const taxa = taxaMovimento(movimento);
  const calculado = Math.max(0, Number((bruto - taxa).toFixed(2)));
  const liquido = numero(movimento.valorLiquido ?? movimento.valorRecebidoLiquido, NaN);

  if (taxa > 0) return calculado;
  if (Number.isFinite(liquido) && liquido > 0) return liquido;
  return calculado;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function limparElemento(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function criarCelula(texto) {
  const td = document.createElement('td');
  td.textContent = String(texto ?? '');
  return td;
}

function criarTag(tipo) {
  const span = document.createElement('span');
  span.className = `tag ${tipo}`;
  span.textContent = tipo === 'saida' ? 'Saída' : 'Entrada';
  return span;
}

function criarBotao(texto, classe, dataNome, dataValor) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = texto;
  if (classe) btn.className = classe;
  btn.dataset[dataNome] = dataValor;
  return btn;
}

function filtros() {
  return {
    q: $('#fBusca').value,
    tipo: $('#fTipo').value,
    formaPagamento: $('#fForma').value,
    caixaId: estado.caixa?.id || ''
  };
}

function renderCaixa() {
  const aberto = Boolean(estado.caixa && estado.caixa.status === 'aberto');
  const totais = estado.totais || {};
  const entradasBrutas = numero(totais.entradasBrutas ?? totais.entradas);
  const taxas = numero(totais.taxas);
  const entradasLiquidas = numero(totais.entradasLiquidas ?? (entradasBrutas - taxas));
  const saidasBrutas = numero(totais.saidasBrutas ?? totais.saidas);
  const saidasLiquidas = numero(totais.saidasLiquidas ?? saidasBrutas);

  // O frontend valida as duas identidades de caixa em vez de confiar em um
  // saldo histórico eventualmente persistido com semântica antiga.
  const saldoBruto = Number((entradasBrutas - saidasBrutas).toFixed(2));
  const saldoLiquido = Number((entradasLiquidas - saidasLiquidas).toFixed(2));
  const btnAbrir = $('#btnAbrir');
  const btnFechar = $('#btnFechar');
  const btnNovoMovimento = $('#btnNovoMovimento');

  $('#cStatus').textContent = aberto ? 'Aberto' : 'Fechado';
  $('#cEntradas').textContent = moeda(entradasBrutas);
  $('#cTaxas').textContent = moeda(taxas);
  $('#cEntradasLiquidas').textContent = moeda(entradasLiquidas);
  $('#cSaidas').textContent = moeda(saidasBrutas);
  $('#cSaldoBruto').textContent = moeda(saldoBruto);
  $('#cSaldo').textContent = moeda(saldoLiquido);
  $('#cMovimentos').textContent = String(totais.quantidadeMovimentos || 0);
  $('#cDinheiro').textContent = moeda(totais.dinheiroLiquido ?? totais.dinheiro ?? 0);
  $('#cPix').textContent = moeda(totais.pixLiquido ?? totais.pix ?? 0);
  $('#cCartao').textContent = moeda(totais.cartaoLiquido ?? totais.cartao ?? 0);
  $('#cOutros').textContent = moeda(totais.outrosLiquido ?? totais.outros ?? 0);

  if (btnAbrir) {
    btnAbrir.textContent = 'Abrir Caixa';
    btnAbrir.disabled = aberto;
    btnAbrir.title = aberto ? 'Feche o caixa atual antes de abrir outro turno.' : 'Abrir caixa para o turno atual.';
    btnAbrir.setAttribute('aria-disabled', aberto ? 'true' : 'false');
  }

  if (btnFechar) {
    btnFechar.textContent = 'Fechar Caixa';
    btnFechar.disabled = !aberto;
    btnFechar.title = aberto ? 'Fechar o caixa do turno atual.' : 'Abra um caixa antes de fechar.';
    btnFechar.setAttribute('aria-disabled', !aberto ? 'true' : 'false');
  }

  if (btnNovoMovimento) {
    btnNovoMovimento.disabled = !aberto;
    btnNovoMovimento.setAttribute('aria-disabled', !aberto ? 'true' : 'false');
  }
}

function renderMovimentos() {
  const tbody = $('#lista');
  limparElemento(tbody);

  if (!estado.movimentos.length) {
    const tr = document.createElement('tr');
    const td = criarCelula('Nenhum movimento encontrado.');
    td.colSpan = 10;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  estado.movimentos.forEach(m => {
    const tr = document.createElement('tr');

    const tdTipo = document.createElement('td');
    tdTipo.appendChild(criarTag(m.tipo));
    tr.appendChild(tdTipo);

    tr.appendChild(criarCelula(m.descricao || '-'));
    tr.appendChild(criarCelula(m.categoria || '-'));
    tr.appendChild(criarCelula(m.pessoa || '-'));
    tr.appendChild(criarCelula(m.formaPagamento || '-'));
    tr.appendChild(criarCelula(m.data || '-'));
    tr.appendChild(criarCelula(moeda(valorBrutoMovimento(m))));
    tr.appendChild(criarCelula(moeda(taxaMovimento(m))));
    tr.appendChild(criarCelula(moeda(valorLiquidoMovimento(m))));

    const tdAcoes = document.createElement('td');
    const div = document.createElement('div');
    div.className = 'acoes';

    div.appendChild(criarBotao('Cancelar', 'sec', 'cancelar', m.id));
    div.appendChild(criarBotao('Excluir', 'excluir', 'excluir', m.id));

    tdAcoes.appendChild(div);
    tr.appendChild(tdAcoes);

    tbody.appendChild(tr);
  });
}

async function carregar() {
  try {
    const atual = await obterCaixaAtual();
    estado.caixa = atual.caixa;
    estado.totais = atual.totais;
    renderCaixa();

    estado.movimentos = estado.caixa ? await listarMovimentos(filtros()) : [];
    renderMovimentos();
  } catch (erro) {
    alert(erro.message);
  }
}

$('#btnSair').addEventListener('click', () => {
  if (window.FusionAuth?.logout) window.FusionAuth.logout();
  else location.href = '/pages/login/';
});

$('#btnAbrir').addEventListener('click', () => {
  $('#formAbrir').reset();
  $('#valorAbertura').value = 0;
  $('#responsavelAbertura').value = 'Administrador';
  $('#modalAbrir').showModal();
});

$('#btnCancelarAbertura').addEventListener('click', () => {
  $('#modalAbrir').close();
});

$('#formAbrir').addEventListener('submit', async ev => {
  ev.preventDefault();

  try {
    await abrirCaixa({
      valorAbertura: Number($('#valorAbertura').value || 0),
      responsavel: $('#responsavelAbertura').value || 'Administrador',
      observacao: $('#obsAbertura').value || ''
    });

    $('#modalAbrir').close();
    await carregar();
  } catch (erro) {
    alert(erro.message);
  }
});

$('#btnNovoMovimento').addEventListener('click', () => {
  $('#formMovimento').reset();
  $('#tipo').value = 'entrada';
  $('#formaPagamento').value = 'Dinheiro';
  $('#modalMovimento').showModal();
});

$('#btnCancelarMovimento').addEventListener('click', () => {
  $('#modalMovimento').close();
});

$('#formMovimento').addEventListener('submit', async ev => {
  ev.preventDefault();

  try {
    await criarMovimento({
      tipo: $('#tipo').value,
      descricao: $('#descricao').value,
      categoria: $('#categoria').value,
      pessoa: $('#pessoa').value,
      formaPagamento: $('#formaPagamento').value,
      valor: Number($('#valor').value || 0),
      data: hojeISO(),
      observacao: $('#observacao').value
    });

    $('#modalMovimento').close();
    await carregar();
  } catch (erro) {
    alert(erro.message);
  }
});

$('#btnFechar').addEventListener('click', () => {
  const saldo = numero(estado.totais?.saldoAtualLiquido ?? estado.totais?.saldoLiquido ?? estado.totais?.saldoAtual);
  $('#formFechar').reset();
  $('#saldoSistema').textContent = `Saldo liquido do sistema: ${moeda(saldo)}`;
  $('#valorFechamento').value = saldo.toFixed(2);
  $('#modalFechar').showModal();
});

$('#btnCancelarFechamento').addEventListener('click', () => {
  $('#modalFechar').close();
});

$('#formFechar').addEventListener('submit', async ev => {
  ev.preventDefault();

  if (!confirm('Confirmar fechamento do caixa?')) return;

  try {
    const resultado = await fecharCaixa({
      valorFechamentoInformado: Number($('#valorFechamento').value || 0),
      observacao: $('#obsFechamento').value || ''
    });

    alert(`Caixa fechado. Diferença: ${moeda(resultado.caixa.diferenca || 0)}`);
    $('#modalFechar').close();
    await carregar();
  } catch (erro) {
    alert(erro.message);
  }
});

$('#btnFiltrar').addEventListener('click', carregar);

$('#btnLimpar').addEventListener('click', () => {
  $('#fBusca').value = '';
  $('#fTipo').value = 'todos';
  $('#fForma').value = 'todos';
  carregar();
});

$('#lista').addEventListener('click', async ev => {
  const btn = ev.target.closest('button');
  if (!btn) return;

  try {
    if (btn.dataset.cancelar) {
      if (!confirm('Cancelar este movimento?')) return;
      await cancelarMovimento(btn.dataset.cancelar);
      await carregar();
    }

    if (btn.dataset.excluir) {
      if (!confirm('Excluir este movimento e o lançamento financeiro vinculado?')) return;
      await excluirMovimento(btn.dataset.excluir);
      await carregar();
    }
  } catch (erro) {
    alert(erro.message);
  }
});

await carregar();
