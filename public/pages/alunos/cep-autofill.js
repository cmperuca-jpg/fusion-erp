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
