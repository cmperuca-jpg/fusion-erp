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
  const btnAbrir = $('#btnAbrir');
  const btnFechar = $('#btnFechar');
  const btnNovoMovimento = $('#btnNovoMovimento');

  $('#cStatus').textContent = aberto ? 'Aberto' : 'Fechado';
  $('#cEntradas').textContent = moeda(totais.entradas || 0);
  $('#cSaidas').textContent = moeda(totais.saidas || 0);
  $('#cSaldo').textContent = moeda(totais.saldoAtual || 0);
  $('#cDinheiro').textContent = moeda(totais.dinheiro || 0);
  $('#cPix').textContent = moeda(totais.pix || 0);
  $('#cCartao').textContent = moeda(totais.cartao || 0);
  $('#cOutros').textContent = moeda(totais.outros || 0);

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
    td.colSpan = 8;
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
    tr.appendChild(criarCelula(moeda(m.valor)));

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
  const saldo = estado.totais?.saldoAtual || 0;
  $('#formFechar').reset();
  $('#saldoSistema').textContent = `Saldo do sistema: ${moeda(saldo)}`;
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
