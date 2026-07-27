(() => {
  const CHAVE_ATIVA = "fusion_aluno_sessao_ativa";
  const CHAVE_LOGIN = "fusion_aluno_treino_login";
  let sessaoDaTela = "";

  function uuid() {
    return crypto?.randomUUID?.() || `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  function lerLogin() {
    try { return JSON.parse(localStorage.getItem(CHAVE_LOGIN) || "null"); }
    catch { return null; }
  }

  function registrarLogin(dados = {}) {
    const sessaoId = uuid();
    const registro = {
      sessaoId,
      alunoId: String(dados.alunoId || ""),
      criadoEm: new Date().toISOString()
    };
    localStorage.setItem(CHAVE_ATIVA, JSON.stringify(registro));
    sessaoDaTela = sessaoId;
    return registro;
  }

  function lerAtiva() {
    try { return JSON.parse(localStorage.getItem(CHAVE_ATIVA) || "null"); }
    catch { return null; }
  }

  function sairPorOutroAcesso() {
    localStorage.removeItem(CHAVE_LOGIN);
    localStorage.removeItem("fusion_aluno_treino_selecionado");
    sessionStorage.setItem("fusion_aluno_motivo_logout", "outro_acesso");
    location.replace("/pages/aluno-login/index.html?motivo=outro_acesso");
  }

  function iniciarPortal() {
    const login = lerLogin();
    if (!login?.alunoId) return;
    const ativa = lerAtiva();
    if (!ativa?.sessaoId || String(ativa.alunoId) !== String(login.alunoId)) {
      registrarLogin(login);
    } else {
      sessaoDaTela = ativa.sessaoId;
    }

    window.addEventListener("storage", (ev) => {
      if (ev.key !== CHAVE_ATIVA || !ev.newValue) return;
      let nova = null;
      try { nova = JSON.parse(ev.newValue); } catch {}
      if (nova?.sessaoId && sessaoDaTela && nova.sessaoId !== sessaoDaTela) sairPorOutroAcesso();
    });

    setInterval(() => {
      const atual = lerAtiva();
      if (atual?.sessaoId && sessaoDaTela && atual.sessaoId !== sessaoDaTela) sairPorOutroAcesso();
    }, 4000);
  }

  window.FusionAlunoSessao = { registrarLogin, iniciarPortal, lerAtiva };
})();
