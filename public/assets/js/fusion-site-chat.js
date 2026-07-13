(function(){
  const script = document.currentScript;
  const caminho = location.pathname;
  const origem = script?.dataset.chatOrigem || (caminho.includes("/aluno-treinos") ? "portal_aluno" : (caminho.includes("/matricula-online") ? "matricula_online" : "site"));
  const renderizados = new Set();

  function esc(valor){
    return String(valor ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }

  function gerarId(prefixo){
    if (globalThis.crypto?.randomUUID) return `${prefixo}_${crypto.randomUUID()}`;
    return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function lerSessaoAluno(){
    try {
      const sessao = JSON.parse(localStorage.getItem("fusion_aluno_treino_login") || "null");
      if (sessao?.alunoId) return sessao;
    } catch {}
    const params = new URLSearchParams(location.search);
    const alunoId = params.get("alunoId") || params.get("id") || "";
    const alunoNome = params.get("alunoNome") || params.get("nome") || "";
    return alunoId ? { alunoId, alunoNome } : {};
  }

  function clienteVisitanteId(){
    const chave = `fusion_site_chat_visitante_${origem}`;
    try {
      let valor = sessionStorage.getItem(chave) || "";
      if (!valor) {
        valor = gerarId("visitante");
        sessionStorage.setItem(chave, valor);
      }
      return valor;
    } catch {
      return gerarId("visitante");
    }
  }

  function contexto(){
    if (origem === "portal_aluno") {
      const sessao = lerSessaoAluno();
      return {
        origem,
        remetente:"aluno",
        alunoId:String(sessao.alunoId || ""),
        clienteId:`aluno_${sessao.alunoId || "sem_id"}`,
        nome:sessao.alunoNome || sessao.nome || sessao.nomeCompleto || "Aluno",
        contato:sessao.telefone || sessao.whatsapp || sessao.email || ""
      };
    }

    const nome = document.getElementById("nome")?.value || "";
    const telefone = document.getElementById("telefone")?.value || "";
    const email = document.getElementById("email")?.value || "";
    const cpf = document.getElementById("cpf")?.value || "";
    return {
      origem,
      remetente:"visitante",
      clienteId:clienteVisitanteId(),
      nome:nome || "Visitante",
      contato:telefone || email || cpf || "",
      protocolo:""
    };
  }

  function chaveConversa(ctx = contexto()){
    const participante = ctx.alunoId ? `aluno_${ctx.alunoId}` : ctx.clienteId;
    return `fusion_site_chat_${origem}_${participante || "anonimo"}`;
  }

  function conversaId(ctx = contexto()){
    try { return sessionStorage.getItem(chaveConversa(ctx)) || ""; } catch { return ""; }
  }

  function salvarConversaId(id, ctx = contexto()){
    if (!id) return;
    try { sessionStorage.setItem(chaveConversa(ctx), id); } catch {}
  }

  function limparConversaId(ctx = contexto()){
    try { sessionStorage.removeItem(chaveConversa(ctx)); } catch {}
  }

  function montar(){
    if (document.querySelector(".fusion-site-chat")) return document.querySelector(".fusion-site-chat");

    const el = document.createElement("div");
    el.className = "fusion-site-chat";
    el.innerHTML = `
      <button class="fusion-chat-toggle" type="button">Chat</button>
      <section class="fusion-chat-panel" hidden aria-label="Chat de atendimento">
        <header class="fusion-chat-head">
          <div><strong>Atendimento</strong><span>Pagamentos, recebimentos e horarios</span></div>
          <button class="fusion-chat-close" type="button" aria-label="Fechar">x</button>
        </header>
        <div class="fusion-chat-identificacao" hidden></div>
        <div class="fusion-chat-messages" role="log" aria-live="polite"></div>
        <form class="fusion-chat-form">
          <input class="fusion-chat-nome" placeholder="Seu nome" autocomplete="name">
          <textarea class="fusion-chat-texto" placeholder="Digite sua duvida"></textarea>
          <div class="fusion-chat-status"></div>
          <button type="submit">Enviar</button>
        </form>
      </section>
    `;
    document.body.appendChild(el);
    return el;
  }

  function tipoMensagem(msg){
    const r = String(msg.remetente || "");
    if (r === "atendimento") return "staff";
    if (r === "sistema") return "system";
    return "user";
  }

  function nomeRemetente(msg){
    const r = String(msg.remetente || "");
    if (r === "atendimento") return "Atendimento";
    if (r === "sistema") return "Sistema";
    return msg.nome || "Voce";
  }

  function adicionarMensagem(area, msg){
    const chave = msg.id || `${msg.remetente}-${msg.criadoEm}-${msg.mensagem}`;
    if (renderizados.has(chave)) return;
    renderizados.add(chave);

    const div = document.createElement("div");
    div.className = `fusion-chat-msg ${tipoMensagem(msg)}`;
    div.innerHTML = `<small>${esc(nomeRemetente(msg))}</small>${esc(msg.mensagem || msg.texto || "")}`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  }

  async function carregar(area, ctx = contexto()){
    const id = conversaId(ctx);
    if (!id) return;
    const resp = await fetch(`/api/site-chat/mensagens?conversaId=${encodeURIComponent(id)}&limite=80`, { cache:"no-store" });
    const json = await resp.json().catch(() => ({}));
    (json.mensagens || []).forEach(msg => adicionarMensagem(area, msg));
  }

  async function postar(payload){
    const resp = await fetch("/api/site-chat/mensagens", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify(payload)
    });
    const json = await resp.json().catch(() => ({}));
    return { resp, json };
  }

  async function enviar({ area, form, statusEl, textoEl, nomeEl, botao }){
    const mensagem = textoEl.value.trim();
    if (!mensagem) {
      statusEl.textContent = "Digite uma mensagem.";
      return;
    }

    const ctx = contexto();
    if (origem !== "portal_aluno" && nomeEl.value.trim()) ctx.nome = nomeEl.value.trim();
    let payload = { ...ctx, conversaId:conversaId(ctx), mensagem };

    botao.disabled = true;
    statusEl.textContent = "Enviando...";
    try {
      let { resp, json } = await postar(payload);

      if (resp.status === 409) {
        limparConversaId(ctx);
        payload = { ...ctx, conversaId:"", mensagem };
        ({ resp, json } = await postar(payload));
      }

      if (!resp.ok || json.ok === false) throw new Error(json.erro || "Nao foi possivel enviar.");
      salvarConversaId(json.conversaId, ctx);
      (json.mensagens || []).forEach(msg => adicionarMensagem(area, msg));
      textoEl.value = "";
      statusEl.textContent = "Mensagem enviada.";
      form.dataset.enviado = "1";
    } catch (e) {
      statusEl.textContent = e.message || "Falha ao enviar.";
    } finally {
      botao.disabled = false;
    }
  }

  function iniciar(){
    const root = montar();
    const toggle = root.querySelector(".fusion-chat-toggle");
    const panel = root.querySelector(".fusion-chat-panel");
    const close = root.querySelector(".fusion-chat-close");
    const area = root.querySelector(".fusion-chat-messages");
    const form = root.querySelector(".fusion-chat-form");
    const textoEl = root.querySelector(".fusion-chat-texto");
    const nomeEl = root.querySelector(".fusion-chat-nome");
    const identificacaoEl = root.querySelector(".fusion-chat-identificacao");
    const statusEl = root.querySelector(".fusion-chat-status");
    const botao = form.querySelector("button[type='submit']");
    const ctx = contexto();

    if (origem === "portal_aluno") {
      nomeEl.hidden = true;
      nomeEl.required = false;
      identificacaoEl.hidden = false;
      identificacaoEl.textContent = `Aluno: ${ctx.nome}${ctx.alunoId ? ` | Codigo: ${ctx.alunoId}` : ""}`;
    } else {
      nomeEl.value = ctx.nome && ctx.nome !== "Visitante" ? ctx.nome : "";
    }

    toggle.addEventListener("click", async () => {
      panel.hidden = false;
      toggle.hidden = true;
      await carregar(area, contexto()).catch(() => {});
      textoEl.focus();
    });

    close.addEventListener("click", () => {
      panel.hidden = true;
      toggle.hidden = false;
    });

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      enviar({ area, form, statusEl, textoEl, nomeEl, botao });
    });

    setInterval(() => {
      const atual = contexto();
      if (!panel.hidden && conversaId(atual)) carregar(area, atual).catch(() => {});
    }, 10000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
