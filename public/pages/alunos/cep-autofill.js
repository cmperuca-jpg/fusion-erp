/* Fusion ERP - preenchimento automático de endereço pelo CEP */
(() => {
  if (!window.location.pathname.includes('/pages/alunos/')) return;

  const cepEl = document.getElementById('cep');
  if (!cepEl || cepEl.dataset.cepAutofill === '1') return;
  cepEl.dataset.cepAutofill = '1';

  let timer = null;
  let controller = null;
  let ultimoCepEncontrado = '';
  let numeroDaConsulta = 0;

  const somenteNumeros = (valor) => String(valor || '').replace(/\D/g, '').slice(0, 8);

  const formatarCep = (valor) => {
    const numeros = somenteNumeros(valor);
    return numeros.replace(/(\d{5})(\d)/, '$1-$2');
  };

  function obterMensagem() {
    let ajuda = document.getElementById('cepAjudaSistema');
    if (ajuda) return ajuda;

    ajuda = document.createElement('small');
    ajuda.id = 'cepAjudaSistema';
    ajuda.setAttribute('aria-live', 'polite');
    ajuda.style.display = 'block';
    ajuda.style.marginTop = '5px';
    ajuda.style.lineHeight = '1.3';

    const campo = cepEl.closest('.field') || cepEl.parentElement;
    campo?.appendChild(ajuda);
    return ajuda;
  }

  function mostrarMensagem(texto, tipo = 'info') {
    const ajuda = obterMensagem();
    ajuda.textContent = texto;
    ajuda.style.color =
      tipo === 'ok' ? '#166534' :
      tipo === 'erro' ? '#b91c1c' :
      '#475569';
  }

  function preencherCampo(id, valor) {
    const campo = document.getElementById(id);
    if (!campo) return;

    campo.value = valor || '';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function buscarCep({ forcar = false } = {}) {
    const cep = somenteNumeros(cepEl.value);
    cepEl.value = formatarCep(cepEl.value);

    if (cep.length < 8) {
      ultimoCepEncontrado = '';
      mostrarMensagem('Digite os 8 números do CEP para preencher o endereço automaticamente.');
      return;
    }

    if (!forcar && cep === ultimoCepEncontrado) return;

    controller?.abort();
    controller = new AbortController();
    const consultaAtual = ++numeroDaConsulta;

    mostrarMensagem('Consultando CEP...');

    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        cache: 'no-store',
        signal: controller.signal
      });

      if (!resposta.ok) {
        throw new Error('Não foi possível consultar o CEP.');
      }

      const dados = await resposta.json();
      if (consultaAtual !== numeroDaConsulta) return;

      if (dados?.erro) {
        ultimoCepEncontrado = '';
        mostrarMensagem('CEP não encontrado. Confira o número ou preencha o endereço manualmente.', 'erro');
        return;
      }

      preencherCampo('endereco', dados.logradouro);
      preencherCampo('bairro', dados.bairro);
      preencherCampo('cidade', dados.localidade);
      preencherCampo('estado', dados.uf);

      ultimoCepEncontrado = cep;
      mostrarMensagem('CEP localizado. Endereço preenchido automaticamente.', 'ok');
    } catch (erro) {
      if (erro?.name === 'AbortError') return;
      ultimoCepEncontrado = '';
      mostrarMensagem('Não foi possível consultar o CEP. Confira a conexão ou preencha o endereço manualmente.', 'erro');
    }
  }

  cepEl.addEventListener('input', () => {
    cepEl.value = formatarCep(cepEl.value);
    ultimoCepEncontrado = '';

    clearTimeout(timer);
    const cep = somenteNumeros(cepEl.value);

    if (cep.length === 8) {
      timer = setTimeout(() => buscarCep(), 300);
    } else {
      mostrarMensagem('Digite os 8 números do CEP para preencher o endereço automaticamente.');
    }
  });

  cepEl.addEventListener('blur', () => {
    clearTimeout(timer);
    if (somenteNumeros(cepEl.value).length === 8) buscarCep();
  });

  mostrarMensagem('Digite os 8 números do CEP para preencher o endereço automaticamente.');
})();

/*
 * Fusion ERP - correção do botão "Trocar turma/modalidade" no cadastro de alunos.
 *
 * O botão original abria a tela de matrícula somente com alunoId. Isso obrigava
 * a tela seguinte a localizar novamente a matrícula ativa e podia produzir
 * comportamento inconsistente. A correção usa diretamente o ID/número da
 * matrícula exibida no próprio cartão e abre cadastro.html?id=..., que já entra
 * no modo de alteração operacional de turma/modalidade sem recriar financeiro.
 */
(() => {
  if (!window.location.pathname.includes('/pages/alunos/')) return;

  const LISTA_ID = 'matriculasAlunoLista';
  const MARCA_CORRIGIDO = 'fusionTrocaTurmaCorrigida';

  function textoNormalizado(valor) {
    return String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function ehBotaoTrocaTurma(botao) {
    const texto = textoNormalizado(botao?.textContent);
    return texto.includes('trocar turma') || texto.includes('alterar turma');
  }

  function ehBotaoVerFicha(botao) {
    return textoNormalizado(botao?.textContent).includes('ver ficha');
  }

  function extrairIdDoOnclick(onclick = '') {
    const texto = String(onclick || '');
    const match = texto.match(/abrirFichaMatricula\(\s*['"]([^'"]+)['"]\s*\)/i);
    return match?.[1] || '';
  }

  function extrairMatriculaId(botaoTroca) {
    const acoes = botaoTroca?.parentElement;
    const card = acoes?.parentElement || botaoTroca?.closest('.timeline-item, .card');
    if (!card) return '';

    const botaoFicha = Array.from(card.querySelectorAll('button')).find(ehBotaoVerFicha);
    const peloOnclick = extrairIdDoOnclick(botaoFicha?.getAttribute('onclick'));
    if (peloOnclick) return peloOnclick;

    const dataId =
      card.dataset?.matriculaId ||
      botaoTroca.dataset?.matriculaId ||
      botaoFicha?.dataset?.matriculaId ||
      '';
    if (dataId) return dataId;

    const textoCard = String(card.textContent || '');
    const peloNumero = textoCard.match(/\bMAT-[A-Z0-9-]+\b/i);
    return peloNumero?.[0] || '';
  }

  function abrirTrocaTurma(matriculaId) {
    const id = String(matriculaId || '').trim();
    if (!id) return;
    const params = new URLSearchParams({
      id,
      origem: 'troca-turma'
    });
    window.location.href = `/pages/matriculas/cadastro.html?${params.toString()}`;
  }

  function aplicarVisual(botao, tipo) {
    if (!botao) return;

    botao.disabled = false;
    botao.removeAttribute('aria-disabled');

    botao.style.setProperty('opacity', '1', 'important');
    botao.style.setProperty('cursor', 'pointer', 'important');
    botao.style.setProperty('text-shadow', 'none', 'important');
    botao.style.setProperty('min-height', '40px', 'important');
    botao.style.setProperty('padding', '9px 14px', 'important');
    botao.style.setProperty('border-radius', '9px', 'important');
    botao.style.setProperty('font-weight', '800', 'important');

    if (tipo === 'troca') {
      botao.style.setProperty('background', '#22b8d2', 'important');
      botao.style.setProperty('border', '1px solid #1299b2', 'important');
      botao.style.setProperty('color', '#ffffff', 'important');
      botao.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
    } else {
      botao.style.setProperty('background', '#0b4452', 'important');
      botao.style.setProperty('border', '1px solid #073946', 'important');
      botao.style.setProperty('color', '#ffffff', 'important');
      botao.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
    }

    botao.querySelectorAll('*').forEach((filho) => {
      filho.style.setProperty('color', '#ffffff', 'important');
      filho.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
      filho.style.setProperty('opacity', '1', 'important');
      filho.style.setProperty('visibility', 'visible', 'important');
      filho.style.setProperty('text-shadow', 'none', 'important');
    });
  }

  function corrigirBotao(botao) {
    if (!botao || !ehBotaoTrocaTurma(botao)) return;

    aplicarVisual(botao, 'troca');

    const card = botao.parentElement?.parentElement;
    const botaoFicha = card
      ? Array.from(card.querySelectorAll('button')).find(ehBotaoVerFicha)
      : null;
    aplicarVisual(botaoFicha, 'ficha');

    const matriculaId = extrairMatriculaId(botao);
    if (!matriculaId) return;

    botao.dataset[MARCA_CORRIGIDO] = '1';
    botao.title = 'Alterar somente turma/modalidade, preservando o financeiro';
    botao.onclick = (evento) => {
      evento?.preventDefault();
      evento?.stopPropagation();
      abrirTrocaTurma(matriculaId);
      return false;
    };
  }

  function aplicarCorrecao() {
    const lista = document.getElementById(LISTA_ID);
    if (!lista) return;

    lista.querySelectorAll('button').forEach((botao) => {
      if (ehBotaoTrocaTurma(botao)) corrigirBotao(botao);
      else if (ehBotaoVerFicha(botao)) aplicarVisual(botao, 'ficha');
    });
  }

  function iniciarObservacao() {
    aplicarCorrecao();

    const lista = document.getElementById(LISTA_ID);
    if (!lista || lista.dataset.trocaTurmaObserver === '1') return;

    lista.dataset.trocaTurmaObserver = '1';
    const observer = new MutationObserver(() => aplicarCorrecao());
    observer.observe(lista, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarObservacao, { once: true });
  } else {
    iniciarObservacao();
  }

  // A lista de matrículas é carregada de forma assíncrona.
  setTimeout(iniciarObservacao, 300);
  setTimeout(iniciarObservacao, 1000);
})();

/* Fusion Aluno - carrega o módulo de emissão de código da academia. */
(() => {
  if (!window.location.pathname.includes('/pages/alunos/')) return;
  if (document.querySelector('script[data-fusion-aluno-app-access="1"]')) return;
  const script = document.createElement('script');
  script.src = './app-access.js?v=20260810-emissao-1';
  script.defer = true;
  script.dataset.fusionAlunoAppAccess = '1';
  document.head.appendChild(script);
})();
