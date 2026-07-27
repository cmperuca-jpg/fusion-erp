const $ = id => document.getElementById(id);
let sessao = null;
let statusAtual = null;
let comprovanteBase64 = "";

function moeda(v){ return Number(v || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" }); }
function dataHora(v){ return v ? new Date(v).toLocaleString("pt-BR") : "-"; }
function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function authHeaders(){
  const token = sessao?.token || sessao?.accessToken || sessao?.jwt || "";
  return token ? { Authorization:`Bearer ${token}` } : {};
}
function alunoId(){ return String(new URLSearchParams(location.search).get("alunoId") || sessao?.alunoId || sessao?.id || ""); }
function mensagem(texto, erro=false){ $("mensagem").textContent=texto || ""; $("mensagem").className=`mensagem ${erro?"erro":"ok"}`; }

function carregarSessao(){
  try { sessao = JSON.parse(localStorage.getItem("fusion_aluno_treino_login") || "null"); } catch { sessao=null; }
  if(!sessao || !alunoId()) { location.replace(`/pages/aluno-login/index.html?next=${encodeURIComponent(location.pathname+location.search)}`); return false; }
  $("saudacao").textContent = `Olá, ${sessao.alunoNome || sessao.nome || "aluno"}.`;
  $("linkTreino").href = `/pages/aluno-treinos/index.html?alunoId=${encodeURIComponent(alunoId())}`;
  return true;
}

async function carregar(){
  $("cardPix").classList.add("hidden");
  $("cardStatus").innerHTML='<div class="loading">Consultando situação financeira...</div>';
  try{
    const resp=await fetch(`/api/emergency-access/alunos/${encodeURIComponent(alunoId())}/status`, {cache:"no-store",headers:authHeaders()});
    const json=await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok===false) throw new Error(json.mensagem || "Não foi possível consultar a liberação.");
    statusAtual=json; render();
  }catch(e){ $("cardStatus").innerHTML=`<div class="erro-box">${esc(e.message)}</div>`; }
}

function render(){
  const s=statusAtual;
  if(s.acessoAtivo){
    $("cardStatus").innerHTML=`<h2>Acesso emergencial ativo</h2><p>Seu comprovante já foi enviado. O acesso temporário está registrado até <strong>${esc(dataHora(s.acessoAtivo.acessoValidoAte))}</strong>.</p><p>Esta foi a tentativa da competência ${esc(s.competencia)}.</p>`;
    return;
  }
  if(!s.elegivel){
    $("cardStatus").innerHTML=`<h2>Liberação emergencial indisponível</h2><p>${esc(s.motivo)}</p>${s.tentativa?`<p>Tentativa utilizada em ${esc(dataHora(s.tentativa.criadoEm))}.</p>`:""}`;
    return;
  }
  const d=s.divida.item || {};
  $("cardStatus").innerHTML=`<h2>Mensalidade em atraso</h2><div class="resumo"><div><span>Vencimento</span><strong>${esc(d.vencimento || d.dataVencimento || "-")}</strong></div><div><span>Valor</span><strong>${esc(moeda(d.valorRestante ?? d.saldo ?? d.total ?? d.valorOriginal ?? d.valor))}</strong></div><div><span>Tentativas</span><strong>1 por mês</strong></div></div>`;
  if(!s.pix.configured){
    $("cardStatus").insertAdjacentHTML("beforeend", '<div class="erro-box">PIX ainda não configurado pela academia.</div>');
    return;
  }
  $("pixValor").textContent=moeda(s.pix.value);
  $("pixCodigo").value=s.pix.code;
  $("cardPix").classList.remove("hidden");
}

$("copiarPix").onclick=async()=>{
  try{ await navigator.clipboard.writeText($("pixCodigo").value); mensagem("PIX copiado."); }
  catch{ $("pixCodigo").select(); document.execCommand("copy"); mensagem("PIX copiado."); }
};
$("comprovante").onchange=()=>{
  const file=$("comprovante").files[0]; comprovanteBase64="";
  if(!file) return;
  if(file.size>8*1024*1024){ mensagem("O arquivo deve ter no máximo 8 MB.",true); $("comprovante").value=""; return; }
  const reader=new FileReader();
  reader.onload=()=>{ comprovanteBase64=String(reader.result||""); $("preview").src=comprovanteBase64; $("preview").classList.remove("hidden"); };
  reader.readAsDataURL(file);
};
$("enviar").onclick=async()=>{
  if(!comprovanteBase64) return mensagem("Selecione a imagem do comprovante.",true);
  if(!confirm("Ao enviar, sua única tentativa do mês será consumida e o acesso será liberado automaticamente por 24 horas. Continuar?")) return;
  $("enviar").disabled=true; mensagem("Enviando comprovante e solicitando liberação...");
  try{
    const resp=await fetch("/api/emergency-access/comprovante", {method:"POST",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify({alunoId:alunoId(),comprovanteBase64})});
    const json=await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok===false) throw new Error(json.mensagem || "Falha ao enviar comprovante.");
    mensagem(`Comprovante enviado. Acesso temporário registrado até ${dataHora(json.solicitacao.acessoValidoAte)}.`);
    await carregar();
  }catch(e){ mensagem(e.message,true); }
  finally{ $("enviar").disabled=false; }
};
$("atualizar").onclick=carregar;
$("sair").onclick=()=>{ localStorage.removeItem("fusion_aluno_treino_login"); localStorage.removeItem("fusion_aluno_treino_selecionado"); location.replace("/pages/aluno-login/index.html"); };
if(carregarSessao()) carregar();
