(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  async function apiGet(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Falha ao carregar ${url}`);
    return r.json();
  }

  function extrairListaPlanos(resp) {
    if (Array.isArray(resp)) return resp;
    return resp.planos || resp.dados || resp.data || [];
  }

  function localizarCampoPlano() {
    return $('#planoId') || $('#plano') || $('[name="planoId"]') || $('[name="plano"]');
  }

  function preencherCamposPlano(plano) {
    const pares = {
      planoId: plano?.id || '',
      plano: plano?.nome || '',
      valorMensal: plano?.valorMensal || 0,
      taxaMatricula: plano?.taxaMatricula || 0,
      modalidades: Array.isArray(plano?.modalidadesIncluidas) ? plano.modalidadesIncluidas.join(', ') : (plano?.modalidades || '')
    };
    Object.entries(pares).forEach(([nome, valor]) => {
      const el = $(`#${nome}`) || $(`[name="${nome}"]`);
      if (el) el.value = valor;
    });
  }

  async function carregarPlanosNoCadastro() {
    const campo = localizarCampoPlano();
    if (!campo || campo.dataset.zipdOk === '1') return;
    const planos = extrairListaPlanos(await apiGet('/api/planos'));
    if (campo.tagName === 'SELECT') {
      const atual = campo.value;
      campo.innerHTML = '<option value="">Selecione um plano</option>' + planos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
      campo.value = atual || campo.value;
    }
    campo.dataset.zipdOk = '1';
    campo.addEventListener('change', () => {
      const plano = planos.find(p => String(p.id) === String(campo.value) || String(p.nome) === String(campo.value));
      if (plano) preencherCamposPlano(plano);
    });
  }

  function preencherDataMatricula() {
    const el = $('#dataMatricula') || $('[name="dataMatricula"]');
    if (el && !el.value) el.value = new Date().toISOString().slice(0, 10);
  }

  function coletarFormulario(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const campoPlano = localizarCampoPlano();
    if (campoPlano) data.planoId = campoPlano.value;
    return data;
  }

  async function salvarMatriculaIntegrada(form) {
    const dados = coletarFormulario(form);
    const r = await fetch('/api/matriculas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    const json = await r.json();
    if (!r.ok || json.ok === false) throw new Error(json.erro || 'Falha ao salvar matrícula integrada.');
    return json;
  }

  window.FusionMatricula = { carregarPlanosNoCadastro, preencherDataMatricula, salvarMatriculaIntegrada };
  document.addEventListener('DOMContentLoaded', () => {
    preencherDataMatricula();
    carregarPlanosNoCadastro().catch(console.error);
  });
})();
