(() => {
  const STATUS_ATIVOS = new Set([
    "ativo", "ativa", "active", "vigente", "regular",
    "matriculado", "matriculada", "em andamento", "em_andamento",
    "liberado", "liberada", "adimplente", "reativado", "reativada"
  ]);

  const STATUS_INATIVOS = new Set([
    "inativo", "inativa", "inactive", "cancelado", "cancelada",
    "bloqueado", "bloqueada", "suspenso", "suspensa", "encerrado",
    "encerrada", "excluido", "excluida", "removido", "removida"
  ]);

  function normalizar(valor) {
    return String(valor ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[-_\s]+/g, " ");
  }

  function primeiroStatus(registro, campos) {
    for (const campo of campos) {
      const valor = registro?.[campo];
      if (valor !== undefined && valor !== null && String(valor).trim() !== "") return valor;
    }
    return "";
  }

  function registroComDados(registro) {
    return Boolean(registro && typeof registro === "object" && Object.keys(registro).length);
  }

  function possuiStatusAluno(aluno = {}) {
    return aluno.bloqueado === true ||
      aluno.bloqueioCheckin === true ||
      aluno.ativo !== undefined ||
      aluno.isAtivo !== undefined ||
      Boolean(primeiroStatus(aluno, ["statusAluno", "status_aluno", "status", "situacaoAluno", "situacao"]));
  }

  function possuiStatusMatricula(matricula = {}) {
    return matricula.bloqueada === true ||
      matricula.bloqueioCheckin === true ||
      matricula.ativo !== undefined ||
      matricula.isAtiva !== undefined ||
      Boolean(primeiroStatus(matricula, ["statusMatricula", "status_matricula", "status", "situacao", "estado"]));
  }

  function alunoDetalheAtual() {
    if (registroComDados(window.alunoDetalhe)) return window.alunoDetalhe;
    try {
      if (typeof alunoDetalhe !== "undefined" && registroComDados(alunoDetalhe)) return alunoDetalhe;
    } catch {}
    return {};
  }

  function matriculaDetalheAtual() {
    if (registroComDados(window.matriculaAlunoDetalhe)) return window.matriculaAlunoDetalhe;
    try {
      if (typeof matriculaAlunoDetalhe !== "undefined" && registroComDados(matriculaAlunoDetalhe)) return matriculaAlunoDetalhe;
    } catch {}
    return {};
  }

  // O cadastro do aluno e a matrícula são entidades diferentes.
  // Nunca usar statusMatricula para concluir que o cadastro do aluno está inativo.
  function alunoAtivo(aluno = {}) {
    if (!aluno || typeof aluno !== "object") return false;
    if (aluno.bloqueado === true || aluno.bloqueioCheckin === true) return false;

    const status = normalizar(primeiroStatus(aluno, [
      "statusAluno", "status_aluno", "status", "situacaoAluno", "situacao"
    ]));

    if (STATUS_INATIVOS.has(status)) return false;
    if (STATUS_ATIVOS.has(status)) return true;
    if (aluno.ativo === true || aluno.isAtivo === true) return true;
    if (aluno.ativo === false || aluno.isAtivo === false) return false;
    return false;
  }

  function matriculaAtiva(matricula = {}) {
    if (!matricula || typeof matricula !== "object") return false;
    if (matricula.bloqueada === true || matricula.bloqueioCheckin === true) return false;

    const status = normalizar(primeiroStatus(matricula, [
      "statusMatricula", "status_matricula", "status", "situacao", "estado"
    ]));

    if (STATUS_INATIVOS.has(status)) return false;
    if (STATUS_ATIVOS.has(status)) return true;
    if (matricula.ativo === true || matricula.isAtiva === true) return true;
    if (matricula.ativo === false || matricula.isAtiva === false) return false;
    return false;
  }

  function obterLista(payload = {}) {
    if (Array.isArray(payload)) return payload;
    for (const campo of ["matriculas", "dados", "data", "itens", "registros"]) {
      if (Array.isArray(payload?.[campo])) return payload[campo];
    }
    return [];
  }

  async function buscarJson(url) {
    try {
      const sessao = typeof sessaoAluno === "function" ? sessaoAluno() : null;
      const headers = sessao?.token ? { Authorization: `Bearer ${sessao.token}` } : {};
      const resp = await fetch(url, { cache: "no-store", headers });
      if (!resp.ok) return null;
      return await resp.json().catch(() => null);
    } catch {
      return null;
    }
  }

  window.carregarMatriculaAluno = async function carregarMatriculaAlunoCorrigida(sessao) {
    if (!sessao?.alunoId) return null;
    const prontuario = await buscarJson(`/api/alunos/${encodeURIComponent(sessao.alunoId)}/prontuario`);
    window.prontuarioAlunoDetalhe = prontuario || null;
    const matriculas = obterLista(prontuario || {});
    return matriculas.find(matriculaAtiva) || null;
  };

  const carregarPagamentosOriginal = window.carregarPagamentos;

  window.carregarPagamentos = async function carregarPagamentosCorrigido(sessao) {
    const aluno = alunoDetalheAtual();
    const matricula = matriculaDetalheAtual();
    const cadastroInformado = registroComDados(aluno) && possuiStatusAluno(aluno);
    const matriculaInformada = registroComDados(matricula) && possuiStatusMatricula(matricula);
    const cadastroAtivo = !cadastroInformado || alunoAtivo(aluno);
    const inscricaoAtiva = !matriculaInformada || matriculaAtiva(matricula);

    if ((cadastroInformado && !cadastroAtivo) || (matriculaInformada && !inscricaoAtiva)) {
      const proximo = document.getElementById("proximoPagamento");
      const status = document.getElementById("statusPagamento");
      const alerta = document.getElementById("alertaPagamento");

      if (proximo) proximo.textContent = "Sem cobrança ativa";
      if (status) {
        status.textContent = !cadastroAtivo ? "Aluno inativo" : "Matrícula inativa";
        status.classList.remove("vencido");
      }
      if (alerta) {
        alerta.textContent = "";
        alerta.classList.add("hidden");
      }
      return;
    }

    // Limpa rótulo residual deixado pelo cache/execução anterior antes de
    // carregar a cobrança real do aluno ativo.
    const status = document.getElementById("statusPagamento");
    if (status && ["Aluno inativo", "Matrícula inativa"].includes(status.textContent.trim())) {
      status.textContent = "";
    }

    return carregarPagamentosOriginal?.(sessao);
  };

  window.FusionStatusPortalAluno = { alunoAtivo, matriculaAtiva, normalizar };
})();
