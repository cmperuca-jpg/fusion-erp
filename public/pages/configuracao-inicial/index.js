(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const API = {
    usuarios: "/api/auth/usuarios",
    professores: "/api/professores",
    categorias: "/api/modalidades/categorias",
    modalidades: "/api/modalidades",
    planos: "/api/planos",
    turmas: "/api/turmas",
    aparencia: "/api/modalidades/onboarding/aparencia",
    onboardingStatus: "/api/auth/onboarding/status",
    onboardingConcluir: "/api/auth/onboarding/concluir",
    onboardingCancelar: "/api/auth/onboarding/cancelar"
  };

  const ETAPAS = [
    { id:"admin", titulo:"Administrador", subtitulo:"Seu acesso principal" },
    { id:"recepcao", titulo:"Recepção", subtitulo:"Atendimento e caixa" },
    { id:"professor", titulo:"Professor", subtitulo:"Treinos e avaliações" },
    { id:"categoria", titulo:"Categoria", subtitulo:"Organização das atividades" },
    { id:"modalidade", titulo:"Modalidade", subtitulo:"Atividade oferecida" },
    { id:"plano", titulo:"Plano", subtitulo:"Preço e cobrança" },
    { id:"turma", titulo:"Turma", subtitulo:"Horário e capacidade" },
    { id:"marca", titulo:"Marca", subtitulo:"Nome, cor e logotipo" },
    { id:"pagina", titulo:"Página pública", subtitulo:"Seu endereço na internet" },
    { id:"aplicativos", titulo:"Aplicativos", subtitulo:"Aluno, professor e equipe" },
    { id:"pronto", titulo:"Academia pronta", subtitulo:"Entrar no seu sistema" }
  ];

  let dados = {
    usuarios:[], professores:[], categorias:[], modalidades:[], planos:[], turmas:[],
    aparencia:null
  };
  let etapaAtual = 0;

  function normalizar(v) {
    return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function texto(v) { return String(v ?? "").trim(); }
  function escapar(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function moeda(v) {
    return Number(v || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  }
  function academiaNome() {
    const u = window.FusionAuth?.usuarioAtual?.() || {};
    return texto(
      sessionStorage.getItem("fusionAcademiaSelecionadaNome") ||
      u.academiaNome ||
      localStorage.getItem("fusionTenantId") ||
      "Sua academia"
    );
  }
  function usuarioAdmin() {
    return window.FusionAuth?.usuarioAtual?.() || {};
  }

  function tenantIdAtual() {
    return texto(localStorage.getItem("fusionTenantId") || usuarioAdmin()?.tenantId);
  }

  function slugAcademia() {
    return texto(
      localStorage.getItem("fusionAcademiaSlug") ||
      window.__FUSION_TENANT_CONTEXT__?.slug ||
      tenantIdAtual()
    );
  }

  function urlPublica() {
    return `${location.origin}/${encodeURIComponent(slugAcademia())}`;
  }

  function urlApp(area = "dashboard") {
    return `/${encodeURIComponent(slugAcademia())}/app/${encodeURIComponent(area)}`;
  }

  function urlApps(perfil = "") {
    const base = `/${encodeURIComponent(slugAcademia())}/apps`;
    return perfil ? `${base}/${encodeURIComponent(perfil)}` : base;
  }

  function chaveEntrega() {
    return `fusion_onboarding_entrega_${tenantIdAtual() || slugAcademia()}`;
  }

  function lerEntrega() {
    try { return JSON.parse(localStorage.getItem(chaveEntrega()) || "{}"); }
    catch { return {}; }
  }

  function salvarEntrega(parcial = {}) {
    const atual = lerEntrega();
    const novo = { ...atual, ...parcial, atualizadoEm:new Date().toISOString() };
    localStorage.setItem(chaveEntrega(), JSON.stringify(novo));
    return novo;
  }

  function alerta(msg = "", tipo = "info") {
    const el = $("alerta");
    el.textContent = msg;
    el.className = msg ? `alert ${tipo}` : "alert hidden";
  }

  async function request(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const resp = await FusionAuth.fetchAuth(url, { cache:"no-store", ...options, headers });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false || json.sucesso === false) {
      throw new Error(json.mensagem || json.erro || "Não foi possível concluir esta etapa.");
    }
    return json;
  }

  function listaDe(json, chaves = []) {
    if (Array.isArray(json)) return json;
    for (const k of chaves) if (Array.isArray(json?.[k])) return json[k];
    if (Array.isArray(json?.dados)) return json.dados;
    return [];
  }

  async function carregarDados() {
    const consultas = [
      ["usuarios", API.usuarios, ["usuarios"]],
      ["professores", API.professores, ["professores"]],
      ["categorias", API.categorias, ["categorias"]],
      ["modalidades", API.modalidades, ["modalidades"]],
      ["planos", API.planos, ["planos"]],
      ["turmas", API.turmas, ["turmas"]],
      ["aparencia", API.aparencia, []]
    ];

    const resultados = await Promise.all(consultas.map(async ([chave, url, chaves]) => {
      try {
        const json = await request(url);
        return { ok: true, chave, chaves, json };
      } catch (error) {
        console.error(`[Onboarding] Falha ao carregar ${chave} (${url}):`, error);
        return { ok: false, chave, chaves, error };
      }
    }));

    const falhas = [];
    for (const item of resultados) {
      if (!item.ok) {
        falhas.push(item.chave);
        continue;
      }

      if (item.chave === "aparencia") {
        dados.aparencia = item.json?.aparencia || item.json?.dados || null;
      } else {
        dados[item.chave] = listaDe(item.json, item.chaves);
      }
    }

    if (falhas.length) {
      alerta(
        `A configuração foi aberta. Alguns dados não puderam ser verificados agora: ${falhas.join(", ")}. Você pode continuar; cada etapa validará o cadastro ao salvar.`,
        "info"
      );
    }
  }

  function recepcaoExistente() {
    return dados.usuarios.find(u => normalizar(u.perfil).includes("recepc"));
  }
  function professorExistente() { return dados.professores[0] || null; }
  function categoriaExistente() {
    return dados.categorias[0] || (dados.modalidades[0]?.categoria ? { nome:dados.modalidades[0].categoria } : null);
  }
  function modalidadeExistente() { return dados.modalidades[0] || null; }
  function planoExistente() { return dados.planos[0] || null; }
  function turmaExistente() { return dados.turmas[0] || null; }
  function marcaConfigurada() {
    const marca = dados.aparencia?.marca || {};
    return Boolean(
      texto(marca.logoUrl) ||
      (texto(marca.nome) && normalizar(marca.nome) !== "fusion erp")
    );
  }

  function estadoEtapas() {
    const entrega = lerEntrega();
    return [
      true,
      Boolean(recepcaoExistente()),
      Boolean(professorExistente()),
      Boolean(categoriaExistente()),
      Boolean(modalidadeExistente()),
      Boolean(planoExistente()),
      Boolean(turmaExistente()),
      marcaConfigurada(),
      entrega.paginaPublica === true,
      entrega.aplicativos === true,
      entrega.finalizado === true
    ];
  }

  function primeiraPendente() {
    const estados = estadoEtapas();
    const i = estados.findIndex(v => !v);
    return i < 0 ? ETAPAS.length : i;
  }

  function atualizarProgresso() {
    const estados = estadoEtapas();
    const feitos = estados.filter(Boolean).length;
    const pct = Math.round((feitos / ETAPAS.length) * 100);
    $("progressoTexto").textContent = `${feitos} de ${ETAPAS.length} etapas concluídas`;
    $("progressoPercentual").textContent = `${pct}%`;
    $("progressoBarra").style.width = `${pct}%`;
    $("progressoAjuda").textContent = feitos === ETAPAS.length
      ? "Configuração mínima concluída. Sua academia já pode iniciar os cadastros."
      : "Sua configuração é salva no Fusion a cada etapa.";
  }

  function renderListaEtapas() {
    const estados = estadoEtapas();
    const primeira = primeiraPendente();
    $("listaEtapas").innerHTML = ETAPAS.map((e, i) => {
      const done = estados[i];
      const acessivel = done || i <= primeira;
      return `
        <li>
          <button class="step-button ${done ? "done" : ""} ${i === etapaAtual ? "active" : ""} ${!acessivel ? "locked" : ""}"
                  type="button" data-step="${i}" ${!acessivel ? "disabled" : ""}>
            <span class="step-number">${done ? "✓" : i + 1}</span>
            <span class="step-label"><strong>${e.titulo}</strong><small>${e.subtitulo}</small></span>
            <span class="step-state">${done ? "✓" : "›"}</span>
          </button>
        </li>`;
    }).join("");

    document.querySelectorAll("[data-step]").forEach(btn => {
      btn.addEventListener("click", () => {
        etapaAtual = Number(btn.dataset.step);
        alerta("");
        renderTudo();
      });
    });
  }

  function stageHead(numero, titulo, descricao, concluida = false) {
    return `
      <div class="stage-head">
        <div>
          <span class="eyebrow">Etapa ${numero} de ${ETAPAS.length}</span>
          <h2>${titulo}</h2>
          <p>${descricao}</p>
        </div>
        ${concluida ? '<span class="done-badge">Concluída</span>' : ""}
      </div>`;
  }

  function botoes({ voltar = true, label = "Salvar e avançar", form = true } = {}) {
    return `
      <div class="actions">
        ${voltar ? '<button class="btn btn-secondary" type="button" data-voltar>Voltar</button>' : '<span></span>'}
        <div class="actions-right">
          <button class="btn btn-primary" ${form ? 'type="submit"' : 'type="button" data-avancar'}>${label}</button>
        </div>
      </div>`;
  }

  function renderAdmin() {
    const u = usuarioAdmin();
    return `
      ${stageHead(1,"Administrador principal","Este usuário foi criado junto com a academia. Ele tem permissão total para concluir a configuração inicial.",true)}
      <div class="info-card">
        <div class="info-grid">
          <div class="info-cell"><span>Nome</span><strong>${escapar(u.nome || "Administrador")}</strong></div>
          <div class="info-cell"><span>E-mail</span><strong>${escapar(u.email || "-")}</strong></div>
          <div class="info-cell"><span>Perfil</span><strong>Administrador</strong></div>
          <div class="info-cell"><span>Status</span><strong>Ativo</strong></div>
        </div>
      </div>
      <div class="note">Este acesso é o dono da configuração. Não criamos outro administrador para evitar duplicidade.</div>
      ${botoes({voltar:false,label:"Continuar para Recepção",form:false})}
    `;
  }

  function renderRecepcao() {
    const existente = recepcaoExistente();
    if (existente) return `
      ${stageHead(2,"Recepção","A recepção atende alunos, matrículas, caixa e rotinas operacionais.",true)}
      <div class="info-card"><div class="info-grid">
        <div class="info-cell"><span>Usuário</span><strong>${escapar(existente.nome)}</strong></div>
        <div class="info-cell"><span>E-mail</span><strong>${escapar(existente.email)}</strong></div>
      </div></div>
      <div class="note">Já existe uma recepção ativa. Você poderá cadastrar outras depois em Configurações → Usuários.</div>
      ${botoes({label:"Continuar para Professor",form:false})}
    `;
    return `
      ${stageHead(2,"Crie o primeiro acesso da Recepção","Esse usuário poderá iniciar atendimento sem usar a senha do administrador.")}
      <form id="formEtapa" class="form-grid">
        <div class="field"><label for="recNome">Nome da recepção *</label><input id="recNome" required minlength="2" value="Recepção" autocomplete="name"></div>
        <div class="field"><label for="recEmail">E-mail de acesso *</label><input id="recEmail" type="email" required autocomplete="email" placeholder="recepcao@suaacademia.com.br"></div>
        <div class="field"><label for="recSenha">Senha *</label><input id="recSenha" type="password" required minlength="10" autocomplete="new-password" placeholder="Mínimo de 10 caracteres"><small>Use uma senha individual. Não compartilhe a senha do administrador.</small></div>
        <div class="field"><label for="recConfirmar">Confirmar senha *</label><input id="recConfirmar" type="password" required minlength="10" autocomplete="new-password"></div>
        <div class="field full">${botoes({label:"Criar Recepção e avançar"})}</div>
      </form>`;
  }

  function renderProfessor() {
    const existente = professorExistente();
    if (existente) return `
      ${stageHead(3,"Professor","O professor terá cadastro próprio para treinos e avaliações.",true)}
      <div class="info-card"><div class="info-grid">
        <div class="info-cell"><span>Professor</span><strong>${escapar(existente.nome)}</strong></div>
        <div class="info-cell"><span>CREF</span><strong>${escapar(existente.cref || "Não informado")}</strong></div>
      </div></div>
      ${botoes({label:"Continuar para Categoria",form:false})}
    `;
    return `
      ${stageHead(3,"Cadastre o primeiro Professor","Crie um acesso que já poderá ser usado no Fusion Professor. CREF e CPF podem ser completados depois.")}
      <form id="formEtapa" class="form-grid">
        <div class="field"><label for="profNome">Nome completo *</label><input id="profNome" required minlength="3" autocomplete="name"></div>
        <div class="field"><label for="profEmail">E-mail</label><input id="profEmail" type="email" autocomplete="email"></div>
        <div class="field"><label for="profCpf">CPF</label><input id="profCpf" inputmode="numeric" autocomplete="off" placeholder="Somente números"></div>
        <div class="field"><label for="profCref">CREF</label><input id="profCref" autocomplete="off" placeholder="Ex.: 000000-G/AL"></div>
        <div class="field"><label for="profTelefone">WhatsApp</label><input id="profTelefone" inputmode="tel" autocomplete="tel"></div>
        <div class="field"><label for="profSenha">Senha do Fusion Professor *</label><input id="profSenha" type="password" required minlength="6" autocomplete="new-password"></div>
        <div class="field full"><label for="profConfirmar">Confirmar senha *</label><input id="profConfirmar" type="password" required minlength="6" autocomplete="new-password"></div>
        <div class="field full">${botoes({label:"Criar Professor e avançar"})}</div>
      </form>`;
  }

  function renderCategoria() {
    const existente = categoriaExistente();
    if (existente) return `
      ${stageHead(4,"Categoria de atividades","A categoria organiza as modalidades da academia.",true)}
      <div class="info-card"><div class="info-cell"><span>Categoria inicial</span><strong>${escapar(existente.nome || existente.categoria)}</strong></div></div>
      ${botoes({label:"Continuar para Modalidade",form:false})}
    `;
    return `
      ${stageHead(4,"Defina a primeira Categoria","Use uma classificação simples. Exemplos: Força e condicionamento, Aquática, Dança, Lutas.")}
      <form id="formEtapa" class="form-grid">
        <div class="field full"><label for="catNome">Nome da categoria *</label><input id="catNome" required minlength="2" placeholder="Ex.: Força e condicionamento"></div>
        <div class="field full"><div class="note">A categoria ficará disponível nos próximos cadastros de modalidade.</div></div>
        <div class="field full">${botoes({label:"Salvar Categoria e avançar"})}</div>
      </form>`;
  }

  function renderModalidade() {
    const existente = modalidadeExistente();
    if (existente) return `
      ${stageHead(5,"Modalidade","A atividade principal já está cadastrada.",true)}
      <div class="info-card"><div class="info-grid">
        <div class="info-cell"><span>Modalidade</span><strong>${escapar(existente.nome)}</strong></div>
        <div class="info-cell"><span>Categoria</span><strong>${escapar(existente.categoria)}</strong></div>
        <div class="info-cell"><span>Professor</span><strong>${escapar(existente.professorResponsavel || "-")}</strong></div>
        <div class="info-cell"><span>Capacidade sugerida</span><strong>${escapar(existente.capacidadeMaxima || "-")}</strong></div>
      </div></div>
      ${botoes({label:"Continuar para Plano",form:false})}
    `;

    const cats = dados.categorias.map(c => `<option value="${escapar(c.nome)}">${escapar(c.nome)}</option>`).join("");
    const profs = dados.professores.map(p => `<option value="${escapar(p.nome)}">${escapar(p.nome)}</option>`).join("");
    return `
      ${stageHead(5,"Cadastre a primeira Modalidade","A modalidade será usada no plano e na turma. Por isso ela vem antes desses dois cadastros.")}
      <form id="formEtapa" class="form-grid">
        <div class="field"><label for="modNome">Nome da modalidade *</label><input id="modNome" required value="Musculação"></div>
        <div class="field"><label for="modCategoria">Categoria *</label><select id="modCategoria" required>${cats}</select></div>
        <div class="field"><label for="modProfessor">Professor responsável</label><select id="modProfessor"><option value="">Sem responsável por enquanto</option>${profs}</select></div>
        <div class="field"><label for="modDuracao">Duração sugerida (min)</label><input id="modDuracao" type="number" min="1" value="60"></div>
        <div class="field"><label for="modCapacidade">Capacidade sugerida</label><input id="modCapacidade" type="number" min="1" value="30"></div>
        <div class="field full"><div class="note"><strong>Preço não é definido na Modalidade.</strong> Valores, mensalidades e cobranças serão configurados exclusivamente na etapa Plano.</div></div>
        <div class="field full">${botoes({label:"Criar Modalidade e avançar"})}</div>
      </form>`;
  }

  function renderPlano() {
    const existente = planoExistente();
    if (existente) return `
      ${stageHead(6,"Plano comercial","Já existe um plano para iniciar as matrículas.",true)}
      <div class="info-card"><div class="info-grid">
        <div class="info-cell"><span>Plano</span><strong>${escapar(existente.nome)}</strong></div>
        <div class="info-cell"><span>Mensalidade</span><strong>${moeda(existente.valorMensal)}</strong></div>
        <div class="info-cell"><span>Tipo</span><strong>${escapar(existente.tipoPlano || existente.tipo || "Mensal")}</strong></div>
        <div class="info-cell"><span>Status</span><strong>${escapar(existente.status || "Ativo")}</strong></div>
      </div></div>
      ${botoes({label:"Continuar para Turma",form:false})}
    `;

    const mods = dados.modalidades.map(m => `<option value="${escapar(m.nome)}">${escapar(m.nome)}</option>`).join("");
    return `
      ${stageHead(6,"Crie o primeiro Plano","Defina o preço básico que será usado quando o primeiro aluno for matriculado.")}
      <form id="formEtapa" class="form-grid">
        <div class="field"><label for="planoNome">Nome do plano *</label><input id="planoNome" required value="Plano Mensal"></div>
        <div class="field"><label for="planoTipo">Tipo</label><select id="planoTipo"><option>Mensal</option><option>Semestral</option><option>Anual</option><option>Pré-pago</option><option>Diarista</option></select></div>
        <div class="field"><label for="planoValor">Valor mensal *</label><input id="planoValor" type="number" min="0.01" step="0.01" required placeholder="Ex.: 99.90"></div>
        <div class="field"><label for="planoMatricula">Taxa de matrícula</label><input id="planoMatricula" type="number" min="0" step="0.01" value="0"></div>
        <div class="field"><label for="planoModalidade">Modalidade incluída *</label><select id="planoModalidade" required>${mods}</select></div>
        <div class="field"><label for="planoLimite">Limite semanal</label><input id="planoLimite" type="number" min="0" value="0"><small>0 = sem limite semanal.</small></div>
        <div class="field full">${botoes({label:"Criar Plano e avançar"})}</div>
      </form>`;
  }

  function renderTurma() {
    const existente = turmaExistente();
    if (existente) return `
      ${stageHead(7,"Turma inicial","Horário e capacidade já estão preparados para receber matrículas.",true)}
      <div class="info-card"><div class="info-grid">
        <div class="info-cell"><span>Turma</span><strong>${escapar(existente.nome)}</strong></div>
        <div class="info-cell"><span>Modalidade</span><strong>${escapar(existente.modalidade)}</strong></div>
        <div class="info-cell"><span>Professor</span><strong>${escapar(existente.professor)}</strong></div>
        <div class="info-cell"><span>Horário</span><strong>${escapar(existente.diasSemana)} · ${escapar(existente.horario)}</strong></div>
      </div></div>
      ${botoes({label:"Continuar para Marca",form:false})}
    `;

    const mod0 = dados.modalidades[0] || {};
    const prof0 = dados.professores[0] || {};
    const mods = dados.modalidades.map(m => `<option value="${escapar(m.nome)}">${escapar(m.nome)}</option>`).join("");
    const profs = dados.professores.map(p => `<option value="${escapar(p.nome)}">${escapar(p.nome)}</option>`).join("");
    return `
      ${stageHead(7,"Crie a primeira Turma","Agora ligamos modalidade + professor + horário. Isso deixa a operação pronta para a matrícula.")}
      <form id="formEtapa" class="form-grid">
        <div class="field"><label for="turmaNome">Nome da turma *</label><input id="turmaNome" required value="Turma ${escapar(mod0.nome || "Principal")}"></div>
        <div class="field"><label for="turmaModalidade">Modalidade *</label><select id="turmaModalidade" required>${mods}</select></div>
        <div class="field"><label for="turmaProfessor">Professor *</label><select id="turmaProfessor" required>${profs}</select></div>
        <div class="field"><label for="turmaDias">Dias da semana *</label><input id="turmaDias" required value="Segunda a Sexta"></div>
        <div class="field"><label for="turmaHorario">Horário *</label><input id="turmaHorario" type="time" required value="06:00"></div>
        <div class="field"><label for="turmaCapacidade">Capacidade *</label><input id="turmaCapacidade" type="number" min="1" required value="30"></div>
        <div class="field"><label for="turmaSala">Sala/local</label><input id="turmaSala" placeholder="Ex.: Sala principal"></div>
        <div class="field full">${botoes({label:"Criar Turma e avançar"})}</div>
      </form>`;
  }

  function renderMarca() {
    const marca = dados.aparencia?.marca || {};
    const tema = dados.aparencia?.tema || {};
    const concluida = marcaConfigurada();
    return `
      ${stageHead(8,"Identidade da academia","A marca aparece no ambiente da academia. O logotipo é opcional neste momento.",concluida)}
      <form id="formEtapa" class="form-grid">
        <div class="field"><label for="marcaNome">Nome exibido *</label><input id="marcaNome" required value="${escapar(normalizar(marca.nome) === "fusion erp" ? academiaNome() : (marca.nome || academiaNome()))}"></div>
        <div class="field"><label for="marcaCor">Cor principal</label><input id="marcaCor" type="color" value="${escapar(tema.corPrimaria || "#0b6a72")}"></div>
        <div class="field full">
          <label for="marcaLogo">Logotipo</label>
          <input id="marcaLogo" type="file" accept="image/png,image/jpeg,image/webp">
          <small>PNG, JPG ou WebP. Até 5 MB. Se você ainda não tiver o arquivo, salve apenas o nome e continue.</small>
        </div>
        <div class="field full">
          <div class="logo-preview" id="logoPreview">${marca.logoUrl ? `<img src="${escapar(marca.logoUrl)}" alt="Logotipo atual">` : "Sem logo"}</div>
        </div>
        <div class="field full">${botoes({label:concluida ? "Salvar alterações e conhecer minha página" : "Salvar Marca e conhecer minha página"})}</div>
      </form>`;
  }

  function renderPaginaPublica() {
    const nome = dados.aparencia?.marca?.nome || academiaNome();
    const url = urlPublica();
    return `
      ${stageHead(9,"Conheça a página pública da sua academia","Este é o endereço que você poderá divulgar para alunos, interessados e equipe. A página já leva o nome da sua academia e reúne matrícula e aplicativos.")}
      <div class="delivery-hero">
        <span class="eyebrow">Seu endereço oficial</span>
        <h3>${escapar(nome)}</h3>
        <div class="url-box"><code>${escapar(url)}</code><button class="btn btn-secondary" type="button" id="btnCopiarPagina">Copiar link</button></div>
      </div>
      <div class="delivery-grid">
        <article class="delivery-card"><strong>Página da academia</strong><p>Abra a página exatamente como seus clientes verão.</p><button class="btn btn-secondary" id="btnAbrirPagina" type="button">Abrir página pública</button></article>
        <article class="delivery-card"><strong>Matrícula online</strong><p>Link direto para quem deseja iniciar uma matrícula.</p><button class="btn btn-secondary" id="btnAbrirMatricula" type="button">Abrir matrícula</button></article>
      </div>
      <div class="note">A página SaaS do Fusion fica para apresentação e criação de novas academias. Depois desta implantação, sua rotina passa a acontecer dentro do endereço da sua própria academia.</div>
      <div class="actions"><button class="btn btn-secondary" type="button" data-voltar>Voltar</button><div class="actions-right"><button class="btn btn-primary" id="btnConfirmarPagina" type="button">Minha página está pronta — continuar</button></div></div>
    `;
  }

  function renderAplicativos() {
    const apps = [
      ["Administração","Gestão completa da academia","administracao"],
      ["Recepção","Atendimento, matrículas e caixa","recepcao"],
      ["Professor","Treinos e avaliações","professor"],
      ["Aluno","Treino, avaliação, frequência e financeiro","aluno"]
    ];

    return `
      ${stageHead(10,"Instale e compartilhe os aplicativos","Agora você já pode deixar Administração e Recepção instalados nos aparelhos de trabalho e enviar Professor e Aluno para a equipe e clientes.")}
      <div class="app-delivery-grid">
        ${apps.map(([nome,desc,perfil]) => `
          <article class="app-delivery-card">
            <span class="app-mini-icon">${nome[0]}</span>
            <div><strong>Fusion ${nome}</strong><p>${desc}</p></div>
            <a class="btn btn-secondary" href="${urlApps(perfil)}" target="_blank" rel="noopener">Instalar / abrir</a>
          </article>`).join("")}
      </div>
      <div class="note"><strong>Nos aparelhos da Administração e Recepção:</strong> o código da academia é usado apenas para o primeiro vínculo. Depois, o aparelho reconhece a academia e o login diário pede somente usuário e senha.</div>
      <div class="actions"><button class="btn btn-secondary" type="button" data-voltar>Voltar</button><div class="actions-right"><a class="btn btn-secondary" href="${urlApps()}" target="_blank" rel="noopener">Abrir central de aplicativos</a><button class="btn btn-primary" id="btnConfirmarApps" type="button">Aplicativos preparados — continuar</button></div></div>
    `;
  }

  function renderFinal() {
    const resumo = [
      ["Administrador", usuarioAdmin().nome || "Administrador"],
      ["Recepção", recepcaoExistente()?.nome || "-"],
      ["Professor", professorExistente()?.nome || "-"],
      ["Categoria", categoriaExistente()?.nome || categoriaExistente()?.categoria || "-"],
      ["Modalidade", modalidadeExistente()?.nome || "-"],
      ["Plano", planoExistente()?.nome || "-"],
      ["Turma", turmaExistente()?.nome || "-"],
      ["Marca", dados.aparencia?.marca?.nome || academiaNome()],
      ["Página pública", urlPublica()],
      ["Aplicativos", "Administração, Recepção, Professor e Aluno"]
    ];
    return `
      <div class="final-hero">
        <div class="final-icon">✓</div>
        <span class="eyebrow">Implantação concluída</span>
        <h2>${escapar(dados.aparencia?.marca?.nome || academiaNome())} está pronta</h2>
        <p>Você configurou a operação mínima, recebeu sua página pública e já sabe onde instalar os aplicativos. A partir de agora, o sistema é acessado pelo endereço da sua academia.</p>
      </div>
      <div class="system-address-card">
        <span>Seu sistema</span>
        <strong>${escapar(location.origin + urlApp("dashboard"))}</strong>
        <small>Tecnologia Fusion Sistema</small>
      </div>
      <div class="summary-list">
        ${resumo.map(([a,b]) => `<div class="summary-item"><span class="summary-check">✓</span><div><strong>${escapar(a)}</strong><small>${escapar(b)}</small></div></div>`).join("")}
      </div>
      <div class="final-actions">
        <button class="btn btn-primary" type="button" id="btnDashboard">Entrar no meu sistema</button>
        <button class="btn btn-secondary" type="button" id="btnPrimeiroAluno">Cadastrar primeiro aluno</button>
        <button class="btn btn-secondary" type="button" id="btnMinhaPagina">Abrir minha página</button>
      </div>`;
  }

  function renderEtapa() {
    const host = $("etapaConteudo");
    const renderers = [
      renderAdmin, renderRecepcao, renderProfessor, renderCategoria,
      renderModalidade, renderPlano, renderTurma, renderMarca,
      renderPaginaPublica, renderAplicativos, renderFinal
    ];
    const indice = Math.min(etapaAtual, renderers.length - 1);
    host.innerHTML = renderers[indice]();
    conectarEventosEtapa();
  }

  function voltar() {
    etapaAtual = Math.max(0, etapaAtual - 1);
    alerta("");
    renderTudo();
  }
  function avancar() {
    const primeira = primeiraPendente();
    if (primeira >= ETAPAS.length) etapaAtual = ETAPAS.length;
    else etapaAtual = Math.min(ETAPAS.length, Math.max(etapaAtual + 1, primeira));
    alerta("");
    renderTudo();
  }

  function setBusy(form, busy) {
    form?.querySelectorAll("button,input,select,textarea").forEach(el => el.disabled = busy);
  }

  function lerArquivo(file) {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Não foi possível ler o logotipo."));
      reader.readAsDataURL(file);
    });
  }

  async function salvarEtapa(form) {
    if (!form.reportValidity()) return;
    setBusy(form, true);
    alerta("Salvando esta etapa...", "info");
    try {
      if (etapaAtual === 1) {
        const senha = $("recSenha").value;
        if (senha !== $("recConfirmar").value) throw new Error("As senhas da recepção não conferem.");
        await request(API.usuarios, {
          method:"POST",
          body:JSON.stringify({
            nome:$("recNome").value.trim(),
            email:$("recEmail").value.trim(),
            senha,
            perfil:"Recepcao",
            status:"ativo"
          })
        });
      }

      if (etapaAtual === 2) {
        const senha = $("profSenha").value;
        if (senha !== $("profConfirmar").value) throw new Error("As senhas do professor não conferem.");
        await request(API.professores, {
          method:"POST",
          body:JSON.stringify({
            nome:$("profNome").value.trim(),
            email:$("profEmail").value.trim(),
            cpf:$("profCpf").value.trim(),
            cref:$("profCref").value.trim(),
            telefone:$("profTelefone").value.trim(),
            whatsapp:$("profTelefone").value.trim(),
            senha,
            senhaAcesso:senha,
            senhaPortal:senha,
            perfil:"professor",
            status:"Ativo"
          })
        });
      }

      if (etapaAtual === 3) {
        await request(API.categorias, {
          method:"POST",
          body:JSON.stringify({ nome:$("catNome").value.trim() })
        });
      }

      if (etapaAtual === 4) {
        await request(API.modalidades, {
          method:"POST",
          body:JSON.stringify({
            nome:$("modNome").value.trim(),
            categoria:$("modCategoria").value,
            professorResponsavel:$("modProfessor").value,
            duracaoMinutos:Number($("modDuracao").value || 60),
            capacidadeMaxima:Number($("modCapacidade").value || 20),
            status:"Ativa"
          })
        });
      }

      if (etapaAtual === 5) {
        const valor = Number($("planoValor").value || 0);
        if (!(valor > 0)) throw new Error("Informe um valor maior que zero para o plano.");
        await request(API.planos, {
          method:"POST",
          body:JSON.stringify({
            nome:$("planoNome").value.trim(),
            tipoPlano:$("planoTipo").value,
            valorMensal:valor,
            valorMatricula:Number($("planoMatricula").value || 0),
            taxaMatricula:Number($("planoMatricula").value || 0),
            modalidadesIncluidas:[$("planoModalidade").value],
            limiteSemanal:Number($("planoLimite").value || 0),
            horariosPermitidos:"Livre",
            status:"Ativo"
          })
        });
      }

      if (etapaAtual === 6) {
        await request(API.turmas, {
          method:"POST",
          body:JSON.stringify({
            nome:$("turmaNome").value.trim(),
            modalidade:$("turmaModalidade").value,
            professor:$("turmaProfessor").value,
            diasSemana:$("turmaDias").value.trim(),
            horario:$("turmaHorario").value,
            capacidade:Number($("turmaCapacidade").value || 0),
            sala:$("turmaSala").value.trim(),
            status:"Ativa"
          })
        });
      }

      if (etapaAtual === 7) {
        let logoUrl = texto(dados.aparencia?.marca?.logoUrl);
        const file = $("marcaLogo").files?.[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) throw new Error("O logotipo deve ter no máximo 5 MB.");
          const dataUrl = await lerArquivo(file);
          const img = await request(`${API.aparencia}/imagem`, {
            method:"POST",
            body:JSON.stringify({ dataUrl, tipo:"logo" })
          });
          logoUrl = img.url || logoUrl;
        }

        const atual = dados.aparencia || {};
        await request(API.aparencia, {
          method:"PUT",
          body:JSON.stringify({
            ...atual,
            tema:{ ...(atual.tema || {}), corPrimaria:$("marcaCor").value },
            marca:{
              ...(atual.marca || {}),
              nome:$("marcaNome").value.trim(),
              subtitulo:atual.marca?.subtitulo || "Gestão para academias",
              logoUrl
            }
          })
        });
      }

      await carregarDados();
      alerta("Etapa salva com sucesso.", "ok");
      const proxima = primeiraPendente();
      etapaAtual = proxima >= ETAPAS.length ? ETAPAS.length : proxima;
      renderTudo();
    } catch (error) {
      alerta(error.message || "Não foi possível salvar esta etapa.", "error");
    } finally {
      setBusy(form, false);
    }
  }

  function conectarEventosEtapa() {
    document.querySelectorAll("[data-voltar]").forEach(btn => btn.addEventListener("click", voltar));
    document.querySelectorAll("[data-avancar]").forEach(btn => btn.addEventListener("click", avancar));

    const form = $("formEtapa");
    form?.addEventListener("submit", event => {
      event.preventDefault();
      salvarEtapa(form);
    });

    const logo = $("marcaLogo");
    logo?.addEventListener("change", () => {
      const file = logo.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      $("logoPreview").innerHTML = `<img src="${url}" alt="Prévia do logotipo selecionado">`;
    });

    $("btnCopiarPagina")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(urlPublica());
        alerta("Link da página copiado.", "ok");
      } catch {
        alerta(urlPublica(), "info");
      }
    });

    $("btnAbrirPagina")?.addEventListener("click", () => window.open(urlPublica(), "_blank", "noopener"));
    $("btnAbrirMatricula")?.addEventListener("click", () => window.open(`/${encodeURIComponent(slugAcademia())}/matricula`, "_blank", "noopener"));

    $("btnConfirmarPagina")?.addEventListener("click", () => {
      salvarEntrega({ paginaPublica:true });
      etapaAtual = 9;
      alerta("");
      renderTudo();
    });

    $("btnConfirmarApps")?.addEventListener("click", () => {
      salvarEntrega({ aplicativos:true });
      etapaAtual = 10;
      alerta("");
      renderTudo();
    });

    async function finalizarOnboarding(destino) {
      alerta("Finalizando a implantação com segurança...", "info");
      try {
        await concluirImplantacaoNoServidor();
        salvarEntrega({ paginaPublica:true, aplicativos:true, finalizado:true });
        atualizarProgresso();
        location.href = destino;
      } catch (error) {
        alerta(
          error.message || "Não foi possível concluir a implantação. Nenhum dado será apagado; tente novamente.",
          "error"
        );
      }
    }

    $("btnPrimeiroAluno")?.addEventListener("click", () => finalizarOnboarding(urlApp("alunos")));
    $("btnDashboard")?.addEventListener("click", () => finalizarOnboarding(urlApp("dashboard")));
    $("btnMinhaPagina")?.addEventListener("click", () => {
      window.open(urlPublica(), "_blank", "noopener");
    });
  }

  async function concluirImplantacaoNoServidor() {
    return request(API.onboardingConcluir, {
      method:"POST",
      body:JSON.stringify({})
    });
  }

  function limparDadosLocaisDaAcademia() {
    const chavesLocal = [
      "fusionToken","fusionUsuario","usuarioLogado","usuarioNome","usuarioEmail",
      "usuarioPerfil","fusionTenantId","fusionAcademiaSlug","fusionAcademiaNome",
      "fusionTenantDeviceBinding",chaveEntrega()
    ];
    chavesLocal.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });

    [
      "fusionTenantSelectionToken","fusionAcademiaSelecionadaNome","fusionAcademiaSlug"
    ].forEach(k => {
      try { sessionStorage.removeItem(k); } catch {}
    });
  }

  async function cancelarImplantacaoERecomecar() {
    const nome = academiaNome();
    const primeira = confirm(
      `Cancelar a implantação de "${nome}"?\n\nIsso apagará esta academia provisória e todos os cadastros feitos nela. Esta ação não pode ser desfeita.`
    );
    if (!primeira) return;

    const segunda = confirm(
      `Confirma a exclusão total da implantação provisória de "${nome}"?\n\nUse esta opção somente se desejar recomeçar o cadastro do zero.`
    );
    if (!segunda) return;

    alerta("Cancelando a implantação e removendo os dados provisórios...", "info");
    const btn = $("btnCancelarImplantacao");
    if (btn) btn.disabled = true;

    try {
      await request(API.onboardingCancelar, {
        method:"DELETE",
        body:JSON.stringify({ confirmacao:"CANCELAR IMPLANTACAO" })
      });

      limparDadosLocaisDaAcademia();
      location.replace("/pages/comecar/?acao=criar&implantacao=cancelada");
    } catch (error) {
      alerta(error.message || "Não foi possível cancelar a implantação.", "error");
      if (btn) btn.disabled = false;
    }
  }

  function renderTudo() {
    atualizarProgresso();
    renderListaEtapas();
    renderEtapa();
  }

  async function init() {
    $("academiaNomeTopo").textContent = academiaNome();
    try {
      await carregarDados();
      const pendente = primeiraPendente();
      etapaAtual = pendente >= ETAPAS.length ? ETAPAS.length - 1 : pendente;
      $("carregando").classList.add("hidden");
      $("etapaConteudo").classList.remove("hidden");
      renderTudo();
    } catch (error) {
      $("carregando").classList.add("hidden");
      $("etapaConteudo").classList.remove("hidden");
      $("etapaConteudo").innerHTML = `
        <div class="final-hero">
          <div class="final-icon" style="background:#fff0f0;color:#9b2f38">!</div>
          <h2>Não foi possível carregar a configuração</h2>
          <p>${escapar(error.message || "Atualize a página e tente novamente.")}</p>
          <div class="fatal-actions">
            <button class="btn btn-primary" id="btnRecarregar" type="button">Tentar novamente</button>
            <button class="btn btn-danger-outline" id="btnCancelarFatal" type="button">Apagar implantação e recomeçar</button>
          </div>
          <p style="margin-top:14px;font-size:12px">Se o problema for apenas navegador ou internet, tente novamente primeiro. Use “apagar” somente se quiser reiniciar toda a implantação.</p>
        </div>`;
      $("btnRecarregar")?.addEventListener("click", () => location.reload());
      $("btnCancelarFatal")?.addEventListener("click", cancelarImplantacaoERecomecar);
    }
  }

  $("btnCancelarImplantacao")?.addEventListener("click", cancelarImplantacaoERecomecar);
  $("btnSair").addEventListener("click", () => FusionAuth.sair());
  init();
})();
