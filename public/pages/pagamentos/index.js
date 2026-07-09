import {
  listarPagamentos,
  criarPagamento,
  baixarPagamento,
  estornarPagamento,
  cancelarPagamento,
  obterBaseAtiva,
  diagnosticarPagamentos
} from "./api.js";

const estado = { registros: [], filtrados: [], pagina: 1, porPagina: 12, resumoApi: null, sortCampo: 'vencimento', sortDir: 'asc', selecionados: new Set(), detalheId: null };
const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

function hojeIso(){return new Date().toISOString().slice(0,10)}
function somarDiasIso(iso,dias){const d=new Date(`${iso}T00:00:00`);d.setDate(d.getDate()+dias);return d.toISOString().slice(0,10)}
function somarMesesIso(iso,meses){const d=new Date(`${iso}T00:00:00`);d.setMonth(d.getMonth()+meses);return d.toISOString().slice(0,10)}
function calcularVencimentoParcela(vencimento,indice,recorrencia){
  if(indice<=0)return vencimento;
  if(recorrencia==="semanal")return somarDiasIso(vencimento,7*indice);
  if(recorrencia==="quinzenal")return somarDiasIso(vencimento,15*indice);
  return somarMesesIso(vencimento,indice);
}
function validarPagamentoForm(payload){
  const erros=[];
  if(!String(payload.fornecedor||"").trim())erros.push("fornecedor");
  if(!String(payload.descricao||"").trim())erros.push("descrição");
  if(!String(payload.vencimento||"").trim())erros.push("vencimento");
  if(!(Number(payload.valor)>0))erros.push("valor");
  return erros;
}
function moeda(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function dataBr(v){if(!v)return "-";const s=String(v).slice(0,10),p=s.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s}
function normalizar(v){return String(v||"").trim().toLowerCase()}
function normalizarStatus(s){s=normalizar(s||"aberto");if(["quitado","baixado","pago"].includes(s))return"pago";if(["pendente","em aberto","vencido"].includes(s))return"aberto";if(["parcialmente pago","baixado parcial"].includes(s))return"parcial";return s||"aberto"}
function campoTexto(item,nomes,padrao=""){for(const n of nomes){if(item?.[n]!==undefined&&item?.[n]!==null&&String(item[n]).trim()!=="")return item[n]}return padrao}
function campoValor(item,nomes,padrao=0){for(const n of nomes){if(item?.[n]!==undefined&&item?.[n]!==null)return item[n]}return padrao}
function idRegistro(item){return campoTexto(item,["id","_id","codigo","uuid","chave"],"")}
function dataItem(item){return campoTexto(item,["vencimento","dataVencimento","data","competencia"],"").slice(0,10)}
function valorTotal(item){return Number(campoValor(item,["valor","valorBruto","total","valorOriginal"],0))}
function valorPago(item){return Number(campoValor(item,["valorPago","pago","valorLiquido","liquido","valorBaixado"],0))}
function saldoItem(item){const s=campoValor(item,["valorRestante","saldo","valorAberto"],null);return s!==null?Number(s):Math.max(0,valorTotal(item)-valorPago(item))}
function estaEmAberto(item){return["aberto","parcial"].includes(normalizarStatus(item.status))&&saldoItem(item)>0}
function tipoBaixaItem(item){
  const status=normalizarStatus(item.status);
  if(status==="parcial" || (valorPago(item)>0 && saldoItem(item)>0))return "parcial";
  if(status==="pago" || (valorPago(item)>0 && saldoItem(item)<=0))return "total";
  return "-";
}
function ehParcialComSaldo(item){return tipoBaixaItem(item)==="parcial" && saldoItem(item)>0}
function podeEstornarPagamento(item){
  const status=normalizarStatus(item.status);
  return !!idRegistro(item) && ["pago","parcial"].includes(status);
}
function podeCancelarPagamento(item){
  const status=normalizarStatus(item.status);
  return !!idRegistro(item) && !["cancelado","estornado","pago"].includes(status);
}
function obterPorId(id){return estado.registros.find(r=>String(idRegistro(r))===String(id))}
function selecionadosValidos(){return [...estado.selecionados].map(obterPorId).filter(Boolean)}
function selecionadosBaixaveis(){return selecionadosValidos().filter(estaEmAberto)}
function valorSelecionado(){return selecionadosBaixaveis().reduce((a,i)=>a+saldoItem(i),0)}
function paginaAtualItens(){
  const totalPaginas=Math.max(1,Math.ceil(estado.filtrados.length/estado.porPagina));
  if(estado.pagina>totalPaginas)estado.pagina=totalPaginas;
  if(estado.pagina<1)estado.pagina=1;
  const ini=(estado.pagina-1)*estado.porPagina;
  return estado.filtrados.slice(ini,ini+estado.porPagina);
}
function atualizarBarraLote(){
  const qtd=estado.selecionados.size;
  const valor=valorSelecionado();
  const txt=$("#txtSelecionados"); if(txt)txt.textContent=`${qtd} selecionado${qtd===1?"":"s"}`;
  const val=$("#txtValorSelecionado"); if(val)val.textContent=`${moeda(valor)} em aberto`;
  const btn=$("#btnBaixaLote"); if(btn)btn.disabled=selecionadosBaixaveis().length===0;
  const limpar=$("#btnLimparSelecao"); if(limpar)limpar.disabled=qtd===0;
  const ids=paginaAtualItens().map(idRegistro).filter(Boolean);
  const marcados=ids.filter(id=>estado.selecionados.has(String(id))).length;
  const chk=$("#chkTodos");
  if(chk){chk.checked=ids.length>0&&marcados===ids.length;chk.indeterminate=marcados>0&&marcados<ids.length;}
}
function abrirModalAcao(tipo,id){
  const item=estado.registros.find(r=>String(idRegistro(r))===String(id));
  if(!item)return;
  $("#acaoId").value=id;
  $("#acaoTipo").value=tipo;
  $("#acaoData").value=hojeIso();
  $("#acaoMotivo").value=tipo==="estorno" ? "Estorno solicitado pelo usuário" : "Cancelamento solicitado pelo usuário";
  $("#acaoTitulo").textContent=tipo==="estorno" ? "Estornar pagamento" : "Cancelar pagamento";
  $("#btnConfirmarAcao").classList.toggle("acao-perigosa",true);
  $("#modalAcao").showModal();
}
function estaVencido(item){const d=dataItem(item);return d&&d<new Date().toISOString().slice(0,10)&&estaEmAberto(item)}
function validarBaixaPagamento(item,valor){
  const saldo=saldoItem(item);
  if(!item)return "Pagamento não encontrado.";
  if(!(valor>0))return "Informe um valor maior que zero.";
  if(valor>saldo+0.009)return `O valor pago não pode ser maior que o saldo (${moeda(saldo)}).`;
  return "";
}
function statusDepoisBaixa(item,valor){
  const saldo=Math.max(0, saldoItem(item)-Number(valor||0));
  return saldo<=0.009 ? "pago" : "parcial";
}
function aviso(txt){const el=$("#avisoSistema");if(!el)return;el.textContent=txt;el.hidden=!txt}
function statusIntegracao(txt){const el=$("#statusIntegracao");if(!el)return;el.textContent=txt;el.hidden=!txt}
function erroAmigavel(e){const msg=String(e?.message||"Erro inesperado");if(e?.status===404)return"Rota não encontrada. Confirme se o módulo financeiro do servidor está ativo.";if(msg.includes("Failed to fetch"))return"Não foi possível conectar ao servidor local.";return msg}

function obterLista(d){
  if(Array.isArray(d))return d;
  for(const k of ["pagamentos","contasPagar","contasAPagar","lancamentos","items","data","resultado"]){
    if(Array.isArray(d?.[k]))return d[k];
  }
  return [];
}

function getFiltros(){
  return {
    busca: $("#fBusca")?.value || "",
    status: $("#fStatus")?.value || "",
    forma: $("#fForma")?.value || "",
    rapido: $("#fRapido")?.value || "",
    inicio: $("#fInicio")?.value || "",
    fim: $("#fFim")?.value || ""
  };
}

function valorSort(item,campo){
  const mapa={
    vencimento:dataItem(item),
    fornecedor:campoTexto(item,["fornecedor","credor","prestador","nomeFornecedor"],""),
    descricao:campoTexto(item,["descricao","observacao","referencia"],""),
    categoria:campoTexto(item,["categoria","centroCusto","grupo"],""),
    forma:campoTexto(item,["formaPagamento","forma","meioPagamento","pagamento"],""),
    valor:valorTotal(item),
    pago:valorPago(item),
    saldo:saldoItem(item),
    status:normalizarStatus(item.status)
  };
  return mapa[campo]??"";
}

function ordenarFiltrados(){
  const dir=estado.sortDir==="desc"?-1:1;
  estado.filtrados.sort((a,b)=>{
    const av=valorSort(a,estado.sortCampo),bv=valorSort(b,estado.sortCampo);
    if(typeof av==="number"||typeof bv==="number")return (Number(av)-Number(bv))*dir;
    return String(av).localeCompare(String(bv),"pt-BR",{numeric:true})*dir;
  });
  document.querySelectorAll(".sort-btn").forEach((btn)=>{
    btn.classList.toggle("ativo",btn.dataset.sort===estado.sortCampo);
    btn.textContent=btn.textContent.replace(/[ ▲▼]$/g,"")+(btn.dataset.sort===estado.sortCampo?(estado.sortDir==="asc"?" ▲":" ▼"):"");
  });
}

function aplicarFiltrosLocais(){
  const f=getFiltros(), busca=normalizar(f.busca), hoje=hojeIso(), semana=somarDiasIso(hoje,7);
  estado.filtrados=estado.registros.filter((item)=>{
    const status=normalizarStatus(item.status);
    const forma=normalizar(campoTexto(item,["formaPagamento","forma","meioPagamento","pagamento"],""));
    const data=dataItem(item);
    const texto=[
      campoTexto(item,["fornecedor","credor","prestador","nomeFornecedor"],""),
      campoTexto(item,["descricao","observacao","documento","referencia","categoria"],""),
      campoTexto(item,["documento","numeroDocumento","parcela"],"")
    ].join(" ").toLowerCase();

    if(f.status&&status!==f.status)return false;
    if(f.forma&&forma!==f.forma)return false;
    if(busca&&!texto.includes(busca))return false;
    if(f.inicio&&data&&data<f.inicio)return false;
    if(f.fim&&data&&data>f.fim)return false;
    if(f.rapido==="vencidos"&&!estaVencido(item))return false;
    if(f.rapido==="hoje"&&!(data===hoje&&estaEmAberto(item)))return false;
    if(f.rapido==="semana"&&!(data&&data>=hoje&&data<=semana&&estaEmAberto(item)))return false;
    if(f.rapido==="aberto_com_saldo"&&!estaEmAberto(item))return false;
    if(f.rapido==="parciais_com_saldo"&&!ehParcialComSaldo(item))return false;
    return true;
  });
  ordenarFiltrados();
}

function agruparDashboard(lista, campoFn){
  const mapa=new Map();
  lista.forEach((item)=>{
    const chave=campoFn(item)||"Não informado";
    const atual=mapa.get(chave)||{qtd:0,valor:0,saldo:0};
    atual.qtd++;
    atual.valor+=valorTotal(item);
    atual.saldo+=saldoItem(item);
    mapa.set(chave,atual);
  });
  return [...mapa.entries()].sort((a,b)=>b[1].saldo-a[1].saldo).slice(0,6);
}

function renderDashLista(el, grupos){
  const alvo=$(el);
  if(!alvo)return;
  if(!grupos.length){
    alvo.innerHTML='<div class="dash-empty">Sem dados para exibir.</div>';
    return;
  }
  alvo.innerHTML=grupos.map(([nome,r])=>`
    <div class="dash-line">
      <div><strong>${esc(nome)}</strong><br><span>${esc(r.qtd)} registro${r.qtd===1?"":"s"}</span></div>
      <div><strong>${esc(moeda(r.saldo))}</strong><br><span>saldo</span></div>
    </div>
  `).join("");
}

function atualizarDashboard(){
  if(!$("#dashboardPagamentos"))return;
  const lista=estado.filtrados;
  const porCategoria=agruparDashboard(lista,(i)=>campoTexto(i,["categoria","grupo"],"Não informado"));
  const porCentro=agruparDashboard(lista,(i)=>campoTexto(i,["centroCusto","centro_custo"],"Não informado"));
  const hoje=hojeIso();
  const proximos=lista
    .filter((i)=>estaEmAberto(i)&&dataItem(i)>=hoje)
    .sort((a,b)=>String(dataItem(a)).localeCompare(String(dataItem(b))))
    .slice(0,6)
    .map((i)=>[`${dataBr(dataItem(i))} - ${campoTexto(i,["fornecedor","credor","prestador","nomeFornecedor"],"Fornecedor")}`,{qtd:1,valor:valorTotal(i),saldo:saldoItem(i)}]);

  renderDashLista("#dashCategorias",porCategoria);
  renderDashLista("#dashCentroCusto",porCentro);
  renderDashLista("#dashVencimentos",proximos);
  const f=getFiltros();
  const periodo=[];
  if(f.inicio)periodo.push(`de ${dataBr(f.inicio)}`);
  if(f.fim)periodo.push(`até ${dataBr(f.fim)}`);
  $("#dashPeriodo").textContent=periodo.length?periodo.join(" "):"Visão geral";
}

function atualizarResumo(){
  const r=estado.registros,res=estado.resumoApi||{};
  $("#kpiTotal").textContent=res.total??r.length;
  $("#kpiAbertos").textContent=res.abertos??r.filter(x=>normalizarStatus(x.status)==="aberto").length;
  $("#kpiPagos").textContent=res.pagos??res.recebidos??r.filter(x=>normalizarStatus(x.status)==="pago").length;
  $("#kpiParciais").textContent=res.parciais??r.filter(x=>normalizarStatus(x.status)==="parcial").length;
  $("#kpiVencidos").textContent=r.filter(estaVencido).length;
  $("#kpiValorPrevisto").textContent=moeda(res.valorPrevisto??res.valorBruto??r.reduce((a,x)=>a+valorTotal(x),0));
  $("#kpiValorPago").textContent=moeda(res.valorPago??res.valorLiquido??r.reduce((a,x)=>a+valorPago(x),0));
  $("#kpiValorAberto").textContent=moeda(res.valorAberto??r.reduce((a,x)=>estaEmAberto(x)?a+saldoItem(x):a,0));
  const parcialSaldo=r.reduce((a,x)=>ehParcialComSaldo(x)?a+saldoItem(x):a,0);
  const elParcial=$("#kpiValorParcial"); if(elParcial)elParcial.textContent=moeda(res.valorParcialAberto??parcialSaldo);
}

function renderTabela(){
  const tbody=$("#tbPagamentos tbody");
  aplicarFiltrosLocais();
  atualizarResumo();
  atualizarDashboard();

  const totalPaginas=Math.max(1,Math.ceil(estado.filtrados.length/estado.porPagina));
  if(estado.pagina>totalPaginas)estado.pagina=totalPaginas;
  if(estado.pagina<1)estado.pagina=1;

  const page=paginaAtualItens();

  $("#contadorLista").textContent=`${estado.filtrados.length} registro${estado.filtrados.length===1?"":"s"}`;
  $("#paginaAtual").textContent=`Página ${estado.pagina} de ${totalPaginas}`;
  $("#btnAnterior").disabled=estado.pagina<=1;
  $("#btnProxima").disabled=estado.pagina>=totalPaginas;

  if(!page.length){
    tbody.innerHTML=`<tr><td colspan="12" class="empty">Nenhum pagamento encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML=page.map((item)=>{
    const id=idRegistro(item),status=normalizarStatus(item.status);
    const podeBaixar=id&&["aberto","parcial"].includes(status);
    const podeEstornar=podeEstornarPagamento(item);
    const podeCancelar=podeCancelarPagamento(item);

    const tipo=tipoBaixaItem(item);
    const selecionado=estado.selecionados.has(String(id));
    const classeLinha=(estaVencido(item)?'linha-vencida':(dataItem(item)===hojeIso()&&estaEmAberto(item)?'linha-hoje':''))+(tipo==="parcial"?' linha-parcial':'')+(status==="cancelado"?' linha-cancelada':'')+(status==="estornado"?' linha-estornada':'')+(selecionado?' linha-selecionada':'');
    return `<tr class="${classeLinha.trim()}">
      <td class="check"><input type="checkbox" data-select="${esc(id)}" ${selecionado?"checked":""}></td>
      <td>${esc(dataBr(dataItem(item)))}</td>
      <td>${esc(campoTexto(item,["fornecedor","credor","prestador","nomeFornecedor"],"-"))}</td>
      <td>${esc(campoTexto(item,["descricao","observacao","referencia"],"-"))}</td>
      <td>${esc(campoTexto(item,["categoria","centroCusto","grupo"],"-"))}</td>
      <td>${esc(campoTexto(item,["formaPagamento","forma","meioPagamento","pagamento"],"-"))}</td>
      <td class="num">${esc(moeda(valorTotal(item)))}</td>
      <td class="num">${esc(moeda(valorPago(item)))}</td>
      <td class="num">${esc(moeda(saldoItem(item)))}</td>
      <td><span class="badge ${esc(status)}">${esc(status)}</span></td>
      <td><span class="tipo-baixa ${esc(tipo)}">${esc(tipo)}</span></td>
      <td class="acoes"><div class="row-actions">
        <button class="btn btn-light" data-detalhe="${esc(id)}">Detalhes</button>
        <button class="btn btn-light" data-comprovante="${esc(id)}">Comprovante</button>
        <button class="btn btn-light" data-duplicar="${esc(id)}">Duplicar</button>
        <button class="btn btn-light" data-baixar="${esc(id)}" ${podeBaixar?"":"disabled"}>Baixar</button>
        <button class="btn btn-light" data-estornar="${esc(id)}" ${podeEstornar?"":"disabled"}>Estornar</button>
        <button class="btn btn-light" data-cancelar="${esc(id)}" ${podeCancelar?"":"disabled"}>Cancelar</button>
      </div></td>
    </tr>`;
  }).join("");
  atualizarBarraLote();
}

async function carregar(){
  const tbody=$("#tbPagamentos tbody");
  tbody.innerHTML=`<tr><td colspan="12" class="empty">Carregando pagamentos...</td></tr>`;
  aviso("");
  try{
    const dados=await listarPagamentos(getFiltros());
    estado.registros=obterLista(dados);
    estado.resumoApi=dados?.resumo||(dados&&!Array.isArray(dados)?dados:null);
    estado.selecionados=new Set([...estado.selecionados].filter(id=>obterPorId(id)));
    renderTabela();
    const base=obterBaseAtiva();
    statusIntegracao(base?`Integração ativa: ${base}`:"");
    if(!estado.registros.length)aviso("");
  }catch(e){
    const msg=erroAmigavel(e);
    tbody.innerHTML=`<tr><td colspan="12" class="empty">${esc(msg)}</td></tr>`;
    statusIntegracao("");
    aviso("Não foi possível carregar a rota de pagamentos.");
  }
}

async function executarDiagnostico(){
  const el=$("#statusIntegracao");
  if(el){el.hidden=false;el.textContent="Executando diagnóstico das rotas...";}
  try{
    const res=await diagnosticarPagamentos();
    const html=res.map((r)=>r.ok
      ? `<li class="ok-rota">${esc(r.base)} OK - ${esc(r.tipo)} - ${esc(r.tempo)}ms</li>`
      : `<li class="erro-rota">${esc(r.base)} falhou - HTTP ${esc(r.status||"-")} - ${esc(r.erro)}</li>`
    ).join("");
    if(el)el.innerHTML=`Diagnóstico concluído:<ul class="diagnostico-lista">${html}</ul>`;
  }catch(e){
    if(el)el.textContent=erroAmigavel(e);
  }
}

function abrirModalBaixa(id){
  const item=estado.registros.find(r=>String(idRegistro(r))===String(id));
  $("#baixaId").value=id;
  $("#baixaValor").value=saldoItem(item)>0?saldoItem(item).toFixed(2):"";
  $("#baixaData").value=hojeIso();
  $("#baixaForma").value="pix";
  $("#baixaTipo").value="auto";
  $("#baixaObs").value="";
  $("#modalBaixa").showModal();
}

async function confirmarBaixa(){
  const id=$("#baixaId").value;
  const item=estado.registros.find(r=>String(idRegistro(r))===String(id));
  let valor=Number($("#baixaValor").value||0);
  const tipo=$("#baixaTipo")?.value||"auto";

  if(tipo==="total" && item) valor=saldoItem(item);

  const erro=validarBaixaPagamento(item,valor);
  if(erro){alert(erro);return;}

  const saldoAnterior=saldoItem(item);
  const saldoRestante=Math.max(0, Number((saldoAnterior-valor).toFixed(2)));
  const novoStatus=tipo==="parcial" ? "parcial" : statusDepoisBaixa(item,valor);

  try{
    await baixarPagamento(id,{
      valor,
      valorPago:valor,
      formaPagamento:$("#baixaForma").value,
      forma:$("#baixaForma").value,
      dataPagamento:$("#baixaData").value || hojeIso(),
      dataBaixa:$("#baixaData").value || hojeIso(),
      tipoBaixa:tipo,
      saldoAnterior,
      saldoRestante,
      status:novoStatus,
      observacao:$("#baixaObs").value,
      historico:{
        tipo:"baixa_pagamento",
        valor,
        forma:$("#baixaForma").value,
        data:$("#baixaData").value || hojeIso(),
        saldoAnterior,
        saldoRestante,
        status:novoStatus,
        observacao:$("#baixaObs").value
      }
    });
    $("#modalBaixa").close();
    await carregar();
  }catch(e){alert(erroAmigavel(e));}
}

function abrirNovo(){
  ["#novoFornecedor","#novoDocumento","#novoDescricao","#novoCategoria","#novoCentroCusto","#novoVencimento","#novoValor","#novoForma","#novoObs"].forEach(id=>{const el=$(id);if(el)el.value=""});
  $("#novoStatus").value="aberto";
  $("#novoParcelas").value="1";
  $("#novoRecorrencia").value="";
  $("#modalNovo").showModal();
}

async function salvarNovo(){
  const fornecedor=$("#novoFornecedor").value.trim();
  const descricao=$("#novoDescricao").value.trim();
  const vencimento=$("#novoVencimento").value;
  const valor=Number($("#novoValor").value||0);
  const status=$("#novoStatus").value;
  const forma=$("#novoForma").value;
  const parcelas=Math.max(1, Math.min(36, Number($("#novoParcelas")?.value||1)));
  const recorrencia=$("#novoRecorrencia")?.value||"";
  const categoria=$("#novoCategoria").value.trim();
  const centroCusto=$("#novoCentroCusto")?.value.trim()||"";
  const documentoBase=$("#novoDocumento").value.trim();
  const observacao=$("#novoObs").value.trim();

  const erros=validarPagamentoForm({fornecedor,descricao,vencimento,valor});
  if(erros.length){alert("Preencha corretamente: "+erros.join(", ")+".");return;}

  const valorParcela=Number((valor/parcelas).toFixed(2));
  let sucesso=0;
  let falhas=0;

  for(let i=0;i<parcelas;i++){
    const numero=i+1;
    const valorAtual=numero===parcelas ? Number((valor-(valorParcela*(parcelas-1))).toFixed(2)) : valorParcela;
    const vencimentoParcela=calcularVencimentoParcela(vencimento,i,recorrencia||"mensal");
    const sufixo=parcelas>1 ? ` ${numero}/${parcelas}` : "";
    const documento=parcelas>1 ? `${documentoBase || "PARC"}-${numero}` : documentoBase;

    try{
      await criarPagamento({
        tipo:"pagar",
        fornecedor,
        credor:fornecedor,
        descricao:descricao+sufixo,
        documento,
        categoria,
        centroCusto,
        vencimento:vencimentoParcela,
        dataVencimento:vencimentoParcela,
        valor:valorAtual,
        valorBruto:valorAtual,
        valorPago:status==="pago"?valorAtual:0,
        valorLiquido:status==="pago"?valorAtual:0,
        valorRestante:status==="pago"?0:valorAtual,
        formaPagamento:forma,
        forma,
        status,
        parcela:numero,
        parcelas,
        recorrencia,
        observacao
      });
      sucesso++;
    }catch(e){
      falhas++;
    }
  }

  $("#modalNovo").close();
  estado.pagina=1;
  await carregar();

  if(falhas)alert(`Pagamentos criados parcialmente. Sucesso: ${sucesso}. Falhas: ${falhas}.`);
}
function agruparResumo(lista, campoFn){
  const mapa=new Map();
  lista.forEach((item)=>{
    const chave=campoFn(item)||"Não informado";
    const atual=mapa.get(chave)||{qtd:0,valor:0,pago:0,saldo:0};
    atual.qtd++;
    atual.valor+=valorTotal(item);
    atual.pago+=valorPago(item);
    atual.saldo+=saldoItem(item);
    mapa.set(chave,atual);
  });
  return [...mapa.entries()].sort((a,b)=>b[1].saldo-a[1].saldo);
}

function linhasResumoTabela(grupos){
  if(!grupos.length)return'<tr><td colspan="5">Sem dados</td></tr>';
  return grupos.map(([nome,r])=>`<tr><td>${esc(nome)}</td><td class="num">${esc(r.qtd)}</td><td class="num">${esc(moeda(r.valor))}</td><td class="num">${esc(moeda(r.pago))}</td><td class="num">${esc(moeda(r.saldo))}</td></tr>`).join("");
}

function abrirResumo(){
  aplicarFiltrosLocais();
  const lista=estado.filtrados;
  const total=lista.reduce((a,i)=>a+valorTotal(i),0);
  const pago=lista.reduce((a,i)=>a+valorPago(i),0);
  const saldo=lista.reduce((a,i)=>a+saldoItem(i),0);
  const vencidos=lista.filter(estaVencido);
  const porStatus=agruparResumo(lista,(i)=>normalizarStatus(i.status));
  const porCategoria=agruparResumo(lista,(i)=>campoTexto(i,["categoria","grupo"],"Não informado"));
  const porCentro=agruparResumo(lista,(i)=>campoTexto(i,["centroCusto","centro_custo"],"Não informado"));

  $("#resumoConteudo").innerHTML=`
    <div class="summary-box"><h4>Totais filtrados</h4><p class="summary-total">${esc(moeda(saldo))}</p><p>${esc(lista.length)} registros | Previsto: ${esc(moeda(total))} | Pago: ${esc(moeda(pago))}</p><p>Vencidos: ${esc(vencidos.length)} | Valor vencido: ${esc(moeda(vencidos.reduce((a,i)=>a+saldoItem(i),0)))}</p></div>
    <div class="summary-box"><h4>Por status</h4><table><thead><tr><th>Status</th><th class="num">Qtd</th><th class="num">Previsto</th><th class="num">Pago</th><th class="num">Saldo</th></tr></thead><tbody>${linhasResumoTabela(porStatus)}</tbody></table></div>
    <div class="summary-box detail-wide"><h4>Por categoria</h4><table><thead><tr><th>Categoria</th><th class="num">Qtd</th><th class="num">Previsto</th><th class="num">Pago</th><th class="num">Saldo</th></tr></thead><tbody>${linhasResumoTabela(porCategoria)}</tbody></table></div>
    <div class="summary-box detail-wide"><h4>Por centro de custo</h4><table><thead><tr><th>Centro</th><th class="num">Qtd</th><th class="num">Previsto</th><th class="num">Pago</th><th class="num">Saldo</th></tr></thead><tbody>${linhasResumoTabela(porCentro)}</tbody></table></div>
  `;
  $("#modalResumo").showModal();
}

function exportarResumoCsv(){
  aplicarFiltrosLocais();
  const linhas=[["Tipo","Grupo","Qtd","Previsto","Pago","Saldo"]];
  [["Status",(i)=>normalizarStatus(i.status)],["Categoria",(i)=>campoTexto(i,["categoria","grupo"],"Não informado")],["CentroCusto",(i)=>campoTexto(i,["centroCusto","centro_custo"],"Não informado")]].forEach(([tipo,fn])=>{
    agruparResumo(estado.filtrados,fn).forEach(([nome,r])=>linhas.push([tipo,nome,r.qtd,r.valor.toFixed(2).replace(".",","),r.pago.toFixed(2).replace(".",","),r.saldo.toFixed(2).replace(".",",")]));
  });
  baixarCsvTexto(linhas.map(l=>l.map(csvCell).join(";")).join("\n"),`fusion_pagamentos_resumo_${hojeIso()}.csv`);
}

function baixarCsvTexto(csv,nome){
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

function imprimirResumo(){
  const conteudo=$("#resumoConteudo")?.innerHTML||"";
  const w=window.open("","_blank");
  if(!w)return;
  w.document.write(`<html><head><title>Resumo de Pagamentos</title><style>body{font-family:Arial;padding:24px}h1{color:#ff6600}.summary-box{border:1px solid #ddd;margin:12px 0;padding:12px;border-radius:8px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:7px;text-align:left}.num{text-align:right}.summary-total{font-size:22px;font-weight:bold;color:#ff6600}</style></head><body><h1>Fusion ERP</h1><h2>Resumo de Pagamentos</h2>${conteudo}<p>Emitido em ${new Date().toLocaleString("pt-BR")}</p><script>window.print();setTimeout(()=>window.close(),700)</script></body></html>`);
  w.document.close();
}

function imprimirComprovante(id){
  const item=obterPorId(id);
  if(!item)return;
  const w=window.open("","_blank");
  if(!w)return;
  const html=`<html><head><title>Comprovante de Pagamento</title><style>body{font-family:Arial;padding:24px}h1{color:#ff6600}.box{border:1px solid #ddd;padding:14px;margin:10px 0;border-radius:8px}p{margin:6px 0}</style></head><body><h1>Fusion ERP</h1><h2>Comprovante de Pagamento</h2><div class="box"><p><b>Fornecedor:</b> ${esc(campoTexto(item,["fornecedor","credor","prestador","nomeFornecedor"],"-"))}</p><p><b>Descrição:</b> ${esc(campoTexto(item,["descricao","observacao","referencia"],"-"))}</p><p><b>Documento:</b> ${esc(campoTexto(item,["documento","numeroDocumento","parcela"],"-"))}</p><p><b>Vencimento:</b> ${esc(dataBr(dataItem(item)))}</p><p><b>Valor:</b> ${esc(moeda(valorTotal(item)))}</p><p><b>Pago:</b> ${esc(moeda(valorPago(item)))}</p><p><b>Saldo:</b> ${esc(moeda(saldoItem(item)))}</p><p><b>Status:</b> ${esc(normalizarStatus(item.status))}</p></div><p>Emitido em ${new Date().toLocaleString("pt-BR")}</p><hr><p>Assinatura: __________________________________________</p><script>window.print();setTimeout(()=>window.close(),700)</script></body></html>`;
  w.document.write(html);w.document.close();
}

function listaMovimentacoes(item){
  const mov=item.movimentacoes||item.historico||item.baixas||item.eventos||[];
  if(Array.isArray(mov)&&mov.length)return mov;
  const fallback=[];
  if(valorPago(item)>0)fallback.push({tipo:"pagamento_registrado",data:campoTexto(item,["dataPagamento","dataBaixa","pagoEm"],""),valor:valorPago(item),observacao:"Movimentação inferida pelo valor pago"});
  if(normalizarStatus(item.status)==="cancelado")fallback.push({tipo:"cancelamento",data:campoTexto(item,["dataCancelamento"],""),valor:0,observacao:campoTexto(item,["motivoCancelamento","motivo"],"Cancelado")});
  if(normalizarStatus(item.status)==="estornado")fallback.push({tipo:"estorno",data:campoTexto(item,["dataEstorno"],""),valor:valorPago(item),observacao:campoTexto(item,["motivoEstorno","motivo"],"Estornado")});
  return fallback;
}

function abrirDetalhe(id){
  const item=obterPorId(id);
  if(!item)return;
  estado.detalheId=id;
  const movs=listaMovimentacoes(item);
  const lista=movs.length?movs.map((m)=>`<li>${esc(dataBr(m.data||m.createdAt||""))} - ${esc(m.tipo||m.acao||"movimento")} - ${esc(moeda(m.valor||0))}${m.observacao?" - "+esc(m.observacao):""}</li>`).join(""):"<li>Nenhuma movimentação registrada no retorno da API.</li>";
  $("#detalheConteudo").innerHTML=`
    <div class="detail-item"><span>Fornecedor</span><strong>${esc(campoTexto(item,["fornecedor","credor","prestador","nomeFornecedor"],"-"))}</strong></div>
    <div class="detail-item"><span>Status</span><strong>${esc(normalizarStatus(item.status))}</strong></div>
    <div class="detail-item detail-wide"><span>Descrição</span><strong>${esc(campoTexto(item,["descricao","observacao","referencia"],"-"))}</strong></div>
    <div class="detail-item"><span>Documento</span><strong>${esc(campoTexto(item,["documento","numeroDocumento","parcela"],"-"))}</strong></div>
    <div class="detail-item"><span>Categoria</span><strong>${esc(campoTexto(item,["categoria","grupo"],"-"))}</strong></div>
    <div class="detail-item"><span>Centro de custo</span><strong>${esc(campoTexto(item,["centroCusto","centro_custo"],"-"))}</strong></div>
    <div class="detail-item"><span>Vencimento</span><strong>${esc(dataBr(dataItem(item)))}</strong></div>
    <div class="detail-item"><span>Valor</span><strong>${esc(moeda(valorTotal(item)))}</strong></div>
    <div class="detail-item"><span>Pago</span><strong>${esc(moeda(valorPago(item)))}</strong></div>
    <div class="detail-item"><span>Saldo</span><strong>${esc(moeda(saldoItem(item)))}</strong></div>
    <div class="timeline"><h4>Histórico / auditoria</h4><ul>${lista}</ul></div>
  `;
  $("#btnBaixarDetalhe").disabled=!estaEmAberto(item);
  $("#modalDetalhe").showModal();
}

function duplicarPagamento(id){
  const item=obterPorId(id);
  if(!item)return;
  $("#novoFornecedor").value=campoTexto(item,["fornecedor","credor","prestador","nomeFornecedor"],"");
  $("#novoDocumento").value=(campoTexto(item,["documento","numeroDocumento","parcela"],"")+" - cópia").trim();
  $("#novoDescricao").value=campoTexto(item,["descricao","observacao","referencia"],"");
  $("#novoCategoria").value=campoTexto(item,["categoria","grupo"],"");
  const cc=$("#novoCentroCusto"); if(cc)cc.value=campoTexto(item,["centroCusto","centro_custo"],"");
  $("#novoVencimento").value=hojeIso();
  $("#novoValor").value=valorTotal(item)?valorTotal(item).toFixed(2):"";
  $("#novoForma").value=campoTexto(item,["formaPagamento","forma","meioPagamento","pagamento"],"");
  $("#novoStatus").value="aberto";
  const parcelas=$("#novoParcelas"); if(parcelas)parcelas.value="1";
  const recorrencia=$("#novoRecorrencia"); if(recorrencia)recorrencia.value="";
  $("#novoObs").value="Duplicado pela tela de pagamentos";
  $("#modalNovo").showModal();
}

function abrirLote(){
  const itens=selecionadosBaixaveis();
  if(!itens.length)return;
  $("#loteQtd").textContent=`${itens.length} pagamento${itens.length===1?"":"s"} selecionado${itens.length===1?"":"s"}`;
  $("#loteValor").textContent=`${moeda(valorSelecionado())} em aberto`;
  $("#loteData").value=hojeIso();
  $("#loteForma").value="pix";
  $("#loteObs").value="Baixa em lote pela tela de pagamentos";
  $("#modalLote").showModal();
}

async function confirmarLote(){
  const itens=selecionadosBaixaveis();
  const data=$("#loteData").value||hojeIso();
  const forma=$("#loteForma").value;
  const observacao=$("#loteObs").value;
  let ok=0, falhas=0;

  for(const item of itens){
    const id=idRegistro(item);
    const valor=saldoItem(item);
    try{
      await baixarPagamento(id,{
        valor,
        valorPago:valor,
        formaPagamento:forma,
        forma,
        dataPagamento:data,
        dataBaixa:data,
        tipoBaixa:"lote_total",
        saldoAnterior:valor,
        saldoRestante:0,
        status:"pago",
        observacao,
        historico:{tipo:"baixa_lote_pagamento",data,valor,forma,observacao}
      });
      estado.selecionados.delete(String(id));
      ok++;
    }catch(e){falhas++;}
  }

  $("#modalLote").close();
  await carregar();
  if(falhas)alert(`Baixa em lote concluída parcialmente. Sucesso: ${ok}. Falhas: ${falhas}.`);
}

function selecionarFiltrados(){
  aplicarFiltrosLocais();
  estado.filtrados.forEach(item=>{
    const id=idRegistro(item);
    if(id && estaEmAberto(item))estado.selecionados.add(String(id));
  });
  renderTabela();
}

async function confirmarEstorno(id,motivo,dataAcao){
  const item=estado.registros.find(r=>String(idRegistro(r))===String(id));
  if(!podeEstornarPagamento(item)){alert("Este pagamento não pode ser estornado no estado atual.");return;}
  try{
    await estornarPagamento(id,{
      motivo,
      dataEstorno:dataAcao || hojeIso(),
      status:"estornado",
      saldoAnterior:saldoItem(item),
      valorPago:valorPago(item),
      historico:{
        tipo:"estorno_pagamento",
        data:dataAcao || hojeIso(),
        motivo,
        valorPago:valorPago(item),
        saldo:saldoItem(item)
      }
    });
    await carregar();
  }catch(e){alert(erroAmigavel(e));}
}

async function confirmarCancelamento(id,motivo,dataAcao){
  const item=estado.registros.find(r=>String(idRegistro(r))===String(id));
  if(!podeCancelarPagamento(item)){alert("Este pagamento não pode ser cancelado no estado atual.");return;}
  try{
    await cancelarPagamento(id,{
      motivo,
      dataCancelamento:dataAcao || hojeIso(),
      status:"cancelado",
      saldoAnterior:saldoItem(item),
      historico:{
        tipo:"cancelamento_pagamento",
        data:dataAcao || hojeIso(),
        motivo,
        saldo:saldoItem(item)
      }
    });
    await carregar();
  }catch(e){alert(erroAmigavel(e));}
}

function csvCell(v){return`"${String(v??"").replaceAll('"','""')}"`}
function exportarCsv(){
  aplicarFiltrosLocais();
  const linhas=[["Vencimento","Fornecedor","Descricao","Categoria","CentroCusto","Forma","Valor","Pago","Saldo","Status","TipoBaixa"]];
  estado.filtrados.forEach((item)=>linhas.push([
    dataBr(dataItem(item)),
    campoTexto(item,["fornecedor","credor","prestador","nomeFornecedor"],""),
    campoTexto(item,["descricao","observacao","referencia"],""),
    campoTexto(item,["categoria","grupo"],""),
    campoTexto(item,["centroCusto","centro_custo"],""),
    campoTexto(item,["formaPagamento","forma","meioPagamento","pagamento"],""),
    valorTotal(item).toFixed(2).replace(".",","),
    valorPago(item).toFixed(2).replace(".",","),
    saldoItem(item).toFixed(2).replace(".",","),
    normalizarStatus(item.status),
    tipoBaixaItem(item)
  ]));
  const csv=linhas.map(l=>l.map(csvCell).join(";")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`fusion_pagamentos_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded",()=>{
  $("#btnAtualizar")?.addEventListener("click",carregar);
  $("#btnDiagnostico")?.addEventListener("click",executarDiagnostico);
  $("#btnExportar")?.addEventListener("click",exportarCsv);
  $("#btnResumo")?.addEventListener("click",abrirResumo);
  $("#btnImprimir")?.addEventListener("click",()=>window.print());
  $("#btnNovo")?.addEventListener("click",abrirNovo);

  $("#btnFiltrar")?.addEventListener("click",()=>{estado.pagina=1;carregar();});
  $("#btnLimpar")?.addEventListener("click",()=>{["#fBusca","#fStatus","#fForma","#fRapido","#fInicio","#fFim"].forEach(id=>{const el=$(id);if(el)el.value=""});estado.pagina=1;carregar();});
  $("#fBusca")?.addEventListener("input",()=>{estado.pagina=1;renderTabela();});
  $("#btnAnterior")?.addEventListener("click",()=>{estado.pagina--;renderTabela();});
  $("#btnProxima")?.addEventListener("click",()=>{estado.pagina++;renderTabela();});

  $("#btnFecharModal")?.addEventListener("click",()=>$("#modalBaixa").close());
  $("#btnCancelarBaixa")?.addEventListener("click",()=>$("#modalBaixa").close());
  $("#baixaTipo")?.addEventListener("change",()=>{
    const id=$("#baixaId").value;
    const item=estado.registros.find(r=>String(idRegistro(r))===String(id));
    if($("#baixaTipo").value==="total" && item) $("#baixaValor").value=saldoItem(item).toFixed(2);
  });
  $("#btnConfirmarBaixa")?.addEventListener("click",confirmarBaixa);

  $("#btnFecharNovo")?.addEventListener("click",()=>$("#modalNovo").close());
  $("#btnCancelarNovo")?.addEventListener("click",()=>$("#modalNovo").close());
  $("#btnSalvarNovo")?.addEventListener("click",salvarNovo);

  $("#tbPagamentos")?.addEventListener("click",(ev)=>{
    const detalhe=ev.target.closest("[data-detalhe]");
    const comprovante=ev.target.closest("[data-comprovante]");
    const duplicar=ev.target.closest("[data-duplicar]");
    const baixar=ev.target.closest("[data-baixar]");
    const estornar=ev.target.closest("[data-estornar]");
    const cancelar=ev.target.closest("[data-cancelar]");
    if(detalhe)abrirDetalhe(detalhe.dataset.detalhe);
    if(comprovante)imprimirComprovante(comprovante.dataset.comprovante);
    if(duplicar)duplicarPagamento(duplicar.dataset.duplicar);
    if(baixar&&!baixar.disabled)abrirModalBaixa(baixar.dataset.baixar);
    if(estornar&&!estornar.disabled)abrirModalAcao("estorno",estornar.dataset.estornar);
    if(cancelar&&!cancelar.disabled)abrirModalAcao("cancelamento",cancelar.dataset.cancelar);
  });

  carregar();
});
