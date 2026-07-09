const $ = (id) => document.getElementById(id);
const fotoFallback = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='#edf2f7'/><text x='50%' y='52%' text-anchor='middle' font-size='14' fill='#64748b'>Exercício</text></svg>`);

let treinosCache = [];

function sessaoAluno() {
  try {
    const sessao = JSON.parse(localStorage.getItem("fusion_aluno_treino_login") || "null");
    if (sessao?.alunoId) return sessao;
  } catch {}
  return null;
}

function exigirLogin() {
  const sessao = sessaoAluno();
  if (!sessao?.alunoId) {
    location.replace("/pages/aluno-login/index.html");
    return null;
  }
  return sessao;
}

function marcarConcluido(chave, checked) {
  const sessao = sessaoAluno();
  const alunoId = sessao?.alunoId || "aluno";
  const key = `fusion_treino_concluidos_${alunoId}`;
  const atual = JSON.parse(localStorage.getItem(key) || "{}");
  atual[chave] = checked;
  localStorage.setItem(key, JSON.stringify(atual));
}

function estaConcluido(chave) {
  const sessao = sessaoAluno();
  const alunoId = sessao?.alunoId || "aluno";
  const key = `fusion_treino_concluidos_${alunoId}`;
  const atual = JSON.parse(localStorage.getItem(key) || "{}");
  return Boolean(atual[chave]);
}

function textoTreino(t) {
  return [
    t.alunoNome, t.professorNome, t.objetivo, t.validade, t.dataPrescricao, t.observacoes,
    ...(t.divisoes || []).flatMap(d => [d.nome, ...(d.itens || []).flatMap(e => [e.nome, e.grupo, e.musculos, e.obs])])
  ].filter(Boolean).join(" ").toLowerCase();
}

function renderTreinos(treinos) {
  const termo = ($("busca").value || "").trim().toLowerCase();
  const filtrados = termo ? treinos.filter(t => textoTreino(t).includes(termo)) : treinos;

  $("treinos").innerHTML = filtrados.map(t => `
    <article class="card treino-card">
      <h2>${t.alunoNome || "Aluno"}</h2>
      <div class="meta aluno-meta">Professor: <strong>${t.professorNome || "Não informado"}</strong> · Objetivo: ${t.objetivo || "-"} · Prescrição: ${t.dataPrescricao || "-"} · Validade: ${t.validade || "-"}</div>
      ${(t.divisoes || []).map(d => `
        <section class="divisao">
          <h3>Treino ${d.nome}</h3>
          ${(d.itens || []).map((e, i) => {
            const chave = `${t.id}_${d.nome}_${i}`;
            return `<div class="item aluno-exercicio ${estaConcluido(chave) ? "done" : ""}">
              <img src="${e.foto || e.gif || ""}" onerror="this.src='${fotoFallback}'">
              <div>
                <strong>${e.nome || "Exercício"}</strong>
                <small>${e.grupo || ""}${e.musculos ? ` · ${e.musculos}` : ""}</small>
                <div class="meta">${e.series || "-"} séries · ${e.repeticoes || "-"} repetições · carga ${e.carga || "-"} · descanso ${e.descanso || "-"} · ${e.metodo || "Convencional"}</div>
                ${e.cadencia ? `<div class="meta">Cadência: ${e.cadencia}</div>` : ""}
                ${e.obs ? `<p>${e.obs}</p>` : ""}
              </div>
              <label class="check-exercicio"><input type="checkbox" data-chave="${chave}" ${estaConcluido(chave) ? "checked" : ""}> Concluído</label>
            </div>`;
          }).join("") || `<div class="empty">Sem exercícios nesta divisão.</div>`}
        </section>
      `).join("")}
      ${t.observacoes ? `<p class="observacoes-aluno"><strong>Observações:</strong> ${t.observacoes}</p>` : ""}
    </article>
  `).join("") || `<div class="card empty">Nenhum treino prescrito para este aluno.</div>`;

  document.querySelectorAll("[data-chave]").forEach((el) => {
    el.onchange = () => {
      marcarConcluido(el.dataset.chave, el.checked);
      el.closest(".aluno-exercicio")?.classList.toggle("done", el.checked);
    };
  });
}

async function carregar() {
  const sessao = exigirLogin();
  if (!sessao) return;

  $("alunoId").value = sessao.alunoId || "";
  $("alunoNome").value = sessao.alunoNome || "Aluno";
  $("subtituloAluno").textContent = `Treinos prescritos para ${sessao.alunoNome || "aluno"}.`;

  const url = `/api/treinos?alunoId=${encodeURIComponent(sessao.alunoId)}`;
  const r = await fetch(url).then(x => x.json()).catch(() => ({ ok: false, dados: [] }));
  treinosCache = Array.isArray(r.dados) ? r.dados.filter(t => String(t.alunoId || "") === String(sessao.alunoId)) : [];
  renderTreinos(treinosCache);
}

function sair() {
  localStorage.removeItem("fusion_aluno_treino_login");
  location.href = "/pages/aluno-login/index.html";
}

$("carregar").onclick = carregar;
$("busca").oninput = () => renderTreinos(treinosCache);
$("sair").onclick = sair;
carregar();
