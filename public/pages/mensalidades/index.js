import {
  listarMensalidades,
  resumoMensalidades,
  criarMensalidade,
  gerarMensalidades,
  atualizarMensalidade,
  baixarMensalidade,
  estornarMensalidade,
  cancelarMensalidade,
  excluirMensalidade,
  listarAlunos,
  listarPlanos
} from './api.js';

const $ = seletor => document.querySelector(seletor);
const PARAMS_INICIAIS = new URLSearchParams(location.search);
const ALUNO_ID_URL = PARAMS_INICIAIS.get('alunoId') || PARAMS_INICIAIS.get('aluno_id') || '';
const estado = { mensalidades: [], alunos: [], planos: [], alunoContexto: null };
let baixaMensalidadeAtual = null;

function valorPrincipalMensalidade(item = {}) {
  const alvo = String([item.origem, item.categoria, item.descricao, item.recorrencia].join(' ')).toLowerCase();
  const entrada = alvo.includes('matricula_inicial_unificada') || alvo.includes('entrada') || alvo.includes('matrícula') || alvo.includes('matricula');
  if (entrada) return Number(item.total ?? item.valorTotalInicial ?? item.valorOriginal ?? item.valor ?? 0);
  return Number(item.valorOriginal ?? item.valor ?? item.total ?? 0);
}

function valorAtualizadoMensalidade(item = {}) {
  const alvo = String([item.origem, item.categoria, item.descricao, item.recorrencia].join(' ')).toLowerCase();
  const entrada = alvo.includes('matricula_inicial_unificada') || alvo.includes('entrada') || alvo.includes('matrícula') || alvo.includes('matricula');
  // Corrige registros já existentes que guardaram `valorAtualizado` apenas
  // com o valor do plano (R$ 65), embora a cobrança inicial seja R$ 100.
  const situacao = String(item.status || '').toLowerCase();
  if (entrada) {
    const saldo = Number(item.saldoRestante ?? item.valorRestante ?? 0);
    return saldo > 0 ? saldo : valorPrincipalMensalidade(item);
  }
  if (situacao === 'programada') return valorPrincipalMensalidade(item);
  if (situacao === 'pago' || situacao === 'cancelado') return 0;

  const saldoInformado = item.saldoRestante ?? item.valorRestante;
  const saldo = Number(saldoInformado ?? 0);
  if (saldoInformado !== undefined && saldoInformado !== null && saldo > 0) return saldo;
  return Number(item.valorAtualizado ?? item.valor ?? 0);
}

function valorDevidoBaixaMensalidade() {
  const base = valorAtualizadoMensalidade(baixaMensalidadeAtual || {});
  const desconto = Number($('#baixaDesconto')?.value || 0);
  const multa = Number($('#baixaMulta')?.value || 0);
  const juros = Number($('#baixaJuros')?.value || 0);
  return Math.max(0, Number((base + multa + juros - desconto).toFixed(2)));
}

function recalcularBaixaMensalidade() {
  const input = $('#baixaValor');
  if (input) input.value = valorDevidoBaixaMensalidade().toFixed(2);
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function competenciaAtual() {
  return hojeISO().slice(0, 7);
}

function competenciaPorVencimento(data) {
  return String(data || hojeISO()).slice(0, 7);
}

function textoSeguro(valor) {
  return String(valor ?? '');
}

function alunoId(item = {}) {
  return textoSeguro(item.id || item._id || item.alunoId || item.aluno_id);
}

function alunoNome(item = {}) {
  return textoSeguro(item.nome || item.nomeCompleto || item.alunoNome || item.aluno || item.name || 'Aluno');
}

function filtros() {
  return {
    q: $('#fBusca').value,
    competencia: $('#fCompetencia').value,
    status: $('#fStatus').value,
    alunoId: ALUNO_ID_URL
  };
}

function limparElemento(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function criarOpcao(valor, texto, extra = {}) {
  const opt = document.createElement('option');
  opt.value = textoSeguro(valor);
  opt.textContent = textoSeguro(texto);
  Object.entries(extra).forEach(([chave, valorExtra]) => opt.dataset[chave] = textoSeguro(valorExtra));
  return opt;
}

function preencherSelects() {
  const alunoSelect = $('#alunoId');
  const planoSelect = $('#planoId');
  limparElemento(alunoSelect);
  limparElemento(planoSelect);

  alunoSelect.appendChild(criarOpcao('', 'Selecione'));
  planoSelect.appendChild(criarOpcao('', 'Selecione'));

  estado.alunos.forEach(aluno => {
    const id = aluno.id || aluno._id || '';
    const nome = aluno.nome || aluno.name || aluno.alunoNome || 'Aluno';
    alunoSelect.appendChild(criarOpcao(id, nome));
  });

  estado.planos.forEach(plano => {
    const id = plano.id || plano._id || '';
    const nome = plano.nome || plano.name || 'Plano';
    const valor = Number(plano.valor ?? plano.preco ?? plano.valorMensal ?? 0);
    planoSelect.appendChild(criarOpcao(id, nome, { valor }));
  });
}

function aplicarContextoAluno() {
  if (!ALUNO_ID_URL) return;
  estado.alunoContexto = estado.alunos.find(aluno => alunoId(aluno) === textoSeguro(ALUNO_ID_URL)) || null;

  const faixa = $('#mensalidadeAlunoContexto');
  if (faixa) {
    const titulo = faixa.querySelector('strong');
    const texto = faixa.querySelector('span');
    if (estado.alunoContexto) {
      titulo.textContent = `Mensalidades de ${alunoNome(estado.alunoContexto)}`;
      texto.textContent = 'Mostrando todos os vencimentos deste aluno, sem limitar ao mes atual.';
    } else {
      titulo.textContent = 'Mensalidades do aluno selecionado';
      texto.textContent = 'O filtro veio da ficha do aluno. Se nada aparecer, ainda nao existe mensalidade vinculada.';
    }
    faixa.classList.remove('hidden');
  }

  if ($('#alunoId')) $('#alunoId').value = ALUNO_ID_URL;
}

function statusTexto(status) {
  return {
    aberto: 'Aberto',
    atrasado: 'Atrasado',
    parcial: 'Parcial',
    pago: 'Pago',
    cancelado: 'Cancelado',
    programada: 'Programada'
  }[status] || status || '-';
}

function criarCelula(texto) {
  const td = document.createElement('td');
  td.textContent = textoSeguro(texto);
  return td;
}

function criarBotao(texto, classe, dataNome, dataValor) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = texto;
  if (classe) btn.className = classe;
  btn.dataset[dataNome] = dataValor;
  return btn;
}

function criarTagStatus(status) {
  const span = document.createElement('span');
  span.className = `tag ${status || ''}`;
  span.textContent = statusTexto(status);
  return span;
}

function renderResumo(resumo) {
  $('#rTotal').textContent = resumo.total || 0;
  $('#rAbertas').textContent = moeda(resumo.valorAberto || 0);
  $('#rAtrasadas').textContent = moeda(resumo.valorAtrasado || 0);
  $('#rPagas').textContent = moeda(resumo.valorPago || 0);
  const programadas = $('#rProgramadas');
  if (programadas) programadas.textContent = moeda(resumo.valorProgramado || 0);
}

function renderLista() {
  const tbody = $('#lista');
  limparElemento(tbody);

  if (!estado.mensalidades.length) {
    const tr = document.createElement('tr');
    const td = criarCelula('Nenhuma mensalidade encontrada.');
    td.colSpan = 8;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  estado.mensalidades.forEach(m => {
    const tr = document.createElement('tr');

    const nomeAlunoLinha = m.alunoNome || m.aluno || m.pessoa || m.alunoFornecedor || m.pessoaFornecedor || '-';
    const nomePlanoLinha = m.planoNome || m.plano || '-';

    tr.appendChild(criarCelula(nomeAlunoLinha));
    tr.appendChild(criarCelula(nomePlanoLinha));
    tr.appendChild(criarCelula(m.competencia || '-'));
    tr.appendChild(criarCelula(m.vencimento || '-'));
    tr.appendChild(criarCelula(moeda(valorPrincipalMensalidade(m))));
    tr.appendChild(criarCelula(moeda(valorAtualizadoMensalidade(m))));

    const tdStatus = document.createElement('td');
    tdStatus.appendChild(criarTagStatus(m.status));
    tr.appendChild(tdStatus);

    const tdAcoes = document.createElement('td');
    const div = document.createElement('div');
    div.className = 'acoes';

    div.appendChild(criarBotao('Editar', '', 'editar', m.id));
    if (!['pago', 'cancelado'].includes(m.status)) {
      div.appendChild(criarBotao(m.status === 'programada' ? 'Pagar' : 'Baixar', 'baixar', 'baixar', m.id));
    }

    if (m.status === 'pago' || m.status === 'parcial') {
      div.appendChild(criarBotao('Estornar', 'estornar', 'estornar', m.id));
    }

    div.appendChild(criarBotao('Cancelar', 'sec', 'cancelar', m.id));
    div.appendChild(criarBotao('Excluir', 'excluir', 'excluir', m.id));

    tdAcoes.appendChild(div);
    tr.appendChild(tdAcoes);
    tbody.appendChild(tr);
  });
}

async function carregar() {
  try {
    const f = filtros();
    estado.mensalidades = await listarMensalidades(f);
    renderLista();
    renderResumo(await resumoMensalidades(f));
  } catch (erro) {
    alert(erro.message);
  }
}

async function carregarBases() {
  try { estado.alunos = await listarAlunos(); } catch { estado.alunos = []; }
  try { estado.planos = await listarPlanos(); } catch { estado.planos = []; }
  preencherSelects();
  aplicarContextoAluno();
}

function abrirModal(m = null) {
  $('#form').reset();
  $('#id').value = m?.id || '';
  $('#modalTitulo').textContent = m ? 'Editar Mensalidade' : 'Nova Mensalidade';
  $('#vencimento').value = m?.vencimento || hojeISO();
  $('#competencia').value = competenciaPorVencimento($('#vencimento').value);
  $('#valor').value = m?.valor || '';
  $('#quantidade').value = 1;
  $('#observacao').value = m?.observacao || '';

  if (m?.alunoId) $('#alunoId').value = m.alunoId;
  else if (ALUNO_ID_URL) $('#alunoId').value = ALUNO_ID_URL;
  if (m?.planoId) $('#planoId').value = m.planoId;

  $('#quantidade').disabled = Boolean(m);
  $('#modal').showModal();
}

function montarPayload() {
  const alunoOpt = $('#alunoId').selectedOptions[0];
  const planoOpt = $('#planoId').selectedOptions[0];

  return {
    alunoId: $('#alunoId').value,
    alunoNome: alunoOpt?.textContent || '',
    planoId: $('#planoId').value,
    planoNome: planoOpt?.textContent || '',
    competencia: competenciaPorVencimento($('#vencimento').value),
    vencimento: $('#vencimento').value,
    valor: Number($('#valor').value || 0),
    quantidade: Number($('#quantidade').value || 1),
    observacao: $('#observacao').value
  };
}

function abrirModalBaixa(m) {
  baixaMensalidadeAtual = m;
  $('#formBaixa').reset();

  $('#baixaId').value = m.id;
  $('#baixaForma').value = 'Dinheiro';
  $('#baixaValor').value = valorAtualizadoMensalidade(m).toFixed(2);
  $('#baixaDesconto').value = 0;
  $('#baixaMulta').value = Number(m.multa || 0).toFixed(2);
  $('#baixaJuros').value = Number(m.juros || 0).toFixed(2);
  $('#baixaObservacao').value = '';

  $('#baixaInfo').textContent =
    `${m.alunoNome || '-'} | Competência ${m.competencia || '-'} | Valor atualizado ${moeda(valorAtualizadoMensalidade(m))}`;

  recalcularBaixaMensalidade();
  $('#modalBaixa').showModal();
}

$('#btnSair').addEventListener('click', () => {
  if (window.FusionAuth?.logout) window.FusionAuth.logout();
  else location.href = '/pages/login/';
});

$('#btnNova').addEventListener('click', () => abrirModal());
$('#btnCancelar').addEventListener('click', () => $('#modal').close());
$('#btnCancelarBaixa').addEventListener('click', () => { baixaMensalidadeAtual = null; $('#modalBaixa').close(); });
['#baixaDesconto', '#baixaMulta', '#baixaJuros'].forEach(id => {
  $(id)?.addEventListener('input', recalcularBaixaMensalidade);
});

$('#btnFiltrar').addEventListener('click', carregar);

$('#btnLimpar').addEventListener('click', () => {
  $('#fBusca').value = '';
  $('#fCompetencia').value = '';
  $('#fStatus').value = 'todos';
  carregar();
});

$('#vencimento').addEventListener('change', () => {
  $('#competencia').value = competenciaPorVencimento($('#vencimento').value);
});

$('#planoId').addEventListener('change', () => {
  const valor = $('#planoId').selectedOptions[0]?.dataset?.valor;
  if (valor && !$('#id').value) $('#valor').value = valor;
});

$('#form').addEventListener('submit', async ev => {
  ev.preventDefault();

  const id = $('#id').value;
  const payload = montarPayload();

  if (!payload.alunoId) return alert('Selecione o aluno.');
  if (!payload.vencimento) return alert('Informe o vencimento.');
  if (!payload.valor) return alert('Informe o valor.');

  try {
    if (id) {
      await atualizarMensalidade(id, payload);
    } else if (payload.quantidade > 1) {
      const resultado = await gerarMensalidades({ ...payload, primeiroVencimento: payload.vencimento });
      if (resultado.ignoradas?.length) {
        alert(`${resultado.criadas?.length || 0} mensalidade(s) criada(s). ${resultado.ignoradas.length} duplicada(s) ignorada(s).`);
      }
    } else {
      await criarMensalidade(payload);
    }

    $('#modal').close();
    await carregar();
  } catch (erro) {
    alert(erro.message);
  }
});

$('#formBaixa').addEventListener('submit', async ev => {
  ev.preventDefault();

  const id = $('#baixaId').value;
  const valorPago = Number($('#baixaValor').value || 0);
  const valorDevido = valorDevidoBaixaMensalidade();
  const valorAplicado = Math.min(valorPago, valorDevido);

  try {
    await baixarMensalidade(id, {
      formaPagamento: $('#baixaForma').value,
      valorAplicado,
      valorPago,
      valorEntregue: valorPago,
      valorRecebido: valorPago,
      valorBaixa: valorAplicado,
      valor: valorAplicado,
      desconto: Number($('#baixaDesconto').value || 0),
      multa: Number($('#baixaMulta').value || 0),
      juros: Number($('#baixaJuros').value || 0),
      observacao: $('#baixaObservacao').value,
      usuario: 'Administrador'
    });

    $('#modalBaixa').close();
    baixaMensalidadeAtual = null;
    await carregar();

    alert('Baixa concluída. Movimento criado no Caixa e lançamento atualizado no Financeiro.');
  } catch (erro) {
    alert(erro.message);
  }
});

$('#lista').addEventListener('click', async ev => {
  const btn = ev.target.closest('button');
  if (!btn) return;

  const idEditar = btn.dataset.editar;
  const idBaixar = btn.dataset.baixar;
  const idCancelar = btn.dataset.cancelar;
  const idEstornar = btn.dataset.estornar;
  const idExcluir = btn.dataset.excluir;

  try {
    if (idEditar) {
      const mensalidade = estado.mensalidades.find(x => x.id === idEditar);
      if (mensalidade) abrirModal(mensalidade);
    }

    if (idBaixar) {
      const mensalidade = estado.mensalidades.find(x => x.id === idBaixar);
      if (mensalidade) abrirModalBaixa(mensalidade);
    }

    if (idCancelar) {
      if (!confirm('Cancelar esta mensalidade?')) return;
      await cancelarMensalidade(idCancelar);
      await carregar();
    }

    if (idEstornar) {
      const motivo = prompt('Motivo do estorno:', 'Estorno de pagamento');
      if (motivo === null) return;
      if (!confirm('Confirmar estorno da baixa? O movimento do caixa será marcado como estornado e o financeiro voltará para aberto.')) return;
      await estornarMensalidade(idEstornar, { motivo, usuario: 'Administrador' });
      await carregar();
      alert('Baixa estornada. Mensalidade voltou para aberto, movimento do caixa foi estornado e financeiro atualizado.');
    }

    if (idExcluir) {
      if (!confirm('Excluir esta mensalidade e o lançamento financeiro vinculado?')) return;
      await excluirMensalidade(idExcluir);
      await carregar();
    }
  } catch (erro) {
    alert(erro.message);
  }
});

$('#fCompetencia').value = ALUNO_ID_URL ? '' : competenciaAtual();
await carregarBases();
await carregar();
