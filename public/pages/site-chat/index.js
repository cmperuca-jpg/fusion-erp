const $ = (id) => document.getElementById(id);
const estado = { conversas: [], conversa: null, mensagens: [] };

function esc(valor){
  return String(valor ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

function fetchAutenticado(url, opcoes = {}){
  const fn = window.FusionAuth?.fetchAuth
    ? window.FusionAuth.fetchAuth.bind(window.FusionAuth)
    : window.fetch.bind(window);
  return fn(url, { cache:"no-store", ...opcoes });
}

async function jsonObrigatorio(resp, mensagemPadrao){
  const json = await resp.json().catch(() => ({}));
  if(!resp.ok || json.ok === false){
    throw new Error(json.erro || json.mensagem || mensagemPadrao);
  }
  return json;
}

function dataHora(valor){
  if(!valor) return "-";
  const d = new Date(valor);
  if(Number.isNaN(d.getTime())) return String(valor).slice(0, 16);
  return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function nomeOrigem(origem){
  const mapa = {
    portal_aluno:"Portal do aluno",
    portal_professor:"Portal do professor",
    matricula_online:"Matrícula online",
    promocao:"Promoções",
    site:"Site"
  };
  return mapa[origem] || origem || "Site";
}

function tipoMsg(msg){
  const r = String(msg.remetente || "");
  if(r === "atendimento") return "atendimento";
  if(r === "sistema") return "sistema";
  return "usuario";
}

function nomeRemetente(msg){
  const r = String(msg.remetente || "");
  if(r === "atendimento") return msg.operadorNome || "Recepção";
  if(r === "sistema") return "Sistema";
  return msg.nome || "Aluno/visitante";
}

function aplicarFiltros(){
  const busca = String($("busca").value || "").toLowerCase();
  const origem = $("origem").value;
  return estado.conversas.filter(c => {
    if(origem && c.origem !== origem) return false;
    const textoBusca = [c.nome, c.contato, c.protocolo, c.ultimaMensagem, c.assunto].join(" ").toLowerCase();
    return !busca || textoBusca.includes(busca);
  });
}

function renderConversas(){
  const lista = $("listaConversas");
  const dados = aplicarFiltros();
  if(!dados.length){
    lista.innerHTML = `<div class="empty">Nenhuma conversa encontrada.</div>`;
    return;
  }
  lista.innerHTML = dados.map(c => `
    <button class="conversa-item ${estado.conversa?.conversaId === c.conversaId ? "ativa" : ""}" data-id="${esc(c.conversaId)}" type="button">
      <strong>${esc(c.nome || "Sem nome")}</strong>
      <span>${esc(c.ultimaMensagem || "")}</span>
      <div class="conversa-meta"><em>${esc(nomeOrigem(c.origem))}</em><em>${esc(dataHora(c.atualizadoEm))}</em></div>
    </button>
  `).join("");
}

function renderCabecalho(){
  const el = $("cabecalhoConversa");
  if(!estado.conversa){
    el.innerHTML = `<strong>Selecione uma conversa</strong><span>As mensagens de alunos e visitantes aparecem aqui.</span>`;
    return;
  }
  el.innerHTML = `<strong>${esc(estado.conversa.nome || "Sem nome")}</strong><span>${esc(nomeOrigem(estado.conversa.origem))} | ${esc(estado.conversa.contato || estado.conversa.protocolo || "sem contato")}</span>`;
}

function renderConteudoMensagem(m){
  const texto = String(m.mensagem || "");
  const url = texto.match(/Comprovante:\s*(\/uploads\/emergency-receipts\/[^\s]+)/i)?.[1] || "";
  const solicitacao = texto.match(/Solicitação:\s*([^\s]+)/i)?.[1] || "";
  const corpo = `<div>${esc(texto).replace(/\n/g,"<br>")}</div>`;
  const imagem = url ? `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="Comprovante" style="max-width:280px;max-height:280px;border-radius:10px;margin-top:8px;display:block"></a>` : "";
  const acoes = solicitacao ? `<div class="emerg-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" data-emerg-action="confirmado" data-emerg-id="${esc(solicitacao)}">Confirmar pagamento</button><button type="button" data-emerg-action="recusado" data-emerg-id="${esc(solicitacao)}">Recusar</button><button type="button" data-emerg-action="baixado" data-emerg-id="${esc(solicitacao)}">Marcar como baixado</button></div>` : "";
  return corpo + imagem + acoes;
}

async function acaoEmergencial(id, acao){
  const resp = await fetchAutenticado(`/api/emergency-access/solicitacoes/${encodeURIComponent(id)}/${encodeURIComponent(acao)}`, {
    method:"POST",
    headers:{"Content-Type":"application/json"}
  });
  await jsonObrigatorio(resp, "Não foi possível atualizar a solicitação.");
  await abrirConversa(estado.conversa.conversaId);
}

function renderMensagens(){
  const area = $("mensagens");
  if(!estado.conversa){
    area.innerHTML = `<div class="empty">Selecione uma conversa na lista.</div>`;
    return;
  }
  if(!estado.mensagens.length){
    area.innerHTML = `<div class="empty">Nenhuma mensagem registrada.</div>`;
    return;
  }
  area.innerHTML = estado.mensagens.map(m => `
    <div class="msg ${esc(tipoMsg(m))}">
      <small>${esc(nomeRemetente(m))} | ${esc(dataHora(m.criadoEm))}</small>
      ${renderConteudoMensagem(m)}
    </div>
  `).join("");
  area.scrollTop = area.scrollHeight;
}

async function carregarConversas(){
  const resp = await fetchAutenticado("/api/site-chat/conversas");
  const json = await jsonObrigatorio(resp, "Não foi possível carregar as conversas.");
  estado.conversas = json.conversas || [];
  if(estado.conversa){
    estado.conversa = estado.conversas.find(c => c.conversaId === estado.conversa.conversaId) || estado.conversa;
  }
  renderConversas();
  renderCabecalho();
}

async function abrirConversa(id){
  estado.conversa = estado.conversas.find(c => c.conversaId === id) || null;
  renderConversas();
  renderCabecalho();
  if(!estado.conversa){
    estado.mensagens = [];
    renderMensagens();
    return;
  }

  const resp = await fetchAutenticado(`/api/site-chat/mensagens?conversaId=${encodeURIComponent(id)}&limite=120`);
  const json = await jsonObrigatorio(resp, "Não foi possível carregar as mensagens.");
  estado.mensagens = json.mensagens || [];
  renderMensagens();

  await fetchAutenticado(`/api/site-chat/conversas/${encodeURIComponent(id)}/leitura`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ leitor:"atendimento" })
  }).catch(() => {});
}

async function responder(ev){
  ev.preventDefault();
  if(!estado.conversa) return alert("Selecione uma conversa.");
  const texto = $("textoResposta").value.trim();
  if(!texto) return alert("Digite a resposta.");
  const btn = ev.currentTarget.querySelector("button");
  btn.disabled = true;
  try{
    const resp = await fetchAutenticado("/api/site-chat/mensagens", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        conversaId:estado.conversa.conversaId,
        origem:estado.conversa.origem,
        nome:"Recepção",
        remetente:"atendimento",
        alunoId:estado.conversa.alunoId || "",
        professorId:estado.conversa.professorId || "",
        clienteId:estado.conversa.clienteId || "",
        contato:estado.conversa.contato || "",
        protocolo:estado.conversa.protocolo || "",
        mensagem:texto
      })
    });
    await jsonObrigatorio(resp, "Não foi possível enviar a resposta.");
    $("textoResposta").value = "";
    const conversaId = estado.conversa.conversaId;
    await carregarConversas();
    await abrirConversa(conversaId);
  }catch(e){
    alert(e.message || "Erro ao responder.");
  }finally{
    btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const conversaInicial = new URLSearchParams(location.search).get("conversaId") || "";

  // Um link vindo do sino deve localizar a conversa independentemente do filtro salvo pelo navegador.
  if(conversaInicial && $("origem")) $("origem").value = "";

  $("btnAtualizar").addEventListener("click", async () => {
    try{
      await carregarConversas();
      if(estado.conversa) await abrirConversa(estado.conversa.conversaId);
    }catch(e){
      alert(e.message || "Erro ao atualizar o chat.");
    }
  });
  $("busca").addEventListener("input", renderConversas);
  $("origem").addEventListener("change", renderConversas);
  $("listaConversas").addEventListener("click", ev => {
    const btn = ev.target.closest("[data-id]");
    if(btn) abrirConversa(btn.dataset.id).catch(e => alert(e.message || "Erro ao abrir a conversa."));
  });
  $("formResposta").addEventListener("submit", responder);

  try{
    await carregarConversas();
    if(conversaInicial) await abrirConversa(conversaInicial);
    renderMensagens();
  }catch(e){
    $("listaConversas").innerHTML = `<div class="empty">${esc(e.message || "Erro ao carregar o chat.")}</div>`;
  }

  setInterval(async () => {
    try{
      const conversaId = estado.conversa?.conversaId || "";
      await carregarConversas();
      if(conversaId) await abrirConversa(conversaId);
    }catch{}
  }, 15000);
});

document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-emerg-action]");
  if(!btn) return;
  btn.disabled = true;
  try { await acaoEmergencial(btn.dataset.emergId, btn.dataset.emergAction); }
  catch(e){ alert(e.message || "Erro ao atualizar solicitação."); }
  finally { btn.disabled = false; }
});
