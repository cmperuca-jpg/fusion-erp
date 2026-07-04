const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function req(url, opcoes = {}) {
  const resp = await fetch(url, opcoes);

  if (!resp.ok) {
    let msg = 'Erro na requisição.';
    try {
      const erro = await resp.json();
      msg = erro.mensagem || erro.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return resp.json();
}

export function obterCaixaAtual() {
  return req('/api/caixa/atual');
}

export function listarMovimentos(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') params.set(k, v);
  });

  return req(`/api/caixa/movimentos?${params.toString()}`);
}

export function abrirCaixa(dados) {
  return req('/api/caixa/abrir', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(dados)
  });
}

export function fecharCaixa(dados) {
  return req('/api/caixa/fechar', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(dados)
  });
}

export function criarMovimento(dados) {
  return req('/api/caixa/movimentos', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(dados)
  });
}

export function cancelarMovimento(id) {
  return req(`/api/caixa/movimentos/${id}/cancelar`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({})
  });
}

export function excluirMovimento(id) {
  return req(`/api/caixa/movimentos/${id}`, { method: 'DELETE' });
}
