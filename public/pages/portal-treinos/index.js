(function(){
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  $("alunoId").value = params.get("id") || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";
  let execucoes = {};

  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}

  async function carregar(){
    const alunoId = $("alunoId").value.trim();
    const res = await fetch(`/api/treinos-operacional/portal/alunos/${encodeURIComponent(alunoId)}?apenasAtivos=true`, {cache:"no-store"});
    const json = await res.json();
    if(!json.ok){ alert(json.mensagem || "Erro ao carregar treinos."); return; }
    if(!json.treinos?.length){ $("treinos").innerHTML = `<div class="empty">Nenhum treino ativo.</div>`; return; }

    $("treinos").innerHTML = json.treinos.map(t => `
      <article class="treino">
        <header>
          <div><h2>${esc(t.nome)}</h2><div>${esc(t.objetivo || "")} · ${esc(t.tipoDivisao || "")} · ${esc(t.professor || "")}</div></div>
          <button class="ok iniciar" data-treino="${esc(t.id)}">Iniciar</button>
        </header>
        ${(t.exercicios || []).map(ex => `
          <div class="ex">
            <div>
              <strong>${esc(ex.ordem || "")}. ${esc(ex.nome)}</strong>
              <div class="muted">${esc(ex.series)} séries · ${esc(ex.repeticoes)} reps · carga ${esc(ex.carga || "-")} · descanso ${esc(ex.descanso || "-")}</div>
            </div>
            <button data-treino="${esc(t.id)}" data-ex="${esc(ex.id)}" class="concluir">Concluir</button>
          </div>
        `).join("")}
      </article>
    `).join("");

    document.querySelectorAll(".iniciar").forEach(btn => btn.onclick = () => iniciar(btn.dataset.treino));
    document.querySelectorAll(".concluir").forEach(btn => btn.onclick = () => concluir(btn.dataset.treino, btn.dataset.ex));
  }

  async function iniciar(treinoId){
    const res = await fetch(`/api/treinos-operacional/treinos/${encodeURIComponent(treinoId)}/iniciar`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ origem:"portal_aluno" }) });
    const json = await res.json();
    if(json.ok){ execucoes[treinoId] = json.dados.id; alert("Treino iniciado."); }
    else alert(json.mensagem || "Erro.");
  }

  async function concluir(treinoId, exId){
    if(!execucoes[treinoId]) await iniciar(treinoId);
    const execId = execucoes[treinoId];
    const res = await fetch(`/api/treinos-operacional/execucoes/${encodeURIComponent(execId)}/exercicios/${encodeURIComponent(exId)}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ concluido:true }) });
    const json = await res.json();
    if(json.ok) alert(`Registrado: ${json.resumo.percentual}% concluído.`);
    else alert(json.mensagem || "Erro.");
  }

  $("btnCarregar").onclick = carregar;
  carregar();
})();
