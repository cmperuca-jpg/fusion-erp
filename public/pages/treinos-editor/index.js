(function(){
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  $("treinoId").value = params.get("id") || "";

  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
  let treino = null;

  async function carregar(){
    const id = $("treinoId").value.trim();
    if(!id){ alert("Informe o ID do treino."); return; }
    const res = await fetch(`/api/treinos-editor/${encodeURIComponent(id)}`, {cache:"no-store"});
    const json = await res.json();
    if(!json.ok){ alert(json.mensagem || "Treino não encontrado."); return; }
    treino = json.dados;
    render();
  }

  function render(){
    $("cabecalho").innerHTML = `
      <h2>${esc(treino.nome || "Treino")}</h2>
      <div class="grid">
        <label>Nome <input id="nome" value="${esc(treino.nome)}"></label>
        <label>Objetivo <input id="objetivo" value="${esc(treino.objetivo)}"></label>
        <label>Status <input id="status" value="${esc(treino.status)}"></label>
      </div>
      <p class="muted">Aluno: ${esc(treino.aluno)} · Professor: ${esc(treino.professor)} · Versão: ${esc(treino.versao)}</p>
      <button id="btnSalvarCab" class="ok">Salvar cabeçalho</button>
    `;
    $("btnSalvarCab").onclick = salvarCabecalho;

    const linhas = (treino.exercicios || []).map(ex => `
      <tr data-id="${esc(ex.id)}">
        <td><input data-campo="ordem" value="${esc(ex.ordem)}"></td>
        <td><input data-campo="nome" value="${esc(ex.nome)}"></td>
        <td><input data-campo="series" value="${esc(ex.series)}"></td>
        <td><input data-campo="repeticoes" value="${esc(ex.repeticoes)}"></td>
        <td><input data-campo="carga" value="${esc(ex.carga)}"></td>
        <td><input data-campo="descanso" value="${esc(ex.descanso)}"></td>
        <td class="actions"><button class="ok salvar">Salvar</button><button class="danger remover">Remover</button></td>
      </tr>
    `).join("");

    $("exercicios").innerHTML = `
      <h2>Exercícios</h2>
      <table class="table">
        <thead><tr><th>Ordem</th><th>Exercício</th><th>Séries</th><th>Repetições</th><th>Carga</th><th>Descanso</th><th>Ações</th></tr></thead>
        <tbody>${linhas || `<tr><td colspan="7" class="empty">Nenhum exercício.</td></tr>`}</tbody>
      </table>
      <h3>Adicionar exercício</h3>
      <div class="grid">
        <label>Nome <input id="novoNome"></label>
        <label>Séries <input id="novoSeries" value="3"></label>
        <label>Repetições <input id="novoReps" value="10-12"></label>
      </div>
      <button id="btnAdd">Adicionar</button>
    `;

    document.querySelectorAll(".salvar").forEach(btn => btn.onclick = salvarExercicio);
    document.querySelectorAll(".remover").forEach(btn => btn.onclick = removerExercicio);
    $("btnAdd").onclick = adicionar;
  }

  async function salvarCabecalho(){
    await fetch(`/api/treinos-editor/${encodeURIComponent(treino.id)}`, {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ nome:$("nome").value, objetivo:$("objetivo").value, status:$("status").value })
    });
    carregar();
  }

  async function salvarExercicio(ev){
    const tr = ev.target.closest("tr");
    const dados = {};
    tr.querySelectorAll("input[data-campo]").forEach(i => dados[i.dataset.campo] = i.value);
    await fetch(`/api/treinos-editor/${encodeURIComponent(treino.id)}/exercicios/${encodeURIComponent(tr.dataset.id)}`, {
      method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(dados)
    });
    carregar();
  }

  async function removerExercicio(ev){
    const tr = ev.target.closest("tr");
    await fetch(`/api/treinos-editor/${encodeURIComponent(treino.id)}/exercicios/${encodeURIComponent(tr.dataset.id)}`, { method:"DELETE" });
    carregar();
  }

  async function adicionar(){
    await fetch(`/api/treinos-editor/${encodeURIComponent(treino.id)}/exercicios`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ nome:$("novoNome").value, series:$("novoSeries").value, repeticoes:$("novoReps").value })
    });
    carregar();
  }

  $("btnCarregar").onclick = carregar;
  if($("treinoId").value) carregar();
})();
