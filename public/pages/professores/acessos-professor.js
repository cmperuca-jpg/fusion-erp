// PROFESSOR ACESSOS DENTRO CADASTRO V2 20260826
(() => {
  const API_PROFESSORES = "/api/professores";
  const API_BIOMETRIA = "/api/biometria";

  let professorAtual = null;
  let carregando = false;

  const $ = (id) => document.getElementById(id);
  const texto = (v) => String(v ?? "").trim();

  function normalizar(v) {
    return texto(v)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }

  function digitos(v) {
    return texto(v).replace(/\D/g, "");
  }

  function fetchAuth(url, opcoes = {}) {
    return window.FusionAuth?.fetchAuth
      ? window.FusionAuth.fetchAuth(url, opcoes)
      : fetch(url, opcoes);
  }

  async function jsonOk(url, opcoes = {}) {
    const resp = await fetchAuth(url, { cache: "no-store", ...opcoes });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json?.ok === false) {
      throw new Error(json?.mensagem || json?.erro || `HTTP ${resp.status}`);
    }
    return json;
  }

  function listaProfessores(payload) {
    if (Array.isArray(payload)) return payload;
    for (const chave of ["professores", "dados", "items", "data", "resultado"]) {
      if (Array.isArray(payload?.[chave])) return payload[chave];
    }
    return [];
  }

  function primeiroValor(seletores) {
    for (const seletor of seletores) {
      const el = document.querySelector(seletor);
      if (!el) continue;
      const valor = texto(el.value ?? el.textContent);
      if (valor) return valor;
    }
    return "";
  }

  function dadosFormulario() {
    return {
      id: primeiroValor([
        "#professorId", "#idProfessor", "#id",
        'input[name="professorId"]',
        'input[name="idProfessor"]',
        'input[name="id"]'
      ]),
      nome: primeiroValor([
        "#nome", "#nomeCompleto",
        'input[name="nome"]',
        'input[name="nomeCompleto"]'
      ]),
      cpf: primeiroValor(["#cpf", 'input[name="cpf"]']),
      email: primeiroValor([
        "#email",
        'input[name="email"]',
        'input[type="email"]'
      ])
    };
  }

  function localizarProfessor(lista, dados) {
    const id = texto(dados.id);
    if (id) {
      const achado = lista.find((p) =>
        [p.id, p._id, p.professorId, p.professor_id]
          .some((v) => texto(v) === id)
      );
      if (achado) return achado;
    }

    const cpf = digitos(dados.cpf);
    if (cpf) {
      const achado = lista.find((p) => digitos(p.cpf) === cpf);
      if (achado) return achado;
    }

    const email = normalizar(dados.email);
    if (email) {
      const achado = lista.find((p) =>
        [p.email, p.login].some((v) => normalizar(v) === email)
      );
      if (achado) return achado;
    }

    const nome = normalizar(dados.nome);
    if (nome) {
      const achado = lista.find((p) =>
        normalizar(p.nome || p.nomeCompleto || p.nome_completo) === nome
      );
      if (achado) return achado;
    }

    return null;
  }

  function idProfessor(p = {}) {
    return texto(p.id || p._id || p.professorId || p.professor_id);
  }

  function nomeProfessor(p = {}) {
    return texto(p.nome || p.nomeCompleto || p.nome_completo || "Professor");
  }

  function identificadorProfessor(p = {}) {
    return texto(p.email || p.login || p.cpf);
  }

  function badge(id, valor, classe = "neutro") {
    const el = $(id);
    if (!el) return;
    el.textContent = valor;
    el.className = `prof-acessos-badge ${classe}`;
  }

  function mensagem(valor = "", erro = false) {
    const el = $("profAcessosMensagem");
    if (!el) return;
    el.hidden = !valor;
    el.textContent = valor;
    el.className = `prof-acessos-mensagem${erro ? " erro" : ""}`;
  }

  function renderProfessor(p = {}) {
    const id = idProfessor(p);
    const nome = nomeProfessor(p);
    const identificador = identificadorProfessor(p);

    if ($("profAcessosIdentidade")) {
      $("profAcessosIdentidade").textContent =
        id ? `${nome} · ID ${id}` : "Salve o professor primeiro";
    }
    if ($("profAppNome")) $("profAppNome").textContent = id ? nome : "-";
    if ($("profAppIdentificador")) {
      $("profAppIdentificador").textContent =
        id ? (identificador || "CPF / e-mail / login") : "-";
    }
    if ($("profBioId")) $("profBioId").textContent = id || "-";

    badge(
      "profAppStatus",
      id ? "Cadastro salvo" : "Salve primeiro",
      id ? "ok" : "warn"
    );

    if ($("btnProfBioAtualizar")) $("btnProfBioAtualizar").disabled = !id;
    if ($("btnProfBioCadastrar")) $("btnProfBioCadastrar").disabled = !id;
    if ($("btnProfAbrirApp")) $("btnProfAbrirApp").disabled = !id;
  }

  async function verificarBiometria() {
    const id = idProfessor(professorAtual);
    if (!id) {
      badge("profBioStatus", "Salve primeiro", "warn");
      return;
    }

    badge("profBioStatus", "Verificando", "neutro");

    try {
      const json = await jsonOk(
        `${API_BIOMETRIA}/pessoa/professor/${encodeURIComponent(id)}`
      );
      const bio = json?.biometria || json?.dados?.biometria || {};
      const cadastrada = Boolean(
        bio === true ||
        bio?.cadastrada === true ||
        bio?.existe === true ||
        json?.cadastrada === true
      );

      badge(
        "profBioStatus",
        cadastrada ? "Digital cadastrada" : "Sem digital",
        cadastrada ? "ok" : "warn"
      );
    } catch (erro) {
      badge("profBioStatus", "Indisponível", "erro");
      mensagem(`Biometria: ${erro.message}`, true);
    }
  }

  async function carregarAcessos() {
    if (!$("profAcessosIdentidade") || carregando) return;

    carregando = true;
    mensagem("");

    try {
      const payload = await jsonOk(API_PROFESSORES);
      professorAtual = localizarProfessor(
        listaProfessores(payload),
        dadosFormulario()
      );

      if (!professorAtual) {
        renderProfessor({});
        badge("profBioStatus", "Salve primeiro", "warn");
        return;
      }

      renderProfessor(professorAtual);
      await verificarBiometria();
    } catch (erro) {
      professorAtual = null;
      renderProfessor({});
      badge("profAppStatus", "Indisponível", "erro");
      badge("profBioStatus", "Indisponível", "erro");
      mensagem(erro.message || "Não foi possível carregar os acessos.", true);
    } finally {
      carregando = false;
    }
  }

  function focarSenha() {
    const senha = document.querySelector(
      '#tab-cadastro input[type="password"], input[type="password"]'
    );
    if (!senha) {
      mensagem("Campo de senha não localizado no cadastro.", true);
      return;
    }
    senha.focus();
    senha.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function abrirApp() {
    window.open("/pages/professor-login/index.html", "_blank", "noopener");
  }

  function abrirBiometria() {
    const id = idProfessor(professorAtual);
    if (!id) {
      mensagem("Salve o professor antes de cadastrar a digital.", true);
      return;
    }

    window.open(
      `/pages/biometria/index.html?tipo=professor&id=${encodeURIComponent(id)}`,
      "_blank",
      "noopener"
    );
  }

  function iniciar() {
    $("btnProfDefinirSenha")?.addEventListener("click", focarSenha);
    $("btnProfAbrirApp")?.addEventListener("click", abrirApp);
    $("btnProfBioAtualizar")?.addEventListener("click", verificarBiometria);
    $("btnProfBioCadastrar")?.addEventListener("click", abrirBiometria);

    document.addEventListener("click", (ev) => {
      const botao = ev.target.closest("button");
      if (!botao) return;

      const textoBotao = normalizar(botao.textContent);
      const tab = normalizar(botao.dataset?.tab);

      if (tab === "cadastro" || textoBotao === "editar") {
        window.setTimeout(carregarAcessos, 120);
      }
    });

    window.setTimeout(carregarAcessos, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
