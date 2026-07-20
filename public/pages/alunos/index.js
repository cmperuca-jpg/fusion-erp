const API_ALUNOS = "/api/alunos";
const API_FINANCEIRO = "/api/financeiro";
const API_MATRICULAS_INTEGRAR = "/api/matriculas/integrar";
const API_MATRICULAS = "/api/matriculas";
let matriculasAlunoAtual = [];
const API_PLANOS_CANDIDATAS = ["/api/planos", "/api/financeiro/planos", "/api/cadastros/planos"];

let alunos = [];
let planosCadastrados = [];
let pagina = 1;
const porPagina = 10;
let fotoBase64Atual = "";
let salvando = false;

const $ = (sel) => document.querySelector(sel);

function dataHojeISO() {
  return new Date().toISOString().slice(0, 10);
}


function dataParaCampo(valor) {
  if (window.FusionDate && typeof window.FusionDate.toBR === "function") return window.FusionDate.toBR(valor || "");
  const s = String(valor || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function dataParaISO(valor) {
  if (window.FusionDate && typeof window.FusionDate.toISO === "function") return window.FusionDate.toISO(valor || "");
  const s = String(valor || "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const n = s.replace(/\D/g, "");
  if (n.length !== 8) return "";
  return `${n.slice(4, 8)}-${n.slice(2, 4)}-${n.slice(0, 2)}`;
}

function normalizarTexto(valor) {
  return String(valor ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function somenteNumeros(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

function extrairLista(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.alunos)) return payload.alunos;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.dados)) return payload.dados;
  if (Array.isArray(payload.itens)) return payload.itens;
  if (Array.isArray(payload.registros)) return payload.registros;
  return [];
}

function planoNome(plano) {
  return String(
    plano?.nome ??
    plano?.descricao ??
    plano?.titulo ??
    plano?.plano ??
    plano?.nomePlano ??
    ""
  ).trim();
}

function planoValor(plano) {
  return plano?.valor ?? plano?.preco ?? plano?.mensalidade ?? plano?.valorMensal ?? "";
}

function planoId(plano) {
  return String(plano?.id ?? plano?.codigo ?? plano?.planoId ?? planoNome(plano)).trim();
}

function planoStatus(plano) {
  return String(plano?.status ?? plano?.situacao ?? "ativo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extrairListaPlanos(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.planos)) return payload.planos;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.dados)) return payload.dados;
  if (Array.isArray(payload.itens)) return payload.itens;
  if (Array.isArray(payload.registros)) return payload.registros;
  if (Array.isArray(payload.resultado)) return payload.resultado;
  if (payload && typeof payload === "object" && planoNome(payload)) return [payload];
  return [];
}

async function carregarPlanos(valorAtual = "") {
  const select = $("#plano");
  if (select) {
    select.innerHTML = '<option value="">Carregando planos...</option>';
  }

  let ultimoErro = "";

  for (const url of API_PLANOS_CANDIDATAS) {
    try {
      const resp = await fetch(url, { cache: "no-store" });
      const payload = await safeJson(resp);

      if (!resp.ok) {
        ultimoErro = payload.erro || payload.mensagem || `HTTP ${resp.status}`;
        continue;
      }

      const lista = extrairListaPlanos(payload)
        .filter((plano) => planoNome(plano))
        .filter((plano) => !["inativo", "cancelado", "excluido", "excluído"].includes(planoStatus(plano)));

      if (lista.length) {
        planosCadastrados = lista;
        preencherSelectPlanos(valorAtual);
        return true;
      }

      ultimoErro = "API respondeu sem lista de planos";
    } catch (erro) {
      ultimoErro = erro.message;
    }
  }

  planosCadastrados = [];
  if (select) {
    select.innerHTML = '<option value="">Nenhum plano cadastrado encontrado</option>';
  }

  mostrarAlerta(`Planos não carregados. Teste no navegador: http://localhost:3000/api/planos. Detalhe: ${ultimoErro}`, "erro");
  return false;
}

function preencherSelectPlanos(valorAtual = "") {
  const select = $("#plano");
  if (!select) return;

  const atual = valorAtual || select.value || "";
  const planos = [...planosCadastrados].sort((a, b) => planoNome(a).localeCompare(planoNome(b), "pt-BR"));

  select.innerHTML = '<option value="">Selecione um plano</option>' + planos.map((plano) => {
    const nome = planoNome(plano);
    const valor = planoValor(plano);
    const label = valor !== "" && valor != null
      ? `${nome} - R$ ${formatarMoeda(valor)}`
      : nome;

    return `<option value="${escapeAttr(planoId(plano))}" data-nome="${escapeAttr(nome)}">${escapeHtml(label)}</option>`;
  }).join("");

  if (atual) {
    let existe = Array.from(select.options).some((opt) => opt.value === atual);
    if (!existe) {
      const planoPorNome = planos.find((p) => planoNome(p) === atual);
      if (planoPorNome) { select.value = planoId(planoPorNome); existe = true; }
    }
    if (!existe) {
      const opt = document.createElement("option");
      opt.value = atual;
      opt.textContent = `${atual} (não localizado nos planos atuais)`;
      select.appendChild(opt);
    }
    if (!select.value) select.value = atual;
  }
}

function formatarMoeda(valor) {
  const numero = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(numero)) return valor;
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoeda(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor ?? "").trim();
  if (!texto) return 0;
  const normalizado = texto.replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function planoSelecionado() {
  const id = $("#plano")?.value || "";
  if (!id) return null;
  return planosCadastrados.find((plano) => String(planoId(plano)) === String(id) || planoNome(plano) === id) || null;
}

function atualizarPainelComercialMatricula() {
  const plano = planoSelecionado();
  const valorMensal = plano ? parseMoeda(planoValor(plano)) : 0;
  const cobrar = $("#cobrar_taxa_matricula")?.value !== "nao";
  const taxaInput = $("#valor_taxa_matricula");
  const descontoInput = $("#desconto_matricula");

  // Taxa de matrícula é livre e não depende do plano.
  // Só preenche com 0,00 na primeira abertura do formulário.
  if (taxaInput && !taxaInput.dataset.inicializado) {
    taxaInput.value = taxaInput.value || "0,00";
    taxaInput.dataset.inicializado = "1";
  }

  const taxaInformada = Math.max(0, parseMoeda(taxaInput?.value || 0));
  const desconto = Math.max(0, parseMoeda(descontoInput?.value || 0));
  const taxaCobrada = cobrar ? taxaInformada : 0;
  const total = Math.max(0, valorMensal + taxaCobrada - desconto);

  const mensalidadePreview = $("#valor_mensal_preview");
  const totalPreview = $("#total_matricula_preview");
  if (mensalidadePreview) mensalidadePreview.value = `R$ ${formatarMoeda(valorMensal)}`;
  if (totalPreview) totalPreview.value = `R$ ${formatarMoeda(total)}`;
  if (taxaInput) taxaInput.disabled = !cobrar;

  return {
    planoOpcional: !plano,
    valorMensal,
    valorPlano: valorMensal,
    taxaPlano: 0,
    cobrarTaxaMatricula: cobrar,
    valorTaxaMatricula: taxaCobrada,
    valorMatricula: taxaCobrada,
    descontoMatricula: desconto,
    valorTotalInicial: total
  };
}

function opcoesComerciaisMatricula() {
  const painel = atualizarPainelComercialMatricula();
  return {
    planoOpcional: painel.planoOpcional,
    cobrarTaxaMatricula: painel.cobrarTaxaMatricula,
    valorTaxaMatricula: painel.valorTaxaMatricula,
    valorMatricula: painel.valorMatricula,
    valorPlano: painel.valorPlano,
    valorMensal: painel.valorMensal,
    descontoMatricula: painel.descontoMatricula,
    valorTotalInicial: painel.valorTotalInicial,
    decisaoComercialEm: new Date().toISOString()
  };
}

function alunoId(aluno) { return aluno.id ?? aluno._id ?? aluno.codigo ?? ""; }
function alunoNome(aluno) { return aluno.nome ?? aluno.nomeCompleto ?? aluno.aluno ?? "Sem nome"; }
function alunoCpf(aluno) { return aluno.cpf ?? aluno.documento ?? ""; }
function alunoTelefone(aluno) { return aluno.telefone ?? aluno.celular ?? aluno.whatsapp ?? ""; }
function alunoEmail(aluno) { return aluno.email ?? ""; }
function alunoPlano(aluno) { return aluno.plano ?? aluno.nomePlano ?? aluno.modalidade ?? aluno.tipoPlano ?? ""; }
function alunoPlanoId(aluno) { return aluno.planoId ?? aluno.plano_id ?? aluno.idPlano ?? ""; }
function alunoStatus(aluno) {
  const statusMatricula = normalizarTexto(aluno?.statusMatricula || aluno?.matriculaStatus || "");
  const statusCadastro = normalizarTexto(aluno?.status || aluno?.situacao || "");

  if (["ativa", "ativo", "regular"].includes(statusMatricula)) return "ativo";

  if (["pendente", "pre-matriculado", "pre matriculado", "pre_matriculado"].includes(statusCadastro)) {
    return "pre-matriculado";
  }

  if (["pendente", "pre-matriculado", "pre matriculado", "pre_matriculado"].includes(statusMatricula)) {
    return "pre-matriculado";
  }

  if (["cancelada", "cancelado", "encerrada", "encerrado", "inativa", "inativo"].includes(statusMatricula)) {
    return "inativo";
  }

  return statusCadastro || "ativo";
}


function resumoComercialMensagem(resultado = {}, painel = null) {
  const dados = painel || atualizarPainelComercialMatricula();
  const planoNomeMsg = $("#plano")?.selectedOptions?.[0]?.textContent?.replace(/\s+-\s+R\$.*$/, "") || "Sem plano";
  const mensalidade = Number(dados.valorMensal || dados.valorPlano || 0);
  const taxa = Number(dados.valorMatricula || dados.valorTaxaMatricula || 0);
  const desconto = Number(dados.descontoMatricula || 0);
  const total = Number(dados.valorTotalInicial ?? Math.max(0, mensalidade + taxa - desconto));

  return [
    "Aluno cadastrado e matrícula criada com sucesso.",
    `Matrícula: ${resultado?.matricula?.numero || resultado?.matricula?.id || "-"}`,
    `Plano: ${planoNomeMsg || "Sem plano"}`,
    `Mensalidade: R$ ${formatarMoeda(mensalidade)}`,
    `Taxa de matrícula: R$ ${formatarMoeda(taxa)}`,
    `Desconto: R$ ${formatarMoeda(desconto)}`,
    `Total inicial: R$ ${formatarMoeda(total)}`,
    "",
    total > 0
      ? "Deseja abrir o financeiro para receber agora?"
      : "Não há valor a receber. A matrícula pode ficar ativa sem baixa."
  ].join("\n");
}

function mostrarAlerta(msg, tipo = "info") {
  const el = $("#alertaAlunos");
  el.textContent = msg;
  el.className = `alunos-alert ${tipo}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 9000);
}

async function carregarAlunos() {
  $("#tabelaAlunos").innerHTML = `<tr><td colspan="6">Carregando alunos...</td></tr>`;

  try {
    const resp = await fetch(API_ALUNOS, { cache: "no-store" });
    const payload = await safeJson(resp);

    if (!resp.ok) {
      throw new Error(payload.erro || payload.mensagem || `Erro HTTP ${resp.status}`);
    }

    alunos = extrairLista(payload);
    pagina = 1;
    limparMenu();
    preencherFiltroPlanos();
    atualizarKpis();
    renderizarTabela();
  } catch (erro) {
    $("#tabelaAlunos").innerHTML = `<tr><td colspan="6">Erro ao carregar alunos: ${escapeHtml(erro.message)}</td></tr>`;
    mostrarAlerta(erro.message, "erro");
  }
}

function limparMenu() {
  document.querySelectorAll(".fusion-menu a").forEach(a => {
    a.classList.toggle("active", a.dataset.module === "alunos");
    if (a.dataset.module !== "alunos") a.removeAttribute("aria-current");
  });
}

function alunosFiltrados() {
  const termo = normalizarTexto($("#buscaAluno").value);
  const status = $("#filtroStatus").value;
  const plano = $("#filtroPlano").value;

  return alunos.filter(aluno => {
    const texto = normalizarTexto([
      alunoNome(aluno),
      alunoCpf(aluno),
      alunoTelefone(aluno),
      alunoEmail(aluno),
      alunoPlano(aluno)
    ].join(" "));

    return (!termo || texto.includes(termo)) &&
      (!status || alunoStatus(aluno) === status) &&
      (!plano || String(alunoPlano(aluno)) === plano);
  });
}

function renderizarTabela() {
  const lista = alunosFiltrados();
  const totalPaginas = Math.max(Math.ceil(lista.length / porPagina), 1);
  if (pagina > totalPaginas) pagina = totalPaginas;

  const inicio = (pagina - 1) * porPagina;
  const itens = lista.slice(inicio, inicio + porPagina);

  $("#contadorRegistros").textContent = `${lista.length} registro(s)`;
  $("#paginaAtual").textContent = `Página ${pagina} de ${totalPaginas}`;
  $("#btnAnterior").disabled = pagina <= 1;
  $("#btnProxima").disabled = pagina >= totalPaginas;

  renderizarCardsMobileAlunos(itens, lista.length);

  if (!itens.length) {
    $("#tabelaAlunos").innerHTML = `<tr><td colspan="6">Nenhum aluno encontrado.</td></tr>`;
    return;
  }

  $("#tabelaAlunos").innerHTML = itens.map(a => {
    const id = alunoId(a);
    const st = alunoStatus(a);

    return `<tr>
      <td><strong>${escapeHtml(alunoNome(a))}</strong><small>${escapeHtml(alunoEmail(a))}</small></td>
      <td>${escapeHtml(formatarCpfVisual(alunoCpf(a)))}</td>
      <td>${escapeHtml(formatarTelefoneVisual(alunoTelefone(a)))}</td>
      <td>${escapeHtml(alunoPlano(a))}</td>
      <td>${statusAlunoHtml(id, st)}</td>
      <td class="text-right">
        <button class="btn-row" type="button" onclick="abrirProntuarioAluno('${escapeAttr(id)}')">Abrir</button>
        <button class="btn-row" type="button" onclick="abrirEdicao('${escapeAttr(id)}')">Editar</button>
        ${botaoStatusAluno(id, st)}
        <button class="btn-row danger" type="button" onclick="excluirAluno('${escapeAttr(id)}')">Excluir</button>
      </td>
    </tr>`;
  }).join("");
}


function alunoEstaInativoOperacional(status) {
  return ["inativo", "cancelado", "encerrado", "desligado"].includes(String(status || "").toLowerCase());
}

function alunoEstaPreMatriculado(status) {
  return ["pre-matriculado", "pre matriculado", "pre_matriculado", "pendente"].includes(normalizarTexto(status));
}

function statusAlunoHtml(id, status) {
  const st = String(status || "").trim();

  if (alunoEstaPreMatriculado(st)) {
    return `<button class="badge badge-status-action status-pre-matriculado" type="button" title="Matrícula aguardando pagamento. Clique para regularizar." onclick="regularizarPreMatricula('${escapeAttr(id)}')">Regularizar</button>`;
  }

  return `<span class="badge status-${escapeHtml(st)}">${escapeHtml(st)}</span>`;
}

function botaoStatusAluno(id, status) {
  if (alunoEstaPreMatriculado(status)) {
    return `<button class="btn-row regularizar" type="button" onclick="regularizarPreMatricula('${escapeAttr(id)}')">Regularizar</button>`;
  }
  if (alunoEstaInativoOperacional(status)) {
    return `<button class="btn-row success" type="button" onclick="reativarAluno('${escapeAttr(id)}')">Reativar</button>`;
  }
  return `<button class="btn-row warning" type="button" onclick="cancelarAluno('${escapeAttr(id)}')">Cancelar</button>`;
}

function botaoStatusAlunoMobile(id, status) {
  if (alunoEstaPreMatriculado(status)) {
    return `<button type="button" class="regularizar" onclick="regularizarPreMatricula('${escapeAttr(id)}')">Regularizar</button>`;
  }
  if (alunoEstaInativoOperacional(status)) {
    return `<button type="button" class="success" onclick="reativarAluno('${escapeAttr(id)}')">Reativar</button>`;
  }
  return `<button type="button" class="warning" onclick="cancelarAluno('${escapeAttr(id)}')">Cancelar</button>`;
}

function renderizarCardsMobileAlunos(itens = [], total = 0) {
  const box = $("#alunosMobileCards");
  if (!box) return;
  if (!itens.length) {
    box.innerHTML = `<div class="aluno-mobile-empty">Nenhum aluno encontrado.</div>`;
    return;
  }
  box.innerHTML = itens.map(a => {
    const id = alunoId(a);
    const st = alunoStatus(a);
    return `<article class="aluno-mobile-card status-${escapeHtml(st)}">
      <div class="aluno-mobile-head">
        <div>
          <strong>${escapeHtml(alunoNome(a))}</strong>
          <small>${escapeHtml(alunoEmail(a) || alunoCpf(a) || '-')}</small>
        </div>
        ${statusAlunoHtml(id, st)}
      </div>
      <div class="aluno-mobile-info">
        <div><span>Plano</span><b>${escapeHtml(alunoPlano(a) || '-')}</b></div>
        <div><span>Telefone</span><b>${escapeHtml(formatarTelefoneVisual(alunoTelefone(a)) || '-')}</b></div>
      </div>
      <div class="aluno-mobile-actions">
        <button type="button" onclick="abrirProntuarioAluno('${escapeAttr(id)}')">Abrir</button>
        <button type="button" onclick="abrirEdicao('${escapeAttr(id)}')">Editar</button>
        ${botaoStatusAlunoMobile(id, st)}
        <button type="button" class="danger" onclick="excluirAluno('${escapeAttr(id)}')">Excluir</button>
      </div>
    </article>`;
  }).join("");
}

window.abrirProntuarioAluno = function(id) {
  if (!id) return mostrarAlerta("ID do aluno não encontrado.", "erro");
  location.href = `/pages/alunos/prontuario.html?id=${encodeURIComponent(id)}`;
};

window.cancelarAluno = async function(id) {
  if (!id) return mostrarAlerta("ID do aluno não encontrado.", "erro");

  const a = alunos.find(x => String(alunoId(x)) === String(id));
  const nome = a ? alunoNome(a) : "este aluno";

  if (!confirm(`Confirma cancelar ${nome}? As cobranças abertas serão canceladas e o histórico pago será preservado.`)) return;

  try {
    const resp = await fetch(`${API_ALUNOS}/${encodeURIComponent(id)}/desligar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario: "operador",
        motivo: "Cancelamento rápido pelo cadastro de alunos."
      })
    });
    const payload = await safeJson(resp);

    if (!resp.ok || payload.ok === false) {
      throw new Error(payload.erro || payload.mensagem || `Erro HTTP ${resp.status}`);
    }

    registrarHistoricoLocal(id, "cancelamento", `Aluno cancelado: ${nome}`);
    mostrarAlerta(payload.mensagem || "Aluno cancelado com sucesso.", "sucesso");
    await carregarAlunos();
  } catch (erro) {
    mostrarAlerta(erro.message, "erro");
  }
};

function atualizarKpis() {
  $("#kpiTotal").textContent = alunos.length;
  $("#kpiAtivos").textContent = alunos.filter(a => alunoStatus(a) === "ativo").length;
  $("#kpiPendentes").textContent = alunos.filter(a => ["pendente", "pre-matriculado"].includes(alunoStatus(a))).length;
  $("#kpiInativos").textContent = alunos.filter(a => ["inativo", "cancelado"].includes(alunoStatus(a))).length;
}

function preencherFiltroPlanos() {
  const select = $("#filtroPlano");
  const atual = select.value;
  const planos = [...new Set(alunos.map(alunoPlano).filter(Boolean))].sort();

  select.innerHTML = `<option value="">Todos</option>` + planos
    .map(plano => `<option value="${escapeAttr(plano)}">${escapeHtml(plano)}</option>`)
    .join("");

  select.value = atual;
}

async function abrirNovoAluno() {
  $("#formAluno").reset();
  const taxaLivre = $("#valor_taxa_matricula"); if (taxaLivre) { delete taxaLivre.dataset.inicializado; delete taxaLivre.dataset.editado; taxaLivre.value = "0,00"; }
  $("#alunoId").value = "";
  $("#status").value = "inativo";
  $("#data_matricula").value = dataParaCampo(dataHojeISO());
  fotoBase64Atual = "";
  atualizarPreviewFoto("");
  renderizarHistorico([]);
  renderizarMatriculasAluno([]);
  trocarTab("cadastro");
  abrirModal("Novo aluno");
  await carregarPlanos("");
  atualizarPainelComercialMatricula();
}

function abrirModal(t) {
  $("#modalTitulo").textContent = t;
  document.body.classList.add("modal-aluno-open");
  $("#modalAluno").classList.remove("hidden");
  setTimeout(() => $("#nome").focus(), 50);
  if (typeof atualizarWizardAlunoMobile === "function") atualizarWizardAlunoMobile();
}

function fecharModal() {
  document.body.classList.remove("modal-aluno-open");
  $("#modalAluno").classList.add("hidden");
  $("#formAluno").reset();
  const taxaLivre = $("#valor_taxa_matricula"); if (taxaLivre) { delete taxaLivre.dataset.inicializado; delete taxaLivre.dataset.editado; taxaLivre.value = "0,00"; }
  $("#alunoId").value = "";
  fotoBase64Atual = "";
  atualizarPreviewFoto("");
  setSalvarLoading(false);
}

window.abrirEdicao = async function(id) {
  const a = alunos.find(x => String(alunoId(x)) === String(id));
  if (!a) return mostrarAlerta("Aluno não encontrado.", "erro");

  preencherFormulario(a);
  renderizarHistorico(obterHistorico(id));
  renderizarMatriculasAluno([]);
  trocarTab("cadastro");
  abrirModal("Editar aluno");
  await carregarPlanos(alunoPlano(a));
  atualizarPainelComercialMatricula();
  atualizarMatriculasAlunoAtual();
};

function preencherFormulario(a) {
  $("#alunoId").value = alunoId(a);
  $("#nome").value = alunoNome(a);
  $("#cpf").value = formatarCpfVisual(alunoCpf(a));
  $("#rg").value = a.rg ?? "";
  $("#data_nascimento").value = dataParaCampo(a.data_nascimento ?? a.dataNascimento ?? "");
  $("#sexo").value = a.sexo ?? "";
  $("#telefone").value = formatarTelefoneVisual(alunoTelefone(a));
  $("#whatsapp").value = formatarTelefoneVisual(a.whatsapp ?? "");
  $("#email").value = alunoEmail(a);
  $("#professor_responsavel").value = a.professor_responsavel ?? "";
  preencherSelectPlanos(alunoPlanoId(a) || alunoPlano(a));
  $("#data_matricula").value = dataParaCampo((a.data_matricula ?? "").slice(0, 10) || dataHojeISO());
  $("#status").value = alunoStatus(a);
  $("#responsavel").value = a.responsavel ?? "";
  $("#contato_emergencia").value = a.contato_emergencia ?? a.contatoEmergencia ?? "";
  $("#cep").value = a.cep ?? "";
  $("#cidade").value = a.cidade ?? "";
  $("#estado").value = a.estado ?? "";
  $("#endereco").value = a.endereco ?? "";
  $("#objetivo").value = a.objetivo ?? "";
  $("#observacoes").value = a.observacoes ?? a.observacao ?? "";
  $("#tipo_sanguineo").value = a.tipo_sanguineo ?? "";
  $("#peso").value = a.peso ?? "";
  $("#altura").value = a.altura ?? "";
  $("#alergias").value = a.alergias ?? "";
  $("#restricoes_medicas").value = a.restricoes_medicas ?? "";
  $("#medicamentos").value = a.medicamentos ?? "";
  $("#lesoes").value = a.lesoes ?? "";
  fotoBase64Atual = a.foto_base64 ?? a.foto ?? "";
  atualizarPreviewFoto(fotoBase64Atual);
}


function extrairLancamentosFinanceiro(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.lancamentos)) return payload.lancamentos;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.dados)) return payload.dados;
  if (Array.isArray(payload?.itens)) return payload.itens;
  if (Array.isArray(payload?.registros)) return payload.registros;
  return [];
}

function statusFinanceiroAberto(item = {}) {
  const st = normalizarTexto(item.status || item.situacao || "aberto");
  return !["pago", "recebido", "quitado", "baixado", "cancelado", "estornado"].includes(st);
}

function pareceCobrancaRegularizacao(item = {}) {
  const alvo = normalizarTexto([
    item.descricao,
    item.categoria,
    item.origem,
    item.recorrencia,
    item.tipoCobranca,
    item.observacao,
    item.observacoes
  ].join(" "));

  return alvo.includes("matricula") ||
    alvo.includes("matrícula") ||
    alvo.includes("pre-matricula") ||
    alvo.includes("pré-matrícula") ||
    alvo.includes("entrada") ||
    alvo.includes("adesao") ||
    alvo.includes("adesão") ||
    alvo.includes("reativacao") ||
    alvo.includes("reativação") ||
    item.ativarMatriculaAoReceber === true;
}

function idsFinanceirosDoAluno(aluno = {}) {
  return [
    aluno.financeiroInicialId,
    aluno.financeiroId,
    aluno.lancamentoFinanceiroId,
    aluno.lancamentoId,
    aluno.matriculaFinanceiroId,
    aluno.recebimentoId
  ].filter(Boolean).map(v => String(v));
}

function idsMensalidadeDoAluno(aluno = {}) {
  return [
    aluno.mensalidadeInicialId,
    aluno.mensalidadeId,
    aluno.mensalidadePendenteId
  ].filter(Boolean).map(v => String(v));
}

async function localizarCobrancaRegularizacao(aluno = {}) {
  const idsFinanceiros = idsFinanceirosDoAluno(aluno);
  if (idsFinanceiros.length) return { financeiroId: idsFinanceiros[0] };

  const idsMensalidades = idsMensalidadeDoAluno(aluno);
  if (idsMensalidades.length) return { mensalidadeId: idsMensalidades[0] };

  const nome = alunoNome(aluno);
  const id = alunoId(aluno);
  const busca = encodeURIComponent(nome || id);
  const resp = await fetch(`${API_FINANCEIRO}?busca=${busca}`, { cache: "no-store" });
  const payload = await safeJson(resp);

  if (!resp.ok) {
    throw new Error(payload.erro || payload.mensagem || `Erro HTTP ${resp.status}`);
  }

  const lista = extrairLancamentosFinanceiro(payload)
    .filter(item => normalizarTexto(item.tipo || "receber") === "receber")
    .filter(statusFinanceiroAberto)
    .filter(item => {
      const mesmoId = id && String(item.alunoId || item.aluno_id || "") === String(id);
      const mesmoNome = nome && normalizarTexto([item.aluno, item.pessoa, item.alunoFornecedor, item.pessoaFornecedor].join(" ")).includes(normalizarTexto(nome));
      return mesmoId || mesmoNome;
    })
    .sort((a, b) => {
      const prioridadeA = pareceCobrancaRegularizacao(a) ? 1 : 0;
      const prioridadeB = pareceCobrancaRegularizacao(b) ? 1 : 0;
      if (prioridadeA !== prioridadeB) return prioridadeB - prioridadeA;
      return String(a.vencimento || "").localeCompare(String(b.vencimento || ""));
    });

  const pendencia = lista[0];
  if (!pendencia) return null;

  return {
    financeiroId: pendencia.id || pendencia.financeiroId || pendencia.lancamentoFinanceiroId || "",
    mensalidadeId: pendencia.mensalidadeId || pendencia.mensalidade_id || "",
    alunoId: id
  };
}

window.regularizarPreMatricula = async function(id) {
  if (!id) return mostrarAlerta("ID do aluno não encontrado.", "erro");

  const aluno = alunos.find(x => String(alunoId(x)) === String(id));
  if (!aluno) return mostrarAlerta("Aluno não encontrado.", "erro");

  try {
    mostrarAlerta(`Localizando cobrança pendente de ${alunoNome(aluno)}...`, "info");
    const pendencia = await localizarCobrancaRegularizacao(aluno);

    if (!pendencia?.financeiroId && !pendencia?.mensalidadeId) {
      mostrarAlerta("Nenhuma cobrança pendente encontrada para regularizar. Abra a matrícula do aluno e confira o lançamento financeiro.", "erro");
      return;
    }

    const params = new URLSearchParams();
    if (pendencia.financeiroId) params.set("financeiroId", pendencia.financeiroId);
    if (pendencia.mensalidadeId) params.set("mensalidadeId", pendencia.mensalidadeId);
    params.set("alunoId", id);
    params.set("receberAgora", "1");
    params.set("origem", "regularizacao_pre_matricula");

    location.href = `/pages/financeiro/index.html?${params.toString()}`;
  } catch (erro) {
    mostrarAlerta(erro.message || "Erro ao localizar pendência financeira.", "erro");
  }
};

window.reativarAluno = async function(id) {
  if (!id) return mostrarAlerta("ID do aluno não encontrado.", "erro");

  const a = alunos.find(x => String(alunoId(x)) === String(id));
  const nome = a ? alunoNome(a) : "este aluno";
  const valorPadrao = parseMoeda(a?.valorMensal || a?.valorPlano || a?.valorMensalTotal || "0");
  const informado = prompt(
    `Valor para reativar ${nome}:`,
    valorPadrao > 0 ? formatarMoeda(valorPadrao) : "0,00"
  );

  if (informado === null) return;

  const valor = parseMoeda(informado);
  if (!(valor > 0)) {
    mostrarAlerta("Informe um valor maior que zero para abrir a cobrança de reativação.", "erro");
    return;
  }

  try {
    const resp = await fetch(`${API_ALUNOS}/${encodeURIComponent(id)}/reativar-cobranca`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor,
        usuario: "operador",
        motivo: "Reativação pelo cadastro de alunos com cobrança no caixa."
      })
    });
    const payload = await safeJson(resp);

    if (!resp.ok || payload.ok === false) {
      throw new Error(payload.erro || payload.mensagem || `Erro HTTP ${resp.status}`);
    }

    const resultado = payload?.resultado || payload || {};
    const financeiroId =
      resultado?.financeiro?.id ||
      resultado?.financeiroId ||
      resultado?.lancamentoFinanceiroId ||
      resultado?.mensalidade?.lancamentoFinanceiroId ||
      resultado?.recebimento?.lancamentoFinanceiroId ||
      "";
    const mensalidadeId =
      resultado?.mensalidade?.id ||
      resultado?.mensalidadeId ||
      resultado?.recebimento?.mensalidadeId ||
      "";

    const mensagem = payload.mensagem || "Cobrança de reativação criada. Baixe no Financeiro para ativar o aluno.";
    mostrarAlerta(mensagem, "sucesso");

    await carregarAlunos();

    const params = new URLSearchParams();
    if (financeiroId) params.set("financeiroId", financeiroId);
    else if (mensalidadeId) params.set("mensalidadeId", mensalidadeId);
    params.set("receberAgora", "1");
    params.set("origem", "reativacao_aluno");

    const url = `/pages/financeiro/index.html?${params.toString()}`;

    if (confirm(`${mensagem}

Abrir o Financeiro para escolher a forma de pagamento e confirmar o recebimento agora?`)) {
      location.href = url;
    }
  } catch (erro) {
    mostrarAlerta(erro.message, "erro");
  }
};

window.excluirAluno = async function(id) {
  if (!id) return mostrarAlerta("ID do aluno não encontrado.", "erro");

  const a = alunos.find(x => String(alunoId(x)) === String(id));
  const nome = a ? alunoNome(a) : "este aluno";

  if (!confirm(`Confirma excluir definitivamente ${nome}? Para apenas desativar, use o botão Cancelar.`)) return;

  try {
    const resp = await fetch(`${API_ALUNOS}/${encodeURIComponent(id)}`, { method: "DELETE" });
    const payload = await safeJson(resp);

    if (!resp.ok || payload.ok === false) {
      throw new Error(payload.erro || payload.mensagem || `Erro HTTP ${resp.status}`);
    }

    registrarHistoricoLocal(id, "exclusao", `Aluno excluído: ${nome}`);
    mostrarAlerta(payload.mensagem || "Aluno excluído com sucesso.", "sucesso");
    await carregarAlunos();
  } catch (erro) {
    mostrarAlerta(erro.message, "erro");
  }
};


function resumoFinanceiroMatricula(resultado) {
  const matricula = resultado?.matricula || {};
  const mensalidade = resultado?.mensalidadeGerada || {};
  const plano = resultado?.plano || {};
  const valor = Number(mensalidade.valor ?? matricula.valorMensal ?? plano.valorMensal ?? 0) || 0;
  const taxa = Number(mensalidade.taxaMatricula ?? matricula.taxaMatricula ?? plano.taxaMatricula ?? 0) || 0;
  const desconto = Number(mensalidade.descontoMatricula ?? matricula.descontoMatricula ?? 0) || 0;
  const total = Number(mensalidade.total ?? matricula.valorTotalInicial ?? Math.max(0, valor + taxa - desconto)) || 0;
  return { matricula, mensalidade, valor, taxa, desconto, total };
}

async function integrarMatriculaAposCadastro(aluno, dadosFormulario) {
  const idAluno = alunoId(aluno);
  const planoSelecionadoId = dadosFormulario.planoId || dadosFormulario.plano;

  if (!idAluno || !planoSelecionadoId) return null;

  const resp = await fetch(API_MATRICULAS_INTEGRAR, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      alunoId: idAluno,
      planoId: planoSelecionadoId,
      dataMatricula: dadosFormulario.data_matricula || dataHojeISO(),
      gerarMensalidade: true,
      usuario: "operador",
      ...opcoesComerciaisMatricula()
    })
  });

  const payload = await safeJson(resp);
  if (!resp.ok || payload.ok === false) {
    throw new Error(payload.erro || payload.mensagem || `Erro HTTP ${resp.status}`);
  }
  return payload;
}

function abrirRecebimentoMatricula(resultado) {
  const { matricula, mensalidade } = resumoFinanceiroMatricula(resultado);
  const params = new URLSearchParams();
  if (matricula.financeiroInicialId) params.set("financeiroId", matricula.financeiroInicialId);
  if (matricula.mensalidadeInicialId || mensalidade.id) params.set("mensalidadeId", matricula.mensalidadeInicialId || mensalidade.id);
  if (matricula.alunoId) params.set("alunoId", matricula.alunoId);
  params.set("origem", "matricula");
  location.href = `/pages/financeiro/index.html?${params.toString()}`;
}

function confirmarRecebimentoAgora(resultado) {
  const { matricula, valor, taxa, desconto, total } = resumoFinanceiroMatricula(resultado);
  const texto = [
    "Aluno cadastrado e matrícula criada com sucesso.",
    `Matrícula: ${matricula.numero || "-"}`,
    `Plano: ${matricula.plano || "-"}`,
    `Mensalidade: R$ ${formatarMoeda(valor)}`,
    `Taxa de matrícula: R$ ${formatarMoeda(taxa)}`,
    `Desconto: R$ ${formatarMoeda(desconto || 0)}`,
    `Total inicial: R$ ${formatarMoeda(total)}`,
    "",
    "Deseja abrir o financeiro para receber agora?"
  ].join("\n");
  return confirm(texto);
}

async function salvarAluno(ev) {
  ev.preventDefault();
  if (salvando) return;

  const id = $("#alunoId").value;
  const dados = coletarDadosFormulario();
  const erro = validarAluno(dados);

  if (erro) return mostrarAlerta(erro, "erro");

  try {
    setSalvarLoading(true);

    const resp = await fetch(id ? `${API_ALUNOS}/${encodeURIComponent(id)}` : API_ALUNOS, {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });

    const payload = await safeJson(resp);

    if (!resp.ok || payload.ok === false) {
      throw new Error(payload.erro || payload.mensagem || `Erro HTTP ${resp.status}`);
    }

    const salvo = payload.aluno || payload;
    const idSalvo = alunoId(salvo) || id;
    registrarHistoricoLocal(idSalvo, id ? "edicao" : "cadastro", id ? "Cadastro do aluno atualizado" : "Aluno cadastrado no sistema");

    fecharModal();
    await carregarAlunos();

    if (id) {
      mostrarAlerta("Aluno atualizado com sucesso.", "sucesso");
      return;
    }

    const resultadoMatricula = await integrarMatriculaAposCadastro(salvo, dados);
    registrarHistoricoLocal(idSalvo, "matricula_plano", "Aluno cadastrado com matricula vinculada ao plano.");
    await carregarAlunos();

    if (resultadoMatricula && confirmarRecebimentoAgora(resultadoMatricula)) {
      abrirRecebimentoMatricula(resultadoMatricula);
      return;
    }

    mostrarAlerta("Aluno cadastrado com matricula vinculada ao plano. Turmas nao alteram o financeiro.", "sucesso");
  } catch (erro) {
    mostrarAlerta(erro.message, "erro");
  } finally {
    setSalvarLoading(false);
  }
}

function coletarDadosFormulario() {
  const ids = [
    "nome", "rg", "data_nascimento", "sexo", "email", "professor_responsavel",
    "plano", "data_matricula", "status", "responsavel", "contato_emergencia",
    "cep", "cidade", "estado", "endereco", "objetivo", "observacoes",
    "tipo_sanguineo", "peso", "altura", "alergias", "restricoes_medicas",
    "medicamentos", "lesoes"
  ];

  const dados = {
    cpf: somenteNumeros($("#cpf").value),
    telefone: somenteNumeros($("#telefone").value),
    whatsapp: somenteNumeros($("#whatsapp").value),
    foto_base64: fotoBase64Atual || ""
  };

  ids.forEach(id => dados[id] = $(`#${id}`).value.trim());
  dados.data_nascimento = dataParaISO(dados.data_nascimento);
  dados.data_matricula = dataParaISO(dados.data_matricula) || dataHojeISO();
  if (!dados.data_nascimento) delete dados.data_nascimento;

  const planoSelecionado = planosCadastrados.find((p) => planoId(p) === dados.plano);
  if (planoSelecionado) {
    dados.planoId = planoId(planoSelecionado);
    dados.plano = planoNome(planoSelecionado);
    dados.valorMensal = Number(planoSelecionado.valorMensal ?? planoSelecionado.valor ?? 0) || 0;
    dados.taxaMatricula = Number(planoSelecionado.taxaMatricula ?? 0) || 0;
  }

  dados.estado = (dados.estado || "").toUpperCase();

  Object.keys(dados).forEach(k => {
    if (dados[k] === "") delete dados[k];
  });

  const novoCadastro = !$("#alunoId").value;

  if (novoCadastro) {
    dados.status = "pre-matriculado";
    dados.statusMatricula = "Pendente";
    dados.matriculaStatus = "Pendente";
    dados.ativo = false;
  } else {
    if (!dados.status) dados.status = "inativo";
  }

  return dados;
}

function validarAluno(d) {
  if (!d.nome || d.nome.length < 3) return "Informe o nome completo do aluno.";
  if (!$("#alunoId").value && !d.planoId) return "Selecione o plano para criar a matricula do aluno.";
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return "E-mail inválido.";
  if (d.telefone && d.telefone.length < 10) return "Telefone inválido.";
  if (d.whatsapp && d.whatsapp.length < 10) return "WhatsApp inválido.";
  return "";
}

function setSalvarLoading(ativo) {
  salvando = ativo;
  const btn = $("#btnSalvarAluno");
  if (btn) {
    btn.disabled = ativo;
    btn.textContent = ativo ? "Salvando..." : "Salvar aluno";
  }
}

function trocarTab(nome) {
  document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === nome));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `tab-${nome}`));
  atualizarWizardAlunoMobile();
}

function obterHistorico(id) {
  try { return JSON.parse(localStorage.getItem(`fusion_historico_aluno_${id}`) || "[]"); }
  catch { return []; }
}

function salvarHistorico(id, lista) {
  localStorage.setItem(`fusion_historico_aluno_${id}`, JSON.stringify(lista));
}

function registrarHistoricoLocal(id, tipo, descricao) {
  if (!id) return;
  const lista = obterHistorico(id);
  lista.unshift({ id: `hist_${Date.now()}`, tipo, descricao, data: new Date().toISOString() });
  salvarHistorico(id, lista.slice(0, 50));
}

function adicionarHistoricoManual() {
  const id = $("#alunoId").value;
  if (!id) return mostrarAlerta("Salve ou selecione um aluno antes de adicionar histórico.", "erro");

  const desc = prompt("Descreva o registro do histórico:");
  if (!desc) return;

  registrarHistoricoLocal(id, "manual", desc);
  renderizarHistorico(obterHistorico(id));
}

function limparHistoricoLocal() {
  const id = $("#alunoId").value;
  if (!id) return mostrarAlerta("Selecione um aluno antes de limpar o histórico.", "erro");
  if (!confirm("Confirma limpar o histórico local deste aluno?")) return;

  localStorage.removeItem(`fusion_historico_aluno_${id}`);
  renderizarHistorico([]);
}

function renderizarHistorico(lista) {
  const el = $("#historicoLista");
  if (!lista.length) {
    el.innerHTML = `<div class="timeline-empty">Nenhum histórico local registrado para este aluno.</div>`;
    return;
  }

  el.innerHTML = lista.map(item => `<div class="timeline-item">
    <div class="timeline-dot"></div>
    <div><strong>${escapeHtml(rotuloHistorico(item.tipo))}</strong><p>${escapeHtml(item.descricao)}</p><small>${escapeHtml(formatarDataHora(item.data))}</small></div>
  </div>`).join("");
}

function rotuloHistorico(tipo) {
  return { cadastro: "Cadastro", edicao: "Alteração", exclusao: "Exclusão", manual: "Registro manual", matricula: "Matrícula" }[tipo] || "Histórico";
}


function matriculaAtiva(lista) {
  return (lista || []).find((m) => ["Ativa", "Pendente", "Trancada"].includes(String(m.status || ""))) || null;
}

function matriculaId(m) {
  return m?.id || m?.matriculaId || m?.numero || "";
}

function matriculaTurma(m) {
  return m?.turma || m?.turmaNome || m?.turma_id || m?.turmaId || "-";
}

function formatarDataCurta(v) {
  if (!v) return "-";
  const s = String(v).slice(0, 10);
  const partes = s.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : s;
}

async function carregarMatriculasDoAluno(id) {
  if (!id) return [];
  try {
    const resp = await fetch(`${API_MATRICULAS}?alunoId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const payload = await safeJson(resp);
    if (!resp.ok || payload.ok === false) throw new Error(payload.erro || payload.mensagem || `Erro HTTP ${resp.status}`);
    return extrairLista(payload);
  } catch (erro) {
    mostrarAlerta(`Não foi possível carregar matrículas do aluno. ${erro.message}`, "erro");
    return [];
  }
}

function renderizarMatriculasAluno(lista) {
  const el = $("#matriculasAlunoLista");
  if (!el) return;

  if (!lista || !lista.length) {
    el.innerHTML = `<div class="timeline-empty">Nenhuma matrícula vinculada. Use "Nova matrícula / turma" para colocar este aluno em uma turma.</div>`;
    return;
  }

  el.innerHTML = lista.map((m) => {
    const id = matriculaId(m);
    const ativo = ["Ativa", "Pendente", "Trancada"].includes(String(m.status || ""));
    return `<div class="mini-card" style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff;display:grid;gap:6px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
        <h4 style="margin:0;">${escapeHtml(m.numero || id || "Matrícula")}</h4>
        <span class="badge status-${escapeHtml(String(m.status || '').toLowerCase())}">${escapeHtml(m.status || "-")}</span>
      </div>
      <p style="margin:0;color:#475569;"><strong>Plano:</strong> ${escapeHtml(m.plano || "-")}</p>
      <p style="margin:0;color:#475569;"><strong>Turma:</strong> ${escapeHtml(matriculaTurma(m))}</p>
      <p style="margin:0;color:#475569;"><strong>Início:</strong> ${escapeHtml(formatarDataCurta(m.dataInicio || m.dataMatricula))} · <strong>Valor:</strong> R$ ${formatarMoeda(m.valorMensal || 0)}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
        <button type="button" class="btn-light" onclick="abrirFichaMatricula('${escapeAttr(id)}')">Abrir matrícula</button>
        ${ativo ? `<button type="button" class="btn-light" onclick="abrirMatriculaAluno('${escapeAttr(m.alunoId || $('#alunoId').value)}')">Alterar plano/turma</button>` : ""}
      </div>
    </div>`;
  }).join("");
}

async function atualizarMatriculasAlunoAtual() {
  const id = $("#alunoId")?.value;
  const el = $("#matriculasAlunoLista");
  if (!id) {
    if (el) el.innerHTML = `<div class="timeline-empty">Selecione ou salve um aluno para visualizar matrículas e turmas.</div>`;
    matriculasAlunoAtual = [];
    return [];
  }
  if (el) el.innerHTML = `<div class="timeline-empty">Carregando matrículas...</div>`;
  matriculasAlunoAtual = await carregarMatriculasDoAluno(id);
  renderizarMatriculasAluno(matriculasAlunoAtual);
  return matriculasAlunoAtual;
}

window.abrirFichaMatricula = function(id) {
  if (!id) return mostrarAlerta("Matrícula não identificada.", "erro");
  location.href = `/pages/matriculas/ficha.html?id=${encodeURIComponent(id)}`;
};

window.abrirFluxoMatriculaAluno = async function(id) {
  if (!id) return mostrarAlerta("Aluno não identificado.", "erro");

  const aluno = alunos.find((a) => String(alunoId(a)) === String(id));
  const status = aluno ? alunoStatus(aluno) : "";

  if (status === "ativo") {
    try {
      const lista = await carregarMatriculasDoAluno(id);
      const ativa = matriculaAtiva(lista);
      if (ativa) {
        window.abrirFichaMatricula(matriculaId(ativa));
        return;
      }
    } catch {}

    mostrarAlerta("Aluno já está ativo. Abra a ficha da matrícula para alterações.", "info");
    return;
  }

  window.abrirMatriculaAluno(id);
};

window.abrirMatriculaAluno = function(id) {
  if (!id) return mostrarAlerta("Aluno não identificado.", "erro");
  location.href = `/pages/matriculas/cadastro.html?alunoId=${encodeURIComponent(id)}`;
};

function abrirMatriculaDoModal() {
  const id = $("#alunoId")?.value;
  if (!id) return mostrarAlerta("Salve ou selecione um aluno antes de abrir matrícula.", "erro");
  window.abrirMatriculaAluno(id);
}

function abrirMatriculaAtivaDoAluno() {
  const ativa = matriculaAtiva(matriculasAlunoAtual);
  if (!ativa) return mostrarAlerta("Este aluno ainda não possui matrícula ativa.", "erro");
  window.abrirFichaMatricula(matriculaId(ativa));
}

function abrirIntegracao(destino) {
  const id = $("#alunoId").value;
  if (!id) return mostrarAlerta("Selecione ou salve um aluno antes de abrir integrações.", "erro");

  const rotas = {
    avaliacoes: "/pages/avaliacoes/index.html",
    mensalidades: "/pages/mensalidades/index.html",
    checkin: "/pages/checkin/index.html"
  };

  location.href = `${rotas[destino]}?alunoId=${encodeURIComponent(id)}`;
}

function formatarCpfVisual(v) {
  const n = somenteNumeros(v).slice(0, 11);
  return n.replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

function formatarTelefoneVisual(v) {
  const n = somenteNumeros(v).slice(0, 11);
  return n.length <= 10
    ? n.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2")
    : n.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

async function processarFoto(ev) {
  const f = ev.target.files?.[0];

  if (!f) {
    fotoBase64Atual = "";
    atualizarPreviewFoto("");
    return;
  }

  if (!f.type.startsWith("image/")) {
    mostrarAlerta("Selecione uma imagem válida.", "erro");
    ev.target.value = "";
    return;
  }

  if (f.size > 700 * 1024) {
    mostrarAlerta("A foto deve ter até 700 KB.", "erro");
    ev.target.value = "";
    return;
  }

  fotoBase64Atual = await arquivoParaBase64(f);
  atualizarPreviewFoto(fotoBase64Atual);
}

function arquivoParaBase64(f) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(f);
  });
}

function atualizarPreviewFoto(src) {
  $("#fotoPreview").innerHTML = src ? `<img src="${escapeAttr(src)}" alt="Foto do aluno">` : "Foto";
}

window.imprimirFichaPorId = function(id) {
  const a = alunos.find(x => String(alunoId(x)) === String(id));
  if (!a) return mostrarAlerta("Aluno não encontrado.", "erro");
  imprimirFicha(a);
};

function imprimirFichaAtual() {
  const id = $("#alunoId").value;
  const a = alunos.find(x => String(alunoId(x)) === String(id));
  imprimirFicha(a ? { ...a, ...coletarDadosFormulario() } : coletarDadosFormulario());
}

function imprimirFicha(a) {
  if (!a?.nome) return mostrarAlerta("Informe o nome para imprimir a ficha.", "erro");

  const hist = alunoId(a) ? obterHistorico(alunoId(a)) : [];

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha Completa</title>
  <style>body{font-family:Arial;margin:32px;color:#0f172a}h1{color:#ff6600}.box{border:1px solid #cbd5e1;border-radius:10px;padding:18px;margin-bottom:14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.label{font-size:12px;color:#64748b;text-transform:uppercase}.value{font-size:16px}.foto{width:120px;height:120px;border:1px solid #cbd5e1;border-radius:10px;object-fit:cover;float:right}.hist{border-left:3px solid #ff6600;padding-left:12px;margin:10px 0}</style></head>
  <body>${(a.foto_base64 || a.foto) ? `<img class="foto" src="${escapeAttr(a.foto_base64 || a.foto)}">` : ""}
  <h1>Fusion ERP</h1><p>Ficha completa do aluno</p>
  <h2>Dados cadastrais</h2><div class="box"><div class="grid">
  ${campoFicha("Nome", alunoNome(a))}${campoFicha("CPF", formatarCpfVisual(alunoCpf(a)))}${campoFicha("Telefone", formatarTelefoneVisual(alunoTelefone(a)))}${campoFicha("E-mail", alunoEmail(a))}${campoFicha("Plano", alunoPlano(a))}${campoFicha("Professor", a.professor_responsavel || "")}${campoFicha("Status", alunoStatus(a))}${campoFicha("Matrícula", a.data_matricula || "")}
  </div></div>
  <h2>Dados médicos</h2><div class="box"><div class="grid">${campoFicha("Tipo sanguíneo", a.tipo_sanguineo || "")}${campoFicha("Peso", a.peso || "")}${campoFicha("Altura", a.altura || "")}${campoFicha("Objetivo", a.objetivo || "")}</div><p><b>Alergias:</b> ${escapeHtml(a.alergias || "")}</p><p><b>Restrições:</b> ${escapeHtml(a.restricoes_medicas || "")}</p><p><b>Observações:</b> ${escapeHtml(a.observacoes || "")}</p></div>
  <h2>Histórico local</h2><div class="box">${hist.length ? hist.map(x => `<div class="hist"><b>${escapeHtml(rotuloHistorico(x.tipo))}</b><br>${escapeHtml(x.descricao)}<br><small>${escapeHtml(formatarDataHora(x.data))}</small></div>`).join("") : "Nenhum histórico local registrado."}</div>
  <script>window.print();</script></body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return mostrarAlerta("O navegador bloqueou a janela de impressão.", "erro");
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function campoFicha(label, valor) {
  return `<div><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(valor)}</div></div>`;
}

function formatarDataHora(d) {
  try { return new Date(d).toLocaleString("pt-BR"); }
  catch { return d || ""; }
}

async function safeJson(resp) {
  try { return await resp.json(); }
  catch { return {}; }
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(v) {
  return escapeHtml(v).replaceAll("`", "&#096;");
}


// Fusion ERP 2.9.3 — Mobile First Alunos
const ALUNO_WIZARD_STEPS = ["cadastro", "medico", "historico", "matriculas", "integracoes"];

function passoAtualAlunoMobile() {
  const ativo = document.querySelector(".tab.active")?.dataset?.tab || "cadastro";
  return Math.max(0, ALUNO_WIZARD_STEPS.indexOf(ativo));
}

function moverPassoAlunoMobile(delta) {
  const atual = passoAtualAlunoMobile();
  const proximo = Math.max(0, Math.min(ALUNO_WIZARD_STEPS.length - 1, atual + delta));
  trocarTab(ALUNO_WIZARD_STEPS[proximo]);
}

function atualizarWizardAlunoMobile() {
  const atual = passoAtualAlunoMobile();
  const anterior = document.getElementById("btnAlunoStepAnterior");
  const proximo = document.getElementById("btnAlunoStepProximo");
  const salvar = document.getElementById("btnSalvarAluno");
  const titulo = document.getElementById("modalTitulo");
  if (anterior) anterior.disabled = atual <= 0;
  if (proximo) proximo.textContent = atual >= ALUNO_WIZARD_STEPS.length - 1 ? "Revisar" : "Próximo";
  if (salvar) salvar.classList.toggle("salvar-final", atual >= ALUNO_WIZARD_STEPS.length - 1);
  if (titulo) titulo.dataset.step = `${atual + 1} de ${ALUNO_WIZARD_STEPS.length}`;
}

function prepararAlunosMobile() {
  document.body.classList.add("alunos-mobile-ready");

  const actions = document.querySelector(".modal-actions");
  if (actions && !document.getElementById("btnAlunoStepAnterior")) {
    const anterior = document.createElement("button");
    anterior.type = "button";
    anterior.id = "btnAlunoStepAnterior";
    anterior.className = "btn-light aluno-step-btn";
    anterior.textContent = "Anterior";
    anterior.addEventListener("click", () => moverPassoAlunoMobile(-1));

    const proximo = document.createElement("button");
    proximo.type = "button";
    proximo.id = "btnAlunoStepProximo";
    proximo.className = "fusion-button aluno-step-btn aluno-step-next";
    proximo.textContent = "Próximo";
    proximo.addEventListener("click", () => moverPassoAlunoMobile(1));

    const cancelar = document.getElementById("btnCancelar");
    actions.insertBefore(anterior, cancelar || actions.firstChild);
    actions.insertBefore(proximo, document.getElementById("btnSalvarAluno"));
  }

  document.querySelectorAll("[data-alunos-action]").forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const act = btn.dataset.alunosAction;
      if (act === "home") location.href = "/pages/dashboard/index.html";
      if (act === "buscar") document.getElementById("buscaAluno")?.focus();
      if (act === "novo") abrirNovoAluno();
      if (act === "topo") window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  atualizarWizardAlunoMobile();
}

document.addEventListener("DOMContentLoaded", async () => {
  prepararAlunosMobile();
  $("#btnNovoAluno").addEventListener("click", abrirNovoAluno);
  $("#btnAtualizar").addEventListener("click", async () => { await carregarPlanos(); await carregarAlunos(); });
  $("#btnFecharModal").addEventListener("click", fecharModal);
  $("#btnCancelar").addEventListener("click", fecharModal);
  $("#btnFicha").addEventListener("click", imprimirFichaAtual);
  $("#formAluno").addEventListener("submit", salvarAluno);
  $("#foto_base64").addEventListener("change", processarFoto);
  $("#btnRecarregarPlanos").addEventListener("click", () => carregarPlanos($("#plano").value));

  $("#btnAddHistorico").addEventListener("click", adicionarHistoricoManual);
  $("#btnLimparHistorico").addEventListener("click", limparHistoricoLocal);
  $("#btnNovaMatriculaAluno")?.addEventListener("click", abrirMatriculaDoModal);
  $("#btnAbrirMatriculaAtiva")?.addEventListener("click", abrirMatriculaAtivaDoAluno);
  $("#btnAtualizarMatriculasAluno")?.addEventListener("click", atualizarMatriculasAlunoAtual);

  $("#btnAbrirAvaliacoes").addEventListener("click", () => abrirIntegracao("avaliacoes"));
  $("#btnAbrirMensalidades").addEventListener("click", () => abrirIntegracao("mensalidades"));
  $("#btnAbrirCheckin").addEventListener("click", () => abrirIntegracao("checkin"));

  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => { trocarTab(btn.dataset.tab); if (btn.dataset.tab === "matriculas") atualizarMatriculasAlunoAtual(); }));

  $("#cpf").addEventListener("input", e => e.target.value = formatarCpfVisual(e.target.value));
  $("#telefone").addEventListener("input", e => e.target.value = formatarTelefoneVisual(e.target.value));
  $("#whatsapp").addEventListener("input", e => e.target.value = formatarTelefoneVisual(e.target.value));

  $("#buscaAluno").addEventListener("input", () => { pagina = 1; renderizarTabela(); });
  $("#filtroStatus").addEventListener("change", () => { pagina = 1; renderizarTabela(); });
  $("#filtroPlano").addEventListener("change", () => { pagina = 1; renderizarTabela(); });

  $("#btnAnterior").addEventListener("click", () => { if (pagina > 1) { pagina--; renderizarTabela(); } });
  $("#btnProxima").addEventListener("click", () => {
    const total = Math.max(Math.ceil(alunosFiltrados().length / porPagina), 1);
    if (pagina < total) { pagina++; renderizarTabela(); }
  });

  $("#modalAluno").addEventListener("click", e => { if (e.target.id === "modalAluno") fecharModal(); });

  await carregarPlanos();
  await carregarAlunos();
});


function inicializarPainelComercialMatricula() {
  const ids = ["plano", "cobrar_taxa_matricula", "valor_taxa_matricula", "desconto_matricula"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.painelComercialOk) return;
    el.dataset.painelComercialOk = "1";
    const evento = id === "plano" || id === "cobrar_taxa_matricula" ? "change" : "input";
    el.addEventListener(evento, () => {
      if (id === "valor_taxa_matricula") el.dataset.editado = "1";
      atualizarPainelComercialMatricula();
    });
  });
  atualizarPainelComercialMatricula();
}

setTimeout(inicializarPainelComercialMatricula, 0);

// Fusion ERP 2.8.0 — Biometria Futronic integrada ao cadastro do aluno
(() => {
  const API_BIOMETRIA = "/api/biometria";
  const estado = { ocupada: false };
  const el = (id) => document.getElementById(id);

  async function bioApi(caminho, opcoes = {}) {
    const resposta = await fetch(`${API_BIOMETRIA}${caminho}`, {
      ...opcoes,
      headers: { "Content-Type": "application/json", ...(opcoes.headers || {}) }
    });
    const json = await resposta.json().catch(() => ({}));
    if (!resposta.ok || json.ok === false) throw new Error(json.mensagem || `Erro HTTP ${resposta.status}`);
    return json;
  }

  function alunoAtual() {
    return { id: String(el("alunoId")?.value || "").trim(), nome: String(el("nome")?.value || "").trim() };
  }

  function mensagem(texto, tipo = "") {
    const box = el("biometriaMensagem");
    if (!box) return;
    box.textContent = texto;
    box.className = `biometria-mensagem ${tipo}`.trim();
  }

  function atualizarVinculo() {
    const aluno = alunoAtual();
    if (el("biometriaAlunoNome")) el("biometriaAlunoNome").textContent = aluno.nome || "Aluno ainda não salvo";
    if (el("biometriaAlunoId")) el("biometriaAlunoId").textContent = aluno.id || "Salve o aluno primeiro";
    return aluno;
  }

  function renderAmostras(concluidas = false, qualidade = 0) {
    document.querySelectorAll("#biometriaCapturas [data-captura]").forEach((card, indice) => {
      card.classList.toggle("aceita", concluidas);
      card.classList.remove("rejeitada");
      const strong = card.querySelector("strong");
      if (strong) strong.textContent = concluidas ? `${qualidade}% — aceita` : "Aguardando";
    });
    const salvar = el("btnBiometriaSalvar");
    if (salvar) { salvar.disabled = true; salvar.textContent = "Salvo automaticamente"; }
  }

  async function testarLeitor() {
    try {
      const r = await bioApi("/status");
      const local = r.local || {};
      const conectado = local.conectado !== false && local.ok !== false;
      if (el("biometriaLeitor")) el("biometriaLeitor").textContent = conectado ? "Conectado" : "Desconectado";
      mensagem(conectado ? `Futronic conectada (${local.largura || 320}×${local.altura || 480}).` : "Leitor Futronic não conectado.", conectado ? "sucesso" : "erro");
      return conectado;
    } catch (e) {
      if (el("biometriaLeitor")) el("biometriaLeitor").textContent = "Indisponível";
      mensagem(e.message, "erro");
      return false;
    }
  }

  async function carregarCadastro() {
    const aluno = atualizarVinculo();
    renderAmostras(false);
    if (!aluno.id) {
      if (el("biometriaStatus")) el("biometriaStatus").textContent = "Salve o aluno primeiro";
      if (el("btnBiometriaApagar")) el("btnBiometriaApagar").disabled = true;
      return;
    }
    try {
      const r = await bioApi(`/aluno/${encodeURIComponent(aluno.id)}`);
      const bio = r.biometria;
      if (el("biometriaStatus")) el("biometriaStatus").textContent = bio ? `Cadastrada — qualidade ${bio.qualidadeMedia || bio.qualidade || 0}%` : "Não cadastrada";
      if (el("btnBiometriaApagar")) el("btnBiometriaApagar").disabled = !bio;
      if (bio) renderAmostras(true, bio.qualidadeMedia || bio.qualidade || 0);
    } catch (e) { mensagem(e.message, "erro"); }
  }

  async function abrirAba() {
    atualizarVinculo();
    await testarLeitor();
    await carregarCadastro();
  }

  async function cadastrar() {
    if (estado.ocupada) return;
    const aluno = atualizarVinculo();
    if (!aluno.id) return mensagem("Salve o aluno antes de cadastrar a biometria.", "erro");
    estado.ocupada = true;
    const botao = el("btnBiometriaCapturar");
    if (botao) { botao.disabled = true; botao.textContent = "Aguardando as 3 amostras..."; }
    renderAmostras(false);
    mensagem("Coloque o mesmo dedo no leitor. O SDK solicitará três amostras; retire e recoloque quando indicado.");
    try {
      const r = await bioApi("/sdk/cadastrar", {
        method: "POST",
        body: JSON.stringify({ alunoId: aluno.id, alunoNome: aluno.nome })
      });
      const bio = r.biometria || {};
      renderAmostras(true, bio.qualidadeMedia || bio.qualidade || 0);
      mensagem(r.mensagem || "Biometria cadastrada e vinculada ao aluno.", "sucesso");
      await carregarCadastro();
      if (typeof carregarAlunos === "function") await carregarAlunos();
    } catch (e) {
      renderAmostras(false);
      mensagem(e.message, "erro");
    } finally {
      estado.ocupada = false;
      if (botao) { botao.disabled = false; botao.textContent = "Cadastrar biometria"; }
    }
  }

  async function apagar() {
    const aluno = alunoAtual();
    if (!aluno.id || !confirm(`Apagar definitivamente a biometria de ${aluno.nome || "este aluno"}?`)) return;
    try {
      await bioApi(`/aluno/${encodeURIComponent(aluno.id)}`, { method: "DELETE" });
      renderAmostras(false);
      mensagem("Biometria apagada.", "sucesso");
      await carregarCadastro();
      if (typeof carregarAlunos === "function") await carregarAlunos();
    } catch (e) { mensagem(e.message, "erro"); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    el("btnBiometriaTestar")?.addEventListener("click", testarLeitor);
    el("btnBiometriaCapturar")?.addEventListener("click", cadastrar);
    el("btnBiometriaSalvar")?.addEventListener("click", cadastrar);
    el("btnBiometriaRepetir")?.addEventListener("click", cadastrar);
    el("btnBiometriaApagar")?.addEventListener("click", apagar);
    document.querySelector('[data-tab="biometria"]')?.addEventListener("click", abrirAba);
  });
})();
