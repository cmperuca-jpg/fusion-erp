(() => {
  const STATUS_ATIVOS = new Set([
    "ativo", "ativa", "active", "vigente", "regular",
    "matriculado", "matriculada", "em andamento", "em_andamento"
  ]);

  function normalizarStatus(valor) {
    return String(valor ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[-\s]+/g, "_");
  }

  function statusDe(registro = {}) {
    return normalizarStatus(
      registro.statusMatricula ??
      registro.status_matricula ??
      registro.statusAluno ??
      registro.status_aluno ??
      registro.status ??
      registro.situacao ??
      registro.ativo
    );
  }

  function estaAtivo(registro = {}) {
    if (!registro || typeof registro !== "object") return false;
    if (registro.ativo === true || registro.isAtivo === true) return true;
    if (registro.ativo === false || registro.isAtivo === false) return false;
    return STATUS_ATIVOS.has(statusDe(registro).replace(/_/g, " "));
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
    const matriculas = obterLista(prontuario || {});
    return matriculas.find(estaAtivo) || null;
  };

  const carregarPagamentosOriginal = window.carregarPagamentos;

  window.carregarPagamentos = async function carregarPagamentosCorrigido(sessao) {
    const alunoAtivo = estaAtivo(window.alunoDetalhe || {});
    const matriculaAtiva = estaAtivo(window.matriculaAlunoDetalhe || {});

    if (!alunoAtivo || !matriculaAtiva) {
      const proximo = document.getElementById("proximoPagamento");
      const status = document.getElementById("statusPagamento");
      const alerta = document.getElementById("alertaPagamento");

      if (proximo) proximo.textContent = "Sem cobrança ativa";
      if (status) {
        status.textContent = !alunoAtivo ? "Aluno inativo" : "Matrícula inativa";
        status.classList.remove("vencido");
      }
      if (alerta) {
        alerta.textContent = "";
        alerta.classList.add("hidden");
      }
      return;
    }

    return carregarPagamentosOriginal?.(sessao);
  };
})();
