import {
  baixarPagamento,
  cancelarPagamento,
  criarPagamento,
  diagnosticarPagamentos,
  duplicarPagamento,
  editarPagamento,
  estornarPagamento,
  excluirPagamento,
  listarPagamentos,
  obterHistoricoPagamento,
  baixarPagamentosEmLote,
  listarConciliacaoPagamentos,
  fecharPeriodoPagamentos,
  obterBaseAtiva,
  parcelarPagamento
} from "./api.js";

const estado = { registros: [], filtrados: [], pagina: 1, porPagina: 12, resumoApi: null };
const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

function hojeIso(){ return new Date().toISOString().slice(0, 10); }
function moeda(v){ return Number(v || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" }); }
function dataBr(v){ if(!v)return "-"; const s=String(v).slice(0,10), p=s.split("-"); return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : s; }
function normalizar(v){ return String(v || "").trim().toLowerCase(); }
function normalizarStatus(s){ s=normalizar(s || "aberto"); if(["quitado","baixado","pago"].includes(s))return "pago"; if(["pendente","em aberto","vencido"].includes(s))return "aberto"; if(["parcialmente pago","baixado parcial"].includes(s))return "parcial"; return s || "aberto"; }
function campoTexto(item, nomes, padrao=""){ for(const n of nomes){ if(item?.[n]!==undefined && item?.[n]!==null && String(item[n]).trim()!=="") return item[n]; } return padrao; }
function campoValor(item, nomes, padrao=0){ for(const n of nomes){ if(item?.[n]!==undefined && item?.[n]!==null) return item[n]; } return padrao; }
function idRegistro(item){ return campoTexto(item, ["id","_id","codigo","uuid","chave"], ""); }
function dataItem(item){ return campoTexto(item, ["vencimento","dataVencimento","data","competencia"], "").slice(0,10); }
function valorTotal(item){ return Number(campoValor(item, ["valor","valorBruto","total","valorOriginal"], 0)); }
function valorPago(item){ return Number(campoValor(item, ["valorPago","pago","valorLiquido","liquido","valorBaixado"], 0)); }
function saldoItem(item){ const s=campoValor(item, ["valorRestante","saldo","valorAberto"], null); return s!==null ? Number(s) : Math.max(0, valorTotal(item)-valorPago(item)); }
function estaEmAberto(item){ return ["aberto","parcial"].includes(normalizarStatus(item.status)) && saldoItem(item)>0; }
function estaVencido(item){ const d=dataItem(item); return d && d < hojeIso() && estaEmAberto(item); }
function obterLista(d){ if(Array.isArray(d))return d; for(const k of ["lancamentos","pagamentos","contasPagar","items","data","resultado"]){ if(Array.isArray(d?.[k])) return d[k]; } return []; }
function getFiltros(){ return { busca: $("#fBusca")?.value || "", status: $("#fStatus")?.value || "", forma: $("#fForma")?.value || "", inicio: $("#fInicio")?.value || "", fim: $("#fFim")?.value || "" }; }
function aviso(txt){ const el=$("#avisoSistema"); if(!el)return; el.textContent=txt; el.hidden=!txt; }
function statusIntegracao(txt){ const el=$("#statusIntegracao"); if(!el)return; el.textContent=txt; el.hidden=!txt; }
function erroAmigavel(e){ const msg=String(e?.message || "Erro inesperado"); if(e?.status===404)return "Rota não encontrada. Confirme se o módulo de pagamentos está ativo no server.mjs."; if(msg.includes("Failed to fetch"))return "Não foi possível conectar ao servidor local. Verifique se o Fusion ERP está iniciado."; return msg; }
function obterPorId(id){ return estado.registros.find((r) => String(idRegistro(r)) === String(id)); }

function aplicarFiltrosLocais(){
  const f=getFiltros(), busca=normalizar(f.busca);
  estado.filtrados=estado.registros.filter((item) => {
    const status=normalizarStatus(item.status), forma=normalizar(campoTexto(item,["formaPagamento","forma","meioPagamento"],"")), data=dataItem(item);
    const texto=[campoTexto(item,["fornecedor","credor","nome"],""), campoTexto(item,["descricao","observacao","referencia"],""), campoTexto(item,["documento","numeroDocumento"],""), campoTexto(item,["categoria"],"")].join(" ").toLowerCase();
    if(f.status && status!==f.status)return false;
    if(f.forma && forma!==f.forma)return false;
    if(f.inicio && data && data<f.inicio)return false;
    if(f.fim && data && data>f.fim)return false;
    if(busca && !texto.includes(busca))return false;
    return true;
  });
}

function renderRank(id, dados){
  const el=$(id); if(!el)return;
  const lista=Array.isArray(dados) ? dados.slice(0,5) : [];
  if(!lista.length){ el.innerHTML='<p class="muted">Sem dados agrupados.</p>'; return; }
  el.innerHTML=lista.map((x)=>`<div class="rank-row"><span>${esc(x.nome)}</span><strong>${esc(moeda(x.valorAberto ?? x.valorPrevisto ?? 0))}</strong></div>`).join("");
}

function atualizarResumo(){
  const r=estado.registros, res=estado.resumoApi || {};
  $("#kpiTotal").textContent = res.total ?? r.length;
  $("#kpiAbertos").textContent = res.abertos ?? r.filter((x)=>normalizarStatus(x.status)==="aberto").length;
  $("#kpiPagos").textContent = res.pagos ?? r.filter((x)=>normalizarStatus(x.status)==="pago").length;
  $("#kpiParciais").textContent = res.parciais ?? r.filter((x)=>normalizarStatus(x.status)==="parcial").length;
  $("#kpiVencidos").textContent = res.vencidos ?? r.filter(estaVencido).length;
  $("#kpiValorPrevisto").textContent = moeda(res.valorPrevisto ?? r.reduce((a,x)=>a+valorTotal(x),0));
  $("#kpiValorPago").textContent = moeda(res.valorPago ?? r.reduce((a,x)=>a+valorPago(x),0));
  $("#kpiValorAberto").textContent = moeda(res.valorAberto ?? r.reduce((a,x)=>a+saldoItem(x),0));
  const vencido = res.valorVencido ?? r.filter(estaVencido).reduce((a,x)=>a+saldoItem(x),0);
  if($("#kpiValorVencido")) $("#kpiValorVencido").textContent = moeda(vencido);
  renderRank("#rankFornecedores", res.porFornecedor);
  renderRank("#rankCategorias", res.porCategoria);
}

function renderTabela(){
  const tbody=$("#tbPagamentos tbody"); if(!tbody)return;
  aplicarFiltrosLocais(); atualizarResumo();
  const total=Math.max(1, Math.ceil(estado.filtrados.length / estado.porPagina));
  estado.pagina=Math.min(Math.max(estado.pagina,1), total);
  const page=estado.filtrados.slice((estado.pagina-1)*estado.porPagina, (estado.pagina-1)*estado.porPagina+estado.porPagina);
  $("#contadorLista").textContent=`${estado.filtrados.length} registro${estado.filtrados.length===1?"":"s"}`;
  $("#paginaAtual").textContent=`Página ${estado.pagina} de ${total}`;
  $("#btnAnterior").disabled=estado.pagina<=1; $("#btnProxima").disabled=estado.pagina>=total;
  if(!page.length){ tbody.innerHTML=`<tr><td colspan="11" class="empty">Nenhum pagamento encontrado.</td></tr>`; return; }
  tbody.innerHTML=page.map((item) => {
    const id=idRegistro(item), status=normalizarStatus(item.status);
    return `<tr class="${estaVencido(item)?"linha-vencida":""}"><td><input type="checkbox" class="sel-pagamento" value="${esc(id)}" ${estaEmAberto(item)?"":"disabled"}></td><td>${esc(dataBr(dataItem(item)))}</td><td>${esc(campoTexto(item,["fornecedor","credor","nome"],"-"))}</td><td>${esc(campoTexto(item,["descricao","observacao","referencia"],"-"))}</td><td>${esc(campoTexto(item,["categoria"],"-"))}</td><td>${esc(campoTexto(item,["formaPagamento","forma","meioPagamento"],"-"))}</td><td class="num">${esc(moeda(valorTotal(item)))}</td><td class="num">${esc(moeda(valorPago(item)))}</td><td class="num">${esc(moeda(saldoItem(item)))}</td><td><span class="badge ${esc(status)}">${esc(status)}</span></td><td class="acoes"><button class="btn btn-light" data-editar="${esc(id)}">Editar</button><button class="btn btn-light" data-baixar="${esc(id)}" ${estaEmAberto(item)?"":"disabled"}>Baixar</button><button class="btn btn-light" data-duplicar="${esc(id)}">Duplicar</button><button class="btn btn-light" data-historico="${esc(id)}">Histórico</button><button class="btn btn-light" data-estornar="${esc(id)}" ${["pago","parcial"].includes(status)?"":"disabled"}>Estornar</button><button class="btn btn-light" data-cancelar="${esc(id)}" ${id && !["cancelado","estornado","pago"].includes(status)?"":"disabled"}>Cancelar</button><button class="btn btn-danger" data-excluir="${esc(id)}">Excluir</button></td></tr>`;
  }).join("");
}

async function carregar(){
  const tbody=$("#tbPagamentos tbody"); if(tbody)tbody.innerHTML=`<tr><td colspan="11" class="empty">Carregando pagamentos...</td></tr>`;
  aviso("");
  try{
    const dados=await listarPagamentos(getFiltros());
    estado.registros=obterLista(dados);
    estado.resumoApi=dados?.resumo || (dados && !Array.isArray(dados) ? dados : null);
    renderTabela();
    const base=obterBaseAtiva(); statusIntegracao(base ? `Integração ativa: ${base}` : "");
    if(!estado.registros.length) aviso("");
  }catch(e){
    if(tbody)tbody.innerHTML=`<tr><td colspan="11" class="empty">${esc(erroAmigavel(e))}</td></tr>`;
    statusIntegracao(""); aviso("Não foi possível carregar a rota de pagamentos.");
  }
}

function abrirModalBaixa(id){ const item=obterPorId(id); $("#baixaId").value=id; $("#baixaValor").value=saldoItem(item)>0 ? saldoItem(item).toFixed(2) : ""; $("#baixaForma").value="pix"; $("#baixaObs").value=""; $("#modalBaixa").showModal(); }
async function confirmarBaixa(){ const id=$("#baixaId").value, valor=Number($("#baixaValor").value||0); if(!id||valor<=0){alert("Informe um valor válido.");return;} try{ await baixarPagamento(id,{valor,formaPagamento:$("#baixaForma").value,forma:$("#baixaForma").value,observacao:$("#baixaObs").value}); $("#modalBaixa").close(); await carregar(); }catch(e){alert(erroAmigavel(e));} }
function limparModalPagamento(){ ["#novoId","#novoFornecedor","#novoDocumento","#novoDescricao","#novoCategoria","#novoVencimento","#novoValor","#novoObs"].forEach((id)=>{const el=$(id); if(el)el.value="";}); $("#novoForma").value="pix"; $("#novoStatus").value="aberto"; }
function abrirNovo(){ limparModalPagamento(); $("#tituloModalNovo").textContent="Novo pagamento"; $("#btnSalvarNovo").textContent="Salvar pagamento"; $("#modalNovo").showModal(); }
function abrirEditar(id){ const item=obterPorId(id); if(!item)return; limparModalPagamento(); $("#tituloModalNovo").textContent="Editar pagamento"; $("#btnSalvarNovo").textContent="Salvar alterações"; $("#novoId").value=id; $("#novoFornecedor").value=campoTexto(item,["fornecedor","credor","nome"],""); $("#novoDocumento").value=campoTexto(item,["documento","numeroDocumento"],""); $("#novoDescricao").value=campoTexto(item,["descricao","observacao","referencia"],""); $("#novoCategoria").value=campoTexto(item,["categoria"],""); $("#novoVencimento").value=dataItem(item); $("#novoValor").value=valorTotal(item).toFixed(2); $("#novoForma").value=campoTexto(item,["formaPagamento","forma"],"pix"); $("#novoStatus").value=normalizarStatus(item.status); $("#novoObs").value=campoTexto(item,["observacao"],""); $("#modalNovo").showModal(); }
async function salvarNovo(){ const id=$("#novoId").value, fornecedor=$("#novoFornecedor").value.trim(), descricao=$("#novoDescricao").value.trim(), vencimento=$("#novoVencimento").value, valor=Number($("#novoValor").value||0); if(!fornecedor||!descricao||!vencimento||valor<=0){alert("Preencha fornecedor, descrição, vencimento e valor.");return;} const status=$("#novoStatus").value, forma=$("#novoForma").value; const payload={tipo:"pagar",fornecedor,credor:fornecedor,descricao,documento:$("#novoDocumento").value.trim(),categoria:$("#novoCategoria").value.trim(),vencimento,dataVencimento:vencimento,valor,valorBruto:valor,valorPago:status==="pago"?valor:0,valorLiquido:status==="pago"?valor:0,valorRestante:status==="pago"?0:valor,formaPagamento:forma,forma,status,observacao:$("#novoObs").value.trim()}; try{ if(id) await editarPagamento(id,payload); else await criarPagamento(payload); $("#modalNovo").close(); estado.pagina=1; await carregar(); }catch(e){alert(erroAmigavel(e));} }
function abrirParcelar(){ ["#parcFornecedor","#parcDocumento","#parcDescricao","#parcCategoria","#parcPrimeiroVencimento","#parcValorTotal"].forEach((id)=>{const el=$(id); if(el)el.value="";}); $("#parcQtd").value="2"; $("#parcIntervalo").value="30"; $("#parcForma").value="boleto"; $("#modalParcelar").showModal(); }
async function salvarParcelar(){ const fornecedor=$("#parcFornecedor").value.trim(), descricao=$("#parcDescricao").value.trim(), vencimento=$("#parcPrimeiroVencimento").value, valor=Number($("#parcValorTotal").value||0), parcelas=Number($("#parcQtd").value||0); if(!fornecedor||!descricao||!vencimento||valor<=0||parcelas<1){alert("Preencha fornecedor, descrição, primeiro vencimento, valor total e parcelas.");return;} try{ await parcelarPagamento({fornecedor,credor:fornecedor,descricao,documento:$("#parcDocumento").value.trim(),categoria:$("#parcCategoria").value.trim(),vencimento,dataVencimento:vencimento,valor,valorBruto:valor,parcelas,intervaloDias:Number($("#parcIntervalo").value||30),formaPagamento:$("#parcForma").value,forma:$("#parcForma").value}); $("#modalParcelar").close(); estado.pagina=1; await carregar(); }catch(e){alert(erroAmigavel(e));} }
async function confirmarDuplicacao(id){ if(!confirm("Duplicar este pagamento como uma nova conta em aberto?"))return; try{ await duplicarPagamento(id); estado.pagina=1; await carregar(); }catch(e){alert(erroAmigavel(e));} }
async function confirmarExclusao(id){ if(!confirm("Excluir definitivamente este pagamento do JSON local?"))return; try{ await excluirPagamento(id); await carregar(); }catch(e){alert(erroAmigavel(e));} }
async function confirmarEstorno(id){ const motivo=prompt("Motivo do estorno:","Estorno solicitado pelo usuário"); if(motivo===null)return; try{ await estornarPagamento(id,motivo); await carregar(); }catch(e){alert(erroAmigavel(e));} }
async function confirmarCancelamento(id){ const motivo=prompt("Motivo do cancelamento:","Cancelamento solicitado pelo usuário"); if(motivo===null)return; try{ await cancelarPagamento(id,motivo); await carregar(); }catch(e){alert(erroAmigavel(e));} }
function csvCell(v){ return `"${String(v ?? "").replaceAll('"','""')}"`; }
function exportarCsv(){ aplicarFiltrosLocais(); const linhas=[["Vencimento","Fornecedor","Descricao","Documento","Categoria","Forma","Valor","Pago","Saldo","Status"],...estado.filtrados.map((i)=>[dataBr(dataItem(i)),campoTexto(i,["fornecedor","credor","nome"],""),campoTexto(i,["descricao","observacao","referencia"],""),campoTexto(i,["documento","numeroDocumento"],""),campoTexto(i,["categoria"],""),campoTexto(i,["formaPagamento","forma"],""),valorTotal(i).toFixed(2).replace(".",","),valorPago(i).toFixed(2).replace(".",","),saldoItem(i).toFixed(2).replace(".",","),normalizarStatus(i.status)])]; const csv=linhas.map((l)=>l.map(csvCell).join(";")).join("\n"); const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a"); a.href=url; a.download=`fusion_pagamentos_${hojeIso()}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
async function executarDiagnostico(){ const el=$("#statusIntegracao"); if(el){el.hidden=false;el.textContent="Executando diagnóstico das rotas...";} try{ const res=await diagnosticarPagamentos(); if(el)el.innerHTML=`Diagnóstico concluído:<ul>${res.map((r)=>r.ok?`<li class="ok-rota">${esc(r.base)} OK - ${esc(r.tipo)} - ${esc(r.tempo)}ms</li>`:`<li class="erro-rota">${esc(r.base)} falhou - HTTP ${esc(r.status||"-")} - ${esc(r.erro)}</li>`).join("")}</ul>`; }catch(e){ if(el)el.textContent=erroAmigavel(e); } }


function idsSelecionados(){ return [...document.querySelectorAll(".sel-pagamento:checked")].map((el)=>el.value).filter(Boolean); }
async function baixarLoteSelecionados(){
  const ids=idsSelecionados();
  if(!ids.length){ alert("Selecione ao menos um pagamento em aberto."); return; }
  const forma=prompt("Forma de pagamento para o lote:", "pix");
  if(forma===null)return;
  if(!confirm(`Baixar ${ids.length} pagamento(s) pelo saldo em aberto?`))return;
  try{ const r=await baixarPagamentosEmLote(ids,{formaPagamento:forma,forma,observacao:"Baixa em lote pelo ZIP 14"}); alert(`Baixa em lote concluída: ${r.baixados || 0} sucesso(s), ${r.falhas || 0} falha(s).`); await carregar(); }
  catch(e){ alert(erroAmigavel(e)); }
}
async function abrirConciliacao(){
  try{
    const dados=await listarConciliacaoPagamentos(getFiltros());
    const res=dados?.resumo || {};
    alert(`Conciliação de pagamentos\nPendentes: ${res.pendentes || 0}\nPagos sem forma: ${res.pagosSemForma || 0}\nDivergentes: ${res.divergentes || 0}\nValor pendente: ${moeda(res.valorPendente || 0)}`);
  }catch(e){ alert(erroAmigavel(e)); }
}
async function fecharPeriodoAtual(){
  const f=getFiltros();
  const inicio=f.inicio || prompt("Data inicial do fechamento (AAAA-MM-DD):", hojeIso().slice(0,8)+"01");
  if(!inicio)return;
  const fim=f.fim || prompt("Data final do fechamento (AAAA-MM-DD):", hojeIso());
  if(!fim)return;
  try{ const r=await fecharPeriodoPagamentos({inicio,fim,observacao:"Fechamento gerado pelo ZIP 14"}); const res=r?.fechamento?.resumo || r?.resumo || {}; alert(`Fechamento salvo. Total: ${res.total || 0}; Valor pago: ${moeda(res.valorPago || 0)}; Valor aberto: ${moeda(res.valorAberto || 0)}.`); }
  catch(e){ alert(erroAmigavel(e)); }
}
async function verHistorico(id){
  try{ const r=await obterHistoricoPagamento(id); const hist=r?.historico || []; alert(hist.length ? hist.map((h)=>`${dataBr(h.data)} - ${h.tipo || "movimento"} - ${moeda(h.valor || 0)} - ${h.observacao || ""}`).join("\n") : "Sem histórico para este pagamento."); }
  catch(e){ alert(erroAmigavel(e)); }
}


document.addEventListener("click", (ev) => {
  const b=ev.target.closest("button"); if(!b)return;
  if(b.id==="btnAtualizar")carregar(); if(b.id==="btnFiltrar"){estado.pagina=1; carregar();} if(b.id==="btnLimpar"){["#fBusca","#fStatus","#fForma","#fInicio","#fFim"].forEach((id)=>$(id).value=""); estado.pagina=1; carregar();}
  if(b.id==="btnNovo")abrirNovo(); if(b.id==="btnParcelar")abrirParcelar(); if(b.id==="btnExportar")exportarCsv(); if(b.id==="btnDiagnostico")executarDiagnostico(); if(b.id==="btnBaixarLote")baixarLoteSelecionados(); if(b.id==="btnConciliacao")abrirConciliacao(); if(b.id==="btnFechamento")fecharPeriodoAtual(); if(b.id==="btnAnterior"){estado.pagina--; renderTabela();} if(b.id==="btnProxima"){estado.pagina++; renderTabela();}
  if(b.id==="btnFecharModal"||b.id==="btnCancelarBaixa")$("#modalBaixa").close(); if(b.id==="btnConfirmarBaixa")confirmarBaixa(); if(b.id==="btnFecharNovo"||b.id==="btnCancelarNovo")$("#modalNovo").close(); if(b.id==="btnSalvarNovo")salvarNovo();
  if(b.id==="btnFecharParcelar"||b.id==="btnCancelarParcelar")$("#modalParcelar").close(); if(b.id==="btnSalvarParcelar")salvarParcelar();
  if(b.dataset.historico)verHistorico(b.dataset.historico); if(b.dataset.editar)abrirEditar(b.dataset.editar); if(b.dataset.baixar)abrirModalBaixa(b.dataset.baixar); if(b.dataset.duplicar)confirmarDuplicacao(b.dataset.duplicar); if(b.dataset.estornar)confirmarEstorno(b.dataset.estornar); if(b.dataset.cancelar)confirmarCancelamento(b.dataset.cancelar); if(b.dataset.excluir)confirmarExclusao(b.dataset.excluir);
});

carregar();


async function carregarDashboardZip15() {
  try {
    const resp = await fetch('/api/financeiro/pagamentos/dashboard');
    const data = await resp.json();
    if (!data || !data.ok || !data.cards) return;
    const set = (id, obj) => { const el = document.getElementById(id); if (el) el.textContent = `${obj.quantidade || 0} / R$ ${Number(obj.valor || 0).toFixed(2)}`; };
    set('zip15-hoje', data.cards.vencendoHoje || {});
    set('zip15-7dias', data.cards.vencendo7Dias || {});
    set('zip15-atraso', data.cards.emAtraso || {});
    set('zip15-pagas', data.cards.pagasPeriodo || {});
  } catch (err) {
    console.warn('Dashboard ZIP 15 indisponível', err);
  }
}

document.addEventListener('DOMContentLoaded', carregarDashboardZip15);
