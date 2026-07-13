const $ = (id) => document.getElementById(id);

function setStatus(texto){ $("status").textContent = texto; }
function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function dataBR(v){ const s=String(v||'').slice(0,10); return s ? s.split('-').reverse().join('/') : ''; }

function lerTextoArquivo(file){
  return file.arrayBuffer().then(buf => {
    try { return new TextDecoder('windows-1252').decode(buf); }
    catch { return new TextDecoder('utf-8').decode(buf); }
  });
}
async function lerArquivos(){
  const input = $("arquivos");
  const lista = Array.from(input.files || []);
  if(!lista.length) throw new Error("Selecione os arquivos TXT da avaliação.");
  const arquivos = {};
  for(const file of lista){
    arquivos[file.name] = await lerTextoArquivo(file);
  }
  return arquivos;
}
async function postJson(url, body){
  const resp = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const json = await resp.json().catch(()=>({}));
  if(!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `Erro HTTP ${resp.status}`);
  return json;
}
function atualizarKpis(d={}){
  $("kpiAvaliacoes").textContent = d.normalizadas ?? d.total_linhas_avaliacao ?? 0;
  $("kpiImportaveis").textContent = d.importaveis ?? d.normalizadas ?? 0;
  $("kpiSemAluno").textContent = d.sem_aluno ?? 0;
  $("kpiDuplicadas").textContent = d.duplicadas_base ?? 0;
}
function renderPreview(lista=[]){
  const tbody = $("preview");
  if(!Array.isArray(lista) || !lista.length){ tbody.innerHTML = '<tr><td colspan="7">Nenhuma avaliação para exibir.</td></tr>'; return; }
  tbody.innerHTML = lista.map(av => `<tr><td>${esc(av.alunoNome||'')}</td><td>${esc(av.id_legado_aluno||'')}</td><td>${esc(dataBR(av.data)||'')}</td><td>${esc(av.peso||'')}</td><td>${esc(av.altura||'')}</td><td>${esc(av.imc||'')}</td><td>${esc(av.objetivo||'')}</td></tr>`).join('');
}
function renderRelatorio(d){ $("relatorio").textContent = JSON.stringify(d, null, 2); }
async function executar(tipo){
  try{
    setStatus("Lendo arquivos...");
    const arquivos = await lerArquivos();
    let url = "/api/importador-access/avaliacoes/analisar";
    let body = { arquivos };
    if(tipo === "simular") { url = "/api/importador-access/avaliacoes/importar-local"; body.dryRun = true; }
    if(tipo === "importar") url = "/api/importador-access/avaliacoes/importar-local";
    setStatus("Processando avaliações...");
    const dados = await postJson(url, body);
    atualizarKpis(dados);
    renderPreview(dados.preview || []);
    renderRelatorio(dados);
    setStatus(tipo === "importar" ? "Importação local concluída." : "Análise concluída.");
  }catch(e){ setStatus(e.message || "Erro ao processar avaliações."); }
}


async function executarServidor(importar=false){
  try{
    setStatus(importar ? "Importando arquivos do servidor..." : "Analisando arquivos do servidor...");
    const url = importar ? "/api/importador-access/avaliacoes/importar-local-arquivos" : "/api/importador-access/avaliacoes/analisar-local";
    const dados = await postJson(url, importar ? { dryRun:false } : {});
    atualizarKpis(dados);
    renderPreview(dados.preview || []);
    renderRelatorio(dados);
    setStatus(importar ? "Importação do servidor concluída." : "Análise dos arquivos do servidor concluída.");
  }catch(e){ setStatus(e.message || "Erro ao processar arquivos do servidor."); }
}

$("btnAnalisar").addEventListener("click", () => executar("analisar"));
$("btnSimular").addEventListener("click", () => executar("simular"));
$("btnImportar").addEventListener("click", () => executar("importar"));
$("btnAnalisarServidor").addEventListener("click", () => executarServidor(false));
$("btnImportarServidor").addEventListener("click", () => executarServidor(true));
$("arquivos").addEventListener("change", () => {
  const nomes = Array.from($("arquivos").files || []).map(f => f.name);
  setStatus(nomes.length ? `${nomes.length} arquivo(s) selecionado(s): ${nomes.slice(0,4).join(', ')}${nomes.length>4?'...':''}` : "Selecione os arquivos TXT da avaliação.");
});

fetch('/api/importador-access/avaliacoes/status', {cache:'no-store'})
  .then(r=>r.json()).then(renderRelatorio).catch(()=>{});
