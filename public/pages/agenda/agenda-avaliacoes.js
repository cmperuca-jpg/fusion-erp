(() => {
  const API = "/api/agenda-avaliacoes";

  const el = {
    botaoAbrir: document.getElementById("btnAgendarAvaliacao"),
    modal: document.getElementById("modalAgendaAvaliacao"),
    fechar: document.getElementById("btnFecharAgendaAvaliacao"),
    cancelar: document.getElementById("btnCancelarAgendaAvaliacao"),
    form: document.getElementById("formAgendaAvaliacao"),
    aluno: document.getElementById("agendaAvaliacaoAluno"),
    professor: document.getElementById("agendaAvaliacaoProfessor"),
    data: document.getElementById("agendaAvaliacaoData"),
    hora: document.getElementById("agendaAvaliacaoHora"),
    observacao: document.getElementById("agendaAvaliacaoObservacao"),
    salvar: document.getElementById("btnSalvarAgendaAvaliacao"),
    lista: document.getElementById("listaAgendaAvaliacoes"),
    filtro: document.getElementById("filtroAgendaAvaliacaoStatus"),
    pendentes: document.getElementById("kpiAvaliacoesPendentes"),
    realizadas: document.getElementById("kpiAvaliacoesRealizadas")
  };

  if (!el.lista) return;

  let agenda = [];
  let alunos = [];
  let professores = [];

  function fetchSeguro(url, opcoes = {}) {
    if (window.FusionAuth?.fetchAuth) {
      return window.FusionAuth.fetchAuth(url, opcoes);
    }
    return fetch(url, opcoes);
  }

  function texto(v) {
    return String(v ?? "").trim();
  }

  function escapar(v) {
    return texto(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function idRegistro(v = {}) {
    return texto(v.id ?? v._id ?? v.alunoId ?? v.professorId);
  }

  function nomeAluno(v = {}) {
    return texto(
      v.nome ??
      v.nomeCompleto ??
      v.nome_completo ??
      v.alunoNome ??
      "Aluno"
    );
  }

  function nomeProfessor(v = {}) {
    return texto(
      v.nome ??
      v.nomeCompleto ??
      v.nome_completo ??
      v.professorNome ??
      "Professor"
    );
  }

  function formatarData(iso) {
    const valor = texto(iso).slice(0, 10);
    const partes = valor.split("-");
    if (partes.length !== 3) return valor || "-";
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  function statusNormalizado(v) {
    const s = texto(v).toLowerCase();
    if (s === "realizada") return "realizada";
    if (s === "cancelada") return "cancelada";
    return "pendente";
  }

  function labelStatus(v) {
    const s = statusNormalizado(v);
    if (s === "realizada") return "✓ REALIZADA COM SUCESSO";
    if (s === "cancelada") return "CANCELADA";
    return "PENDENTE";
  }

  function ordenarNome(a, b, fn) {
    return fn(a).localeCompare(fn(b), "pt-BR");
  }

  async function carregarCadastros() {
    const [respAlunos, respProfessores] = await Promise.all([
      fetchSeguro("/api/alunos", { cache: "no-store" }),
      fetchSeguro("/api/professores", { cache: "no-store" })
    ]);

    if (!respAlunos.ok) throw new Error("Não foi possível carregar os alunos.");
    if (!respProfessores.ok) throw new Error("Não foi possível carregar os professores.");

    const jsonAlunos = await respAlunos.json();
    const jsonProfessores = await respProfessores.json();

    alunos = Array.isArray(jsonAlunos)
      ? jsonAlunos
      : (jsonAlunos.alunos || jsonAlunos.dados || []);

    professores = Array.isArray(jsonProfessores)
      ? jsonProfessores
      : (jsonProfessores.professores || jsonProfessores.dados || []);

    alunos = alunos
      .filter(a => {
        const s = texto(a.status || "ativo").toLowerCase();
        return !["inativo", "cancelado", "excluido", "excluído"].includes(s);
      })
      .sort((a, b) => ordenarNome(a, b, nomeAluno));

    professores = professores
      .filter(p => {
        const s = texto(p.status || "ativo").toLowerCase();
        return !["inativo", "bloqueado", "cancelado", "excluido", "excluído"].includes(s);
      })
      .sort((a, b) => ordenarNome(a, b, nomeProfessor));

    el.aluno.innerHTML =
      '<option value="">Selecione o aluno</option>' +
      alunos.map(a => {
        const id = escapar(idRegistro(a));
        const nome = escapar(nomeAluno(a));
        return `<option value="${id}" data-nome="${nome}">${nome}</option>`;
      }).join("");

    el.professor.innerHTML =
      '<option value="">Selecione o professor</option>' +
      professores.map(p => {
        const id = escapar(idRegistro(p));
        const nome = escapar(nomeProfessor(p));
        return `<option value="${id}" data-nome="${nome}">${nome}</option>`;
      }).join("");
  }

  async function carregarAgenda() {
    const resp = await fetchSeguro(API, { cache: "no-store" });

    if (!resp.ok) {
      throw new Error("Não foi possível carregar a agenda de avaliações.");
    }

    const json = await resp.json();
    agenda = Array.isArray(json)
      ? json
      : (json.agenda || json.registros || []);

    renderizar();
  }

  function renderizar() {
    const pendentes = agenda.filter(x => statusNormalizado(x.status) === "pendente");
    const realizadas = agenda.filter(x => statusNormalizado(x.status) === "realizada");

    el.pendentes.textContent = String(pendentes.length);
    el.realizadas.textContent = String(realizadas.length);

    const filtro = texto(el.filtro.value).toLowerCase();

    const lista = agenda
      .filter(x => !filtro || statusNormalizado(x.status) === filtro)
      .sort((a, b) =>
        `${texto(b.data)}T${texto(b.hora)}`.localeCompare(
          `${texto(a.data)}T${texto(a.hora)}`
        )
      );

    if (!lista.length) {
      el.lista.innerHTML = "<p>Nenhum agendamento encontrado.</p>";
      return;
    }

    el.lista.innerHTML = lista.map(item => {
      const st = statusNormalizado(item.status);

      return `
        <article class="agenda-avaliacao-item">
          <div class="agenda-avaliacao-data">
            ${escapar(formatarData(item.data))}
            <strong>${escapar(item.hora || "-")}</strong>
          </div>

          <div class="agenda-avaliacao-pessoa">
            <small>Aluno</small>
            <strong>${escapar(item.alunoNome || "-")}</strong>
          </div>

          <div class="agenda-avaliacao-professor">
            <small>Professor</small>
            <strong>${escapar(item.professorNome || "-")}</strong>
          </div>

          <div>
            <span class="status-avaliacao-agenda ${st}">
              ${labelStatus(st)}
            </span>
          </div>
        </article>
      `;
    }).join("");
  }

  function abrirModal() {
    el.form.reset();

    const hoje = new Date();
    const local = new Date(
      hoje.getTime() - hoje.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);

    el.data.value = local;
    el.modal.classList.add("ativo");
  }

  function fecharModal() {
    el.modal.classList.remove("ativo");
  }

  async function salvar(event) {
    event.preventDefault();

    const opcaoAluno = el.aluno.options[el.aluno.selectedIndex];
    const opcaoProfessor = el.professor.options[el.professor.selectedIndex];

    const payload = {
      alunoId: el.aluno.value,
      alunoNome: opcaoAluno?.dataset?.nome || opcaoAluno?.textContent || "",
      professorId: el.professor.value,
      professorNome: opcaoProfessor?.dataset?.nome || opcaoProfessor?.textContent || "",
      data: el.data.value,
      hora: el.hora.value,
      observacao: el.observacao.value
    };

    el.salvar.disabled = true;
    el.salvar.textContent = "Salvando...";

    try {
      const resp = await fetchSeguro(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await resp.json().catch(() => ({}));

      if (!resp.ok || json.ok === false) {
        throw new Error(
          json.mensagem ||
          json.erro ||
          "Não foi possível salvar o agendamento."
        );
      }

      fecharModal();
      await carregarAgenda();
      alert("Avaliação agendada com sucesso.");
    } catch (erro) {
      alert(erro.message || "Erro ao salvar o agendamento.");
    } finally {
      el.salvar.disabled = false;
      el.salvar.textContent = "Salvar agendamento";
    }
  }

  el.botaoAbrir?.addEventListener("click", abrirModal);
  el.fechar?.addEventListener("click", fecharModal);
  el.cancelar?.addEventListener("click", fecharModal);
  el.filtro?.addEventListener("change", renderizar);
  el.form?.addEventListener("submit", salvar);

  Promise.all([
    carregarCadastros(),
    carregarAgenda()
  ]).then(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("agendarAvaliacao") === "1") {
      abrirModal();
    }
  }).catch(erro => {
    console.error("Agenda de avaliações:", erro);
    el.lista.innerHTML =
      `<p>Não foi possível carregar a agenda de avaliações: ${escapar(erro.message)}</p>`;
  });
})();
