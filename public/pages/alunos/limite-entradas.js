// LIMITE INDIVIDUAL DE ENTRADAS - FICHA DO ALUNO 20260826
(() => {
  const MARCADOR = "LIMITE ENTRADAS ALUNO UI 20260826";
  const params = new URLSearchParams(location.search);
  const alunoId = params.get("id") || params.get("alunoId") || params.get("aluno_id") || params.get("aluno") || "";
  const $ = (id) => document.getElementById(id);

  function fetchAuth(url, opcoes = {}) {
    if (window.FusionAuth?.fetchAuth) return window.FusionAuth.fetchAuth(url, opcoes);
    return fetch(url, opcoes);
  }

  async function api(url, opcoes = {}) {
    const resp = await fetchAuth(url, { cache: "no-store", ...opcoes });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json?.ok === false) throw new Error(json?.mensagem || json?.erro || `HTTP ${resp.status}`);
    return json;
  }

  function garantirCard() {
    if (!alunoId) return false;
    if ($("alunoLimiteEntradasCard")) return true;
    const grid = document.querySelector("#tab-acesso .ficha-acesso-grid") || document.querySelector("#tab-acesso");
    if (!grid) return false;

    const card = document.createElement("section");
    card.id = "alunoLimiteEntradasCard";
    card.className = "ficha-acesso-card aluno-limite-entradas-card";
    card.dataset.marker = MARCADOR;
    card.innerHTML = `
      <div class="aluno-limite-head">
        <div><small>CONTROLE DE ACESSO</small><h3>Entradas permitidas por dia</h3></div>
        <span id="alunoLimiteEntradasBadge">Carregando</span>
      </div>
      <p class="aluno-limite-explicacao">
        Define quantas <strong>entradas</strong> este aluno pode realizar no mesmo dia.
        A saída não consome entrada e não é bloqueada por este limite.
      </p>
      <div class="aluno-limite-form">
        <label for="alunoLimiteEntradasInput">
          Quantidade diária
          <input id="alunoLimiteEntradasInput" type="number" min="1" max="10" step="1" inputmode="numeric">
        </label>
        <button id="alunoLimiteEntradasSalvar" type="button">Salvar limite</button>
      </div>
      <div class="aluno-limite-resumo">
        <div><span>Entradas hoje</span><strong id="alunoLimiteEntradasUsadas">-</strong></div>
        <div><span>Restantes hoje</span><strong id="alunoLimiteEntradasRestantes">-</strong></div>
      </div>
      <small id="alunoLimiteEntradasMsg" class="aluno-limite-msg"></small>
    `;
    grid.appendChild(card);
    $("alunoLimiteEntradasSalvar")?.addEventListener("click", salvar);
    return true;
  }

  function render(dados = {}) {
    const limite = Number(dados.limiteDiario ?? dados.limite ?? 1);
    const usados = Number(dados.usados ?? dados.acessosUsadosHoje ?? 0);
    const restantes = Number(dados.restantes ?? dados.acessosRestantesHoje ?? Math.max(0, limite - usados));

    if ($("alunoLimiteEntradasInput")) $("alunoLimiteEntradasInput").value = String(limite);
    if ($("alunoLimiteEntradasUsadas")) $("alunoLimiteEntradasUsadas").textContent = `${usados} de ${limite}`;
    if ($("alunoLimiteEntradasRestantes")) $("alunoLimiteEntradasRestantes").textContent = String(Math.max(0, restantes));

    const badge = $("alunoLimiteEntradasBadge");
    if (badge) {
      badge.textContent = dados.limiteAtingido ? "Limite atingido" : "Ativo";
      badge.dataset.status = dados.limiteAtingido ? "bloqueado" : "ativo";
    }

    const msg = $("alunoLimiteEntradasMsg");
    if (msg) {
      msg.textContent = dados.avisoContador
        ? `Limite salvo. ${dados.avisoContador}`
        : "Saídas permanecem liberadas por este controle.";
      msg.dataset.tipo = dados.avisoContador ? "aviso" : "ok";
    }
  }

  async function carregar() {
    if (!garantirCard()) return;
    try {
      render(await api(`/api/alunos/${encodeURIComponent(alunoId)}/limite-acessos`));
    } catch (erro) {
      const msg = $("alunoLimiteEntradasMsg");
      if (msg) { msg.textContent = erro.message || "Não foi possível carregar o limite de entradas."; msg.dataset.tipo = "erro"; }
    }
  }

  async function salvar() {
    const input = $("alunoLimiteEntradasInput");
    const botao = $("alunoLimiteEntradasSalvar");
    const limite = Number(input?.value);

    if (!Number.isInteger(limite) || limite < 1 || limite > 10) {
      const msg = $("alunoLimiteEntradasMsg");
      if (msg) { msg.textContent = "Informe um número inteiro de 1 a 10."; msg.dataset.tipo = "erro"; }
      input?.focus();
      return;
    }

    if (botao) { botao.disabled = true; botao.textContent = "Salvando..."; }
    try {
      const dados = await api(`/api/alunos/${encodeURIComponent(alunoId)}/limite-acessos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limiteAcessosDiarios: limite })
      });
      render(dados);
      const msg = $("alunoLimiteEntradasMsg");
      if (msg) {
        msg.textContent = `Limite salvo: ${limite} entrada(s) por dia. Saídas não consomem o limite.`;
        msg.dataset.tipo = "ok";
      }
    } catch (erro) {
      const msg = $("alunoLimiteEntradasMsg");
      if (msg) { msg.textContent = erro.message || "Não foi possível salvar o limite."; msg.dataset.tipo = "erro"; }
    } finally {
      if (botao) { botao.disabled = false; botao.textContent = "Salvar limite"; }
    }
  }

  function iniciar() {
    garantirCard();
    carregar();
    document.addEventListener("click", (ev) => {
      if (ev.target.closest?.('[data-tab="acesso"]')) setTimeout(carregar, 80);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
