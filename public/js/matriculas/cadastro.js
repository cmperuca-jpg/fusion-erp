(function(){
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const idUrl = params.get("id");
  const alunoIdUrl = params.get("alunoId") || params.get("aluno_id");

  let alunos = [];
  let planos = [];
  let turmas = [];
  let modalidades = [];
  let matriculaAtual = null;
  let modoSomenteTurma = false;
  let ultimoPlanoTaxaSincronizada = "";

  function lista(payload) {
    if (Array.isArray(payload)) return payload;
    return payload?.dados || payload?.alunos || payload?.planos || payload?.turmas || [];
  }

  function esc(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c]));
  }

  function attr(valor) { return esc(valor).replace(/`/g, "&#096;"); }
  function dinheiro(valor) {
    const numero = Number(String(valor ?? 0).replace(",", "."));
    return Number.isFinite(numero) ? numero : 0;
  }
  function diaVencimentoValido(valor) {
    const texto = String(valor ?? "").trim();
    if (!/^\d{1,2}$/.test(texto)) return null;
    const dia = Number(texto);
    return Number.isInteger(dia) && dia >= 1 && dia <= 28 ? dia : null;
  }
  function br(valor) { return dinheiro(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function hoje() { return new Date().toISOString().slice(0, 10); }
  function addMes(data) {
    const d = new Date(`${data || hoje()}T12:00:00`);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }
  function norm(valor) {
    return String(valor || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function tipoPlano(plano) {
    const tipo = norm(plano?.tipoPlano || plano?.tipo || "Mensal");
    if (tipo.includes("pre")) return "Pre-pago";
    if (tipo.includes("diar")) return "Diarista";
    if (tipo.includes("semes")) return "Semestral";
    if (tipo.includes("anual")) return "Anual";
    return "Mensal";
  }
  function valorPlano(plano) { return dinheiro(plano?.valorMensal ?? plano?.valor ?? plano?.mensalidade ?? 0); }
  function valorMatriculaPlano(plano) { return dinheiro(plano?.valorMatricula ?? plano?.valorBaseMatricula ?? plano?.taxaMatricula ?? 0); }
  function alunoNome(aluno) { return aluno.nome || aluno.name || aluno.nomeCompleto || aluno.aluno || ""; }
  function setAlerta(msg, tipo = "") {
    const el = $("alertaMatricula");
    if (!el) return;
    el.className = `alerta-matricula ${tipo}`;
    el.textContent = msg || "";
  }
  function tab(nome) {
    document.querySelectorAll(".tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === nome));
    document.querySelectorAll(".tab-content").forEach((el) => el.classList.toggle("active", el.id === `tab-${nome}`));
  }
  function planoSelecionado() { return planos.find((p) => String(p.id) === String($("plano_id")?.value)) || null; }
  function turmaSelecionadaId() { return $("turma_id")?.value || ""; }
  function turmaValor(turma) {
    return turma?.id ?? turma?.turmaId ?? turma?.turma_id ?? turma?.codigo ?? turma?.nome ?? "";
  }
  function turmaNome(turma) {
    return turma?.nome || turma?.turma || turma?.descricao || turma?.modalidade || "";
  }
  function modalidadeValor(modalidade) {
    return modalidade?.nome || modalidade?.modalidade || modalidade?.descricao || modalidade?.id || "";
  }
  function modalidadeSelecionadaNome() {
    const select = $("modalidade");
    return select?.value || select?.selectedOptions?.[0]?.dataset?.nome || "";
  }
  function listaTexto(valor) {
    if (Array.isArray(valor)) return valor.map((item) => String(item || "").trim()).filter(Boolean);
    return String(valor || "").split(",").map((item) => item.trim()).filter(Boolean);
  }
  function modalidadesDoPlano(plano = planoSelecionado()) {
    return [...new Set(listaTexto(plano?.modalidadesIncluidas ?? plano?.modalidades))];
  }
  function renderizarSelectModalidades(selecionada = "") {
    const select = $("modalidade");
    if (!select) return;
    const modalidadesPlano = modalidadesDoPlano();
    const base = modalidadesPlano.length ? modalidadesPlano.map((nome) => ({ nome })) : modalidades;
    const atual = selecionada || select.value || "";
    const opcoes = new Map();

    base.forEach((item) => {
      const nome = modalidadeValor(item);
      if (nome && !opcoes.has(norm(nome))) opcoes.set(norm(nome), nome);
    });
    if (atual && !opcoes.has(norm(atual))) opcoes.set(norm(atual), atual);

    const itens = [...opcoes.values()];
    select.innerHTML = `<option value="">Selecione a modalidade</option>` + itens
      .map((nome) => `<option value="${attr(nome)}">${esc(nome)}</option>`)
      .join("");

    if (atual && itens.some((nome) => norm(nome) === norm(atual))) select.value = itens.find((nome) => norm(nome) === norm(atual)) || "";
    else if (itens.length === 1) select.value = itens[0];
    else select.value = "";
  }
  function garantirOpcaoModalidade(nome) {
    const select = $("modalidade");
    const valor = String(nome || "").trim();
    if (!select || !valor) return;
    const existe = Array.from(select.options).some((opcao) => String(opcao.value) === valor);
    if (!existe) {
      const opcao = document.createElement("option");
      opcao.value = valor;
      opcao.dataset.nome = valor;
      opcao.textContent = valor;
      select.appendChild(opcao);
    }
  }
  function sincronizarModalidadeDaTurma() {
    const turma = turmaSelecionada();
    const modalidade = turma?.modalidade || turma?.modalidadeNome || turma?.servico || "";
    if (!modalidade) return;
    garantirOpcaoModalidade(modalidade);
    const select = $("modalidade");
    if (select) select.value = modalidade;
  }
  function turmaSelecionada() {
    const valor = turmaSelecionadaId();
    return turmas.find((t) => String(turmaValor(t)) === String(valor)) || null;
  }
  function turmaPayload() {
    const turmaId = turmaSelecionadaId();
    const turma = turmaSelecionada();
    const nome = turmaNome(turma);
    return {
      turmaIds: turmaId ? [turmaId] : [],
      turmaNome: nome,
      turmaNomes: nome ? [nome] : [],
      modalidade: modalidadeSelecionadaNome(),
      modalidadeNome: modalidadeSelecionadaNome()
    };
  }
  function statusMatriculaEditavel(status) {
    return ["ativa", "pendente", "trancada"].includes(norm(status));
  }
  function setSalvando(ativo) {
    const btn = $("btnSalvar");
    if (!btn) return;
    btn.disabled = Boolean(ativo);
    btn.textContent = ativo ? "Salvando..." : (matriculaAtual ? "Salvar matrícula" : "Salvar matrícula");
  }

  function preencherSelect(id, dados, label, getValue, getText) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = `<option value="">${label}</option>` + dados
      .map((item) => `<option value="${attr(getValue(item))}">${esc(getText(item))}</option>`)
      .join("");
  }

  async function carregarBase() {
    const [alunosResp, planosResp, turmasResp, modalidadesResp] = await Promise.all([
      fetch("/api/alunos", { cache: "no-store" }).then((r) => r.json()).catch(() => []),
      fetch("/api/planos", { cache: "no-store" }).then((r) => r.json()).catch(() => []),
      fetch("/api/turmas", { cache: "no-store" }).then((r) => r.json()).catch(() => []),
      fetch("/api/modalidades", { cache: "no-store" }).then((r) => r.json()).catch(() => [])
    ]);

    alunos = lista(alunosResp);
    planos = lista(planosResp).filter((p) => !["inativo", "inativa", "cancelado"].includes(norm(p.status || "Ativo")));
    turmas = lista(turmasResp).filter((t) => !["inativa", "inativo", "cancelada", "cancelado"].includes(norm(t.status || "Ativa")));
    modalidades = lista(modalidadesResp).filter((m) => !["inativa", "inativo", "cancelada", "cancelado"].includes(norm(m.status || "Ativa")));
    const modalidadesDasTurmas = turmas
      .map((t) => t.modalidade || t.modalidadeNome || t.servico || "")
      .filter(Boolean)
      .map((nome) => ({ nome }));
    const modalidadesUnicas = new Map();
    [...modalidades, ...modalidadesDasTurmas].forEach((m) => {
      const valor = modalidadeValor(m);
      if (valor && !modalidadesUnicas.has(norm(valor))) modalidadesUnicas.set(norm(valor), { ...m, nome: valor });
    });
    modalidades = [...modalidadesUnicas.values()];

    preencherSelect("aluno_id", alunos, "Selecione o aluno", (a) => a.id, alunoNome);
    preencherSelect("plano_id", planos, "Selecione o plano", (p) => p.id, (p) => `${p.nome || p.id} - ${br(valorPlano(p))}`);
    renderizarSelectModalidades();
    preencherSelect("turma_id", turmas, "Sem turma vinculada", turmaValor, (t) => {
      const partes = [t.nome, t.modalidade, t.professor, t.horario].filter(Boolean);
      return partes.join(" - ");
    });
  }

  function recalcular() {
    const plano = planoSelecionado();
    const cobrarTaxa = $("cobrar_taxa_matricula")?.value !== "false";
    const taxaInput = $("taxa_matricula");
    const planoIdAtual = String(plano?.id || "");

    const taxaConfiguradaPlano = valorMatriculaPlano(plano);
    const taxaDigitada = dinheiro(taxaInput?.value);
    const deveSincronizarTaxa = Boolean(
      plano &&
      taxaInput &&
      cobrarTaxa &&
      (
        ultimoPlanoTaxaSincronizada !== planoIdAtual ||
        taxaInput.dataset.manual !== "true" ||
        taxaDigitada <= 0
      )
    );

    if (deveSincronizarTaxa) {
      taxaInput.value = taxaConfiguradaPlano.toFixed(2);
      taxaInput.dataset.manual = "";
    }
    ultimoPlanoTaxaSincronizada = planoIdAtual;

    const mensalidade = valorPlano(plano);
    const taxa = cobrarTaxa ? dinheiro(taxaInput?.value || taxaConfiguradaPlano) : 0;
    const desconto = dinheiro($("desconto_matricula")?.value);
    const total = Math.max(0, mensalidade + taxa - desconto);

    if ($("valor")) $("valor").value = mensalidade.toFixed(2);
    if ($("valor_total_inicial")) $("valor_total_inicial").value = total.toFixed(2);
    if (taxaInput) taxaInput.disabled = !cobrarTaxa;

    if ($("resumoPlano")) {
      $("resumoPlano").innerHTML = plano
        ? `<b>${esc(plano.nome || "")}</b><br>Mensalidade do plano: ${br(mensalidade)}<br>Taxa de matricula: ${br(taxa)}<br>Desconto: ${br(desconto)}<br><b>Total inicial: ${br(total)}</b><br><small>Turma nao entra no financeiro. Ela serve somente para agenda, presenca e organizacao operacional.</small>`
        : "Selecione um plano para calcular a matricula.";
    }
  }

  async function buscarMatriculasAluno(alunoId) {
    if (!alunoId) return [];
    const res = await fetch(`/api/matriculas?alunoId=${encodeURIComponent(alunoId)}`, { cache: "no-store" });
    return lista(await res.json().catch(() => ({})));
  }

  async function carregarMatricula(id) {
    const res = await fetch(`/api/matriculas/${encodeURIComponent(id)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json.erro || "Matricula nao encontrada.");
    return json.dados || json.matricula || json;
  }

  function preencherFormulario(m) {
    matriculaAtual = m;
    modoSomenteTurma = false;
    const btn = $("btnSalvar");
    if (btn) btn.textContent = "Salvar matricula";
    $("matriculaId").value = m.id || "";
    $("aluno_id").value = m.alunoId || m.aluno_id || m.idAluno || "";
    $("status").value = m.status || "Ativa";
    $("data_matricula").value = String(m.dataMatricula || m.data_matricula || hoje()).slice(0, 10);
    $("data_inicio").value = String(m.dataInicio || m.data_inicio || m.dataMatricula || hoje()).slice(0, 10);
    $("data_fim").value = String(m.dataFim || m.data_fim || "").slice(0, 10);
    $("plano_id").value = m.planoId || m.plano_id || "";
    $("turma_id").value = Array.isArray(m.turmaIds) ? (m.turmaIds[0] || "") : (m.turmaId || m.turma_id || "");
    renderizarSelectModalidades(m.modalidade || turmaSelecionada()?.modalidade || "");
    $("taxa_matricula").value = dinheiro(m.valorMatricula ?? m.taxaMatricula).toFixed(2);
    $("taxa_matricula").dataset.manual = dinheiro(m.valorMatricula ?? m.taxaMatricula) > 0 ? "true" : "";
    $("desconto_matricula").value = dinheiro(m.descontoMatricula).toFixed(2);
    $("forma_pagamento").value = m.formaPagamento || "Dinheiro";
    $("vencimento").value = String(m.vencimentoInicial || addMes(hoje())).slice(0, 10);
    $("dia_vencimento").value = m.diaVencimento || "";
    $("observacoes").value = m.observacao || m.observacoes || "";
    mostrarExistente(m);
    recalcular();
  }

  function ativarModoSomenteTurma({ mostrarMensagem = true } = {}) {
    if (!matriculaAtual) return;
    modoSomenteTurma = true;
    const btn = $("btnSalvar");
    if (btn) btn.textContent = "Salvar turma";
    tab("dados");
    if (mostrarMensagem) {
      setAlerta("Escolha a turma e clique em Salvar turma. Este ajuste nao gera cobranca nem taxa.", "ok");
    }
  }

  function mostrarExistente(m) {
    const box = $("matriculaExistenteBox");
    if (!box) return;
    box.classList.add("ativo");
    box.innerHTML = `<strong>Aluno com matricula ativa.</strong><br>Matricula: ${esc(m.numero || m.id || "-")}<br>Plano: ${esc(m.plano || "-")}<br>Turma: ${esc(m.turma || "-")}<br>Mensalidade: ${br(m.valorMensalTotal ?? m.valorMensal)}<div class="acoes-existente"><button type="button" class="dark" id="btnAbrirExistente">Abrir matricula existente</button><button type="button" class="primary" id="btnAlterarTurmaTela">Alterar turma</button></div>`;
    $("btnAbrirExistente").onclick = () => location.href = `/pages/matriculas/ficha.html?id=${encodeURIComponent(m.id || m.numero)}`;
    $("btnAlterarTurmaTela").onclick = () => ativarModoSomenteTurma();
  }

  async function verificarAtiva() {
    const alunoId = $("aluno_id")?.value;
    if (!alunoId) return;
    const mats = await buscarMatriculasAluno(alunoId);
    const ativa = mats.find((m) => statusMatriculaEditavel(m.status));
    if (ativa) preencherFormulario(ativa);
  }

  async function salvarMatriculaExistenteSemFinanceiro({ atualizarVencimento = false, atualizarStatus = false } = {}) {
    const matriculaId = matriculaAtual?.id || matriculaAtual?.numero;
    if (!matriculaId) return setAlerta("Matricula ativa nao encontrada para atualizar a turma.", "erro");

    let diaVencimento = null;
    if (atualizarVencimento) {
      diaVencimento = diaVencimentoValido($("dia_vencimento")?.value);
      if (!diaVencimento) {
        tab("financeiro");
        $("dia_vencimento")?.focus();
        return setAlerta("Informe o dia de vencimento mensal com um numero inteiro de 1 a 28.", "erro");
      }
    }

    try {
      setSalvando(true);

      if (atualizarVencimento) {
        const resVencimento = await fetch(`/api/matriculas/${encodeURIComponent(matriculaId)}/vencimento`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ diaVencimento, usuario: "Administrador" })
        });
        const jsonVencimento = await resVencimento.json().catch(() => ({}));
        if (!resVencimento.ok || jsonVencimento.ok === false) {
          throw new Error(jsonVencimento.erro || jsonVencimento.mensagem || "Erro ao salvar o dia de vencimento.");
        }
      }

      const resTurma = await fetch(`/api/matriculas/${encodeURIComponent(matriculaId)}/turmas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...turmaPayload(), usuario: "Administrador" })
      });
      const jsonTurma = await resTurma.json().catch(() => ({}));
      if (!resTurma.ok || jsonTurma.ok === false) throw new Error(jsonTurma.erro || jsonTurma.mensagem || "Erro ao salvar turma.");

      if (atualizarStatus && matriculaAtual.status && norm(matriculaAtual.status) !== norm($("status").value)) {
        const resStatus = await fetch(`/api/matriculas/${encodeURIComponent(matriculaId)}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: $("status").value, diaVencimento, usuario: "Administrador" })
        });
        const jsonStatus = await resStatus.json().catch(() => ({}));
        if (!resStatus.ok || jsonStatus.ok === false) {
          throw new Error(jsonStatus.erro || jsonStatus.mensagem || "Erro ao atualizar o status da matricula.");
        }
      }

      setAlerta(jsonTurma.mensagem || "Turma/modalidade atualizada sem alterar o financeiro.", "ok");
      setTimeout(() => location.href = `/pages/matriculas/ficha.html?id=${encodeURIComponent(matriculaId)}`, 700);
    } catch (erro) {
      setAlerta(erro.message || "Erro ao salvar turma.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function salvar(ev) {
    ev.preventDefault();
    setAlerta("", "");

    const alunoId = $("aluno_id").value;
    const planoIdInformado = $("plano_id").value;
    const planoAtual = matriculaAtual?.planoId || matriculaAtual?.plano_id || "";
    const planoId = planoIdInformado || planoAtual;
    const mesmoPlanoDaMatricula = Boolean(matriculaAtual && (!planoIdInformado || String(planoAtual) === String(planoIdInformado)));

    if (!alunoId) {
      tab("dados");
      return setAlerta("Informe o aluno da matrícula.", "erro");
    }
    if (matriculaAtual && (modoSomenteTurma || mesmoPlanoDaMatricula)) {
      return salvarMatriculaExistenteSemFinanceiro({
        atualizarVencimento: !modoSomenteTurma,
        atualizarStatus: !modoSomenteTurma
      });
    }

    if (!planoId) {
      tab("financeiro");
      $("plano_id")?.focus();
      return setAlerta("Informe o plano antes de salvar a matrícula.", "erro");
    }

    const tipo = tipoPlano(planoSelecionado());
    const cobrarTaxa = $("cobrar_taxa_matricula")?.value !== "false";
    const planoSelecionadoAtual = planoSelecionado();
    const taxaConfigurada = valorMatriculaPlano(planoSelecionadoAtual);
    let taxaMatricula = dinheiro($("taxa_matricula")?.value);

    if (cobrarTaxa && taxaMatricula <= 0 && taxaConfigurada > 0) {
      taxaMatricula = taxaConfigurada;
      $("taxa_matricula").value = taxaConfigurada.toFixed(2);
      $("taxa_matricula").dataset.manual = "";
      recalcular();
    }

    if (cobrarTaxa && taxaMatricula <= 0) {
      tab("financeiro");
      $("taxa_matricula")?.focus();
      return setAlerta("A taxa de matrícula está habilitada, mas o plano não possui um valor válido. Configure a taxa no plano ou selecione Não para a cobrança.", "erro");
    }

    const diaVencimento = diaVencimentoValido($("dia_vencimento")?.value);
    if (!diaVencimento) {
      tab("financeiro");
      $("dia_vencimento")?.focus();
      return setAlerta("Informe o dia de vencimento mensal com um número inteiro de 1 a 28.", "erro");
    }

    if (matriculaAtual && String(planoAtual) !== String(planoId)) {
      const ok = confirm("Voce alterou o plano. Isso encerra a matricula atual e cria nova cobranca pelo novo plano. Continuar?");
      if (!ok) return;
    }

    const payload = {
      alunoId,
      planoId,
      novoPlanoId: planoId,
      ...turmaPayload(),
      tipoCobranca: tipo,
      tipoPlano: tipo,
      status: $("status").value,
      dataMatricula: $("data_matricula").value,
      dataInicio: $("data_inicio").value,
      dataFim: $("data_fim").value,
      vencimento: $("vencimento").value,
      diaVencimento,
      gerarMensalidade: !["Pre-pago", "Diarista"].includes(tipo),
      cobrarMatricula: cobrarTaxa,
      valorMatricula: cobrarTaxa ? taxaMatricula : 0,
      valorTaxaMatricula: cobrarTaxa ? taxaMatricula : 0,
      taxaMatricula: cobrarTaxa ? taxaMatricula : 0,
      valorMensal: dinheiro($("valor").value),
      valorPlano: dinheiro($("valor").value),
      valorMensalPlano: dinheiro($("valor").value),
      valorTotalInicial: dinheiro($("valor_total_inicial").value),
      descontoMatricula: dinheiro($("desconto_matricula").value),
      formaPagamento: $("forma_pagamento").value,
      observacao: $("observacoes").value,
      usuario: "Administrador"
    };

    try {
      setSalvando(true);
      if (matriculaAtual && String(planoAtual) === String(planoId)) {
        const resVencimento = await fetch(`/api/matriculas/${encodeURIComponent(matriculaAtual.id)}/vencimento`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ diaVencimento, usuario: "Administrador" })
        });
        const jsonVencimento = await resVencimento.json().catch(() => ({}));
        if (!resVencimento.ok || jsonVencimento.ok === false) {
          throw new Error(jsonVencimento.erro || jsonVencimento.mensagem || "Erro ao salvar o dia de vencimento.");
        }

        const resTurma = await fetch(`/api/matriculas/${encodeURIComponent(matriculaAtual.id)}/turmas`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...turmaPayload(), usuario: "Administrador" })
        });
        const jsonTurma = await resTurma.json().catch(() => ({}));
        if (!resTurma.ok || jsonTurma.ok === false) throw new Error(jsonTurma.erro || jsonTurma.mensagem || "Erro ao salvar turma.");

        if (matriculaAtual.status && norm(matriculaAtual.status) !== norm(payload.status)) {
          const resStatus = await fetch(`/api/matriculas/${encodeURIComponent(matriculaAtual.id)}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: payload.status, diaVencimento, usuario: "Administrador" })
          });
          const jsonStatus = await resStatus.json().catch(() => ({}));
          if (!resStatus.ok || jsonStatus.ok === false) {
            throw new Error(jsonStatus.erro || jsonStatus.mensagem || "Erro ao atualizar o status da matrícula.");
          }
        }

        setAlerta(jsonTurma.mensagem || "Matrícula salva sem alterar o financeiro.", "ok");
        setTimeout(() => location.href = `/pages/matriculas/ficha.html?id=${encodeURIComponent(matriculaAtual.id)}`, 700);
        return;
      }

      const url = matriculaAtual ? "/api/matriculas/trocar-plano" : "/api/matriculas/integrar";
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.erro || json.mensagem || "Erro ao salvar matricula.");

      const mat = json.matricula || json.dados;
      setAlerta(json.mensagem || "Matricula salva com plano vinculado.", "ok");
      if (mat?.id) setTimeout(() => location.href = `/pages/matriculas/ficha.html?id=${encodeURIComponent(mat.id)}`, 700);
    } catch (erro) {
      setAlerta(erro.message || "Erro ao salvar matricula.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function iniciar() {
    $("formMatricula")?.setAttribute("novalidate", "novalidate");
    document.querySelectorAll(".tab").forEach((btn) => btn.addEventListener("click", () => tab(btn.dataset.tab)));
    await carregarBase();

    $("plano_id")?.addEventListener("change", () => {
      if (modoSomenteTurma) {
        modoSomenteTurma = false;
        const btn = $("btnSalvar");
        if (btn) btn.textContent = "Salvar matricula";
        setAlerta("Plano alterado: salvar agora passa a ser troca comercial com financeiro.", "erro");
      }
      renderizarSelectModalidades();
      recalcular();
    });
    $("turma_id")?.addEventListener("change", () => {
      sincronizarModalidadeDaTurma();
      if (matriculaAtual) ativarModoSomenteTurma({ mostrarMensagem: false });
    });
    $("modalidade")?.addEventListener("change", () => {
      if (matriculaAtual) ativarModoSomenteTurma({ mostrarMensagem: false });
    });
    $("cobrar_taxa_matricula")?.addEventListener("change", () => {
      if ($("cobrar_taxa_matricula").value !== "false") {
        $("taxa_matricula").dataset.manual = "";
        ultimoPlanoTaxaSincronizada = "";
      }
      recalcular();
    });
    $("taxa_matricula")?.addEventListener("input", () => {
      $("taxa_matricula").dataset.manual = "true";
      recalcular();
    });
    $("desconto_matricula")?.addEventListener("input", recalcular);
    $("aluno_id")?.addEventListener("change", verificarAtiva);
    $("formMatricula")?.addEventListener("submit", salvar);
    $("btnCancelar")?.addEventListener("click", () => location.href = "/pages/matriculas/");

    const data = hoje();
    $("data_matricula").value = data;
    $("data_inicio").value = data;
    $("vencimento").value = addMes(data);
    $("dia_vencimento").value = "";

    $("dia_vencimento")?.addEventListener("input", (event) => {
      event.target.value = String(event.target.value || "").replace(/\D/g, "").slice(0, 2);
    });

    if (alunoIdUrl && alunoIdUrl !== "undefined") {
      $("aluno_id").value = alunoIdUrl;
      $("aluno_id").disabled = true;
      await verificarAtiva();
    }
    if (idUrl && idUrl !== "undefined") {
      try { preencherFormulario(await carregarMatricula(idUrl)); }
      catch (erro) { setAlerta(erro.message, "erro"); }
    }
    recalcular();
  }

  iniciar();
})();
