(function(){
  "use strict";
  if (window.__FusionNotificacoesLoaded) return;
  window.__FusionNotificacoesLoaded = true;

  const API = "/api/notificacoes";
  const INTERVALO = 12000;
  const conhecidos = new Set();
  let primeiraCarga = true;
  let painelAberto = false;
  let dadosAtuais = [];
  let timerToast = null;

  function esc(valor){
    return String(valor ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function dataHora(valor){
    const d = new Date(valor || "");
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
  }

  function requisicao(url, opcoes = {}){
    if (window.FusionAuth?.fetchAuth) return FusionAuth.fetchAuth(url, opcoes);
    return fetch(url, opcoes);
  }

  function garantirRaiz(){
    let raiz = document.getElementById("fusionNotificacoes");
    if (raiz) return raiz;
    const alvo = document.querySelector(".fusion-sidebar-notificacoes,.fusion-topbar>div:last-child,.usuario-topo,.fusion-userbar,.topbar>div:last-child");
    if (!alvo) return null;
    raiz = document.createElement("div");
    raiz.id = "fusionNotificacoes";
    raiz.className = "fusion-notificacoes";
    raiz.innerHTML = `
      <button class="fusion-notificacoes-bell" type="button" aria-label="Abrir notificações" title="Notificações"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="fusion-notificacoes-badge" hidden>0</span></button>
      <section class="fusion-notificacoes-panel" hidden>
        <header class="fusion-notificacoes-head"><strong>Notificações</strong><div><button type="button" data-ativar>Ativar avisos</button> <button type="button" data-ler-todas>Marcar lidas</button></div></header>
        <div class="fusion-notificacoes-lista"><div class="fusion-notificacoes-vazio">Carregando...</div></div>
      </section>`;
    alvo.prepend(raiz);
    raiz.querySelector(".fusion-notificacoes-bell").addEventListener("click", () => {
      painelAberto = !painelAberto;
      raiz.querySelector(".fusion-notificacoes-panel").hidden = !painelAberto;
      if (painelAberto) carregar(true);
    });
    raiz.querySelector("[data-ler-todas]").addEventListener("click", marcarTodas);
    raiz.querySelector("[data-ativar]").addEventListener("click", ativarAvisos);
    document.addEventListener("click", evento => {
      if (painelAberto && !raiz.contains(evento.target)) {
        painelAberto = false;
        raiz.querySelector(".fusion-notificacoes-panel").hidden = true;
      }
    });
    return raiz;
  }

  function renderizar(payload){
    const raiz = garantirRaiz();
    if (!raiz) return;
    dadosAtuais = Array.isArray(payload.notificacoes) ? payload.notificacoes : [];
    const badge = raiz.querySelector(".fusion-notificacoes-badge");
    const total = Number(payload.naoLidas || 0);
    badge.textContent = total > 99 ? "99+" : String(total);
    badge.hidden = total < 1;
    const lista = raiz.querySelector(".fusion-notificacoes-lista");
    if (!dadosAtuais.length) {
      lista.innerHTML = '<div class="fusion-notificacoes-vazio">Nenhuma notificação.</div>';
      return;
    }
    lista.innerHTML = dadosAtuais.map(item => `
      <button type="button" class="fusion-notificacao-item ${item.lida ? "lida" : ""} prioridade-${esc(item.prioridade)}" data-id="${esc(item.id)}">
        <i class="fusion-notificacao-dot"></i>
        <span class="fusion-notificacao-conteudo"><strong>${esc(item.titulo)}</strong><span>${esc(item.mensagem)}</span><small>${esc(dataHora(item.criadoEm))}</small></span>
      </button>`).join("");
    lista.querySelectorAll("[data-id]").forEach(botao => botao.addEventListener("click", () => abrirNotificacao(botao.dataset.id)));
  }

  function tocarSom(){
    if (localStorage.getItem("fusion_notificacoes_som") === "0") return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 740;
      gain.gain.setValueAtTime(.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .24);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .25);
    } catch {}
  }

  function toast(item){
    document.querySelector(".fusion-notificacao-toast")?.remove();
    const el = document.createElement("div");
    el.className = `fusion-notificacao-toast ${item.prioridade === "alta" ? "alta" : ""}`;
    el.innerHTML = `<strong>${esc(item.titulo)}</strong><span>${esc(item.mensagem)}</span>`;
    el.addEventListener("click", () => abrirNotificacao(item.id));
    document.body.appendChild(el);
    clearTimeout(timerToast);
    timerToast = setTimeout(() => el.remove(), 9000);
    tocarSom();
    if (window.Notification?.permission === "granted" && document.hidden) {
      const aviso = new Notification(item.titulo, { body:item.mensagem, tag:item.eventoId || item.id });
      aviso.onclick = () => { window.focus(); abrirNotificacao(item.id); aviso.close(); };
    }
  }

  async function carregar(silencioso = false){
    if (!window.FusionAuth?.estaLogado?.()) return;
    try {
      const resp = await requisicao(`${API}?limite=50`, { cache:"no-store" });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json.ok === false) throw new Error(json.mensagem || "Erro ao carregar notificações.");
      const recebidas = Array.isArray(json.notificacoes) ? json.notificacoes : [];
      if (!primeiraCarga) {
        const novas = recebidas.filter(item => !item.lida && !conhecidos.has(item.id));
        if (novas[0]) toast(novas[0]);
      }
      recebidas.forEach(item => conhecidos.add(item.id));
      primeiraCarga = false;
      renderizar(json);
    } catch (erro) {
      if (!silencioso) console.warn("[Notificações]", erro.message);
    }
  }

  async function abrirNotificacao(id){
    const item = dadosAtuais.find(n => String(n.id) === String(id));
    if (!item) return;
    if (!item.lida) await requisicao(`${API}/${encodeURIComponent(id)}/ler`, { method:"POST" }).catch(() => null);
    if (item.link) location.href = item.link;
    else carregar(true);
  }

  async function marcarTodas(){
    await requisicao(`${API}/ler-todas`, { method:"POST" }).catch(() => null);
    await carregar(true);
  }

  async function ativarAvisos(){
    localStorage.setItem("fusion_notificacoes_som", "1");
    tocarSom();
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  }

  function iniciar(){
    if (window.FusionAuth?.estaLogado && !window.FusionAuth.estaLogado()) return;
    if (!garantirRaiz()) {
      setTimeout(iniciar, 400);
      return;
    }
    carregar(true);
    setInterval(() => carregar(true), INTERVALO);
    window.addEventListener("focus", () => carregar(true));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) carregar(true); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
