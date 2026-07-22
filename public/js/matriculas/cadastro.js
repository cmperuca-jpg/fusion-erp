(function(){
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const idUrl = params.get("id");
  const alunoIdUrl = params.get("alunoId") || params.get("aluno_id");

  let alunos = [];
  let planos = [];
  let turmas = [];
  let matriculaAtual = null;
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
      turmaNomes: nome ? [nome] : []
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
    const [alunosResp, planosResp, turmasResp] = await Promise.all([
      fetch("/api/alunos", { cache: "no-store" }).then((r) => r.json()).catch(() => []),
      fetch("/api/planos", { cache: "no-store" }).then((r) => r.json()).catch(() => []),
      fetch("/api/turmas", { cache: "no-store" }).then((r) => r.json()).catch(() => [])
    ]);

    alunos = lista(alunosResp);
    planos = lista(planosResp).filter((p) => !["inativo", "inativa", "cancelado"].includes(norm(p.status || "Ativo")));
    turmas = lista(turmasResp).filter((t) => !["inativa", "inativo", "cancelada", "cancelado"].includes(norm(t.status || "Ativa")));

    preencherSelect("aluno_id", alunos, "Selecione o aluno", (a) => a.id, alunoNome);
    preencherSelect("plano_id", planos, "Selecione o plano", (p) => p.id, (p) => `${p.nome || p.id} - ${br(valorPlano(p))}`);
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

    if (plano && taxaInput && taxaInput.dataset.manual !== "true" && ultimoPlanoTaxaSincronizada !== planoIdAtual) {
      taxaInput.value = valorMatriculaPlano(plano).toFixed(2);
    }
    ultimoPlanoTaxaSincronizada = planoIdAtual;

    const mensalidade = valorPlano(plano);
    const taxa = cobrarTaxa ? dinheiro(taxaInput?.value) : 0;
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
    $("matriculaId").value = m.id || "";
    $("aluno_id").value = m.alunoId || m.aluno_id || m.idAluno || "";
    $("status").value = m.status || "Ativa";
    $("data_matricula").value = String(m.dataMatricula || m.data_matricula || hoje()).slice(0, 10);
    $("data_inicio").value = String(m.dataInicio || m.data_inicio || m.dataMatricula || hoje()).slice(0, 10);
    $("data_fim").value = String(m.dataFim || m.data_fim || "").slice(0, 10);
    $("plano_id").value = m.planoId || m.plano_id || "";
    $("turma_id").value = Array.isArray(m.turmaIds) ? (m.turmaIds[0] || "") : (m.turmaId || m.turma_id || "");
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

  function mostrarExistente(m) {
    const box = $("matriculaExistenteBox");
    if (!box) return;
    box.classList.add("ativo");
    box.innerHTML = `<strong>Aluno com matricula ativa.</strong><br>Matricula: ${esc(m.numero || m.id || "-")}<br>Plano: ${esc(m.plano || "-")}<br>Turma: ${esc(m.turma || "-")}<br>Mensalidade: ${br(m.valorMensalTotal ?? m.valorMensal)}<div class="acoes-existente"><button type="button" class="dark" id="btnAbrirExistente">Abrir matricula existente</button><button type="button" class="primary" id="btnAlterarTurmaTela">Alterar turma</button></div>`;
    $("btnAbrirExistente").onclick = () => location.href = `/pages/matriculas/ficha.html?id=${encodeURIComponent(m.id || m.numero)}`;
    $("btnAlterarTurmaTela").onclick = () => {
      $("btnSalvar").textContent = "Salvar turma";
      tab("dados");
      setAlerta("Alterar turma nao muda mensalidade nem financeiro.", "ok");
    };
  }

  async function verificarAtiva() {
    const alunoId = $("aluno_id")?.value;
    if (!alunoId) return;
    const mats = await buscarMatriculasAluno(alunoId);
    const ativa = mats.find((m) => statusMatriculaEditavel(m.status));
    if (ativa) preencherFormulario(ativa);
  }

  async function salvar(ev) {
    ev.preventDefault();
    setAlerta("", "");

    const alunoId = $("aluno_id").value;
    const planoId = $("plano_id").value;
    const planoAtual = matriculaAtual?.planoId || matriculaAtual?.plano_id || "";
    const tipo = tipoPlano(planoSelecionado());

    if (!alunoId) {
      tab("dados");
      return setAlerta("Informe o aluno da matrícula.", "erro");
    }
    if (!planoId) {
      tab("financeiro");
      $("plano_id")?.focus();
      return setAlerta("Informe o plano antes de salvar a matrícula.", "erro");
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
      cobrarMatricula: $("cobrar_taxa_matricula").value !== "false",
      valorMatricula: dinheiro($("taxa_matricula").value),
      valorTaxaMatricula: dinheiro($("taxa_matricula").value),
      taxaMatricula: dinheiro($("taxa_matricula").value),
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

    $("plano_id")?.addEventListener("change", recalcular);
    $("cobrar_taxa_matricula")?.addEventListener("change", recalcular);
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
