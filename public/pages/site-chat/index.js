const $ = (id) => document.getElementById(id);
const estado = { conversas: [], conversa: null, mensagens: [] };

function esc(valor){
  return String(valor ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

function dataHora(valor){
  if(!valor) return "-";
  const d = new Date(valor);
  if(Number.isNaN(d.getTime())) return String(valor).slice(0, 16);
  return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function nomeOrigem(origem){
  const mapa = { portal_aluno:"Portal do aluno", matricula_online:"Matricula online", site:"Site" };
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
  if(r === "atendimento") return "Recepcao";
  if(r === "sistema") return "Sistema";
  return msg.nome || "Aluno/visitante";
}

function aplicarFiltros(){
  const busca = String($("busca").value || "").toLowerCase();
  const origem = $("origem").value;
  return estado.conversas.filter(c => {
    if(origem && c.origem !== origem) return false;
    const texto = [c.nome, c.contato, c.protocolo, c.ultimaMensagem, c.assunto].join(" ").toLowerCase();
    return !busca || texto.includes(busca);
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
      ${esc(m.mensagem || "")}
    </div>
  `).join("");
  area.scrollTop = area.scrollHeight;
}

async function carregarConversas(){
  const resp = await fetch("/api/site-chat/conversas", { cache:"no-store" });
  const json = await resp.json().catch(() => ({}));
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
  const resp = await fetch(`/api/site-chat/mensagens?conversaId=${encodeURIComponent(id)}&limite=120`, { cache:"no-store" });
  const json = await resp.json().catch(() => ({}));
  estado.mensagens = json.mensagens || [];
  renderMensagens();
}

async function responder(ev){
  ev.preventDefault();
  if(!estado.conversa) return alert("Selecione uma conversa.");
  const texto = $("textoResposta").value.trim();
  if(!texto) return alert("Digite a resposta.");
  const btn = ev.currentTarget.querySelector("button");
  btn.disabled = true;
  try{
    await fetch("/api/site-chat/mensagens", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        conversaId:estado.conversa.conversaId,
        origem:estado.conversa.origem,
        nome:"Recepcao",
        remetente:"atendimento",
        alunoId:estado.conversa.alunoId || "",
        contato:estado.conversa.contato || "",
        protocolo:estado.conversa.protocolo || "",
        mensagem:texto
      })
    });
    $("textoResposta").value = "";
    await carregarConversas();
    await abrirConversa(estado.conversa.conversaId);
  }finally{
    btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const conversaInicial = new URLSearchParams(location.search).get("conversaId") || "";
  $("btnAtualizar").addEventListener("click", async () => {
    await carregarConversas();
    if(estado.conversa) await abrirConversa(estado.conversa.conversaId);
  });
  $("busca").addEventListener("input", renderConversas);
  $("origem").addEventListener("change", renderConversas);
  $("listaConversas").addEventListener("click", ev => {
    const btn = ev.target.closest("[data-id]");
    if(btn) abrirConversa(btn.dataset.id);
  });
  $("formResposta").addEventListener("submit", responder);
  await carregarConversas();
  if(conversaInicial) await abrirConversa(conversaInicial);
  renderMensagens();
  setInterval(async () => {
    await carregarConversas().catch(() => {});
    if(estado.conversa) await abrirConversa(estado.conversa.conversaId).catch(() => {});
  }, 15000);
});
