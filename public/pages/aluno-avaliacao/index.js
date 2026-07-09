const $ = (id) => document.getElementById(id);

const GRUPOS = [
  { titulo: "Dados principais", campos: [["aluno_nome","Aluno"],["professorNome","Professor"],["professor_nome","Professor"],["data","Data"],["hora","Hora"],["objetivo","Objetivo"],["observacoes","Observações", true]] },
  { titulo: "Composição corporal", campos: [["peso","Peso"],["altura","Altura"],["imc","IMC"],["classificacao_imc","Classificação IMC"],["percentual_gordura","% Gordura"],["percentual_ideal","% Ideal"],["massa_magra","Massa magra"],["massa_gorda","Massa gorda"],["agua_corporal","Água corporal"],["gordura_visceral","Gordura visceral"],["idade_metabolica","Idade metabólica"],["tmb","TMB"],["composicao_resultado","Resultado", true]] },
  { titulo: "Perímetros e RCQ", campos: [["pescoco","Pescoço"],["punho","Punho"],["ombro","Ombro"],["braco_relaxado_direito","Braço relaxado direito"],["braco_relaxado_esquerdo","Braço relaxado esquerdo"],["braco_contraido_direito","Braço contraído direito"],["braco_contraido_esquerdo","Braço contraído esquerdo"],["antebraco_direito","Antebraço direito"],["antebraco_esquerdo","Antebraço esquerdo"],["torax_relaxado","Tórax relaxado"],["torax_inspirado","Tórax inspirado"],["cintura","Cintura"],["abdomen","Abdome"],["quadril","Quadril"],["coxa_proximal_direita","Coxa proximal direita"],["coxa_proximal_esquerda","Coxa proximal esquerda"],["coxa_medial_direita","Coxa medial direita"],["coxa_medial_esquerda","Coxa medial esquerda"],["panturrilha_direita","Panturrilha direita"],["panturrilha_esquerda","Panturrilha esquerda"],["rcq","RCQ"],["rcq_classificacao","Classificação RCQ", true],["soma_perimetros","Soma dos perímetros"]] },
  { titulo: "Dobras cutâneas e protocolo", campos: [["protocolo_dobras","Protocolo"],["subescapular","Subescapular"],["bicipital","Bicipital"],["tricipital","Tricipital"],["axilar_media","Axilar média"],["supra_iliaca","Supra-ilíaca"],["peitoral","Peitoral"],["dobra_abdominal","Abdominal"],["dobra_coxa","Coxa"],["dobra_panturrilha","Panturrilha"]] },
  { titulo: "Cardiorrespiratória", campos: [["condicao_fisica","Condição física"],["protocolo_cardio","Protocolo"],["vo2_obtido","VO² obtido"],["vo2_previsto","VO² previsto"],["deficit_aerobico","Déficit aeróbico"],["cardio_info","Resultado", true]] },
  { titulo: "Neuromotores", campos: [["flexao_bracos","Flexão de braços"],["flexao_resultado","Resultado flexão"],["abdominal_repeticoes","Abdominal"],["abdominal_resultado","Resultado abdominal"],["banco_wells","Banco de Wells"],["wells_resultado","Resultado Wells"]] },
  { titulo: "Anamnese", campos: [["pratica_atividade","Pratica atividade física"],["medicamentos","Medicamentos"],["cirurgias","Cirurgias"],["doencas_familia","Doenças na família"],["alergias","Alergias"],["restricoes_medicas","Restrições médicas"],["lesoes","Lesões"],["anamnese_observacoes","Observações", true]] }
];

const METRICAS_COMPARACAO = [
  ["peso", "Peso"], ["imc", "IMC"], ["percentual_gordura", "% Gordura"], ["massa_magra", "Massa magra"], ["massa_gorda", "Massa gorda"], ["cintura", "Cintura"], ["quadril", "Quadril"], ["rcq", "RCQ"], ["abdomen", "Abdome"], ["soma_perimetros", "Soma perímetros"]
];

const FOTOS = [
  ["foto_frente_base64", "Frente"], ["foto_costas_base64", "Costas"], ["foto_lateral_direita_base64", "Lateral direita"], ["foto_lateral_esquerda_base64", "Lateral esquerda"]
];

function sessaoAluno(){
  try { const s = JSON.parse(localStorage.getItem("fusion_aluno_treino_login") || "null"); if (s?.alunoId) return s; } catch {}
  const p = new URLSearchParams(location.search);
  const alunoId = p.get("alunoId") || p.get("id");
  const alunoNome = p.get("alunoNome") || p.get("nome") || "Aluno";
  return alunoId ? { alunoId, alunoNome } : null;
}
function dataISO(v){ if(!v) return ""; const s=String(v).slice(0,10); const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if(m) return s; const b=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return b ? `${b[3]}-${b[2]}-${b[1]}` : s; }
function dataBR(v){ const s=dataISO(v); const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || "-"); }
function valor(obj, key){ return obj?.[key] ?? obj?.[key.replaceAll("_","")] ?? obj?.[key.replaceAll("_","").toLowerCase()] ?? ""; }
function temValor(v){ return v !== undefined && v !== null && String(v).trim() !== ""; }
function num(v){ const n = Number(String(v ?? "").replace(/[^0-9,.-]/g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; }
function fmt(v){ return temValor(v) ? String(v) : "-"; }
function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function extrairLista(payload){ if(Array.isArray(payload)) return payload; for(const k of ["avaliacoes","dados","data","itens","registros"]) if(Array.isArray(payload?.[k])) return payload[k]; return []; }
async function buscarAvaliacoes(alunoId){
  const urls = [`/api/avaliacoes?alunoId=${encodeURIComponent(alunoId)}`, `/api/avaliacoes?aluno_id=${encodeURIComponent(alunoId)}`];
  for (const url of urls) {
    try { const r = await fetch(url, { cache:"no-store" }); const j = await r.json().catch(()=>({})); if(r.ok){ const l=extrairLista(j); if(l.length || url.includes("aluno_id")) return l; } } catch {}
  }
  return [];
}
function dataAvaliacao(a){ return dataISO(a?.data || a?.criado_em || a?.criadoEm || a?.createdAt); }
function ordenar(a,b){ return String(dataAvaliacao(b)).localeCompare(String(dataAvaliacao(a))); }
function renderComparacao(atual, anterior){
  if(!anterior){ $("comparacaoInfo").textContent = "Não existe avaliação anterior para comparar."; $("comparacao").innerHTML = `<div class="alerta">Esta é a primeira avaliação registrada para este aluno.</div>`; return; }
  $("comparacaoInfo").textContent = `Comparando ${dataBR(dataAvaliacao(atual))} com ${dataBR(dataAvaliacao(anterior))}.`;
  $("comparacao").innerHTML = METRICAS_COMPARACAO.map(([key, nome]) => {
    const a = valor(atual,key), b = valor(anterior,key);
    if(!temValor(a) && !temValor(b)) return "";
    const na=num(a), nb=num(b); let diff="-", cls="neutro";
    if(na !== null && nb !== null){ const d = na - nb; diff = `${d > 0 ? "+" : ""}${d.toFixed(2).replace(".", ",")}`; cls = d > 0 ? "positivo" : d < 0 ? "negativo" : "neutro"; }
    return `<article class="metric-card"><h3>${esc(nome)}</h3><div class="metric-row"><div><span>Anterior</span><strong>${esc(fmt(b))}</strong></div><div><span>Atual</span><strong>${esc(fmt(a))}</strong></div><div><span>Diferença</span><strong class="diff ${cls}">${esc(diff)}</strong></div></div></article>`;
  }).join("") || `<div class="alerta">Não há campos numéricos suficientes para comparação.</div>`;
}
function renderCompleto(atual){
  $("resultadoCompleto").innerHTML = GRUPOS.map(grupo => {
    const campos = grupo.campos.map(([key,label,full]) => {
      const v = valor(atual,key);
      if(!temValor(v)) return "";
      return `<div class="campo ${full ? "full" : ""}"><span>${esc(label)}</span><strong>${esc(fmt(v))}</strong></div>`;
    }).join("");
    if(!campos) return "";
    return `<section class="grupo"><h3>${esc(grupo.titulo)}</h3><div class="campo-grid">${campos}</div></section>`;
  }).join("");
}
function renderFotos(atual){
  const fotos = FOTOS.map(([key,label]) => [valor(atual,key), label]).filter(([src]) => temValor(src));
  if(!fotos.length){ $("fotosBox").classList.add("hidden"); return; }
  $("fotosBox").classList.remove("hidden");
  $("fotosPosturais").innerHTML = fotos.map(([src,label]) => `<div class="foto-card"><span>${esc(label)}</span><img src="${esc(src)}" alt="${esc(label)}"></div>`).join("");
}
async function carregar(){
  const sessao = sessaoAluno();
  if(!sessao?.alunoId){ location.replace("/pages/aluno-login/index.html"); return; }
  $("tituloAluno").textContent = sessao.alunoNome || "Minha avaliação";
  const lista = (await buscarAvaliacoes(sessao.alunoId)).sort(ordenar);
  if(!lista.length){ $("alerta").textContent = "Nenhuma avaliação física foi encontrada para este aluno."; $("alerta").classList.remove("hidden"); return; }
  const atual = lista[0], anterior = lista[1] || null;
  $("dataAtual").textContent = dataBR(dataAvaliacao(atual));
  $("dataAnterior").textContent = anterior ? dataBR(dataAvaliacao(anterior)) : "Sem anterior";
  $("professor").textContent = valor(atual,"professorNome") || valor(atual,"professor_nome") || valor(atual,"professor") || "-";
  $("objetivo").textContent = valor(atual,"objetivo") || "-";
  renderComparacao(atual, anterior);
  renderCompleto(atual);
  renderFotos(atual);
}
$("btnVoltar").onclick = () => {
  const s = sessaoAluno();
  location.href = s?.alunoId ? `/pages/aluno-treinos/index.html?alunoId=${encodeURIComponent(s.alunoId)}` : "/pages/aluno-treinos/index.html";
};
$("btnAtualizar").onclick = carregar;
carregar();
