(function () {
  document.addEventListener("DOMContentLoaded", iniciarCheckin);

  function iniciarCheckin() {
    if (typeof window.carregarLayout === "function") {
      window.carregarLayout("Check-in");
    }

    const API = "/api/checkin";

    const els = {
      tabela: document.getElementById("tabelaCheckin"),
      modal: document.getElementById("modalCheckin"),
      form: document.getElementById("formCheckin"),
      modalTitulo: document.getElementById("modalTitulo"),
      busca: document.getElementById("busca"),
      filtroStatus: document.getElementById("filtroStatus"),
      filtroData: document.getElementById("filtroData"),
      entradaCodigo: document.getElementById("entradaCodigo"),
      kpiTotal: document.getElementById("kpiTotal"),
      kpiHoje: document.getElementById("kpiHoje"),
      kpiLiberados: document.getElementById("kpiLiberados"),
      kpiBloqueados: document.getElementById("kpiBloqueados")
    };

    if (!els.modal || !els.form || !els.tabela) {
      console.error("Check-in: elementos essenciais da página não foram encontrados.");
      return;
    }

    let registros = [];
    let alunos = [];
    let matriculas = [];
    let professores = [];
    let turmas = [];
    let planos = [];

    function valor(id) {
      const el = document.getElementById(id);
      return el ? el.value : "";
    }

    function setValor(id, value) {
      const el = document.getElementById(id);
      if (el) el.value = value ?? "";
    }

    function listaDeResposta(json, chavePrincipal) {
      if (Array.isArray(json)) return json;
      if (Array.isArray(json?.[chavePrincipal])) return json[chavePrincipal];
      if (Array.isArray(json?.dados)) return json.dados;
      if (Array.isArray(json?.registros)) return json.registros;
      return [];
    }

    async function buscarLista(url, chavePrincipal) {
      try {
        const resp = await fetch(url);
        const json = await resp.json().catch(() => []);
        return listaDeResposta(json, chavePrincipal);
      } catch (err) {
        console.error(`Erro ao carregar ${url}:`, err);
        return [];
      }
    }

    function option(valor, texto, extra = "") {
      const opt = document.createElement("option");
      opt.value = valor ?? "";
      opt.textContent = texto || valor || "-";
      if (extra) opt.dataset.extra = extra;
      return opt;
    }

    function preencherSelect(id, itens, obterValor, obterTexto, placeholder = "Selecione") {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = "";
      el.appendChild(option("", placeholder));
      itens.forEach((item) => {
        const valorOpt = obterValor(item);
        const textoOpt = obterTexto(item);
        if (valorOpt || textoOpt) el.appendChild(option(valorOpt, textoOpt));
      });
    }

    function ativo(item = {}) {
      const status = String(item.status || item.statusMatricula || "Ativo").toLowerCase();
      return !["cancelado", "cancelada", "inativo", "inativa", "encerrado", "encerrada", "bloqueado", "bloqueada", "suspenso", "suspensa"].includes(status);
    }

    function obterAlunoSelecionado() {
      const alunoId = valor("aluno");
      return alunos.find((aluno) => String(aluno.id || aluno._id) === String(alunoId)) || null;
    }

    function matriculasDoAluno(alunoId) {
      return matriculas.filter((m) => String(m.alunoId || m.aluno_id) === String(alunoId) && ativo(m));
    }

    function preencherMatriculasDoAluno(aluno) {
      const selectMatricula = document.getElementById("matricula");
      const selectPlano = document.getElementById("plano");
      const selectModalidade = document.getElementById("modalidade");
      if (!selectMatricula || !selectPlano || !aluno) return;

      const lista = matriculasDoAluno(aluno.id || aluno._id);
      selectMatricula.innerHTML = "";
      selectPlano.innerHTML = "";

      if (!lista.length) {
        selectMatricula.appendChild(option(aluno.numeroMatricula || aluno.matriculaId || "", aluno.numeroMatricula || "Sem matrícula ativa"));
        selectPlano.appendChild(option(aluno.plano || "", aluno.plano || "Plano não localizado"));
      } else {
        lista.forEach((matricula) => {
          const numero = matricula.numero || matricula.numeroMatricula || matricula.id;
          const rotulo = `${numero} — ${matricula.plano || matricula.nomePlano || "Plano"}`;
          selectMatricula.appendChild(option(numero, rotulo));
        });

        const planosUnicos = [];
        lista.forEach((matricula) => {
          const nome = matricula.plano || matricula.nomePlano;
          if (nome && !planosUnicos.includes(nome)) planosUnicos.push(nome);
        });
        planosUnicos.forEach((nome) => selectPlano.appendChild(option(nome, nome)));
      }

      const modalidades = new Set(["Musculação"]);
      const origemModalidades = lista.length ? lista : [aluno];
      origemModalidades.forEach((item) => {
        const valores = Array.isArray(item.modalidades) ? item.modalidades : Array.isArray(item.modalidadesIncluidas) ? item.modalidadesIncluidas : [];
        valores.forEach((m) => modalidades.add(m));
      });
      if (selectModalidade) {
        selectModalidade.innerHTML = "";
        [...modalidades].forEach((m) => selectModalidade.appendChild(option(m, m)));
        selectModalidade.value = [...modalidades].find((m) => String(m).toLowerCase().includes("muscula")) || [...modalidades][0] || "";
      }

      setValor("matricula", selectMatricula.options[0]?.value || "");
      setValor("plano", selectPlano.options[0]?.value || aluno.plano || "");

      if (aluno.professorNome || aluno.professor_responsavel) setValor("professor", aluno.professorNome || aluno.professor_responsavel);
    }

    async function carregarCadastros() {
      const [listaAlunos, listaMatriculas, listaProfessores, listaTurmas, listaPlanos] = await Promise.all([
        buscarLista("/api/alunos", "alunos"),
        buscarLista("/api/matriculas", "matriculas"),
        buscarLista("/api/professores", "professores"),
        buscarLista("/api/turmas", "turmas"),
        buscarLista("/api/planos", "planos")
      ]);

      alunos = listaAlunos.filter(ativo).sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
      matriculas = listaMatriculas;
      professores = listaProfessores.filter(ativo).sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
      turmas = listaTurmas.filter(ativo).sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
      planos = listaPlanos.filter(ativo);

      preencherSelect("aluno", alunos, (a) => a.id || a._id, (a) => `${a.nome || "Aluno"}${a.numeroMatricula ? ` — ${a.numeroMatricula}` : ""}`, "Selecione o aluno");
      preencherSelect("professor", professores, (p) => p.nome, (p) => p.nome, "Selecione o professor");
      preencherSelect("turma", turmas, (t) => t.nome, (t) => `${t.nome || "Turma"}${t.modalidade ? ` — ${t.modalidade}` : ""}`, "Selecione a turma");

      const selectPlano = document.getElementById("plano");
      if (selectPlano && planos.length) {
        preencherSelect("plano", planos, (p) => p.nome, (p) => p.nome, "Selecione o plano");
      }
    }

    function hojeISO() {
      return new Date().toISOString().slice(0, 10);
    }

    function horaAtual() {
      return new Date().toTimeString().slice(0, 5);
    }

    function abrirModal(registro = null) {
      els.form.reset();

      if (registro) {
        els.modalTitulo.textContent = "Editar Check-in";
        setValor("registroId", registro.id);
        const alunoEncontrado = alunos.find((a) => String(a.nome || "") === String(registro.aluno || "") || String(a.id || a._id) === String(registro.alunoId || ""));
        if (alunoEncontrado) {
          setValor("aluno", alunoEncontrado.id || alunoEncontrado._id);
          preencherMatriculasDoAluno(alunoEncontrado);
        } else {
          setValor("aluno", "");
        }
        setValor("matricula", registro.matricula);
        setValor("plano", registro.plano);
        setValor("modalidade", registro.modalidade);
        setValor("turma", registro.turma);
        setValor("professor", registro.professor);
        setValor("data", registro.data);
        setValor("horaEntrada", registro.horaEntrada);
        setValor("horaSaida", registro.horaSaida);
        setValor("tipo", registro.tipo);
        setValor("status", registro.status);
        setValor("observacoes", registro.observacoes);
      } else {
        els.modalTitulo.textContent = "Novo Check-in";
        setValor("registroId", "");
        setValor("data", hojeISO());
        setValor("horaEntrada", horaAtual());
        setValor("tipo", "Manual");
        setValor("status", "Liberado");
      }

      els.modal.classList.add("ativo");
    }

    function fecharModal() {
      els.modal.classList.remove("ativo");
    }

    function statusClasse(status) {
      return String(status || "").toLowerCase();
    }

    function renderizarTabela() {
      if (!registros.length) {
        els.tabela.innerHTML = `<tr><td colspan="9">Nenhum check-in encontrado.</td></tr>`;
        return;
      }

      els.tabela.innerHTML = registros.map((item) => `
        <tr>
          <td>${item.aluno || "-"}</td>
          <td>${item.matricula || "-"}</td>
          <td>${item.plano || "-"}</td>
          <td>${item.modalidade || "-"}${item.treinoNome ? `<br><small>Treino: ${item.treinoNome}</small>` : ""}</td>
          <td>${item.data || "-"}</td>
          <td>${item.horaEntrada || "-"}</td>
          <td>${item.horaSaida || "-"}</td>
          <td><span class="badge ${statusClasse(item.status)}">${item.status || "-"}</span></td>
          <td>
            <div class="acoes">
              <button class="btn-secondary" type="button" onclick="editarRegistro('${item.id}')">Editar</button>
              <button class="btn-light" type="button" onclick="registrarSaida('${item.id}')">Saída</button>
              <button class="btn-danger" type="button" onclick="excluirRegistro('${item.id}')">Excluir</button>
            </div>
          </td>
        </tr>
      `).join("");
    }

    async function carregarResumo() {
      try {
        const resp = await fetch(`${API}/resumo`);
        const json = await resp.json();
        if (!json.ok) return;
        els.kpiTotal.textContent = json.resumo.total ?? 0;
        els.kpiHoje.textContent = json.resumo.hoje ?? 0;
        els.kpiLiberados.textContent = json.resumo.liberados ?? 0;
        els.kpiBloqueados.textContent = json.resumo.bloqueados ?? 0;
      } catch (err) {
        console.error("Erro ao carregar resumo de check-in:", err);
      }
    }

    async function carregarRegistros() {
      try {
        const params = new URLSearchParams();
        if (els.busca.value) params.set("busca", els.busca.value);
        if (els.filtroStatus.value) params.set("status", els.filtroStatus.value);
        if (els.filtroData.value) params.set("data", els.filtroData.value);

        const resp = await fetch(`${API}?${params.toString()}`);
        const json = await resp.json();
        registros = json.registros || [];
        renderizarTabela();
        await carregarResumo();
      } catch (err) {
        console.error("Erro ao carregar registros de check-in:", err);
        registros = [];
        renderizarTabela();
      }
    }

    async function salvarRegistro(event) {
      event.preventDefault();
      const id = valor("registroId");
      const alunoSelecionado = obterAlunoSelecionado();
      const payload = {
        alunoId: alunoSelecionado?.id || alunoSelecionado?._id || "",
        aluno: alunoSelecionado?.nome || valor("aluno"),
        matricula: valor("matricula"),
        plano: valor("plano"),
        modalidade: valor("modalidade"),
        turma: valor("turma"),
        professor: valor("professor"),
        data: valor("data"),
        horaEntrada: valor("horaEntrada"),
        horaSaida: valor("horaSaida"),
        tipo: valor("tipo"),
        status: valor("status"),
        observacoes: valor("observacoes")
      };

      const url = id ? `${API}/${id}` : `${API}/musculacao`;
      const metodo = id ? "PUT" : "POST";
      if (!id) {
        payload.codigo = payload.matricula || payload.alunoId;
        payload.tipo = "Check-in Inteligente Musculação";
        payload.usuario = "Recepção";
      }

      const resp = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json.ok === false) {
        alert(json.mensagem || "Não foi possível salvar o check-in.");
        return;
      }
      fecharModal();
      await carregarRegistros();
    }

    async function entradaRapida() {
      const codigo = els.entradaCodigo.value.trim();
      if (!codigo) {
        alert("Informe uma matrícula, CPF, QR Code ou código do aluno.");
        return;
      }

      const resp = await fetch(`${API}/musculacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo,
          data: hojeISO(),
          horaEntrada: horaAtual(),
          tipo: "Check-in Inteligente Musculação",
          usuario: "Recepção"
        })
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) {
        alert(json.mensagem || "Não foi possível registrar o check-in inteligente.");
        return;
      }

      const nome = json?.registro?.aluno || codigo;
      const status = json?.status || (json?.autorizado ? "Liberado" : "Bloqueado");
      const treino = json?.execucaoTreino?.id ? `\nTreino iniciado: ${json.execucaoTreino.id}` : "";
      const frequencia = json?.frequencia?.id ? `\nFrequência: ${json.frequencia.id}` : "";
      alert(`${status}: ${nome}\n${json.mensagem || "Check-in processado."}${frequencia}${treino}`);
      els.entradaCodigo.value = "";
      await carregarRegistros();
    }

    window.editarRegistro = function editarRegistro(id) {
      const registro = registros.find((item) => String(item.id) === String(id));
      if (registro) abrirModal(registro);
    };

    window.registrarSaida = async function registrarSaida(id) {
      await fetch(`${API}/${id}/saida`, { method: "PATCH" });
      await carregarRegistros();
    };

    window.excluirRegistro = async function excluirRegistro(id) {
      if (!confirm("Deseja excluir este registro de check-in?")) return;
      await fetch(`${API}/${id}`, { method: "DELETE" });
      await carregarRegistros();
    };

    document.getElementById("aluno")?.addEventListener("change", () => {
      const aluno = obterAlunoSelecionado();
      if (aluno) preencherMatriculasDoAluno(aluno);
    });

    document.getElementById("btnNovoCheckin")?.addEventListener("click", () => abrirModal());
    document.getElementById("btnFecharModal")?.addEventListener("click", fecharModal);
    document.getElementById("btnCancelar")?.addEventListener("click", fecharModal);
    document.getElementById("btnFiltrar")?.addEventListener("click", carregarRegistros);
    document.getElementById("btnEntradaRapida")?.addEventListener("click", entradaRapida);
    document.getElementById("btnLimpar")?.addEventListener("click", () => {
      els.busca.value = "";
      els.filtroStatus.value = "";
      els.filtroData.value = "";
      carregarRegistros();
    });

    els.form.addEventListener("submit", salvarRegistro);
    carregarCadastros().then(carregarRegistros);
  }
}());
