const el = (id) => document.getElementById(id);

function setStatus(texto) {
  el("status").textContent = texto;
}

function atualizarKpis(dados = {}) {
  el("kpiRegistros").textContent = dados.registros_txt_validos ?? 0;
  el("kpiZip").textContent = dados.imagens_no_zip ?? 0;
  el("kpiVinculadas").textContent = dados.vinculadas ?? 0;
  el("kpiPendencias").textContent = (dados.sem_aluno ?? 0) + (dados.sem_arquivo ?? 0) + (dados.ignorados_txt ?? 0) + (dados.erros ?? 0);
}

function renderPreview(lista = []) {
  const tbody = el("preview");
  if (!Array.isArray(lista) || !lista.length) {
    tbody.innerHTML = '<tr><td colspan="4">Nenhuma foto para exibir.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map((item) => `
    <tr>
      <td>${item.id_legado || ""}</td>
      <td>${item.aluno || ""}</td>
      <td>${item.arquivo_origem || ""}</td>
      <td>${item.foto || item.arquivo_destino || ""}</td>
    </tr>
  `).join("");
}

function renderRelatorio(dados) {
  el("relatorio").textContent = JSON.stringify(dados, null, 2);
}

function lerArquivoTexto(inputId) {
  return new Promise((resolve, reject) => {
    const file = el(inputId).files?.[0];
    if (!file) return reject(new Error("Selecione o Fotos.txt."));
    const reader = new FileReader();
    reader.onload = () => resolve({ nome: file.name, conteudo: String(reader.result || "") });
    reader.onerror = () => reject(new Error("Não foi possível ler o Fotos.txt."));
    reader.readAsText(file, "windows-1252");
  });
}

function lerArquivoBase64(inputId) {
  return new Promise((resolve, reject) => {
    const file = el(inputId).files?.[0];
    if (!file) return reject(new Error("Selecione o Fotos.zip."));
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",").pop() : dataUrl;
      resolve({ nome: file.name, base64 });
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o Fotos.zip."));
    reader.readAsDataURL(file);
  });
}

async function postJson(url, body) {
  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok || dados.ok === false) throw new Error(dados.mensagem || dados.erro || "Falha na operação.");
  return dados;
}

async function montarPayload() {
  const txt = await lerArquivoTexto("fotosTxt");
  const zip = await lerArquivoBase64("fotosZip");
  return {
    fotosTxt: txt.conteudo,
    zipBase64: zip.base64,
    nomeZip: zip.nome
  };
}

async function executar(tipo, origem = "upload") {
  try {
    let payload = {};
    let url = "";

    if (origem === "servidor") {
      url = tipo === "importar"
        ? "/api/importador-access/fotos/importar-local-arquivos"
        : "/api/importador-access/fotos/analisar-local";
      setStatus(tipo === "importar" ? "Importando Fotos.txt e Fotos.zip do servidor..." : "Analisando Fotos.txt e Fotos.zip do servidor...");
    } else {
      setStatus("Lendo arquivos enviados...");
      payload = await montarPayload();
      url = tipo === "importar"
        ? "/api/importador-access/fotos/importar-local"
        : "/api/importador-access/fotos/analisar";
      setStatus(tipo === "importar" ? "Importando fotos enviadas..." : "Analisando fotos enviadas...");
    }

    const dados = await postJson(url, payload);
    atualizarKpis(dados);
    renderPreview(dados.preview || []);
    renderRelatorio(dados);
    setStatus(tipo === "importar" ? "Importação local de fotos concluída." : "Análise concluída. Confira o relatório antes de importar.");
  } catch (erro) {
    setStatus(erro.message);
  }
}

el("btnAnalisar").addEventListener("click", () => executar("analisar", "upload"));
el("btnImportar").addEventListener("click", () => executar("importar", "upload"));
el("btnAnalisarServidor").addEventListener("click", () => executar("analisar", "servidor"));
el("btnImportarServidor").addEventListener("click", () => executar("importar", "servidor"));

["fotosTxt", "fotosZip"].forEach((id) => {
  el(id).addEventListener("change", () => {
    const txt = el("fotosTxt").files?.[0]?.name || "Fotos.txt não selecionado";
    const zip = el("fotosZip").files?.[0]?.name || "Fotos.zip não selecionado";
    setStatus(`${txt} | ${zip}`);
  });
});

fetch("/api/importador-access/fotos/status", { cache: "no-store" })
  .then((r) => r.json())
  .then((dados) => renderRelatorio(dados))
  .catch(() => {});
