(function(){
  const $ = (id) => document.getElementById(id);
  const hoje = new Date().toISOString().slice(0,10);
  $("data").value = hoje;
  $("alunoId").value = new URLSearchParams(location.search).get("id") || "153dcca5-1b2c-475b-8ce7-438e95e69ac5";

  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
  function moeda(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
  function vazio(txt){return `<div class="empty">${esc(txt)}</div>`;}
  function dataBr(v){const s=String(v||"").slice(0,10);return s?s.split("-").reverse().join("/"):"-";}
  function itemFin(f, usarSaldo=false){const valor=usarSaldo?(f.saldoPortal??f.valorRestante??f.saldoRestante??0):(f.valorPortal??f.total??f.valorOriginal??f.valor??0);return `<div class="item"><strong>${esc(f.descricao || f.plano || f.competencia || "Cobranca")}</strong><div>${moeda(valor)} - ${esc(f.statusExibicao || f.status || "-")} - ${dataBr(f.vencimento)}</div></div>`;}

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
      <div class="metric">Divida ativa<b>${moeda(json.resumo?.financeiroAberto || 0)}</b></div>
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
      <div class="item destaque"><strong>Proxima mensalidade</strong><div>${json.financeiro?.proximaMensalidade ? `${moeda(json.financeiro.proximaMensalidade.valorPortal || 0)} - ${esc(json.financeiro.proximaMensalidade.statusExibicao || "Programada")} - ${dataBr(json.financeiro.proximaMensalidade.vencimento)}` : "Sem mensalidade programada"}</div></div>
      <div class="item"><strong>Divida ativa</strong><div>${moeda(json.financeiro?.totalDividaAtiva || 0)}</div></div>
      ${(json.financeiro?.dividaAtiva || []).slice(0,6).map(f => itemFin(f, true)).join("")}
      ${(json.financeiro?.venceHoje || []).length ? `<div class="item"><strong>Vence hoje</strong></div>${(json.financeiro.venceHoje || []).slice(0,6).map(f => itemFin(f, true)).join("")}` : ""}
      ${(json.financeiro?.aVencer || []).length ? `<div class="item"><strong>A vencer</strong></div>${(json.financeiro.aVencer || []).slice(0,6).map(f => itemFin(f, true)).join("")}` : ""}
    `;

    $("frequencia").innerHTML = json.frequencias?.length ? json.frequencias.slice(0,10).map(f => `
      <div class="item"><strong>${esc(f.data)} · ${esc(f.turma || f.servico || "")}</strong><div>${esc(f.status || "-")} · ${esc(f.professor || "")}</div></div>
    `).join("") : vazio("Nenhuma frequência registrada.");
  }

  $("btnCarregar").onclick = carregar;
  carregar();
})();
