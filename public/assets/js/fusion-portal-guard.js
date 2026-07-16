(function () {
  const script = document.currentScript;
  const modo = script?.dataset?.fusionGuard || "sistema";
  const LOGIN_SISTEMA = "/pages/login/index.html";
  const LOGIN_PROFESSOR = "/pages/professor-login/index.html";
  const LOGIN_ALUNO = "/pages/aluno-login/index.html";

  document.documentElement.style.visibility = "hidden";

  function lerJson(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || "null"); }
    catch { return null; }
  }

  function destinoLogin(tipo) {
    const next = encodeURIComponent(location.pathname + location.search);
    const base = tipo === "professor" ? LOGIN_PROFESSOR : (tipo === "aluno" ? LOGIN_ALUNO : LOGIN_SISTEMA);
    return `${base}?next=${next}`;
  }

  function limpar(tipo) {
    if (tipo === "professor") localStorage.removeItem("fusion_professor_sessao");
    else if (tipo === "aluno") localStorage.removeItem("fusion_aluno_treino_login");
    else ["fusionToken", "fusionUsuario", "usuarioLogado", "usuarioNome", "usuarioEmail", "usuarioPerfil"].forEach((k) => localStorage.removeItem(k));
  }

  async function validarSistema() {
    const token = localStorage.getItem("fusionToken") || "";
    if (!token || !lerJson("fusionUsuario")) return null;
    const resp = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!resp.ok) return null;
    const dados = await resp.json().catch(() => ({}));
    return dados.ok === false ? null : { tipo: "sistema", usuario: dados.usuario, token };
  }

  async function validarProfessor() {
    const sessao = lerJson("fusion_professor_sessao");
    if (!sessao?.professorId || !sessao?.token) return null;
    const resp = await fetch("/api/professores/sessao", { headers: { Authorization: `Bearer ${sessao.token}` }, cache: "no-store" });
    if (!resp.ok) return null;
    const dados = await resp.json().catch(() => ({}));
    if (dados.ok === false || !dados.professor?.id) return null;
    const atualizada = {
      ...sessao,
      professorId: String(dados.professor.id),
      professorNome: dados.professor.nome || sessao.professorNome || "Professor",
      perfil: dados.professor.perfil || sessao.perfil || "professor",
      acessoTodosAlunos: dados.professor.acessoTodosAlunos === true
    };
    localStorage.setItem("fusion_professor_sessao", JSON.stringify(atualizada));
    return { tipo: "professor", usuario: atualizada, token: sessao.token };
  }

  async function validarAluno() {
    const sessao = lerJson("fusion_aluno_treino_login");
    if (!sessao?.alunoId || !sessao?.token) return null;
    const url = `/api/treinos/aluno-sessao?alunoId=${encodeURIComponent(sessao.alunoId)}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${sessao.token}` }, cache: "no-store" });
    if (!resp.ok) return null;
    const dados = await resp.json().catch(() => ({}));
    return dados.ok === false ? null : { tipo: "aluno", usuario: sessao, token: sessao.token };
  }

  async function executar() {
    let sessao = null;
    let tipoLogin = modo;

    try {
      if (modo === "professor") sessao = await validarProfessor();
      else if (modo === "aluno") sessao = await validarAluno();
      else if (modo === "sistema-ou-professor") {
        const pediuProfessor = new URLSearchParams(location.search).get("origem") === "professor";
        sessao = pediuProfessor ? await validarProfessor() : await validarSistema();
        if (!sessao && !pediuProfessor) sessao = await validarProfessor();
        tipoLogin = pediuProfessor || (!localStorage.getItem("fusionToken") && Boolean(lerJson("fusion_professor_sessao"))) ? "professor" : "sistema";
      } else sessao = await validarSistema();
    } catch { sessao = null; }

    if (!sessao) {
      limpar(tipoLogin);
      location.replace(destinoLogin(tipoLogin));
      return null;
    }

    window.FUSION_SESSAO_VALIDADA = sessao;
    document.documentElement.style.visibility = "";
    return sessao;
  }

  window.FusionPortalGuard = { ready: executar() };
})();
