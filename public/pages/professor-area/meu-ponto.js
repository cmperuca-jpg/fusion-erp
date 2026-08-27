// PROFESSOR APP - MEU PONTO / MEUS GANHOS 20260826
(() => {
  const $=id=>document.getElementById(id),t=v=>String(v??"").trim();
  const esc=v=>t(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  let timer=null;
  function sessao(){
    try{const s=window.__FUSION_PROFESSOR_PONTO_SESSAO__;if(s&&typeof s==="object")return s;}catch{}
    for(const st of [localStorage,sessionStorage])for(let i=0;i<st.length;i++){try{const o=JSON.parse(st.getItem(st.key(i))||"null");for(const c of [o,o?.sessao,o?.session,o?.professor,o?.usuario]){if(!c||typeof c!=="object")continue;const professorId=t(c.professorId||o?.professorId||o?.professor?.id||(o?.portalTipo==="professor"?c.id:"")),token=t(c.token||c.accessToken||c.jwt||o?.token||o?.accessToken||o?.jwt);if(professorId&&token)return{...o,...c,professorId,token};}}catch{}}
    return null;
  }
  const fmtMin=(v,sinal=false)=>{let n=Math.round(Number(v)||0),p=sinal?(n>0?"+":n<0?"-":""):(n<0?"-":"");n=Math.abs(n);return`${p}${String(Math.floor(n/60)).padStart(2,"0")}h${String(n%60).padStart(2,"0")}`};
  const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(v)||0)/100);
  const dataBR=v=>{const s=t(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||"-";const[a,m,d]=s.split("-");return`${d}/${m}/${a}`};
  function mes(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Maceio",year:"numeric",month:"2-digit"}).formatToParts(new Date()),o={};for(const x of p)if(x.type!=="literal")o[x.type]=x.value;return `${o.year}-${o.month}`;}
  function garantir(){
    if($("profMeuPonto"))return;
    const alvo=document.querySelector(".content")||document.querySelector("main")||document.querySelector(".portal-app")||document.body,e=document.createElement("section");
    e.id="profMeuPonto";e.className="prof-meu-ponto";e.innerHTML=`
      <div class="pmp-head"><div><small>CONTROLE PESSOAL</small><h2>Meu ponto / Meus ganhos</h2><p>Catraca, banco de horas e horas-aula.</p></div><button id="pmpAtualizar" type="button">Atualizar</button></div>
      <div id="pmpMsg" class="pmp-msg">Carregando...</div>
      <div class="pmp-kpis"><article><span>Status</span><strong id="pmpStatus">-</strong></article><article><span>Trabalhado hoje</span><strong id="pmpTrab">00h00</strong></article><article><span>Tempo fora hoje</span><strong id="pmpFora">00h00</strong></article><article><span>Saldo hoje</span><strong id="pmpSaldo">00h00</strong></article><article><span>Banco de horas</span><strong id="pmpBanco">00h00</strong></article><article><span>Aprovado a receber</span><strong id="pmpReceber">R$ 0,00</strong></article></div>
      <div class="pmp-grid">
        <article class="pmp-card"><div class="pmp-title"><h3>Marcações de hoje</h3><span id="pmpHojeResumo"></span></div><div id="pmpMarcas" class="pmp-list"></div></article>
        <article class="pmp-card"><div class="pmp-title"><h3>Meus ganhos no mês</h3><span id="pmpQtdAulas"></span></div><div class="pmp-money"><div><span>Estimado</span><strong id="pmpEst">R$ 0,00</strong></div><div><span>Em conferência</span><strong id="pmpPend">R$ 0,00</strong></div><div><span>Aprovado</span><strong id="pmpApr">R$ 0,00</strong></div></div><div id="pmpAulas" class="pmp-list"></div></article>
      </div>
      <article class="pmp-card"><div class="pmp-title"><h3>Resumo do mês</h3><span id="pmpMes"></span></div><div class="pmp-money"><div><span>Trabalhado</span><strong id="pmpMesTrab">00h00</strong></div><div><span>Tempo fora</span><strong id="pmpMesFora">00h00</strong></div><div><span>Previsto</span><strong id="pmpMesPrev">00h00</strong></div></div></article>`;
    alvo.appendChild(e);$("pmpAtualizar").onclick=carregar;
  }
  function msg(x,erro=false){$("pmpMsg").textContent=x;$("pmpMsg").className=`pmp-msg${erro?" erro":""}`;}
  async function carregar(){
    garantir();const s=sessao(),pid=t(s?.professorId||s?.professor?.id),token=t(s?.token||s?.accessToken||s?.jwt);
    if(!pid||!token){msg("Sessão do professor não identificada. Entre novamente no App do Professor.",true);return;}
    try{
      const r=await fetch(`/api/professores/${encodeURIComponent(pid)}/ponto?mes=${encodeURIComponent(mes())}`,{cache:"no-store",headers:{Authorization:`Bearer ${token}`}});
      const d=await r.json().catch(()=>({}));if(!r.ok||d?.ok===false)throw new Error(d?.mensagem||d?.erro||`HTTP ${r.status}`);
      const h=d.hoje||{};$("pmpStatus").textContent=h.dentroAgora?"Dentro da academia":(h.marcas?.length?"Fora da academia":"Sem marcação");$("pmpTrab").textContent=fmtMin(h.trabalhadoMinutos);$("pmpFora").textContent=fmtMin(h.foraMinutos);$("pmpSaldo").textContent=fmtMin(h.saldoMinutos,true);$("pmpBanco").textContent=fmtMin(d.banco?.minutos,true);$("pmpReceber").textContent=money(d.horasAula?.valorAprovadoCentavos);
      $("pmpEst").textContent=money(d.horasAula?.valorEstimadoCentavos);$("pmpPend").textContent=money(d.horasAula?.valorPendenteCentavos);$("pmpApr").textContent=money(d.horasAula?.valorAprovadoCentavos);$("pmpQtdAulas").textContent=`${Number(d.horasAula?.horasAulaEquivalentes||0).toFixed(2).replace(".",",")} hora(s)-aula`;
      $("pmpMes").textContent=d.mes;$("pmpMesTrab").textContent=fmtMin(d.resumoMes?.trabalhadoMinutos);$("pmpMesFora").textContent=fmtMin(d.resumoMes?.foraMinutos);$("pmpMesPrev").textContent=fmtMin(d.resumoMes?.previstoMinutos);
      $("pmpHojeResumo").textContent=`${h.primeiraEntrada||"-"} → ${h.ultimaSaida||(h.dentroAgora?"agora":"-")}`;
      $("pmpMarcas").innerHTML=(h.marcas||[]).map(m=>`<div class="pmp-row"><span>${esc(m.hora||"-")}</span><strong>${m.direcao==="saida"?"Saída":"Entrada"}</strong><small>${m.origem==="catraca"?"Catraca":"Ajuste administrativo"}${m.anomalia?` · ${esc(m.anomalia)}`:""}</small></div>`).join("")||'<div class="pmp-empty">Nenhuma marcação hoje.</div>';
      $("pmpAulas").innerHTML=(d.horasAula?.itens||[]).slice(0,12).map(a=>`<div class="pmp-row"><span>${dataBR(a.data)}</span><strong>${esc(a.descricao||"Hora-aula")}</strong><small>${fmtMin(a.minutos)} · ${money(a.valorCentavos)} · ${esc(a.status||"pendente")}</small></div>`).join("")||'<div class="pmp-empty">Nenhuma hora-aula lançada neste mês.</div>';
      msg(d.catraca?.aviso||"Atualizado agora.",!!d.catraca?.aviso);
    }catch(e){msg(e.message||"Não foi possível carregar o ponto.",true);}
  }
  function iniciar(){garantir();setTimeout(carregar,250);timer=setInterval(carregar,30000);addEventListener("pagehide",()=>clearInterval(timer));}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();
})();
