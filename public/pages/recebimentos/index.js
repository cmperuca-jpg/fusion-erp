import { listarRecebimentos, criarRecebimento, baixarRecebimento, estornarRecebimento, cancelarRecebimento, obterBaseAtiva, diagnosticarRecebimentos } from "./api.js";

const STORAGE_KEY = "fusion.recebimentos.filtros.v10";
const estado = { registros: [], filtrados: [], pagina: 1, porPagina: 12, resumoApi: null, sortCampo: "vencimento", sortDir: "asc", selecionados: new Set(), detalheId: null };
const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

function hojeIso(){return new Date().toISOString().slice(0,10)}
function somarDiasIso(iso,dias){const d=new Date(`${iso}T00:00:00`);d.setDate(d.getDate()+dias);return d.toISOString().slice(0,10)}
function diferencaDias(iso){if(!iso)return null;return Math.round((new Date(`${iso}T00:00:00`)-new Date(`${hojeIso()}T00:00:00`))/86400000)}
function moeda(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function dataBr(v){if(!v)return "-";const s=String(v).slice(0,10),p=s.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s}
function normalizar(v){return String(v||"").trim().toLowerCase()}
function normalizarStatus(s){s=normalizar(s||"aberto");if(["pago","quitado","baixado"].includes(s))return"recebido";if(["pendente","em aberto","vencido"].includes(s))return"aberto";if(["parcialmente pago","baixado parcial"].includes(s))return"parcial";return s||"aberto"}
function campoValor(item,nomes,padrao=0){for(const n of nomes){if(item?.[n]!==undefined&&item?.[n]!==null)return item[n]}return padrao}
function campoTexto(item,nomes,padrao=""){for(const n of nomes){if(item?.[n]!==undefined&&item?.[n]!==null&&String(item[n]).trim()!=="")return item[n]}return padrao}
function idRegistro(item){return campoTexto(item,["id","_id","codigo","uuid","chave"],"")}
function dataItem(item){return campoTexto(item,["vencimento","dataVencimento","data","competencia"],"").slice(0,10)}
function valorBruto(item){return Number(campoValor(item,["valor","valorBruto","total","valorOriginal"],0))}
function valorRecebido(item){return Number(campoValor(item,["valorRecebido","recebido","valorLiquido","liquido"],0))}
function saldoItem(item){const s=campoValor(item,["valorRestante","saldo","valorAberto"],null);return s!==null?Number(s):Math.max(0,valorBruto(item)-valorRecebido(item))}
function estaEmAberto(item){return["aberto","parcial"].includes(normalizarStatus(item.status))&&saldoItem(item)>0}
function estaVencido(item){const d=dataItem(item);return d&&d<hojeIso()&&estaEmAberto(item)}
function venceHoje(item){return dataItem(item)===hojeIso()&&estaEmAberto(item)}
function venceAmanha(item){return dataItem(item)===somarDiasIso(hojeIso(),1)&&estaEmAberto(item)}
function textoDias(item){if(!estaEmAberto(item))return{texto:"-",classe:""};const d=diferencaDias(dataItem(item));if(d===null)return{texto:"-",classe:""};if(d<0)return{texto:`${Math.abs(d)} atrasado${Math.abs(d)===1?"":"s"}`,classe:"atrasado"};if(d===0)return{texto:"Hoje",classe:"hoje"};return{texto:`${d} dia${d===1?"":"s"}`,classe:"futuro"}}
function obterLista(d){if(Array.isArray(d))return d;for(const k of ["lancamentos","recebimentos","contasReceber","items","data","resultado"]){if(Array.isArray(d?.[k]))return d[k]}return[]}
function getFiltros(){return{busca:$("#fBusca")?.value||"",status:$("#fStatus")?.value||"",forma:$("#fForma")?.value||"",rapido:$("#fRapido")?.value||"",inicio:$("#fInicio")?.value||"",fim:$("#fFim")?.value||""}}

function marcarQaFinal(){
  const existente=document.getElementById("qaFinalRecebimentos");
  if(existente)return;
  const ref=document.getElementById("statusIntegracao")||document.getElementById("avisoSistema");
  if(!ref||!ref.parentElement)return;
  const el=document.createElement("section");
  el.id="qaFinalRecebimentos";
  el.className="qa-finalizado";
  el.textContent="Tela de Recebimentos carregada com revisão final da Parte 4.1-B.";
  ref.parentElement.insertBefore(el, ref.nextSibling);
}

function aviso(txt){const el=$("#avisoSistema");if(!el)return;el.textContent=txt;el.hidden=!txt}

function statusIntegracao(txt){const el=$("#statusIntegracao");if(!el)return;el.textContent=txt;el.hidden=!txt}
function setBusy(btn, busy=true){if(!btn)return;btn.disabled=busy;btn.classList.toggle("loading",busy);if(busy){btn.dataset.originalText=btn.textContent;btn.textContent="Processando..."}else if(btn.dataset.originalText){btn.textContent=btn.dataset.originalText;delete btn.dataset.originalText}}
function garantirCamposBaixaComercial(){
  const modal=$("#modalBaixa");
  if(!modal || $("#baixaDesconto")) return;
  const ref=$("#baixaForma")?.closest("label") || $("#baixaForma")?.parentElement || $("#baixaValor")?.parentElement;
  const html=`<label>Desconto
    <input id="baixaDesconto" type="number" step="0.01" min="0" value="0">
  </label>
  <label>Acréscimo/Juros
    <input id="baixaAcrescimo" type="number" step="0.01" min="0" value="0">
  </label>`;
  if(ref) ref.insertAdjacentHTML("afterend", html);
}
function valorComercialBaixa(){
  const bruto=Number($("#baixaValor")?.value||0);
  const desconto=Number($("#baixaDesconto")?.value||0);
  const acrescimo=Number($("#baixaAcrescimo")?.value||0);
  return { bruto, desconto, acrescimo };
}

function erroAmigavel(e){const msg=String(e?.message||"Erro inesperado");if(e?.status===404)return"Rota não encontrada. Confirme se o módulo financeiro do servidor está ativo.";if(msg.includes("Failed to fetch"))return"Não foi possível conectar ao servidor local. Verifique se o Fusion ERP está iniciado.";return msg}

function validarPayloadRecebimento(payload){
  const erros=[];
  if(!String(payload.cliente||"").trim())erros.push("cliente");
  if(!String(payload.descricao||"").trim())erros.push("descrição");
  if(!String(payload.vencimento||"").trim())erros.push("vencimento");
  if(!(Number(payload.valor)>0))erros.push("valor");
  return erros;
}
function validarBaixaPayload(payload, item){
  const valor=Number(payload.valor||0);
  if(valor<=0)return "Informe um valor maior que zero.";
  const saldo=saldoItem(item);
  if(saldo>0 && valor>saldo+0.009)return `Valor da baixa não pode ser maior que o saldo (${moeda(saldo)}).`;
  return "";
}
function listaPossuiIds(){
  return estado.registros.every((item)=>!!idRegistro(item));
}
async function executarDiagnostico(){
  const el=$("#statusIntegracao");
  if(el){el.hidden=false;el.textContent="Executando diagnóstico das rotas...";}
  try{
    const res=await diagnosticarRecebimentos();
    const html=res.map((r)=>r.ok
      ? `<li class="ok-rota">${esc(r.base)} OK - ${esc(r.tipo)} - ${esc(r.tempo)}ms</li>`
      : `<li class="erro-rota">${esc(r.base)} falhou - HTTP ${esc(r.status||"-")} - ${esc(r.erro)}</li>`
    ).join("");
    if(el)el.innerHTML=`Diagnóstico concluído:<ul class="diagnostico-lista">${html}</ul>`;
  }catch(e){
    if(el)el.textContent=erroAmigavel(e);
  }
}


function salvarPreferencias(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({filtros:getFiltros(),sortCampo:estado.sortCampo,sortDir:estado.sortDir}))}catch{}}
function restaurarPreferencias(){try{const pref=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(!pref)return;const mapa={busca:"#fBusca",status:"#fStatus",forma:"#fForma",rapido:"#fRapido",inicio:"#fInicio",fim:"#fFim"};Object.entries(pref.filtros||{}).forEach(([k,v])=>{const el=$(mapa[k]);if(el)el.value=v||""});if(pref.sortCampo)estado.sortCampo=pref.sortCampo;if(pref.sortDir)estado.sortDir=pref.sortDir}catch{}}
function obterPorId(id){return estado.registros.find(r=>String(idRegistro(r))===String(id))}
function selecionadosValidos(){return[...estado.selecionados].map(obterPorId).filter(Boolean)}
function selecionadosBaixaveis(){return selecionadosValidos().filter(estaEmAberto)}
function valorSelecionado(){return selecionadosBaixaveis().reduce((a,i)=>a+saldoItem(i),0)}
function paginaAtualItens(){const total=Math.max(1,Math.ceil(estado.filtrados.length/estado.porPagina));estado.pagina=Math.min(Math.max(estado.pagina,1),total);return estado.filtrados.slice((estado.pagina-1)*estado.porPagina,(estado.pagina-1)*estado.porPagina+estado.porPagina)}
function atualizarBarraLote(){const qtd=estado.selecionados.size;$("#txtSelecionados").textContent=`${qtd} selecionado${qtd===1?"":"s"}`;$("#txtValorSelecionado").textContent=`${moeda(valorSelecionado())} em aberto`;$("#btnBaixaLote").disabled=selecionadosBaixaveis().length===0;$("#btnLimparSelecao").disabled=qtd===0;$("#btnExportarSelecionados").disabled=qtd===0;const ids=paginaAtualItens().map(idRegistro).filter(Boolean);const marc=ids.filter(id=>estado.selecionados.has(String(id))).length;const chk=$("#chkTodos");if(chk){chk.checked=ids.length>0&&marc===ids.length;chk.indeterminate=marc>0&&marc<ids.length}}
function valorSort(item,c){return{vencimento:dataItem(item),cliente:campoTexto(item,["cliente","aluno","nomeCliente","responsavel"],""),descricao:campoTexto(item,["descricao","observacao","documento","referencia"],""),forma:campoTexto(item,["formaPagamento","forma","meioPagamento","pagamento"],""),valor:valorBruto(item),recebido:valorRecebido(item),saldo:saldoItem(item),status:normalizarStatus(item.status)}[c]??""}
function ordenarFiltrados(){const dir=estado.sortDir==="desc"?-1:1;estado.filtrados.sort((a,b)=>{const av=valorSort(a,estado.sortCampo),bv=valorSort(b,estado.sortCampo);return(typeof av==="number"||typeof bv==="number"?(Number(av)-Number(bv)):String(av).localeCompare(String(bv),"pt-BR",{numeric:true}))*dir});document.querySelectorAll(".sort-btn").forEach(btn=>{btn.classList.toggle("ativo",btn.dataset.sort===estado.sortCampo);btn.textContent=btn.textContent.replace(/[ ▲▼]$/g,"")+(btn.dataset.sort===estado.sortCampo?(estado.sortDir==="asc"?" ▲":" ▼"):"")})}
function aplicarFiltrosLocais(){const f=getFiltros(),busca=normalizar(f.busca),fimSemana=somarDiasIso(hojeIso(),7);estado.filtrados=estado.registros.filter(item=>{const status=normalizarStatus(item.status),forma=normalizar(campoTexto(item,["formaPagamento","forma","meioPagamento","pagamento"],"")),data=dataItem(item),texto=[campoTexto(item,["cliente","aluno","nomeCliente","responsavel"],""),campoTexto(item,["descricao","observacao","documento","referencia"],""),campoTexto(item,["documento","numeroDocumento","parcela"],"")].join(" ").toLowerCase();if(f.status&&status!==f.status)return false;if(f.forma&&forma!==f.forma)return false;if(busca&&!texto.includes(busca))return false;if(f.inicio&&data&&data<f.inicio)return false;if(f.fim&&data&&data>f.fim)return false;if(f.rapido==="vencidos"&&!estaVencido(item))return false;if(f.rapido==="hoje"&&!venceHoje(item))return false;if(f.rapido==="amanha"&&!venceAmanha(item))return false;if(f.rapido==="semana"&&!(data&&data>=hojeIso()&&data<=fimSemana&&estaEmAberto(item)))return false;if(f.rapido==="aberto_com_saldo"&&!estaEmAberto(item))return false;return true});ordenarFiltrados();salvarPreferencias()}
function atualizarResumo(){const r=estado.registros,res=estado.resumoApi||{};$("#kpiTotal").textContent=res.total??r.length;$("#kpiAbertos").textContent=res.abertos??r.filter(x=>normalizarStatus(x.status)==="aberto").length;$("#kpiRecebidos").textContent=res.recebidos??r.filter(x=>normalizarStatus(x.status)==="recebido").length;$("#kpiParciais").textContent=res.parciais??r.filter(x=>normalizarStatus(x.status)==="parcial").length;$("#kpiVencidos").textContent=r.filter(estaVencido).length;$("#kpiValorBruto").textContent=moeda(res.valorBruto??r.reduce((a,x)=>a+valorBruto(x),0));$("#kpiValorLiquido").textContent=moeda(res.valorLiquido??r.reduce((a,x)=>a+valorRecebido(x),0));$("#kpiValorAberto").textContent=moeda(res.valorAberto??r.reduce((a,x)=>estaEmAberto(x)?a+saldoItem(x):a,0))}
function renderTabela(){const tbody=$("#tbRecebimentos tbody");if(!tbody)return;aplicarFiltrosLocais();atualizarResumo();const total=Math.max(1,Math.ceil(estado.filtrados.length/estado.porPagina)),page=paginaAtualItens();$("#contadorLista").textContent=`${estado.filtrados.length} registro${estado.filtrados.length===1?"":"s"}`;$("#paginaAtual").textContent=`Página ${estado.pagina} de ${total}`;$("#btnAnterior").disabled=estado.pagina<=1;$("#btnProxima").disabled=estado.pagina>=total;if(!page.length){tbody.innerHTML=`<tr><td colspan="11" class="empty">Nenhum recebimento encontrado.</td></tr>`;atualizarBarraLote();return}tbody.innerHTML=page.map(item=>{const id=idRegistro(item),status=normalizarStatus(item.status),dias=textoDias(item),sel=estado.selecionados.has(String(id)),classe=`${estaVencido(item)?"linha-vencida":(venceHoje(item)?"linha-hoje":(venceAmanha(item)?"linha-amanha":""))} ${sel?"linha-selecionada":""}`.trim();return`<tr class="${classe}"><td class="check"><input type="checkbox" data-select="${esc(id)}" ${sel?"checked":""}></td><td>${esc(dataBr(dataItem(item)))}</td><td>${esc(campoTexto(item,["cliente","aluno","nomeCliente","responsavel"],"-"))}</td><td>${esc(campoTexto(item,["descricao","observacao","documento","referencia"],"-"))}</td><td>${esc(campoTexto(item,["formaPagamento","forma","meioPagamento","pagamento"],"-"))}</td><td class="num">${esc(moeda(valorBruto(item)))}</td><td class="num">${esc(moeda(valorRecebido(item)))}</td><td class="num">${esc(moeda(saldoItem(item)))}</td><td><span class="dias ${esc(dias.classe)}">${esc(dias.texto)}</span></td><td><span class="badge ${esc(status)}">${esc(status)}</span></td><td class="acoes"><div class="row-actions"><button class="btn btn-light" data-detalhe="${esc(id)}">Detalhes</button><button class="btn btn-light" data-duplicar="${esc(id)}">Duplicar</button><button class="btn btn-light" data-comprovante="${esc(id)}">Comprovante</button><button class="btn btn-light" data-baixar="${esc(id)}" ${estaEmAberto(item)?"":"disabled"}>Baixar</button><button class="btn btn-light" data-estornar="${esc(id)}" ${["recebido","parcial"].includes(status)?"":"disabled"}>Estornar</button><button class="btn btn-light" data-cancelar="${esc(id)}" ${id&&!["cancelado","estornado","recebido"].includes(status)?"":"disabled"}>Cancelar</button></div></td></tr>`}).join("");atualizarBarraLote()}
async function carregar(){const tbody=$("#tbRecebimentos tbody");if(tbody)tbody.innerHTML=`<tr><td colspan="11" class="empty">Carregando recebimentos...</td></tr>`;aviso("");try{const dados=await listarRecebimentos(getFiltros());estado.registros=obterLista(dados);estado.resumoApi=dados?.resumo||(dados&&!Array.isArray(dados)?dados:null);estado.selecionados=new Set([...estado.selecionados].filter(id=>obterPorId(id)));renderTabela();const base=await obterBaseAtiva(); statusIntegracao("");if(!estado.registros.length)aviso("A API respondeu, mas não retornou recebimentos para os filtros atuais."); else if(!listaPossuiIds())aviso("Alguns registros retornaram sem ID. Ações como baixa, estorno e cancelamento podem ficar indisponíveis nesses itens.")}catch(e){const msg=erroAmigavel(e);if(tbody)tbody.innerHTML=`<tr><td colspan="11" class="empty">${esc(msg)}</td></tr>`;statusIntegracao("");aviso("Não foi possível carregar a rota de recebimentos. Verifique se o servidor está iniciado e se a rota financeira está ativa.")}}
function abrirModalBaixa(id){const item=obterPorId(id);if(!item)return alert("Recebimento não encontrado.");const financeiroId=campoTexto(item,["lancamentoFinanceiroId","financeiroId","id"],"");const mensalidadeId=campoTexto(item,["mensalidadeId"],"");if(!financeiroId&&!mensalidadeId)return alert("Este recebimento não possui vínculo financeiro para baixa.");const params=new URLSearchParams();if(financeiroId)params.set("financeiroId",financeiroId);if(mensalidadeId)params.set("mensalidadeId",mensalidadeId);params.set("receberAgora","1");params.set("origem","recebimentos");location.href=`/pages/financeiro/index.html?${params.toString()}`}
function abrirModalNovo(){["#novoCliente","#novoDocumento","#novoDescricao","#novoVencimento","#novoValor","#novoForma","#novoObs"].forEach(id=>{const el=$(id);if(el)el.value=""});$("#tituloModalNovo").textContent="Novo recebimento";$("#novoStatus").value="aberto";$("#modalNovo").showModal()}
function duplicarRecebimento(id){const i=obterPorId(id);if(!i)return;$("#tituloModalNovo").textContent="Duplicar recebimento";$("#novoCliente").value=campoTexto(i,["cliente","aluno","nomeCliente","responsavel"],"");$("#novoDocumento").value=(campoTexto(i,["documento","numeroDocumento","parcela"],"")+" - cópia").trim();$("#novoDescricao").value=campoTexto(i,["descricao","observacao","referencia"],"");$("#novoVencimento").value=hojeIso();$("#novoValor").value=valorBruto(i)?valorBruto(i).toFixed(2):"";$("#novoForma").value=campoTexto(i,["formaPagamento","forma","meioPagamento","pagamento"],"");$("#novoStatus").value="aberto";$("#novoObs").value="Duplicado pela tela de recebimentos";$("#modalNovo").showModal()}
async function salvarNovo(){const cliente=$("#novoCliente").value.trim(),descricao=$("#novoDescricao").value.trim(),valor=Number($("#novoValor").value||0),vencimento=$("#novoVencimento").value;const erros=validarPayloadRecebimento({cliente,descricao,vencimento,valor});if(erros.length){alert("Preencha corretamente: "+erros.join(", ")+".");return}const status=$("#novoStatus").value,forma=$("#novoForma").value;try{await criarRecebimento({tipo:"receber",cliente,aluno:cliente,descricao,documento:$("#novoDocumento").value.trim(),vencimento,dataVencimento:vencimento,valor,valorBruto:valor,valorRecebido:status==="recebido"?valor:0,valorLiquido:status==="recebido"?valor:0,valorRestante:status==="recebido"?0:valor,formaPagamento:forma,forma,status,observacao:$("#novoObs").value.trim()});$("#modalNovo").close();estado.pagina=1;await carregar()}catch(e){alert(erroAmigavel(e))}}
async function confirmarBaixa(){return alert('A baixa agora é realizada pelo motor financeiro oficial. Clique em Baixar novamente para abrir o Financeiro.')}
function abrirLote(){const itens=selecionadosBaixaveis();if(!itens.length)return;$("#loteQtd").textContent=`${itens.length} título${itens.length===1?"":"s"} selecionado${itens.length===1?"":"s"}`;$("#loteValor").textContent=`${moeda(valorSelecionado())} em aberto`;$("#loteForma").value="pix";$("#loteObs").value="Baixa em lote pela tela de recebimentos";$("#modalLote").showModal()}
async function confirmarLote(){const itens=selecionadosBaixaveis(),forma=$("#loteForma").value,observacao=$("#loteObs").value;let ok=0,falhas=0;for(const item of itens){const id=idRegistro(item);try{await baixarRecebimento(id,{valor:saldoItem(item),valorPago:saldoItem(item),valorRecebido:saldoItem(item),valorBaixa:saldoItem(item),desconto:0,acrescimo:0,juros:0,formaPagamento:forma,forma,observacao});estado.selecionados.delete(String(id));ok++}catch{falhas++}}$("#modalLote").close();await carregar();if(falhas)alert(`Baixa em lote concluída parcialmente. Sucesso: ${ok}. Falhas: ${falhas}.`)}
async function confirmarEstorno(id){const motivo=prompt("Motivo do estorno:","Estorno solicitado pelo usuário");if(motivo===null)return;try{await estornarRecebimento(id,motivo);estado.selecionados.delete(String(id));await carregar()}catch(e){alert(erroAmigavel(e))}}
async function confirmarCancelamento(id){const motivo=prompt("Motivo do cancelamento:","Cancelamento solicitado pelo usuário");if(motivo===null)return;try{await cancelarRecebimento(id,motivo);estado.selecionados.delete(String(id));await carregar()}catch(e){alert(erroAmigavel(e))}}
function csvCell(v){return`"${String(v??"").replaceAll('"','""')}"`}
function montarCsv(lista){return[["Vencimento","Cliente","Descricao","Documento","Forma","Valor","Recebido","Saldo","Dias","Status"],...lista.map(i=>[dataBr(dataItem(i)),campoTexto(i,["cliente","aluno","nomeCliente","responsavel"],""),campoTexto(i,["descricao","observacao","referencia"],""),campoTexto(i,["documento","numeroDocumento","parcela"],""),campoTexto(i,["formaPagamento","forma","meioPagamento","pagamento"],""),valorBruto(i).toFixed(2).replace(".",","),valorRecebido(i).toFixed(2).replace(".",","),saldoItem(i).toFixed(2).replace(".",","),textoDias(i).texto,normalizarStatus(i.status)])].map(l=>l.map(csvCell).join(";")).join("\n")}
function baixarCsv(csv,nome){const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}
function exportarCsv(){aplicarFiltrosLocais();baixarCsv(montarCsv(estado.filtrados),`fusion_recebimentos_${hojeIso()}.csv`)}
function exportarSelecionados(){const lista=selecionadosValidos();if(lista.length)baixarCsv(montarCsv(lista),`fusion_recebimentos_selecionados_${hojeIso()}.csv`)}
function selecionarFiltrados(){aplicarFiltrosLocais();estado.filtrados.forEach(i=>{const id=idRegistro(i);if(id)estado.selecionados.add(String(id))});renderTabela()}
function abrirDetalhe(id){const i=obterPorId(id);if(!i)return;estado.detalheId=id;const dias=textoDias(i),mov=i.movimentacoes||i.historico||i.baixas||[];const lista=Array.isArray(mov)&&mov.length?mov.map(m=>`<li>${esc(dataBr(m.data||m.createdAt||""))} - ${esc(m.tipo||m.acao||"movimento")} - ${esc(moeda(m.valor||0))} ${m.observacao?"- "+esc(m.observacao):""}</li>`).join(""):"<li>Nenhuma movimentação registrada no retorno da API.</li>";$("#detalheConteudo").innerHTML=`<div class="detail-item"><span>Cliente</span><strong>${esc(campoTexto(i,["cliente","aluno","nomeCliente","responsavel"],"-"))}</strong></div><div class="detail-item"><span>Status</span><strong>${esc(normalizarStatus(i.status))}</strong></div><div class="detail-item detail-wide"><span>Descrição</span><strong>${esc(campoTexto(i,["descricao","observacao","referencia"],"-"))}</strong></div><div class="detail-item"><span>Documento</span><strong>${esc(campoTexto(i,["documento","numeroDocumento","parcela"],"-"))}</strong></div><div class="detail-item"><span>Vencimento</span><strong>${esc(dataBr(dataItem(i)))}</strong></div><div class="detail-item"><span>Valor bruto</span><strong>${esc(moeda(valorBruto(i)))}</strong></div><div class="detail-item"><span>Recebido</span><strong>${esc(moeda(valorRecebido(i)))}</strong></div><div class="detail-item"><span>Saldo</span><strong>${esc(moeda(saldoItem(i)))}</strong></div><div class="detail-item"><span>Dias</span><strong>${esc(dias.texto)}</strong></div><div class="timeline"><h4>Histórico</h4><ul>${lista}</ul></div>`;$("#btnBaixarDetalhe").disabled=!estaEmAberto(i);$("#modalDetalhe").showModal()}

function agruparResumo(lista, campoFn){
  const mapa=new Map();
  lista.forEach((item)=>{
    const chave=campoFn(item)||"Não informado";
    const atual=mapa.get(chave)||{qtd:0,bruto:0,recebido:0,saldo:0};
    atual.qtd++;
    atual.bruto+=valorBruto(item);
    atual.recebido+=valorRecebido(item);
    atual.saldo+=saldoItem(item);
    mapa.set(chave,atual);
  });
  return [...mapa.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),"pt-BR"));
}
function linhasResumoTabela(grupos){
  if(!grupos.length)return'<tr><td colspan="5">Sem dados</td></tr>';
  return grupos.map(([nome,r])=>`<tr><td>${esc(nome)}</td><td class="num">${esc(r.qtd)}</td><td class="num">${esc(moeda(r.bruto))}</td><td class="num">${esc(moeda(r.recebido))}</td><td class="num">${esc(moeda(r.saldo))}</td></tr>`).join("");
}
function abrirResumo(){
  aplicarFiltrosLocais();
  const lista=estado.filtrados;
  const total=lista.reduce((a,i)=>a+valorBruto(i),0);
  const recebido=lista.reduce((a,i)=>a+valorRecebido(i),0);
  const saldo=lista.reduce((a,i)=>a+saldoItem(i),0);
  const porStatus=agruparResumo(lista,(i)=>normalizarStatus(i.status));
  const porForma=agruparResumo(lista,(i)=>campoTexto(i,["formaPagamento","forma","meioPagamento","pagamento"],"Não informado"));
  const vencidos=lista.filter(estaVencido);
  $("#resumoConteudo").innerHTML=`
    <div class="summary-box"><h4>Totais filtrados</h4><p class="summary-total">${esc(moeda(recebido))}</p><p>${esc(lista.length)} registros | Bruto: ${esc(moeda(total))} | Saldo: ${esc(moeda(saldo))}</p><p>Vencidos: ${esc(vencidos.length)} | Valor vencido: ${esc(moeda(vencidos.reduce((a,i)=>a+saldoItem(i),0)))}</p></div>
    <div class="summary-box"><h4>Por status</h4><table><thead><tr><th>Status</th><th class="num">Qtd</th><th class="num">Bruto</th><th class="num">Recebido</th><th class="num">Saldo</th></tr></thead><tbody>${linhasResumoTabela(porStatus)}</tbody></table></div>
    <div class="summary-box detail-wide"><h4>Por forma de pagamento</h4><table><thead><tr><th>Forma</th><th class="num">Qtd</th><th class="num">Bruto</th><th class="num">Recebido</th><th class="num">Saldo</th></tr></thead><tbody>${linhasResumoTabela(porForma)}</tbody></table></div>
  `;
  $("#modalResumo").showModal();
}
function exportarResumoCsv(){
  aplicarFiltrosLocais();
  const porStatus=agruparResumo(estado.filtrados,(i)=>normalizarStatus(i.status));
  const porForma=agruparResumo(estado.filtrados,(i)=>campoTexto(i,["formaPagamento","forma","meioPagamento","pagamento"],"Não informado"));
  const linhas=[["Tipo","Grupo","Qtd","Bruto","Recebido","Saldo"]];
  porStatus.forEach(([nome,r])=>linhas.push(["Status",nome,r.qtd,r.bruto.toFixed(2).replace(".",","),r.recebido.toFixed(2).replace(".",","),r.saldo.toFixed(2).replace(".",",")]));
  porForma.forEach(([nome,r])=>linhas.push(["Forma",nome,r.qtd,r.bruto.toFixed(2).replace(".",","),r.recebido.toFixed(2).replace(".",","),r.saldo.toFixed(2).replace(".",",")]));
  baixarCsv(linhas.map(l=>l.map(csvCell).join(";")).join("\n"),`fusion_recebimentos_resumo_${hojeIso()}.csv`);
}
function imprimirResumo(){
  const conteudo=$("#resumoConteudo")?.innerHTML||"";
  const w=window.open("","_blank");
  if(!w)return;
  w.document.write(`<html><head><title>Resumo de Recebimentos</title><style>body{font-family:Arial;padding:24px}h1{color:#ff6600}.summary-box{border:1px solid #ddd;margin:12px 0;padding:12px;border-radius:8px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:7px;text-align:left}.num{text-align:right}.summary-total{font-size:22px;font-weight:bold;color:#ff6600}</style></head><body><h1>Fusion ERP</h1><h2>Resumo de Recebimentos</h2>${conteudo}<p>Emitido em ${new Date().toLocaleString("pt-BR")}</p><hr><p>Assinatura: __________________________________________</p><script>window.print();setTimeout(()=>window.close(),700)</script></body></html>`);
  w.document.close();
}

function imprimirComprovante(id){const i=obterPorId(id);if(!i)return;const html=`<html><head><title>Comprovante</title><style>body{font-family:Arial;padding:24px}h1{color:#ff6600}.box{border:1px solid #ddd;padding:14px;margin:10px 0}p{margin:6px 0}</style></head><body><h1>Fusion ERP</h1><h2>Comprovante de Recebimento</h2><p><b>Documento fiscal interno:</b> Recebimento</p><div class="box"><p><b>Cliente:</b> ${esc(campoTexto(i,["cliente","aluno","nomeCliente","responsavel"],"-"))}</p><p><b>Descrição:</b> ${esc(campoTexto(i,["descricao","observacao","referencia"],"-"))}</p><p><b>Documento:</b> ${esc(campoTexto(i,["documento","numeroDocumento","parcela"],"-"))}</p><p><b>Vencimento:</b> ${esc(dataBr(dataItem(i)))}</p><p><b>Valor:</b> ${esc(moeda(valorBruto(i)))}</p><p><b>Recebido:</b> ${esc(moeda(valorRecebido(i)))}</p><p><b>Saldo:</b> ${esc(moeda(saldoItem(i)))}</p><p><b>Status:</b> ${esc(normalizarStatus(i.status))}</p></div><p>Emitido em ${new Date().toLocaleString("pt-BR")}</p><hr><p>Assinatura: __________________________________________</p><script>window.print();setTimeout(()=>window.close(),500)</script></body></html>`;const w=window.open("","_blank");if(w){w.document.write(html);w.document.close()}}


function abrirBaixaAutomaticaPorUrl(){
  const p=new URLSearchParams(location.search);
  const alvo=p.get("recebimentoId")||p.get("rec")||p.get("id")||p.get("financeiroId")||p.get("lancamentoFinanceiroId")||p.get("mensalidadeId");
  if(!alvo)return;
  const item=estado.registros.find(r=>String(idRegistro(r))===String(alvo)||String(r.lancamentoFinanceiroId||"")===String(alvo)||String(r.mensalidadeId||"")===String(alvo));
  if(!item){aviso(`Recebimento de origem ${alvo} não encontrado na lista atual. Use a pesquisa ou atualize a página.`);return;}
  if(!estaEmAberto(item)){aviso("Este recebimento já está quitado ou não está disponível para baixa.");return;}
  setTimeout(()=>abrirModalBaixa(idRegistro(item)),250);
}

document.addEventListener("DOMContentLoaded",()=>{restaurarPreferencias();$("#btnAtualizar")?.addEventListener("click",carregar);$("#btnDiagnostico")?.addEventListener("click",executarDiagnostico);$("#btnExportar")?.addEventListener("click",exportarCsv);$("#btnResumo")?.addEventListener("click",abrirResumo);$("#btnExportarSelecionados")?.addEventListener("click",exportarSelecionados);$("#btnImprimir")?.addEventListener("click",()=>window.print());$("#btnSelecionarFiltrados")?.addEventListener("click",selecionarFiltrados);$("#btnBaixaLote")?.addEventListener("click",abrirLote);$("#btnLimparSelecao")?.addEventListener("click",()=>{estado.selecionados.clear();renderTabela()});$("#btnFiltrar")?.addEventListener("click",()=>{estado.pagina=1;carregar().then(abrirBaixaAutomaticaPorUrl)});$("#btnLimpar")?.addEventListener("click",()=>{["#fBusca","#fStatus","#fForma","#fRapido","#fInicio","#fFim"].forEach(id=>{const el=$(id);if(el)el.value=""});estado.sortCampo="vencimento";estado.sortDir="asc";localStorage.removeItem(STORAGE_KEY);estado.pagina=1;carregar()});["#fBusca","#fRapido","#fStatus","#fForma","#fInicio","#fFim"].forEach(id=>{$(id)?.addEventListener("input",()=>{estado.pagina=1;renderTabela()});$(id)?.addEventListener("change",()=>{estado.pagina=1;renderTabela()})});document.querySelectorAll(".sort-btn").forEach(btn=>btn.addEventListener("click",()=>{const c=btn.dataset.sort;if(estado.sortCampo===c)estado.sortDir=estado.sortDir==="asc"?"desc":"asc";else{estado.sortCampo=c;estado.sortDir=c==="vencimento"?"asc":"desc"}estado.pagina=1;renderTabela()}));$("#chkTodos")?.addEventListener("change",ev=>{paginaAtualItens().forEach(i=>{const id=idRegistro(i);if(id){if(ev.target.checked)estado.selecionados.add(String(id));else estado.selecionados.delete(String(id))}});renderTabela()});$("#btnAnterior")?.addEventListener("click",()=>{estado.pagina--;renderTabela()});$("#btnProxima")?.addEventListener("click",()=>{estado.pagina++;renderTabela()});$("#btnFecharModal")?.addEventListener("click",()=>$("#modalBaixa").close());$("#btnCancelarBaixa")?.addEventListener("click",()=>$("#modalBaixa").close());$("#btnConfirmarBaixa")?.addEventListener("click",async(ev)=>{setBusy(ev.currentTarget,true);try{await confirmarBaixa()}finally{setBusy(ev.currentTarget,false)}});$("#btnNovo")?.addEventListener("click",abrirModalNovo);$("#btnFecharNovo")?.addEventListener("click",()=>$("#modalNovo").close());$("#btnCancelarNovo")?.addEventListener("click",()=>$("#modalNovo").close());$("#btnSalvarNovo")?.addEventListener("click",async(ev)=>{setBusy(ev.currentTarget,true);try{await salvarNovo()}finally{setBusy(ev.currentTarget,false)}});$("#btnFecharLote")?.addEventListener("click",()=>$("#modalLote").close());$("#btnCancelarLote")?.addEventListener("click",()=>$("#modalLote").close());$("#btnConfirmarLote")?.addEventListener("click",async(ev)=>{setBusy(ev.currentTarget,true);try{await confirmarLote()}finally{setBusy(ev.currentTarget,false)}});$("#btnFecharResumo")?.addEventListener("click",()=>$("#modalResumo").close());$("#btnImprimirResumo")?.addEventListener("click",imprimirResumo);$("#btnExportarResumo")?.addEventListener("click",exportarResumoCsv);$("#btnFecharDetalhe")?.addEventListener("click",()=>$("#modalDetalhe").close());$("#btnDuplicarDetalhe")?.addEventListener("click",()=>{$("#modalDetalhe").close();duplicarRecebimento(estado.detalheId)});$("#btnBaixarDetalhe")?.addEventListener("click",()=>{$("#modalDetalhe").close();abrirModalBaixa(estado.detalheId)});$("#btnComprovanteDetalhe")?.addEventListener("click",()=>imprimirComprovante(estado.detalheId));$("#tbRecebimentos")?.addEventListener("change",ev=>{const chk=ev.target.closest("[data-select]");if(!chk)return;if(chk.checked)estado.selecionados.add(String(chk.dataset.select));else estado.selecionados.delete(String(chk.dataset.select));renderTabela()});$("#tbRecebimentos")?.addEventListener("click",ev=>{const d=ev.target.closest("[data-detalhe]"),du=ev.target.closest("[data-duplicar]"),co=ev.target.closest("[data-comprovante]"),b=ev.target.closest("[data-baixar]"),e=ev.target.closest("[data-estornar]"),c=ev.target.closest("[data-cancelar]");if(d)abrirDetalhe(d.dataset.detalhe);if(du)duplicarRecebimento(du.dataset.duplicar);if(co)imprimirComprovante(co.dataset.comprovante);if(b&&!b.disabled)abrirModalBaixa(b.dataset.baixar);if(e&&!e.disabled)confirmarEstorno(e.dataset.estornar);if(c&&!c.disabled)confirmarCancelamento(c.dataset.cancelar)});carregar()});
