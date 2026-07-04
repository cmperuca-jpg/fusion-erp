const API_PROFESSORES = "/api/professores";

async function buscarJSON(url) {
  const resposta = await fetch(url);
  return await resposta.json();
}

async function salvarJSON(url, metodo, dados) {
  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados)
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    throw new Error(erro.erro || "Erro ao salvar.");
  }

  return await resposta.json();
}

async function excluirJSON(url) {
  const resposta = await fetch(url, { method: "DELETE" });

  if (!resposta.ok) {
    throw new Error("Erro ao excluir.");
  }

  return await resposta.json();
}
