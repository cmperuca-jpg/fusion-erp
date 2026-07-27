const API = "/api/auth";
const MODULOS = [
  ["*", "Administrador total"],
  ["dashboard", "Dashboard"],
  ["admin", "Painel Administrativo"],
  ["alunos", "Alunos"],
  ["professores", "Professores"],
  ["matriculas", "Matrículas"],
  ["matriculas-pendentes", "Matrículas Pendentes"],
  ["comercial", "Página Comercial"],
  ["comercial-painel", "CRM Comercial"],
  ["site-chat", "Chat do Site"],
  ["financeiro", "Financeiro"],
  ["mensalidades", "Mensalidades"],
  ["caixa", "Caixa"],
  ["planos", "Planos"],
  ["turmas", "Turmas"],
  ["checkin", "Check-in"],
  ["access-engine", "Catracas"],
  ["professor-area", "Area do Professor"],
  ["aluno-treinos", "Treinos do Aluno"],
  ["aluno-avaliacao", "Avaliacao do Aluno"],
  ["bi", "BI"],
  ["relatorios", "Relatórios"]
];

let usuarios = [];

function esc(v){return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}

function dataHoraBR(valor) {
  if (!valor) return "data não informada";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? String(valor) : data.toLocaleString("pt-BR");
}

function mostrarResultadoBackup(mensagem, tipo = "ok") {
  const box = document.getElementById("backupResultado");
  box.textContent = mensagem;
  box.className = `backup-result ${tipo === "erro" ? "erro" : ""}`;
}

function bloquearBackup(bloqueado) {
  ["btnBackupAgora", "btnAtualizarBackups", "btnRestaurarBackup"].forEach(id => {
    const botao = document.getElementById(id);
    if (botao) botao.disabled = bloqueado;
  });
}

async function carregarStatusBackup() {
  const resp = await FusionAuth.fetchAuth("/api/backup/status", { cache: "no-store" });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.ok === false) throw new Error(json.mensagem || "Erro ao verificar backup.");
  const status = document.getElementById("backupStatus");
  const persistencia = json.persistencia || {};
  const automatico = json.automatico || {};
  if (persistencia.configurado && persistencia.ok !== false) {
    if (automatico.ultimoErro) {
      status.textContent = "Supabase ativo · último backup automático falhou";
      status.className = "backup-status erro";
    } else {
      status.textContent = `Supabase ativo · backup ${automatico.ativo ? "automático" : "manual"}`;
      status.className = "backup-status ok";
    }
  } else {
    status.textContent = persistencia.ultimoErro || "Supabase não configurado";
    status.className = "backup-status erro";
  }
}

async function carregarBackups() {
  const select = document.getElementById("backupSelecionado");
  const resp = await FusionAuth.fetchAuth("/api/backup/listar", { cache: "no-store" });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.ok === false) throw new Error(json.mensagem || "Erro ao listar backups.");
  const backups = json.backups || [];
  select.innerHTML = backups.length
    ? '<option value="">Selecione um backup</option>' + backups.map(item => `<option value="${esc(item.caminho)}">${esc(item.nomeExibicao || item.name)} · ${esc(dataHoraBR(item.created_at || item.updated_at))}</option>`).join("")
    : '<option value="">Nenhum backup encontrado</option>';
}

async function fazerBackupAgora() {
  bloquearBackup(true);
  mostrarResultadoBackup("Copiando o estado atual do banco e dos arquivos para um novo backup no Supabase...");
  try {
    const resp = await FusionAuth.fetchAuth("/api/backup/supabase", { method: "POST" });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || "Erro ao criar backup.");
    const partes = Number(json.partes || 1);
    const detalhePartes = partes > 1 ? `, dividido em ${partes} partes` : "";
    const detalheBanco = Number.isFinite(Number(json.totalRegistrosBanco)) ? `, ${Number(json.totalRegistrosBanco)} registro(s) do banco` : "";
    mostrarResultadoBackup(`Backup criado: ${json.nome || json.caminho}${detalhePartes}${detalheBanco}.`);
    await carregarBackups();
    await carregarStatusBackup();
  } catch (erro) {
    mostrarResultadoBackup(erro.message, "erro");
  } finally { bloquearBackup(false); }
}

async function restaurarBackupSelecionado() {
  const select = document.getElementById("backupSelecionado");
  const caminho = String(select?.value || "").trim();

  if (!caminho) {
    mostrarResultadoBackup("Selecione um backup para restaurar.", "erro");
    select?.focus();
    return;
  }

  const digitado = prompt(
    "ATENÇÃO: os dados atuais serão substituídos.\n\n" +
    "Digite RESTAURAR para confirmar:"
  );

  // Cancelar o prompt não deve iniciar nenhuma operação.
  if (digitado === null) return;

  // Aceita espaços acidentais e diferença entre maiúsculas/minúsculas.
  const confirmacao = String(digitado).trim().toUpperCase();
  if (confirmacao !== "RESTAURAR") {
    mostrarResultadoBackup(
      'Confirmação inválida. Digite exatamente "RESTAURAR".',
      "erro"
    );
    return;
  }

  // Uma única confirmação é suficiente. O segundo confirm() nativo foi
  // removido porque, em alguns navegadores, ele não era exibido depois do
  // prompt e o fluxo terminava sem enviar a requisição.
  bloquearBackup(true);
  mostrarResultadoBackup(
    "Restauração iniciada. Criando o backup de segurança e baixando os dados. Não feche esta página..."
  );

  try {
    const resp = await FusionAuth.fetchAuth("/api/backup/restaurar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({ caminho, confirmacao })
    });

    const texto = await resp.text();
    let json = {};
    try {
      json = texto ? JSON.parse(texto) : {};
    } catch {
      throw new Error(
        resp.ok
          ? "O servidor concluiu a requisição, mas retornou uma resposta inválida."
          : `Falha HTTP ${resp.status}: ${texto || resp.statusText || "sem detalhes"}`
      );
    }

    if (!resp.ok || json.ok === false) {
      throw new Error(
        json.mensagem ||
        json.erro ||
        `Erro HTTP ${resp.status} ao restaurar o backup.`
      );
    }

    mostrarResultadoBackup(
      `Restauração concluída: ${Number(json.totalRestaurados || 0)} arquivo(s) restaurado(s). ` +
      "O banco transacional e a persistência foram sincronizados."
    );

    await Promise.all([
      carregarBackups(),
      carregarStatusBackup()
    ]);
  } catch (erro) {
    console.error("[Backup] Falha na restauração:", erro);
    mostrarResultadoBackup(
      erro?.message || "Falha desconhecida ao restaurar o backup.",
      "erro"
    );
  } finally {
    bloquearBackup(false);
  }
}

function renderPermissoes(selecionadas = []) {
  const box = document.getElementById("permissoes");
  box.innerHTML = MODULOS.map(([valor,label]) => `
    <label class="check-permissao">
      <input type="checkbox" value="${esc(valor)}" ${selecionadas.includes(valor) ? "checked" : ""}>
      <span>${esc(label)}</span>
    </label>
  `).join("");
}

function permissoesSelecionadas() {
  return [...document.querySelectorAll("#permissoes input:checked")].map(i => i.value);
}

function permissoesPorPerfil(perfil) {
  const mapa = {
    Administrador: ["*"],
    Gerente: ["dashboard","alunos","professores","matriculas","matriculas-pendentes","financeiro","mensalidades","caixa","comercial","comercial-painel","site-chat","planos","turmas","relatorios"],
    Recepcao: ["dashboard","alunos","matriculas","matriculas-pendentes","financeiro","mensalidades","caixa","comercial-painel","site-chat","checkin"],
    Comercial: ["dashboard","comercial","comercial-painel","site-chat","matriculas-pendentes"],
    Professor: ["professor-area"],
    Aluno: ["aluno-treinos","aluno-avaliacao"]
  };
  return mapa[perfil] || mapa.Recepcao;
}

function limparForm() {
  document.getElementById("tituloForm").textContent = "Novo usuário";
  document.getElementById("formUsuario").reset();
  document.getElementById("usuarioId").value = "";
  renderPermissoes(permissoesPorPerfil(document.getElementById("perfil").value));
}

function renderTabela() {
  const tbody = document.getElementById("tabelaUsuarios");
  setText("kpiUsuarios", usuarios.length);
  setText("kpiAtivos", usuarios.filter(u => u.status === "ativo").length);
  setText("kpiInativos", usuarios.filter(u => u.status === "inativo").length);

  if (!usuarios.length) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhum usuário cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td><strong>${esc(u.nome)}</strong></td>
      <td>${esc(u.email)}</td>
      <td><span class="badge administrador">${esc(u.perfil)}</span></td>
      <td><span class="badge ${esc(u.status)}">${esc(u.status)}</span></td>
      <td>${Array.isArray(u.permissoes) && u.permissoes.includes("*") ? "Todas" : esc((u.permissoes || []).join(", "))}</td>
      <td>
        <div class="acoes">
          <button type="button" class="btn-light" onclick="editarUsuario('${esc(u.id)}')">Editar</button>
          <button type="button" class="btn-secondary" onclick="alternarStatus('${esc(u.id)}')">${u.status === "ativo" ? "Inativar" : "Ativar"}</button>
          <button type="button" class="btn-danger" onclick="removerUsuario('${esc(u.id)}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");
}

async function carregarUsuarios() {
  const resp = await FusionAuth.fetchAuth(`${API}/usuarios`, { cache: "no-store" });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.ok === false) throw new Error(json.mensagem || "Erro ao carregar usuários.");
  usuarios = json.usuarios || [];
  renderTabela();
}

window.editarUsuario = function(id) {
  const u = usuarios.find(item => String(item.id) === String(id));
  if (!u) return alert("Usuário não encontrado.");
  document.getElementById("tituloForm").textContent = "Editar usuário";
  document.getElementById("usuarioId").value = u.id;
  document.getElementById("nome").value = u.nome || "";
  document.getElementById("email").value = u.email || "";
  document.getElementById("senha").value = "";
  document.getElementById("perfil").value = u.perfil || "Recepcao";
  document.getElementById("status").value = u.status || "ativo";
  renderPermissoes(Array.isArray(u.permissoes) ? u.permissoes : permissoesPorPerfil(u.perfil));
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.alternarStatus = async function(id) {
  const resp = await FusionAuth.fetchAuth(`${API}/usuarios/${encodeURIComponent(id)}/status`, { method: "POST" });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.ok === false) return alert(json.mensagem || "Erro ao alterar status.");
  await carregarUsuarios();
};

window.removerUsuario = async function(id) {
  if (!confirm("Deseja excluir este usuário?")) return;
  const resp = await FusionAuth.fetchAuth(`${API}/usuarios/${encodeURIComponent(id)}`, { method: "DELETE" });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.ok === false) return alert(json.mensagem || "Erro ao excluir usuário.");
  await carregarUsuarios();
};

document.getElementById("perfil").addEventListener("change", ev => {
  renderPermissoes(permissoesPorPerfil(ev.target.value));
});

document.getElementById("btnLimpar").addEventListener("click", limparForm);
document.getElementById("btnAtualizar").addEventListener("click", () => carregarUsuarios().catch(e => alert(e.message)));
document.getElementById("btnBackupAgora").addEventListener("click", fazerBackupAgora);
document.getElementById("btnAtualizarBackups").addEventListener("click", () => carregarBackups().catch(e => mostrarResultadoBackup(e.message, "erro")));
document.getElementById("btnRestaurarBackup").addEventListener("click", restaurarBackupSelecionado);

document.getElementById("formUsuario").addEventListener("submit", async ev => {
  ev.preventDefault();
  const id = document.getElementById("usuarioId").value;
  const payload = {
    nome: document.getElementById("nome").value.trim(),
    email: document.getElementById("email").value.trim(),
    senha: document.getElementById("senha").value,
    perfil: document.getElementById("perfil").value,
    status: document.getElementById("status").value,
    permissoes: permissoesSelecionadas()
  };

  if (id && !payload.senha) delete payload.senha;

  const resp = await FusionAuth.fetchAuth(id ? `${API}/usuarios/${encodeURIComponent(id)}` : `${API}/usuarios`, {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.ok === false) return alert(json.mensagem || "Erro ao salvar usuário.");

  limparForm();
  await carregarUsuarios();
});

renderPermissoes(permissoesPorPerfil("Administrador"));
carregarUsuarios().catch(e => {
  document.getElementById("tabelaUsuarios").innerHTML = `<tr><td colspan="6">${esc(e.message)}</td></tr>`;
});
Promise.all([carregarStatusBackup(), carregarBackups()]).catch(e => mostrarResultadoBackup(e.message, "erro"));
