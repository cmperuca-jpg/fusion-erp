// PROFESSOR PONTO ADMIN 20260826
(() => {
  const DIAS=[["segunda","Segunda"],["terca","Terça"],["quarta","Quarta"],["quinta","Quinta"],["sexta","Sexta"],["sabado","Sábado"],["domingo","Domingo"]];
  let pid="",dados=null,timer=null;
  // PROFESSOR PONTO PRESERVAR EDICAO MINIFICADO 20260826
  let ppConfigSuja=false,ppSalvandoConfig=false;
  const $=id=>document.getElementById(id), t=v=>String(v??"").trim();
  const esc=v=>t(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  function hoje(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Maceio",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),o={};for(const x of p)if(x.type!=="literal")o[x.type]=x.value;return `${o.year}-${o.month}-${o.day}`;}
  const mes=()=>hoje().slice(0,7);
  function idTela(){for(const s of ["#id","#professorId","#idProfessor",'input[name="id"]','input[name="professorId"]']){const v=t(document.querySelector(s)?.value);if(v)return v;}return "";}
  const fmtMin=(v,sinal=false)=>{let n=Math.round(Number(v)||0),p=sinal?(n>0?"+":n<0?"-":""):(n<0?"-":"");n=Math.abs(n);return `${p}${String(Math.floor(n/60)).padStart(2,"0")}h${String(n%60).padStart(2,"0")}`};
  const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(v)||0)/100);
  const dataBR=v=>{const s=t(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||"-";const[a,m,d]=s.split("-");return `${d}/${m}/${a}`};
  function fetchAuth(url,o={}){return (window.FusionAuth?.fetchAuth?window.FusionAuth.fetchAuth.bind(window.FusionAuth):fetch)(url,{cache:"no-store",...o});}
  async function api(url,o={}){const r=await fetchAuth(url,o),j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw new Error(j?.mensagem||j?.erro||`HTTP ${r.status}`);return j;}
  function msg(x="",erro=false){const e=$("ppMsg");if(!e)return;e.hidden=!x;e.textContent=x;e.className=`pp-msg${erro?" erro":""}`;}
  function jornadaHtml(){return DIAS.map(([k,n])=>`<div class="pp-jrow"><strong>${n}</strong>${[1,2].map(i=>`<input type="time" data-j="${k}-${i}-i"><input type="time" data-j="${k}-${i}-f">`).join("")}</div>`).join("");}
  function garantir(){
    const tab=$("tab-prontuario"); if(!tab||$("profPontoProntuario"))return;
    const e=document.createElement("section");e.id="profPontoProntuario";e.className="pp-shell";e.innerHTML=`
      <div class="pp-head"><div><small>CONTROLE DO PROFISSIONAL</small><h3>Ponto, banco de horas e remuneração</h3><p>Catraca física + ajustes auditados + horas-aula.</p></div><div><input id="ppMes" type="month" value="${mes()}"><button id="ppAtualizar" class="pp-btn sec" type="button">Atualizar</button></div></div>
      <div id="ppMsg" class="pp-msg" hidden></div>
      <div class="pp-kpis">
        <article><span>Status agora</span><strong id="ppStatus">-</strong></article><article><span>1ª entrada</span><strong id="ppEntrada">-</strong></article>
        <article><span>Última saída</span><strong id="ppSaida">-</strong></article><article><span>Trabalhado hoje</span><strong id="ppTrab">00h00</strong></article>
        <article><span>Tempo fora hoje</span><strong id="ppFora">00h00</strong></article><article><span>Saldo hoje</span><strong id="ppSaldo">00h00</strong></article>
        <article><span>Banco de horas</span><strong id="ppBanco">00h00</strong></article><article><span>Aprovado a receber</span><strong id="ppReceber">R$ 0,00</strong></article>
      </div>
      <details class="pp-card" open><summary>Jornada e remuneração</summary>
        <div class="pp-config">
          <label class="check"><input id="ppAtivo" type="checkbox"> Controlar ponto pela catraca</label>
          <label>Início da apuração<input id="ppInicio" type="date"></label><label>Tolerância (min)<input id="ppTol" type="number" min="0" max="60"></label>
          <label>Banco inicial (horas)<input id="ppBancoInicial" type="number" step=".25"></label>
          <label>Valor hora-aula (R$)<input id="ppValorAula" inputmode="decimal"></label><label>Duração hora-aula (min)<input id="ppDurAula" type="number" min="15" max="240"></label>
        </div>
        <div class="pp-jhead"><span>Dia</span><span>Entrada 1</span><span>Saída 1</span><span>Entrada 2</span><span>Saída 2</span></div><div class="pp-jornada">${jornadaHtml()}</div>
        <div class="pp-actions"><button id="ppSalvarConfig" class="pp-btn" type="button">Salvar jornada e remuneração</button></div>
      </details>
      <div class="pp-cols">
        <section class="pp-card"><h4>Ajuste manual de marcação</h4><p>A catraca original não é alterada.</p><div class="pp-form">
          <label>Data<input id="ppMData" type="date" value="${hoje()}"></label><label>Hora<input id="ppMHora" type="time"></label>
          <label>Movimento<select id="ppMDir"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
          <label class="full">Motivo<input id="ppMMotivo" placeholder="Motivo obrigatório"></label></div><button id="ppMSalvar" class="pp-btn" type="button">Adicionar marcação</button>
        </section>
        <section class="pp-card"><h4>Ajuste do banco de horas</h4><p>Abono ou compensação administrativa.</p><div class="pp-form">
          <label>Data<input id="ppBData" type="date" value="${hoje()}"></label><label>Horas (+/-)<input id="ppBHoras" type="number" step=".25"></label>
          <label class="full">Motivo<input id="ppBMotivo" placeholder="Motivo obrigatório"></label></div><button id="ppBSalvar" class="pp-btn" type="button">Lançar ajuste</button>
        </section>
      </div>
      <section class="pp-card"><div class="pp-section"><div><h4>Horas-aula / valor a receber</h4><p>Não é calculado pelo tempo dentro da academia.</p></div><div class="pp-resumo"><span>Estimado <strong id="ppEst">R$ 0,00</strong></span><span>Pendente <strong id="ppPend">R$ 0,00</strong></span><span>Aprovado <strong id="ppApr">R$ 0,00</strong></span></div></div>
        <div class="pp-aulaform"><label>Data<input id="ppAData" type="date" value="${hoje()}"></label><label>Horas-aula<input id="ppAQtd" type="number" min=".1" step=".25" value="1"></label><label>Descrição<input id="ppADesc" placeholder="Ex.: Aula funcional 19h"></label><button id="ppASalvar" class="pp-btn" type="button">Lançar</button></div>
        <div class="pp-table"><table><thead><tr><th>Data</th><th>Descrição</th><th>Duração</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody id="ppAulas"></tbody></table></div>
      </section>
      <section class="pp-card"><div class="pp-section"><div><h4>Espelho de ponto do mês</h4><p>CATRACA = físico; AJUSTE = administrativo.</p></div><div class="pp-resumo"><span>Trabalhado <strong id="ppMesTrab">00h00</strong></span><span>Fora <strong id="ppMesFora">00h00</strong></span><span>Previsto <strong id="ppMesPrev">00h00</strong></span></div></div>
        <div class="pp-table"><table><thead><tr><th>Data</th><th>Dia</th><th>Status</th><th>Entrada</th><th>Saída</th><th>Trabalhado</th><th>Fora</th><th>Previsto</th><th>Saldo</th></tr></thead><tbody id="ppDias"></tbody></table></div>
        <h4 class="pp-sub">Marcações do mês</h4><div class="pp-table"><table><thead><tr><th>Data</th><th>Hora</th><th>Movimento</th><th>Origem</th><th>Motivo</th></tr></thead><tbody id="ppMarcas"></tbody></table></div>
      </section>`;
    tab.appendChild(e);
    $("ppAtualizar").onclick=()=>{if(ppConfigSuja&&!confirm("Existem alterações de jornada/remuneração não salvas. Descartar e atualizar?"))return;ppConfigSuja=false;carregar(true);};
    $("ppMes").onchange=()=>{if(ppConfigSuja){msg("Salve a jornada/remuneração antes de trocar o mês.",true);return;}carregar(true);};
    $("ppSalvarConfig").onclick=salvarConfig;$("ppMSalvar").onclick=salvarMarcacao;$("ppBSalvar").onclick=salvarBanco;$("ppASalvar").onclick=salvarAula;$("ppAulas").onclick=acaoAula;
    e.addEventListener("input",ev=>{if(ev.target?.matches?.("#ppAtivo,#ppInicio,#ppTol,#ppBancoInicial,#ppValorAula,#ppDurAula,[data-j]"))ppConfigSuja=true;});
    e.addEventListener("change",ev=>{if(ev.target?.matches?.("#ppAtivo,#ppInicio,#ppTol,#ppBancoInicial,#ppValorAula,#ppDurAula,[data-j]"))ppConfigSuja=true;});
  }
  function renderConfig(c={}){
    $("ppAtivo").checked=c.controlePontoAtivo===true;$("ppInicio").value=c.inicioApuracao||hoje();$("ppTol").value=Number(c.toleranciaMinutos??5);
    $("ppBancoInicial").value=((Number(c.bancoInicialMinutos)||0)/60).toFixed(2);$("ppValorAula").value=((Number(c.valorHoraAulaCentavos)||0)/100).toFixed(2).replace(".",",");$("ppDurAula").value=Number(c.duracaoHoraAulaMinutos||60);
    for(const[d]of DIAS){const s=Array.isArray(c.jornada?.[d])?c.jornada[d]:[];for(let i=1;i<=2;i++){document.querySelector(`[data-j="${d}-${i}-i"]`).value=s[i-1]?.inicio||"";document.querySelector(`[data-j="${d}-${i}-f"]`).value=s[i-1]?.fim||"";}}
  }
  function render(d){dados=d;const h=d.hoje||{};
    $("ppStatus").textContent=h.dentroAgora?"Dentro da academia":(h.marcas?.length?"Fora da academia":"Sem marcação");$("ppEntrada").textContent=h.primeiraEntrada||"-";$("ppSaida").textContent=h.ultimaSaida||"-";$("ppTrab").textContent=fmtMin(h.trabalhadoMinutos);$("ppFora").textContent=fmtMin(h.foraMinutos);$("ppSaldo").textContent=fmtMin(h.saldoMinutos,true);$("ppBanco").textContent=fmtMin(d.banco?.minutos,true);$("ppReceber").textContent=money(d.horasAula?.valorAprovadoCentavos);
    $("ppEst").textContent=money(d.horasAula?.valorEstimadoCentavos);$("ppPend").textContent=money(d.horasAula?.valorPendenteCentavos);$("ppApr").textContent=money(d.horasAula?.valorAprovadoCentavos);$("ppMesTrab").textContent=fmtMin(d.resumoMes?.trabalhadoMinutos);$("ppMesFora").textContent=fmtMin(d.resumoMes?.foraMinutos);$("ppMesPrev").textContent=fmtMin(d.resumoMes?.previstoMinutos);renderConfig(d.config);
    const status=x=>({dentro:"Dentro",fechado:"Fechado",incompleto:"Incompleto",sem_marcacao:"Sem marcação",folga:"Folga"}[x.status]||x.status||"-");
    $("ppDias").innerHTML=(d.dias||[]).slice().reverse().map(x=>`<tr><td>${dataBR(x.data)}</td><td>${esc(x.diaSemana)}</td><td><span class="tag ${esc(x.status)}">${status(x)}</span>${x.anomalias?.length?`<small>${esc(x.anomalias.join(" · "))}</small>`:""}</td><td>${esc(x.primeiraEntrada||"-")}</td><td>${esc(x.ultimaSaida||"-")}</td><td>${fmtMin(x.trabalhadoMinutos)}</td><td>${fmtMin(x.foraMinutos)}</td><td>${fmtMin(x.previstoMinutos)}</td><td>${fmtMin(x.saldoMinutos,true)}${x.computaBanco?"":"<small>não fechado no banco</small>"}</td></tr>`).join("")||'<tr><td colspan="9">Nenhum dia apurado.</td></tr>';
    $("ppMarcas").innerHTML=(d.marcacoes||[]).slice().reverse().map(x=>`<tr><td>${dataBR(x.data)}</td><td>${esc(x.hora)}</td><td>${x.direcao==="saida"?"Saída":"Entrada"}</td><td><span class="tag ${x.origem==="catraca"?"catraca":"ajuste"}">${x.origem==="catraca"?"CATRACA":"AJUSTE"}</span></td><td>${esc(x.motivo||"-")}</td></tr>`).join("")||'<tr><td colspan="5">Nenhuma marcação.</td></tr>';
    $("ppAulas").innerHTML=(d.horasAula?.itens||[]).map(a=>`<tr><td>${dataBR(a.data)}</td><td>${esc(a.descricao)}</td><td>${fmtMin(a.minutos)}</td><td>${money(a.valorCentavos)}</td><td><span class="tag ${esc(a.status)}">${esc(a.status)}</span></td><td>${a.status!=="aprovado"?`<button data-aula="${esc(a.id)}" data-st="aprovado">Aprovar</button>`:""} ${a.status!=="cancelado"?`<button class="danger" data-aula="${esc(a.id)}" data-st="cancelado">Cancelar</button>`:""}</td></tr>`).join("")||'<tr><td colspan="6">Nenhuma hora-aula lançada.</td></tr>';
    msg(d.catraca?.aviso||"",!!d.catraca?.aviso);
  }
  async function carregar(forcar=false){garantir();if(!forcar&&(ppConfigSuja||ppSalvandoConfig))return;const id=idTela();if(!id){pid="";msg("Salve ou selecione um professor para carregar o ponto.",true);return;}pid=id;try{const d=await api(`/api/professores/${encodeURIComponent(id)}/ponto?mes=${encodeURIComponent($("ppMes")?.value||mes())}`);if(id===idTela()){render(d);if(forcar)ppConfigSuja=false;}}catch(e){msg(e.message,true);}}
  function coletarJornada(){const j={};for(const[d]of DIAS){j[d]=[];for(let i=1;i<=2;i++){const a=t(document.querySelector(`[data-j="${d}-${i}-i"]`)?.value),b=t(document.querySelector(`[data-j="${d}-${i}-f"]`)?.value);if(a&&b)j[d].push({inicio:a,fim:b});}}return j;}
  function reais(v){let s=t(v).replace(/[R$\s]/g,"");if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");else s=s.replace(/[^\d.-]/g,"");const n=Number(s);return Number.isFinite(n)?n:0;}
  async function salvarConfig(){if(!pid)return;ppSalvandoConfig=true;const payload={controlePontoAtivo:$("ppAtivo").checked,inicioApuracao:$("ppInicio").value,toleranciaMinutos:Number($("ppTol").value||0),bancoInicialMinutos:Math.round(Number($("ppBancoInicial").value||0)*60),valorHoraAulaCentavos:Math.round(reais($("ppValorAula").value)*100),duracaoHoraAulaMinutos:Number($("ppDurAula").value||60),jornada:coletarJornada()};try{await api(`/api/professores/${encodeURIComponent(pid)}/ponto/config`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});ppConfigSuja=false;msg("Jornada e remuneração salvas.");await carregar(true);}catch(e){ppConfigSuja=true;msg(e.message,true);}finally{ppSalvandoConfig=false;}}
  async function salvarMarcacao(){if(!pid)return;try{await api(`/api/professores/${encodeURIComponent(pid)}/ponto/marcacoes`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:$("ppMData").value,hora:$("ppMHora").value,direcao:$("ppMDir").value,motivo:$("ppMMotivo").value})});$("ppMMotivo").value="";msg("Marcação ajustada adicionada sem alterar a catraca.");await carregar();}catch(e){msg(e.message,true);}}
  async function salvarBanco(){if(!pid)return;try{await api(`/api/professores/${encodeURIComponent(pid)}/ponto/banco-ajustes`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:$("ppBData").value,minutos:Math.round(Number($("ppBHoras").value||0)*60),motivo:$("ppBMotivo").value})});$("ppBHoras").value="";$("ppBMotivo").value="";await carregar();}catch(e){msg(e.message,true);}}
  async function salvarAula(){if(!pid||!dados)return;const minutos=Math.round(Number($("ppAQtd").value||0)*Number(dados.config?.duracaoHoraAulaMinutos||60));try{await api(`/api/professores/${encodeURIComponent(pid)}/ponto/horas-aula`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:$("ppAData").value,minutos,descricao:$("ppADesc").value})});$("ppADesc").value="";await carregar();}catch(e){msg(e.message,true);}}
  async function acaoAula(ev){const b=ev.target.closest("[data-aula]");if(!b||!pid)return;if(b.dataset.st==="cancelado"&&!confirm("Cancelar este lançamento?"))return;try{await api(`/api/professores/${encodeURIComponent(pid)}/ponto/horas-aula/${encodeURIComponent(b.dataset.aula)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:b.dataset.st})});await carregar();}catch(e){msg(e.message,true);}}
  function iniciar(){garantir();document.addEventListener("click",e=>{if(e.target.closest('button.tab[data-tab="prontuario"]'))setTimeout(carregar,120);});const mo=new MutationObserver(()=>{if(!$("profPontoProntuario"))garantir();});mo.observe(document.documentElement,{subtree:true,childList:true});timer=setInterval(()=>{const painel=$("profPontoProntuario"),focoConfig=painel?.contains(document.activeElement)&&document.activeElement?.matches?.("#ppAtivo,#ppInicio,#ppTol,#ppBancoInicial,#ppValorAula,#ppDurAula,[data-j]");if($("tab-prontuario")?.classList.contains("active")&&pid&&!ppConfigSuja&&!ppSalvandoConfig&&!focoConfig)carregar(false);},30000);addEventListener("pagehide",()=>{clearInterval(timer);mo.disconnect();});}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();
})();
