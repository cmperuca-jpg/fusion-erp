(() => {
  "use strict";
  const API = "/api/agenda-avaliacoes";
  const $ = (id) => document.getElementById(id);

  function sessaoAtual() {
    try {
      const s = JSON.parse(localStorage.getItem("fusion_professor_sessao") || "null");
      return s?.professorId ? s : null;
    } catch { return null; }
  }

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function norm(v) {
    return String(v ?? "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function dataBR(v) {
    const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v || "-");
  }

  function statusAgenda(item = {}) {
    const s = norm(item.status);
    if (s.includes("realiz") || s.includes("conclu")) return "realizada";
    if (s.includes("cancel")) return "cancelada";
    return "pendente";
  }

  function urlNova(item, sessao) {
    const p = new URLSearchParams();
    p.set("alunoId", String(item.alunoId || item.aluno_id || ""));
    p.set("professorId", String(sessao.professorId || item.professorId || item.professor_id || ""));
    p.set("professorNome", String(sessao.professorNome || item.professorNome || item.professor_nome || ""));
    p.set("nova", "1");
    p.set("origem", "professor");
    p.set("agendamentoId", String(item.id || ""));
    if (item.data) p.set("agendamentoData", String(item.data).slice(0,10));
    if (item.hora) p.set("agendamentoHora", String(item.hora).slice(0,5));
    return `/pages/avaliacoes/index.html?${p.toString()}`;
  }

  function urlRealizada(item, sessao) {
    const p = new URLSearchParams();
    p.set("alunoId", String(item.alunoId || item.aluno_id || ""));
    p.set("professorId", String(sessao.professorId || item.professorId || item.professor_id || ""));
    p.set("origem", "professor");
    const avaliacaoId = item.avaliacaoId || item.avaliacao_id || "";
    if (avaliacaoId) {
      p.set("avaliacaoId", String(avaliacaoId));
      p.set("editar", "1");
    }
    return `/pages/avaliacoes/index.html?${p.toString()}`;
  }

  function renderizar(lista, sessao) {
    const box = $("listaAgendaAvaliacoesProfessor");
    const msg = $("mensagemAgendaAvaliacoesProfessor");
    if (!box) return;

    const validos = (Array.isArray(lista) ? lista : [])
      .filter(x => statusAgenda(x) !== "cancelada");

    const pendentes = validos
      .filter(x => statusAgenda(x) === "pendente")
      .sort((a,b) => `${a.data||""}T${a.hora||""}`.localeCompare(`${b.data||""}T${b.hora||""}`));

    const realizadas = validos
      .filter(x => statusAgenda(x) === "realizada")
      .sort((a,b) => String(b.realizadaEm||b.atualizadoEm||"").localeCompare(String(a.realizadaEm||a.atualizadoEm||"")))
      .slice(0,8);

    if (msg) msg.textContent = pendentes.length
      ? `${pendentes.length} avaliação(ões) aguardando realização.`
      : "Nenhuma avaliação pendente para este professor.";

    const card = (item, realizada) => {
      const nome = item.alunoNome || item.aluno_nome || item.aluno || "Aluno";
      const url = realizada ? urlRealizada(item, sessao) : urlNova(item, sessao);
      const obs = String(item.observacao || item.observacoes || "").trim();
      return `<article class="prof-agenda-item ${realizada ? "realizada" : "pendente"}">
        <div>
          <div class="prof-agenda-item-topo">
            <strong>${esc(nome)}</strong>
            <span class="prof-agenda-status">${realizada ? "Realizada" : "Agendada"}</span>
          </div>
          <div class="prof-agenda-meta">
            <span>${esc(dataBR(item.data))}</span>
            <span>${esc(String(item.hora || "").slice(0,5) || "-")}</span>
          </div>
          ${obs ? `<small>${esc(obs)}</small>` : ""}
        </div>
        <button class="btn ${realizada ? "" : "primary"}" type="button" data-av-url="${esc(url)}">
          ${realizada ? "Abrir avaliação" : "Realizar avaliação"}
        </button>
      </article>`;
    };

    box.innerHTML =
      `<div class="prof-agenda-grupo"><h3>A realizar</h3>${
        pendentes.length ? pendentes.map(x => card(x,false)).join("") :
        '<div class="prof-agenda-vazio">Nenhuma avaliação agendada aguardando realização.</div>'
      }</div>` +
      (realizadas.length
        ? `<div class="prof-agenda-grupo realizadas"><h3>Realizadas recentemente</h3>${realizadas.map(x => card(x,true)).join("")}</div>`
        : "");

    box.querySelectorAll("[data-av-url]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.avUrl) location.href = btn.dataset.avUrl;
      });
    });
  }

  async function carregar() {
    const sessao = sessaoAtual();
    if (!sessao) return;
    const msg = $("mensagemAgendaAvaliacoesProfessor");
    if (msg) msg.textContent = "Carregando avaliações agendadas...";
    try {
      const headers = sessao.token ? { Authorization: `Bearer ${sessao.token}` } : {};
      const resp = await fetch(API, { cache:"no-store", headers });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || payload.ok === false) throw new Error(payload.mensagem || "Não foi possível carregar a agenda.");
      renderizar(payload.agenda || payload.dados || [], sessao);
    } catch (e) {
      if (msg) msg.textContent = e.message || "Erro ao carregar agenda.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!sessaoAtual()) return;
    $("atualizarAgendaAvaliacoesProfessor")?.addEventListener("click", carregar);
    carregar();
  });
  window.addEventListener("pageshow", () => { if (sessaoAtual()) carregar(); });
})();
