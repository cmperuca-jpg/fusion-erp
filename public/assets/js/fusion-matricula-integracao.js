(function () {
  async function postJSON(url, payload) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) throw new Error(json.erro || 'Falha na operação.');
    return json;
  }

  window.FusionMatriculaIntegracao = {
    integrar: function (alunoId, planoId, opcoes) {
      return postJSON('/api/matriculas/integrar', {
        alunoId,
        planoId,
        vencimento: opcoes && opcoes.vencimento,
        gerarMensalidade: !(opcoes && opcoes.gerarMensalidade === false)
      });
    },
    trocarPlano: function (alunoId, novoPlanoId) {
      return postJSON('/api/matriculas/trocar-plano', { alunoId, novoPlanoId });
    }
  };
})();
