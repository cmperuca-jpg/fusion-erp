const el = (id) => document.getElementById(id);
let arquivoAtual = null;
let conteudoAtual = "";

function setStatus(texto) {
  el("status").textContent = texto;
}

function atualizarKpis(dados = {}) {
  el("kpiLinhas").textContent = dados.total_registros ?? dados.total_linhas ?? 0;
  el("kpiNormalizados").textContent = dados.total_normalizados ?? dados.normalizados ?? 0;
  el("kpiDuplicados").textContent = (dados.duplicados_no_arquivo ?? dados.duplicados_arquivo ?? 0) + (dados.duplicados_base ?? 0);
  el("kpiImportaveis").textContent = dados.importaveis ?? dados.total_normalizados ?? dados.normalizados ?? 0;
}

function renderPreview(lista = []) {
  const tbody = el("preview");
  if (!Array.isArray(lista) || !lista.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum aluno para exibir.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map((aluno) => `
    <tr>
      <td>${aluno.nome || ""}</td>
      <td>${aluno.cpf || ""}</td>
      <td>${aluno.telefone || aluno.celular || ""}</td>
      <td>${aluno.data_nascimento || ""}</td>
      <td>${aluno.matricula_promocional?.valor_formatado || "R$ 0,01"}</td>
      <td>${aluno.status || "ativo"}</td>
    </tr>
  `).join("");
}

function renderRelatorio(dados) {
  el("relatorio").textContent = JSON.stringify(dados, null, 2);
}

async function lerArquivoSelecionado() {
  const input = el("arquivo");
  const arquivo = input.files && input.files[0];
  if (!arquivo) throw new Error("Selecione o arquivo Alunos.txt ou Alunos.csv.");
  arquivoAtual = arquivo;

  const buffer = await arquivo.arrayBuffer();
  try {
    conteudoAtual = new TextDecoder("windows-1252").decode(buffer);
  } catch {
    conteudoAtual = new TextDecoder("utf-8").decode(buffer);
  }

  return { nomeArquivo: arquivo.name, conteudo: conteudoAtual };
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

async function executar(tipo) {
  try {
    setStatus("Lendo arquivo...");
    const payload = await lerArquivoSelecionado();
    let url = "/api/importador-access/analisar";
    let body = payload;

    if (tipo === "simular") {
      url = "/api/importador-access/importar-local";
      body = { ...payload, dryRun: true };
    }
    if (tipo === "local") url = "/api/importador-access/importar-local";
    if (tipo === "supabase") url = "/api/importador-access/importar-supabase";

    setStatus("Processando...");
    const dados = await postJson(url, body);
    atualizarKpis(dados);
    renderPreview(dados.preview || []);
    renderRelatorio(dados);
    setStatus(tipo === "local" ? "Importação local concluída." : tipo === "supabase" ? "Importação Supabase concluída." : "Análise concluída.");
  } catch (erro) {
    setStatus(erro.message);
  }
}

el("btnAnalisar").addEventListener("click", () => executar("analisar"));
el("btnSimular").addEventListener("click", () => executar("simular"));
el("btnLocal").addEventListener("click", () => executar("local"));
el("btnSupabase").addEventListener("click", () => executar("supabase"));
el("arquivo").addEventListener("change", () => {
  const arquivo = el("arquivo").files?.[0];
  setStatus(arquivo ? `Arquivo selecionado: ${arquivo.name}` : "Selecione o arquivo exportado do Access.");
});

fetch("/api/importador-access/status", { cache: "no-store" })
  .then((r) => r.json())
  .then((dados) => renderRelatorio(dados))
  .catch(() => {});
