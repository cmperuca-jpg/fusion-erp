const API_BASE = "/api";

function apiHeaders(headers = {}) {
  const token = localStorage.getItem("fusionToken") || "";
  return token ? { ...headers, Authorization: `Bearer ${token}` } : { ...headers };
}

async function apiGet(url) {
  const resposta = await fetch(`${API_BASE}${url}`, { headers: apiHeaders() });
  if (!resposta.ok) throw new Error("Erro ao consultar API");
  return resposta.json();
}

async function apiPost(url, dados) {
  const resposta = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dados)
  });

  if (!resposta.ok) throw new Error("Erro ao enviar dados");
  return resposta.json();
}

async function apiPut(url, dados) {
  const resposta = await fetch(`${API_BASE}${url}`, {
    method: "PUT",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dados)
  });

  if (!resposta.ok) throw new Error("Erro ao atualizar dados");
  return resposta.json();
}

async function apiDelete(url) {
  const resposta = await fetch(`${API_BASE}${url}`, { method: "DELETE", headers: apiHeaders() });
  if (!resposta.ok) throw new Error("Erro ao remover registro");
  return resposta.json();
}
