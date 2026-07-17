const $ = (id) => document.getElementById(id);

function sessaoProfessor() {
  try {
    const sessao = JSON.parse(localStorage.getItem("fusion_professor_sessao") || "null");
    if (sessao?.professorId) return sessao;
  } catch {}
  return null;
}

function exigirLoginProfessor() {
  const sessao = sessaoProfessor();
  if (!sessao?.professorId) {
    location.replace("/pages/professor-login/index.html");
    return null;
  }
  return sessao;
}

function paramsProfessor(sessao) {
  const params = new URLSearchParams();
  params.set("professorNome", sessao.professorNome || "Professor");
  params.set("origem", "professor");

  if (sessao.acessoTodosAlunos === true || sessao.perfil === "responsavel_tecnico") {
    params.set("acessoTodosAlunos", "1");
    params.set("perfil", "responsavel_tecnico");
  } else {
    params.set("professorId", sessao.professorId);
    params.set("perfil", "professor");
  }

  return params.toString();
}

function abrirAvaliacao() {
  const sessao = exigirLoginProfessor();
  if (!sessao) return;
  location.href = `/pages/avaliacoes/index.html?${paramsProfessor(sessao)}`;
}

function abrirTreinos() {
  const sessao = exigirLoginProfessor();
  if (!sessao) return;
  location.href = `/pages/treinos/index.html?${paramsProfessor(sessao)}`;
}

const sessao = exigirLoginProfessor();
if (sessao) {
  $("professorNome").textContent = sessao.professorNome || "Professor";
  const global = sessao.acessoTodosAlunos === true || sessao.perfil === "responsavel_tecnico";
  $("escopoAcesso").textContent = global
    ? "Responsável técnico — acesso a todos os alunos"
    : "Professor — acesso aos alunos vinculados";
  $("escopoAcesso").classList.toggle("global", global);
}

$("abrirAvaliacao").onclick = abrirAvaliacao;
$("abrirTreinos").onclick = abrirTreinos;
$("sair").onclick = () => {
  localStorage.removeItem("fusion_professor_sessao");
  location.replace("/pages/professor-login/index.html");
};


function ehResponsavelTecnico(sessao) {
  return sessao?.acessoTodosAlunos === true || sessao?.perfil === "responsavel_tecnico" || sessao?.perfil === "responsavel-tecnico";
}

function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function headersResponsavel(sessao) {
  return {
    "Content-Type": "application/json",
    "x-fusion-professor-id": String(sessao.professorId || ""),
    "x-fusion-perfil": "responsavel_tecnico",
    "x-fusion-acesso-global": "true"
  };
}

async function carregarProfessores() {
  const sessao = exigirLoginProfessor();
  if (!sessao || !ehResponsavelTecnico(sessao)) return;
  const listaEl = $("listaProfessores");
  const msgEl = $("mensagemProfessores");
  msgEl.textContent = "Carregando professores...";
  try {
    const resp = await fetch("/api/professores", { cache: "no-store" });
    const professores = await resp.json().catch(() => []);
    if (!resp.ok) throw new Error(professores.mensagem || "Erro ao carregar professores.");
    const lista = Array.isArray(professores) ? professores : (professores.dados || []);
    listaEl.innerHTML = lista.map((prof) => {
      const proprio = String(prof.id) === String(sessao.professorId);
      const bloqueado = prof.bloqueado === true || String(prof.status || "").toLowerCase() === "bloqueado";
      return `<article class="professor-item">
        <div class="professor-dados">
          <strong>${escaparHtml(prof.nome || "Professor")}</strong>
          <span>${escaparHtml(prof.cref || "Sem CREF")} · ${escaparHtml(prof.email || "Sem e-mail")}</span>
        </div>
        <span class="status-professor ${bloqueado ? "bloqueado" : "ativo"}">${bloqueado ? "Bloqueado" : "Ativo"}</span>
        <button class="btn ${bloqueado ? "desbloquear" : "bloquear"}" type="button" data-professor-status="${escaparHtml(prof.id)}" data-novo-status="${bloqueado ? "Ativo" : "Bloqueado"}" ${proprio ? "disabled title=\"Você não pode bloquear o próprio acesso\"" : ""}>
          ${proprio ? "Seu acesso" : (bloqueado ? "Desbloquear" : "Bloquear")}
        </button>
      </article>`;
    }).join("") || '<p class="lista-vazia">Nenhum professor cadastrado.</p>';
    msgEl.textContent = `${lista.length} professor(es) encontrado(s).`;
    listaEl.querySelectorAll("[data-professor-status]").forEach((botao) => {
      botao.addEventListener("click", () => alterarStatusProfessor(botao.dataset.professorStatus, botao.dataset.novoStatus));
    });
  } catch (erro) {
    msgEl.textContent = erro.message || "Erro ao carregar professores.";
  }
}

async function alterarStatusProfessor(id, status) {
  const sessao = exigirLoginProfessor();
  if (!sessao || !ehResponsavelTecnico(sessao)) return;
  const acao = status === "Ativo" ? "desbloquear" : "bloquear";
  if (!confirm(`Confirma ${acao} este professor?`)) return;
  const msgEl = $("mensagemProfessores");
  try {
    const resp = await fetch(`/api/professores/${encodeURIComponent(id)}/status`, {
      method: "PUT",
      headers: headersResponsavel(sessao),
      body: JSON.stringify({ status })
    });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok || payload.ok === false) throw new Error(payload.mensagem || "Não foi possível alterar o status.");
    msgEl.textContent = payload.mensagem || "Status atualizado.";
    await carregarProfessores();
  } catch (erro) {
    msgEl.textContent = erro.message || "Erro ao alterar status.";
  }
}

if (sessao && ehResponsavelTecnico(sessao)) {
  $("gestaoProfessores").hidden = false;
  $("atualizarProfessores").onclick = carregarProfessores;
  carregarProfessores();
}
