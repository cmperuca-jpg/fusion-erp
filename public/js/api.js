const API_BASE = "/api";

async function apiGet(url) {
  const resposta = await fetch(`${API_BASE}${url}`);
  if (!resposta.ok) throw new Error("Erro ao consultar API");
  return resposta.json();
}

async function apiPost(url, dados) {
  const resposta = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados)
  });

  if (!resposta.ok) throw new Error("Erro ao enviar dados");
  return resposta.json();
}

async function apiPut(url, dados) {
  const resposta = await fetch(`${API_BASE}${url}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados)
  });

  if (!resposta.ok) throw new Error("Erro ao atualizar dados");
  return resposta.json();
}

async function apiDelete(url) {
  const resposta = await fetch(`${API_BASE}${url}`, { method: "DELETE" });
  if (!resposta.ok) throw new Error("Erro ao remover registro");
  return resposta.json();
}
