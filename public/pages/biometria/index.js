const $ = (id) => document.getElementById(id);

let pessoas = [];
let selecionada = null;
let comandoTimer = null;
let buscaTimer = null;

async function api(url, opt = {}) {
  const resp = await fetch(url, {
    ...opt,
    cache: opt.cache || "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(opt.headers || {})
    }
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.ok === false) {
    throw new Error(
      json.mensagem ||
      json.erro ||
      "Não foi possível concluir a operação."
    );
  }
  return json;
}

function texto(valor = "") {
  return String(valor ?? "").trim();
}

function esc(valor = "") {
  return texto(valor).replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
}

function tipoDaUrl() {
  const tipo = new URLSearchParams(location.search).get("tipo") || "";
  return ["aluno", "professor", "usuario"].includes(tipo) ? tipo : "";
}

function setMensagem(msg = "", tipo = "") {
  const el = $("mensagemOperacao");
  el.textContent = msg;
  el.dataset.tipo = tipo;
}

function renderLista() {
  const lista = $("listaPessoas");
  $("contadorPessoas").textContent =
    `${pessoas.length} pessoa${pessoas.length === 1 ? "" : "s"}`;

  if (!pessoas.length) {
    lista.innerHTML = `
      <div class="bio-empty compact">
        <strong>Nenhuma pessoa encontrada</strong>
        <span>Altere a busca ou o filtro.</span>
      </div>`;
    return;
  }

  lista.innerHTML = pessoas.map((p) => `
    <button
      type="button"
      class="pessoa-item ${selecionada?.id === p.id && selecionada?.tipoPessoa === p.tipoPessoa ? "ativo" : ""}"
      data-id="${esc(p.id)}"
      data-tipo="${esc(p.tipoPessoa)}"
    >
      <span class="pessoa-item-main">
        <strong>${esc(p.nome)}</strong>
        <small>${esc(p.perfilRotulo)} · ${esc(p.status || (p.ativo ? "Ativo" : "Inativo"))}</small>
      </span>
      <span class="estado-dot ${p.bloqueado || !p.ativo ? "bloqueado" : "ok"}"></span>
    </button>
  `).join("");

  lista.querySelectorAll(".pessoa-item").forEach((btn) => {
    btn.addEventListener("click", () =>
      selecionarPessoa(btn.dataset.tipo, btn.dataset.id)
    );
  });
}

async function carregarLeitor() {
  const badge = $("leitorBadge");
  try {
    const json = await api("/api/biometria/status");
    const conectado = Boolean(json.local?.conectado ?? json.local?.ok);
    badge.textContent = conectado ? "Leitor conectado" : "Leitor indisponível";
    badge.className = `leitor-badge ${conectado ? "ok" : "erro"}`;
  } catch {
    badge.textContent = "Computador da academia indisponível";
    badge.className = "leitor-badge erro";
  }
}

async function carregarPessoas() {
  const lista = $("listaPessoas");
  lista.innerHTML = `<div class="bio-empty compact"><span>Carregando pessoas...</span></div>`;

  const tipo = $("tipoPessoaFiltro").value;
  const busca = $("buscaPessoa").value.trim();
  const qs = new URLSearchParams();
  if (tipo) qs.set("tipo", tipo);
  if (busca) qs.set("busca", busca);

  try {
    const json = await api(`/api/biometria/pessoas?${qs.toString()}`);
    pessoas = Array.isArray(json.pessoas) ? json.pessoas : [];
    renderLista();
  } catch (e) {
    pessoas = [];
    lista.innerHTML = `
      <div class="bio-empty compact erro">
        <strong>Não foi possível carregar a lista</strong>
        <span>${esc(e.message)}</span>
      </div>`;
    $("contadorPessoas").textContent = "";
  }
}

function renderCapturas(atividade = 0) {
  for (let i = 1; i <= 3; i += 1) {
    const el = $(`captura${i}`);
    if (!el) continue;
    el.textContent = i <= atividade
      ? `${i} · capturada`
      : `${i} · aguardando`;
    el.classList.toggle("ok", i <= atividade);
  }
}

function renderProgresso(progresso = {}) {
  const percentual = Math.max(0, Math.min(100, Number(progresso.percentual || 0)));
  const atividade = Math.max(0, Math.min(3, Number(progresso.atividade || 0)));
  $("progressoBox").hidden = false;
  $("progressoMensagem").textContent =
    progresso.mensagem || "Siga as orientações do leitor.";
  $("progressoPercentual").textContent = `${Math.round(percentual)}%`;
  $("progressoBarra").style.width = `${percentual}%`;
  renderCapturas(atividade);
}

function renderSelecionada(dados) {
  const pessoa = dados.pessoa || selecionada;
  const biometria = dados.biometria || {};
  selecionada = pessoa;

  $("semSelecao").hidden = true;
  $("pessoaSelecionada").hidden = false;
  $("pessoaNome").textContent = pessoa.nome;
  $("pessoaPerfil").textContent = pessoa.perfilRotulo;
  $("pessoaStatus").textContent =
    `${pessoa.status || (pessoa.ativo ? "Ativo" : "Inativo")}`;

  $("avisoAcesso").textContent = pessoa.avisoAcesso || "";
  $("avisoAcesso").dataset.tipo =
    pessoa.acessoLiberavel ? "ok" : "atencao";

  $("digitalStatus").textContent =
    biometria.cadastrada ? "Digital cadastrada" : "Sem digital";
  $("digitalStatus").className =
    `digital-chip ${biometria.cadastrada ? "ok" : "neutro"}`;

  $("btnRemoverDigital").disabled = !biometria.cadastrada;
  $("btnCadastrarDigital").textContent =
    biometria.cadastrada ? "Atualizar digital" : "Cadastrar digital";

  setMensagem("");
  $("progressoBox").hidden = true;
  renderLista();
}

async function selecionarPessoa(tipoPessoa, pessoaId) {
  if (comandoTimer) {
    clearTimeout(comandoTimer);
    comandoTimer = null;
  }

  setMensagem("Consultando a digital...");
  try {
    const json = await api(
      `/api/biometria/pessoa/${encodeURIComponent(tipoPessoa)}/${encodeURIComponent(pessoaId)}`
    );
    renderSelecionada(json);
  } catch (e) {
    setMensagem(e.message, "erro");
  }
}

async function consultarComando(commandId) {
  try {
    const json = await api(
      `/api/biometria/sdk/comandos/${encodeURIComponent(commandId)}`
    );

    if (json.progresso) renderProgresso(json.progresso);

    if (json.status === "completed") {
      renderProgresso({
        percentual: 100,
        atividade: 3,
        mensagem: "Digital cadastrada com sucesso."
      });
      setMensagem("Digital cadastrada. A pessoa já pode usar a catraca quando estiver liberada.", "ok");
      await selecionarPessoa(selecionada.tipoPessoa, selecionada.id);
      return;
    }

    if (json.status === "failed" || json.status === "expired") {
      setMensagem(
        json.mensagem || "Não foi possível cadastrar a digital.",
        "erro"
      );
      $("btnCadastrarDigital").disabled = false;
      return;
    }

    comandoTimer = setTimeout(() => consultarComando(commandId), 650);
  } catch (e) {
    setMensagem(e.message, "erro");
    $("btnCadastrarDigital").disabled = false;
  }
}

async function cadastrarDigital() {
  if (!selecionada) return;

  $("btnCadastrarDigital").disabled = true;
  $("btnRemoverDigital").disabled = true;
  setMensagem("Prepare o dedo e siga as capturas mostradas na tela.");
  renderProgresso({
    percentual: 2,
    atividade: 0,
    mensagem: "Aguardando o leitor..."
  });

  try {
    const json = await api("/api/biometria/sdk/cadastrar", {
      method: "POST",
      body: JSON.stringify({
        pessoaId: selecionada.id,
        tipoPessoa: selecionada.tipoPessoa
      })
    });

    await consultarComando(json.commandId);
  } catch (e) {
    setMensagem(e.message, "erro");
    $("btnCadastrarDigital").disabled = false;
    $("btnRemoverDigital").disabled = false;
  }
}

async function removerDigital() {
  if (!selecionada) return;

  if (!confirm(
    `Remover a digital de ${selecionada.nome}? Use esta opção somente quando a digital realmente precisar ser substituída.`
  )) return;

  $("btnCadastrarDigital").disabled = true;
  $("btnRemoverDigital").disabled = true;
  setMensagem("Removendo a digital...");

  try {
    await api(
      `/api/biometria/pessoa/${encodeURIComponent(selecionada.tipoPessoa)}/${encodeURIComponent(selecionada.id)}`,
      { method: "DELETE" }
    );
    setMensagem("Digital removida.", "ok");
    await selecionarPessoa(selecionada.tipoPessoa, selecionada.id);
  } catch (e) {
    setMensagem(e.message, "erro");
  } finally {
    $("btnCadastrarDigital").disabled = false;
  }
}

$("btnCadastrarDigital").addEventListener("click", cadastrarDigital);
$("btnRemoverDigital").addEventListener("click", removerDigital);
$("btnAtualizarLista").addEventListener("click", () => {
  carregarLeitor();
  carregarPessoas();
});
$("tipoPessoaFiltro").addEventListener("change", carregarPessoas);
$("buscaPessoa").addEventListener("input", () => {
  clearTimeout(buscaTimer);
  buscaTimer = setTimeout(carregarPessoas, 250);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") carregarLeitor();
});
window.addEventListener("focus", carregarLeitor);

(async function iniciar() {
  $("tipoPessoaFiltro").value = tipoDaUrl();
  await Promise.all([carregarLeitor(), carregarPessoas()]);
})();
