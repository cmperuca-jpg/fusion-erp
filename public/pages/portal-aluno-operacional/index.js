(function(){
  const $ = (id) => document.getElementById(id);
  const hoje = new Date().toISOString().slice(0,10);
  $("data").value = hoje;
  $("alunoId").value = new URLSearchParams(location.search).get("id") || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";

  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
  function moeda(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
  function vazio(txt){return `<div class="empty">${esc(txt)}</div>`;}

  async function carregar(){
    const alunoId = $("alunoId").value.trim();
    const data = $("data").value || hoje;
    if(!alunoId){ alert("Informe o ID do aluno."); return; }

    const res = await fetch(`/api/portal-aluno-operacional/alunos/${encodeURIComponent(alunoId)}?data=${encodeURIComponent(data)}`, {cache:"no-store"});
    const json = await res.json();
    if(!json.ok){ alert(json.mensagem || "Erro ao carregar portal."); return; }

    $("resumo").innerHTML = `
      <div class="metric">Aluno<b>${esc(json.aluno?.nome || json.aluno?.aluno || "-")}</b></div>
      <div class="metric">Serviços<b>${json.resumo?.totalServicos || 0}</b></div>
      <div class="metric">Aulas hoje<b>${json.resumo?.aulasHoje || 0}</b></div>
      <div class="metric">Aberto<b>${moeda(json.resumo?.financeiroAberto || 0)}</b></div>
    `;

    $("agendaHoje").innerHTML = json.agendaHoje?.length ? json.agendaHoje.map(a => `
      <div class="item"><strong>${esc(a.turma)}</strong><div>${esc(a.horario || "-")} · ${esc(a.professor || "-")} · ${esc(a.sala || "-")}</div><span class="tag">${esc(a.modalidade || "-")}</span></div>
    `).join("") : vazio("Sem aulas previstas para hoje.");

    $("servicos").innerHTML = json.servicosAtivos?.length ? json.servicosAtivos.map(s => `
      <div class="item"><strong>${esc(s.nome || s.turma || s.modalidade)}</strong><div>${esc(s.professor || "-")} · ${esc(s.horario || "-")}</div><div class="muted">${esc(s.tipoCobranca || "Mensal")} · ${moeda(s.valor || 0)}</div></div>
    `).join("") : vazio("Nenhum serviço ativo.");

    $("treinos").innerHTML = json.treinosAtivos?.length ? json.treinosAtivos.map(t => `
      <div class="item"><strong>${esc(t.nome || t.objetivo || "Treino")}</strong><div class="muted">${esc(t.professorNome || t.professor || "")} ${esc(t.dataInicio || t.criadoEm || "")}</div></div>
    `).join("") : vazio("Nenhum treino ativo.");

    $("financeiro").innerHTML = `
      <div class="item"><strong>Total em aberto</strong><div>${moeda(json.financeiro?.totalAberto || 0)}</div></div>
      ${(json.financeiro?.abertos || []).slice(0,6).map(f => `<div class="item"><strong>${esc(f.descricao || f.plano || "Cobrança")}</strong><div>${moeda(f.total || f.valorOriginal || f.valor || 0)} · ${esc(f.status || "-")}</div></div>`).join("")}
    `;

    $("frequencia").innerHTML = json.frequencias?.length ? json.frequencias.slice(0,10).map(f => `
      <div class="item"><strong>${esc(f.data)} · ${esc(f.turma || f.servico || "")}</strong><div>${esc(f.status || "-")} · ${esc(f.professor || "")}</div></div>
    `).join("") : vazio("Nenhuma frequência registrada.");
  }

  $("btnCarregar").onclick = carregar;
  carregar();
})();
