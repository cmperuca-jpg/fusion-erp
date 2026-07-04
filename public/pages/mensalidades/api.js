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

export function listarMensalidades(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') params.set(k, v);
  });

  return req(`/api/mensalidades?${params.toString()}`);
}

export function resumoMensalidades(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') params.set(k, v);
  });

  return req(`/api/mensalidades/resumo?${params.toString()}`);
}

export function criarMensalidade(dados) {
  return req('/api/mensalidades', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(dados)
  });
}

export function gerarMensalidades(dados) {
  return req('/api/mensalidades/gerar', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(dados)
  });
}

export function atualizarMensalidade(id, dados) {
  return req(`/api/mensalidades/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(dados)
  });
}

export function baixarMensalidade(id, dados) {
  return req(`/api/mensalidades/${id}/baixar`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(dados)
  });
}

export function estornarMensalidade(id, dados = {}) {
  return req(`/api/mensalidades/${id}/estornar`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(dados)
  });
}

export function cancelarMensalidade(id, dados = {}) {
  return req(`/api/mensalidades/${id}/cancelar`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(dados)
  });
}

export function excluirMensalidade(id) {
  return req(`/api/mensalidades/${id}`, { method: 'DELETE' });
}

export async function listarAlunos() {
  const dados = await req('/api/alunos');
  return Array.isArray(dados) ? dados : dados.alunos || dados.dados || dados.items || [];
}

export async function listarPlanos() {
  const dados = await req('/api/planos');
  return Array.isArray(dados) ? dados : dados.planos || dados.dados || dados.items || [];
}
