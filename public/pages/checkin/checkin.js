(function () {
  document.addEventListener("DOMContentLoaded", iniciarCheckin);

  function iniciarCheckin() {
    if (typeof window.carregarLayout === "function") {
      window.carregarLayout("Check-in");
    }

    const API = "/api/checkin";
    const paramsIniciais = new URLSearchParams(location.search);
    const alunoIdUrl = paramsIniciais.get("alunoId") || paramsIniciais.get("aluno_id") || "";

    const els = {
      tabela: document.getElementById("tabelaCheckin"),
      modal: document.getElementById("modalCheckin"),
      form: document.getElementById("formCheckin"),
      modalTitulo: document.getElementById("modalTitulo"),
      busca: document.getElementById("busca"),
      filtroStatus: document.getElementById("filtroStatus"),
      filtroData: document.getElementById("filtroData"),
      entradaCodigo: document.getElementById("entradaCodigo"),
      kpiEntradasHoje: document.getElementById("kpiEntradasHoje"),
      kpiAlunosPresentes: document.getElementById("kpiAlunosPresentes"),
      kpiFuncionariosPresentes: document.getElementById("kpiFuncionariosPresentes"),
      kpiSaidasHoje: document.getElementById("kpiSaidasHoje"),
      kpiBloqueadosHoje: document.getElementById("kpiBloqueadosHoje"),
      kpiPessoasMes: document.getElementById("kpiPessoasMes"),
      listaEntradasHoje: document.getElementById("listaEntradasHoje"),
      listaAlunosPresentes: document.getElementById("listaAlunosPresentes"),
      listaFuncionariosPresentes: document.getElementById("listaFuncionariosPresentes"),
      listaSaidasHoje: document.getElementById("listaSaidasHoje"),
      listaBloqueadosHoje: document.getElementById("listaBloqueadosHoje"),
      listaPessoasMes: document.getElementById("listaPessoasMes")
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
    let alunoContexto = null;

    function valor(id) {
      const el = document.getElementById(id);
      return el ? el.value : "";
    }

    function setValor(id, value) {
      const el = document.getElementById(id);
      if (el) el.value = value ?? "";
    }

    function idAluno(aluno = {}) {
      return String(aluno.id || aluno._id || aluno.alunoId || aluno.aluno_id || "");
    }

    function nomeAluno(aluno = {}) {
      return String(aluno.nome || aluno.nomeCompleto || aluno.alunoNome || aluno.aluno || aluno.name || "Aluno");
    }

    function renderizarContextoAluno() {
      const faixa = document.getElementById("checkinAlunoContexto");
      if (!faixa || !alunoIdUrl) return;
      const titulo = faixa.querySelector("strong");
      const texto = faixa.querySelector("span");

      if (alunoContexto) {
        if (titulo) titulo.textContent = `Check-in de ${nomeAluno(alunoContexto)}`;
        if (texto) texto.textContent = "Historico filtrado pelo aluno selecionado. Novo check-in ja abre com este aluno.";
      } else {
        if (titulo) titulo.textContent = "Check-in do aluno selecionado";
        if (texto) texto.textContent = "O aluno veio da ficha cadastral, mas nao foi localizado entre os cadastros ativos.";
      }

      faixa.classList.remove("hidden");
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

      alunoContexto = alunoIdUrl
        ? listaAlunos.find((aluno) => idAluno(aluno) === String(alunoIdUrl)) || null
        : null;

      alunos = listaAlunos.filter(ativo).sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
      if (alunoContexto && !alunos.some((aluno) => idAluno(aluno) === idAluno(alunoContexto))) {
        alunos.unshift(alunoContexto);
      }

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

      if (alunoContexto) {
        setValor("aluno", idAluno(alunoContexto));
        preencherMatriculasDoAluno(alunoContexto);
      }
      renderizarContextoAluno();
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
        if (alunoContexto) {
          setValor("aluno", idAluno(alunoContexto));
          preencherMatriculasDoAluno(alunoContexto);
        }
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
        const mensagem = alunoContexto
          ? "Nenhum check-in encontrado para este aluno."
          : "Nenhum check-in encontrado.";
        els.tabela.innerHTML = `<tr><td colspan="9">${mensagem}</td></tr>`;
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

    // PAINEL OPERACIONAL CHECKIN 6 COLUNAS 20260826
    function renderizarListaPessoas(container, lista = []) {
      if (!container) return;
      container.replaceChildren();

      const itens = Array.isArray(lista) ? lista : [];

      if (!itens.length) {
        const vazio = document.createElement("div");
        vazio.className = "checkin-kpi-vazio";
        vazio.textContent = "Nenhuma pessoa";
        container.appendChild(vazio);
        return;
      }

      itens.forEach((item) => {
        const linha = document.createElement("div");
        linha.className = "checkin-kpi-pessoa";

        const nome = document.createElement("span");
        nome.textContent = String(item?.nome || item?.aluno || item?.pessoa || "Pessoa");

        linha.appendChild(nome);
        container.appendChild(linha);
      });
    }

    async function carregarResumo() {
      try {
        const resp = await fetch(`${API}/resumo`, { cache: "no-store" });
        const json = await resp.json();
        if (!json.ok) return;
        els.kpiEntradasHoje.textContent = json.resumo.entradasHoje ?? 0;
        els.kpiAlunosPresentes.textContent = json.resumo.alunosPresentesAgora ?? 0;
        els.kpiFuncionariosPresentes.textContent = json.resumo.funcionariosPresentesAgora ?? 0;
        els.kpiSaidasHoje.textContent = json.resumo.saidasHoje ?? 0;
        els.kpiBloqueadosHoje.textContent = json.resumo.bloqueadosHoje ?? 0;
        els.kpiPessoasMes.textContent = json.resumo.pessoasMes ?? 0;
        const listas = json.resumo.listas || {};
        renderizarListaPessoas(els.listaEntradasHoje, listas.entradasHoje);
        renderizarListaPessoas(els.listaAlunosPresentes, listas.alunosPresentes);
        renderizarListaPessoas(els.listaFuncionariosPresentes, listas.funcionariosPresentes);
        renderizarListaPessoas(els.listaSaidasHoje, listas.saidasHoje);
        renderizarListaPessoas(els.listaBloqueadosHoje, listas.bloqueadosHoje);
        renderizarListaPessoas(els.listaPessoasMes, listas.pessoasMes);
      } catch (err) {
        console.error("Erro ao carregar resumo de check-in:", err);
      }
    }

    async function carregarRegistros() {
      try {
        const params = new URLSearchParams();
        if (alunoIdUrl) params.set("alunoId", alunoIdUrl);
        if (els.busca.value) params.set("busca", els.busca.value);
        // CHECKIN FILTRO DENTRO AGORA JS 20260826
        const filtroDentroAgora = els.filtroStatus.value === "dentro_agora";

        if (!filtroDentroAgora && els.filtroStatus.value) {
          params.set("status", els.filtroStatus.value);
        }

        if (filtroDentroAgora) {
          // CHECKIN TIMEZONE MACEIO 20260826
          const TIMEZONE_FUSION = "America/Maceio";
          const agora = new Date();
          const partesHoje = new Intl.DateTimeFormat("en-CA", {
            timeZone: TIMEZONE_FUSION,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          }).formatToParts(agora);
          const mapaHoje = Object.fromEntries(partesHoje.map((p) => [p.type, p.value]));
          const hojeLocal = `${mapaHoje.year}-${mapaHoje.month}-${mapaHoje.day}`;
          els.filtroData.value = hojeLocal;
          params.set("data", hojeLocal);
        } else if (els.filtroData.value) {
          params.set("data", els.filtroData.value);
        }

        const resumoPromise = carregarResumo();
        const resp = await fetch(`${API}?${params.toString()}`, { cache: "no-store" });
        const json = await resp.json();
        registros = json.registros || [];

        if (filtroDentroAgora) {
          try {
            const rr = await fetch(`${API}/resumo`, { cache: "no-store" });
            const rj = await rr.json();
            const listas = rj?.resumo?.listas || {};
            const presentes = [
              ...(Array.isArray(listas.alunosPresentes) ? listas.alunosPresentes : []),
              ...(Array.isArray(listas.funcionariosPresentes) ? listas.funcionariosPresentes : [])
            ];

            const norm = (v="") => String(v??"").normalize("NFD").replace(/[̀-ͯ]/g,"").trim().toLowerCase();
            const ids = new Set(presentes.map(p=>String(p?.id||"").trim()).filter(Boolean));
            const nomes = new Set(presentes.map(p=>norm(p?.nome)).filter(Boolean));

            const idReg = (r={}) => String(
              r.pessoaId||r.pessoa_id||r.alunoId||r.aluno_id||
              r.funcionarioId||r.funcionario_id||r.professorId||r.professor_id||
              r.usuarioId||r.usuario_id||""
            ).trim();

            const nomeReg = (r={}) => norm(
              r.aluno||r.pessoaNome||r.pessoa_nome||r.alunoNome||r.aluno_nome||r.nome||r.pessoa||""
            );

            const horaLocalFusion = (v="") => {
              const data = new Date(v);
              if (Number.isNaN(data.getTime())) return "";
              return new Intl.DateTimeFormat("pt-BR", {
                timeZone: "America/Maceio",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
              }).format(data);
            };

            const mapa = new Map();
            registros
              .filter(r => (idReg(r) && ids.has(idReg(r))) || (nomeReg(r) && nomes.has(nomeReg(r))))
              .forEach((r,i)=>{
                const chave=idReg(r)||nomeReg(r)||`linha:${i}`;
                const ordem=String(r.ultimaMovimentacaoEm||r.ultimaEntradaEm||`${r.data||""}T${r.horaEntrada||""}`);
                const atual=mapa.get(chave);
                if(!atual||ordem>=atual.ordem) mapa.set(chave,{ordem,item:r});
              });

            registros=[...mapa.values()].map(x=>({
              ...x.item,
              horaEntrada: horaLocalFusion(x.item.ultimaEntradaEm)||x.item.horaEntrada||"",
              horaSaida:"",
              status:"Dentro agora",
              _dentroAgora:true
            }));
          } catch (e) {
            console.error("Erro ao filtrar quem esta dentro agora:", e);
            registros=[];
          }
        }

        renderizarTabela();
        await resumoPromise;
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

      /*
       * 1. Somente autorizacao.
       * Nenhuma presenca e gravada nesta etapa.
       */
      const parametros = new URLSearchParams({ codigo });

      const respostaAutorizacao = await fetch(
        `${API}/musculacao/autorizacao?${parametros.toString()}`
      );

      const autorizacao = await respostaAutorizacao
        .json()
        .catch(() => ({}));

      if (!respostaAutorizacao.ok || autorizacao.ok === false) {
        alert(
          autorizacao.mensagem ||
          autorizacao.motivo ||
          "Não foi possível validar o acesso."
        );
        return;
      }

      const nome = autorizacao?.aluno?.nome || codigo;
      const alunoId = autorizacao?.aluno?.id || "";

      if (!autorizacao.autorizado) {
        alert(
          `Bloqueado: ${nome}\n${
            autorizacao.motivo ||
            autorizacao.mensagem ||
            "Acesso não autorizado."
          }`
        );
        return;
      }

      /*
       * 2. Mesmo Access Engine usado pelo Dashboard e biometria.
       */
      let acesso = null;

      try {
        const respostaCatraca = await fetch(
          "/api/access-engine/liberar-remoto",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              pessoaTipo: "aluno",
              alunoId,
              alunoNome: nome,
              direcao: "entrada",
              origem: "checkin-entrada-rapida",
              motivo: "checkin-musculacao-autorizado"
            })
          }
        );

        acesso = await respostaCatraca
          .json()
          .catch(() => ({}));

        if (
          !respostaCatraca.ok ||
          acesso.ok === false ||
          acesso.autorizado === false
        ) {
          throw new Error(
            acesso.motivo ||
            acesso.mensagem ||
            acesso.erro ||
            "A catraca não foi autorizada."
          );
        }
      } catch (erro) {
        console.error(
          "Falha na liberação unificada da catraca:",
          erro
        );

        alert(
          `Não foi possível liberar a catraca para ${nome}.\n${
            erro?.message || "Falha de comunicação."
          }`
        );
        return;
      }

      const accessLogId = acesso?.log?.id || "";
      const commandId =
        acesso?.catraca?.commandId ||
        acesso?.catraca?.command?.id ||
        "";

      if (!accessLogId) {
        alert(
          "A catraca foi autorizada, mas o servidor não retornou o evento de acesso."
        );
        await carregarRegistros();
        return;
      }

      /*
       * 3. O Access Engine ja criou o evento e a presenca.
       * Este POST apenas complementa o MESMO registro com os dados
       * da musculacao, frequencia e treino.
       */
      const resp = await fetch(`${API}/musculacao`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          codigo,
          data: hojeISO(),
          horaEntrada: horaAtual(),
          tipo: "Check-in Inteligente Musculação",
          usuario: "Recepção",
          accessLogId,
          comandoCatracaId: commandId,
          observacao:
            `Acesso criado pelo Access Engine. accessLogId=${accessLogId}` +
            (commandId ? ` commandId=${commandId}` : "")
        })
      });

      const json = await resp
        .json()
        .catch(() => ({}));

      if (!resp.ok || !json.ok) {
        alert(
          `Acesso registrado para ${nome}, mas não foi possível complementar os dados do check-in.`
        );

        els.entradaCodigo.value = "";
        await carregarRegistros();
        return;
      }

      const treino = json?.execucaoTreino?.id
        ? `\nTreino iniciado: ${json.execucaoTreino.id}`
        : "";

      const frequencia = json?.frequencia?.id
        ? `\nFrequência: ${json.frequencia.id}`
        : "";

      alert(
        `Liberado: ${nome}\nAcesso registrado pela catraca.${frequencia}${treino}`
      );

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
