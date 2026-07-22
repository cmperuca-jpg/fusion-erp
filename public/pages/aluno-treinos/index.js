const $ = (id) => document.getElementById(id);

const fotoFallback = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='420'><rect width='100%' height='100%' fill='#edf2f7'/><text x='50%' y='50%' text-anchor='middle' font-size='28' fill='#64748b'>Exercício</text></svg>`);
const fotoAlunoFallback = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><rect width='100%' height='100%' rx='90' fill='#e8eef8'/><text x='50%' y='54%' text-anchor='middle' font-size='24' font-family='Arial' font-weight='700' fill='#64748b'>Aluno</text></svg>`);

let alunoDetalhe = null;
let matriculaAlunoDetalhe = null;
let professoresPortal = [];
let treinoAtual = null;
let divisaoAtual = 0;
let exercicioAtual = 0;
let installPrompt = null;
let touchStartX = 0;
let touchStartY = 0;
let controleCatracaAtual = null;

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function sessaoAluno() {
  try {
    const sessao = JSON.parse(localStorage.getItem("fusion_aluno_treino_login") || "null");
    if (sessao?.alunoId) return sessao;
  } catch {}

  const params = new URLSearchParams(location.search);
  const alunoId = params.get("alunoId") || params.get("id");
  const alunoNome = params.get("alunoNome") || params.get("nome") || "Aluno";
  if (alunoId) return { alunoId, alunoNome };
  return null;
}

function exigirLogin() {
  const sessao = sessaoAluno();
  if (!sessao?.alunoId) {
    location.replace("/pages/aluno-login/index.html");
    return null;
  }
  return sessao;
}

function dataBR(valor) {
  if (!valor) return "-";
  const s = String(valor).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function dataISO(valor) {
  if (!valor) return "";
  const s = String(valor).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return "";
}

function somarDias(iso, dias) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function estaVencido(iso) {
  if (!iso) return false;
  return iso < new Date().toISOString().slice(0, 10);
}

function moeda(v) {
  const n = Number(String(v ?? 0).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function extrairLista(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.alunos)) return payload.alunos;
  if (Array.isArray(payload.professores)) return payload.professores;
  if (Array.isArray(payload.avaliacoes)) return payload.avaliacoes;
  if (Array.isArray(payload.mensalidades)) return payload.mensalidades;
  if (Array.isArray(payload.pagamentos)) return payload.pagamentos;
  if (Array.isArray(payload.dados)) return payload.dados;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.itens)) return payload.itens;
  if (Array.isArray(payload.registros)) return payload.registros;
  if (Array.isArray(payload.lancamentos)) return payload.lancamentos;
  return [];
}

function idAlunoRegistro(a) {
  return String(a?.id ?? a?._id ?? a?.codigo ?? a?.alunoId ?? a?.aluno_id ?? a?.matricula ?? "");
}

function nomeAlunoRegistro(a) {
  return a?.nome || a?.nomeCompleto || a?.alunoNome || a?.aluno || a?.name || "Aluno";
}

function fotoAlunoRegistro(a) {
  return a?.foto_base64 || a?.foto || a?.fotoBase64 || a?.avatar || a?.imagem || "";
}

async function safeFetchJson(url) {
  try {
    const resp = await fetch(url, { cache: "no-store" });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) return null;
    return json;
  } catch {
    return null;
  }
}

async function carregarAlunoDetalhe(sessao) {
  if (!sessao?.alunoId) return null;
  const direto = await safeFetchJson(`/api/alunos/${encodeURIComponent(sessao.alunoId)}`);
  if (direto) return direto.aluno || direto.dados || direto.data || direto;

  const listaPayload = await safeFetchJson("/api/alunos");
  const lista = extrairLista(listaPayload || {});
  return lista.find((a) => idAlunoRegistro(a) === String(sessao.alunoId)) || null;
}

async function carregarMatriculaAluno(sessao) {
  if (!sessao?.alunoId) return null;
  const prontuario = await safeFetchJson(`/api/alunos/${encodeURIComponent(sessao.alunoId)}/prontuario`);
  const matriculas = Array.isArray(prontuario?.matriculas) ? prontuario.matriculas : [];
  return matriculas.find((matricula) => ["ativa", "ativo"].includes(String(matricula?.status || "").trim().toLowerCase()))
    || matriculas[0]
    || null;
}

async function carregarProfessoresPortal() {
  const payload = await safeFetchJson("/api/professores");
  return extrairLista(payload || {});
}

function nomeProfessorValido(...valores) {
  for (const valor of valores.flat(Infinity)) {
    const nome = String(valor || "").trim();
    const normalizado = nome.toLowerCase();
    if (!nome || ["-", "todos", "todas", "sem professor", "nao informado", "não informado"].includes(normalizado)) continue;
    return nome;
  }
  return "";
}

function professorResponsavelPortal() {
  const servicos = [
    ...(Array.isArray(matriculaAlunoDetalhe?.servicos) ? matriculaAlunoDetalhe.servicos : []),
    ...(Array.isArray(matriculaAlunoDetalhe?.turmas) ? matriculaAlunoDetalhe.turmas : [])
  ];
  const nomeExplicito = nomeProfessorValido(
    treinoAtual?.professorNome,
    treinoAtual?.professor,
    alunoDetalhe?.professorNome,
    alunoDetalhe?.professor_responsavel,
    alunoDetalhe?.professorResponsavel,
    alunoDetalhe?.professor,
    matriculaAlunoDetalhe?.professorNome,
    matriculaAlunoDetalhe?.professor_responsavel,
    matriculaAlunoDetalhe?.professorResponsavel,
    matriculaAlunoDetalhe?.professor,
    servicos.map((servico) => servico?.professorNome || servico?.professor_responsavel || servico?.professorResponsavel || servico?.professor)
  );
  if (nomeExplicito) return nomeExplicito;

  const idsVinculados = nomeProfessorValido(
    treinoAtual?.professorId,
    treinoAtual?.professor_id,
    alunoDetalhe?.professorId,
    alunoDetalhe?.professor_id,
    matriculaAlunoDetalhe?.professorId,
    matriculaAlunoDetalhe?.professor_id,
    servicos.map((servico) => servico?.professorId || servico?.professor_id)
  );
  if (idsVinculados) {
    const cadastrado = professoresPortal.find((professor) => String(
      professor?.id || professor?._id || professor?.professorId || professor?.professor_id || ""
    ) === String(idsVinculados));
    const nomeCadastrado = nomeProfessorValido(cadastrado?.nome, cadastrado?.professorNome, cadastrado?.professor);
    if (nomeCadastrado) return nomeCadastrado;
  }

  // Sem professor individual, exibe somente o responsável técnico oficial.
  // Não escolhe um professor comum ao acaso.
  const responsavelTecnico = professoresPortal.find((professor) => {
    const perfil = String(professor?.perfil || professor?.tipoPerfil || professor?.funcao || "").trim().toLowerCase();
    const ativo = !["inativo", "inativa", "bloqueado", "bloqueada", "cancelado", "cancelada"].includes(
      String(professor?.status || "ativo").trim().toLowerCase()
    );
    return ativo && (professor?.acessoTodosAlunos === true || ["responsavel_tecnico", "responsavel-tecnico"].includes(perfil));
  });
  return nomeProfessorValido(responsavelTecnico?.nome, responsavelTecnico?.professorNome, responsavelTecnico?.professor);
}

function renderFotoAluno() {
  const img = $("fotoAluno");
  const foto = fotoAlunoRegistro(alunoDetalhe);
  img.src = foto || fotoAlunoFallback;
  img.onerror = () => { img.src = fotoAlunoFallback; };
}

function setTexto(id, valor, padrao = "-") {
  const el = $(id);
  if (el) el.textContent = valor || padrao;
}

function atualizarContadorCatraca(controle = null) {
  if (!controle) return;
  controleCatracaAtual = controle;

  const limite = Number(controle.limite ?? controle.limiteDiario ?? 3);
  const usados = Number(controle.usados ?? controle.acessosUsadosHoje ?? 0);
  const restantesBruto = controle.restantes ?? controle.acessosRestantesHoje;
  const restantes = restantesBruto === null || restantesBruto === undefined
    ? null
    : Number(restantesBruto);
  const ilimitado = !(limite > 0);
  const atingiuLimite = !ilimitado && (controle.limiteAtingido || usados >= limite || restantes <= 0);

  setTexto("acessosCatraca", ilimitado ? `${usados}` : `${usados} / ${limite}`);

  const status = $("statusAcessosCatraca");
  if (status) {
    status.textContent = ilimitado
      ? "Sem limite diario"
      : (atingiuLimite ? "Limite atingido" : `${Math.max(0, limite - usados)} restante(s)`);
    status.classList.toggle("vencido", Boolean(atingiuLimite));
  }

  const botao = $("btnLiberarCatraca");
  if (botao) botao.disabled = Boolean(atingiuLimite);
}

async function carregarContadorCatraca(sessao) {
  if (!sessao?.alunoId || !sessao?.token) {
    atualizarContadorCatraca({ limite: 3, usados: 0, restantes: 3, limiteAtingido: false });
    return;
  }

  const url = `/api/treinos/aluno-catraca-contador?alunoId=${encodeURIComponent(sessao.alunoId)}&token=${encodeURIComponent(sessao.token)}`;
  const payload = await safeFetchJson(url);
  const dados = payload?.dados || payload;
  if (dados) atualizarContadorCatraca(dados);
}

function chaveConclusao() {
  const d = treinoAtual?.divisoes?.[divisaoAtual];
  return `${treinoAtual?.id || "treino"}_${d?.nome || divisaoAtual}_${exercicioAtual}`;
}

function storageKey() {
  const sessao = sessaoAluno();
  return `fusion_treino_concluidos_${sessao?.alunoId || "aluno"}`;
}

function concluidos() {
  try { return JSON.parse(localStorage.getItem(storageKey()) || "{}"); }
  catch { return {}; }
}

function estaConcluido() {
  return Boolean(concluidos()[chaveConclusao()]);
}

function marcarConcluido(checked) {
  const dados = concluidos();
  dados[chaveConclusao()] = checked;
  localStorage.setItem(storageKey(), JSON.stringify(dados));
}

function divisoesValidas(treino) {
  return (treino?.divisoes || []).filter((d) => Array.isArray(d.itens) && d.itens.length);
}

function exerciciosDaDivisao() {
  const divisao = divisoesValidas(treinoAtual)[divisaoAtual];
  return divisao?.itens || [];
}

function renderCabecalho() {
  const nomeAluno = nomeAlunoRegistro(alunoDetalhe) || treinoAtual?.alunoNome || sessaoAluno()?.alunoNome;
  const professor = professorResponsavelPortal();
  setTexto("alunoNomeTitulo", nomeAluno);
  setTexto("professorNome", professor);
  setTexto("objetivoTreino", treinoAtual?.objetivo);
  setTexto("validadeTreino", dataBR(treinoAtual?.validade));
  $("subtituloAluno").textContent = `Professor: ${professor || "não informado"}`;
  renderFotoAluno();
}

function renderTabs() {
  const divisoes = divisoesValidas(treinoAtual);
  $("tabsDivisoes").innerHTML = divisoes.map((d, idx) => `
    <button type="button" class="tab-divisao ${idx === divisaoAtual ? "active" : ""}" data-divisao="${idx}">
      ${esc(d.nome || String.fromCharCode(65 + idx))}
    </button>
  `).join("");

  document.querySelectorAll("[data-divisao]").forEach((btn) => {
    btn.onclick = () => {
      divisaoAtual = Number(btn.dataset.divisao);
      exercicioAtual = 0;
      renderTudo();
    };
  });
}

function renderExercicio() {
  const exercicios = exerciciosDaDivisao();
  const ex = exercicios[exercicioAtual];

  if (!ex) {
    $("cardExercicio").classList.add("hidden");
    return;
  }

  $("semTreino").classList.add("hidden");
  $("cardExercicio").classList.remove("hidden");

  setTexto("contadorExercicio", `${exercicioAtual + 1} / ${exercicios.length}`);
  setTexto("nomeExercicio", ex.nome || "Exercício");
  setTexto("seriesExercicio", ex.series);
  setTexto("repsExercicio", ex.repeticoes);
  setTexto("cargaExercicio", ex.carga);
  setTexto("descansoExercicio", ex.descanso);
  setTexto("metodoExercicio", ex.metodo || "Convencional");
  setTexto("cadenciaExercicio", ex.cadencia);
  setTexto("descricaoExercicio", ex.descricao, "Sem descrição cadastrada.");
  setTexto("obsExercicio", ex.obs, "Sem observação.");

  const foto = ex.foto || ex.gif || "";
  $("fotoExercicio").src = foto || fotoFallback;
  $("fotoExercicio").onerror = () => { $("fotoExercicio").src = fotoFallback; };

  $("checkConcluido").checked = estaConcluido();
  $("anterior").disabled = exercicios.length <= 1;
  $("proximo").disabled = exercicios.length <= 1;
}

function renderTudo() {
  // O professor pertence ao aluno/matrícula e deve aparecer mesmo quando o
  // primeiro treino ainda não foi prescrito.
  renderCabecalho();
  if (!treinoAtual || !divisoesValidas(treinoAtual).length) {
    $("semTreino").classList.remove("hidden");
    $("cardExercicio").classList.add("hidden");
    $("tabsDivisoes").innerHTML = "";
    return;
  }
  renderTabs();
  renderExercicio();
}

async function carregarAvaliacoes(sessao) {
  const payload = await safeFetchJson(`/api/avaliacoes?alunoId=${encodeURIComponent(sessao.alunoId)}`)
    || await safeFetchJson(`/api/avaliacoes?aluno_id=${encodeURIComponent(sessao.alunoId)}`);
  const lista = extrairLista(payload || {}).sort((a, b) => String(b.data || b.criado_em || b.criadoEm || "").localeCompare(String(a.data || a.criado_em || a.criadoEm || "")));
  const ultima = lista[0];
  const ultimaData = dataISO(ultima?.data || ultima?.criado_em || ultima?.criadoEm);
  const proxima = ultimaData ? somarDias(ultimaData, 30) : "";
  setTexto("proximaAvaliacao", proxima ? dataBR(proxima) : "Sem avaliação");

  const status = $("statusAvaliacao");
  const alerta = $("alertaAvaliacao");
  if (!ultimaData) {
    status.textContent = "Agendar avaliação";
    alerta.textContent = "Você ainda não possui avaliação física registrada. Solicite uma avaliação ao professor.";
    alerta.classList.remove("hidden");
    return;
  }
  if (estaVencido(proxima)) {
    status.textContent = "Vencida";
    status.classList.add("vencido");
    alerta.textContent = "Sua avaliação física venceu. Solicite uma nova avaliação ao professor.";
    alerta.classList.remove("hidden");
  } else {
    status.textContent = `Última: ${dataBR(ultimaData)}`;
    status.classList.remove("vencido");
    alerta.classList.add("hidden");
  }
}

function dataPagamento(item) {
  return dataISO(item.vencimento || item.dataVencimento || item.data_vencimento || item.data || item.competencia);
}

function valorPagamento(item) {
  return item.valor ?? item.total ?? item.valorTotal ?? item.valorLiquido ?? item.valorMensal ?? item.valor_pago ?? item.valorPago;
}

function statusPagamento(item) {
  return String(item.statusPagamento || item.status || item.situacao || "").toLowerCase();
}

async function carregarPagamentos(sessao) {
  const urls = [
    `/api/mensalidades?alunoId=${encodeURIComponent(sessao.alunoId)}`,
    `/api/mensalidades?aluno_id=${encodeURIComponent(sessao.alunoId)}`,
    `/api/financeiro?alunoId=${encodeURIComponent(sessao.alunoId)}`,
    `/api/pagamentos?alunoId=${encodeURIComponent(sessao.alunoId)}`
  ];
  let lista = [];
  for (const url of urls) {
    const payload = await safeFetchJson(url);
    lista = extrairLista(payload || {});
    if (lista.length) break;
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const abertos = lista
    .filter((p) => !["pago", "recebido", "baixado", "cancelado"].includes(statusPagamento(p)))
    .filter((p) => dataPagamento(p))
    .sort((a, b) => dataPagamento(a).localeCompare(dataPagamento(b)));
  const proximo = abertos.find((p) => dataPagamento(p) >= hoje) || abertos[0];

  const data = dataPagamento(proximo);
  const valor = moeda(valorPagamento(proximo));
  setTexto("proximoPagamento", data ? `${dataBR(data)}${valor ? " · " + valor : ""}` : "Não localizado");

  const st = $("statusPagamento");
  const alerta = $("alertaPagamento");
  if (data && estaVencido(data)) {
    st.textContent = "Em atraso";
    st.classList.add("vencido");
    alerta.textContent = "Existe pagamento em atraso. Procure a recepção da academia.";
    alerta.classList.remove("hidden");
  } else {
    st.textContent = data ? "Em aberto" : "";
    st.classList.remove("vencido");
    alerta.classList.add("hidden");
  }
}

async function carregar() {
  const sessao = exigirLogin();
  if (!sessao) return;

  const [alunoCarregado, matriculaCarregada, professoresCarregados] = await Promise.all([
    carregarAlunoDetalhe(sessao),
    carregarMatriculaAluno(sessao),
    carregarProfessoresPortal()
  ]);
  alunoDetalhe = alunoCarregado;
  matriculaAlunoDetalhe = matriculaCarregada;
  professoresPortal = professoresCarregados;
  setTexto("alunoNomeTitulo", nomeAlunoRegistro(alunoDetalhe) || sessao.alunoNome || "Aluno");
  renderFotoAluno();

  const resp = await fetch(`/api/treinos?alunoId=${encodeURIComponent(sessao.alunoId)}`, { cache: "no-store" });
  const json = await resp.json().catch(() => ({}));
  const treinos = Array.isArray(json.dados) ? json.dados : [];
  treinoAtual = treinos.find((t) => t.ativo !== false) || treinos[0] || null;
  divisaoAtual = 0;
  exercicioAtual = 0;
  renderTudo();
  carregarAvaliacoes(sessao);
  carregarPagamentos(sessao);
  carregarContadorCatraca(sessao);
}

function proximo() {
  const total = exerciciosDaDivisao().length;
  if (!total) return;
  exercicioAtual = (exercicioAtual + 1) % total;
  renderExercicio();
}

function anterior() {
  const total = exerciciosDaDivisao().length;
  if (!total) return;
  exercicioAtual = (exercicioAtual - 1 + total) % total;
  renderExercicio();
}

function proximaDivisao() {
  const total = divisoesValidas(treinoAtual).length;
  if (!total) return;
  divisaoAtual = (divisaoAtual + 1) % total;
  exercicioAtual = 0;
  renderTudo();
}

function divisaoAnterior() {
  const total = divisoesValidas(treinoAtual).length;
  if (!total) return;
  divisaoAtual = (divisaoAtual - 1 + total) % total;
  exercicioAtual = 0;
  renderTudo();
}

function abrirAvaliacao() {
  const sessao = sessaoAluno();
  if (!sessao?.alunoId) return;

  location.href =
    `/pages/aluno-avaliacao/index.html?alunoId=${encodeURIComponent(sessao.alunoId)}`;
}

function mostrarStatusCatraca(mensagem, tipo = "info") {
  const box = $("statusCatraca");
  if (!box) return;
  box.textContent = mensagem;
  box.dataset.tipo = tipo;
  box.classList.remove("hidden");
}

async function liberarCatracaPortal() {
  const sessao = exigirLogin();
  if (!sessao) return;

  if (!sessao.token) {
    mostrarStatusCatraca("Faca login novamente para liberar a catraca.", "erro");
    return;
  }

  const botao = $("btnLiberarCatraca");
  botao.disabled = true;
  mostrarStatusCatraca("Liberando catraca...", "info");

  try {
    const resp = await fetch("/api/treinos/aluno-liberar-catraca", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alunoId: sessao.alunoId,
        token: sessao.token,
        direcao: "entrada"
      })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || "Nao foi possivel liberar a catraca.");

    const dados = json.dados || {};
    if (dados.controleAcessos) atualizarContadorCatraca(dados.controleAcessos);
    if (dados.autorizado) {
      const limite = dados.limiteDiario || dados.controleAcessos?.limite || 3;
      const usados = dados.acessosUsadosHoje ?? dados.controleAcessos?.usados;
      const detalhe = limite > 0 && usados !== undefined ? ` (${usados}/${limite} hoje)` : "";
      mostrarStatusCatraca(`Acesso liberado. Pode passar.${detalhe}`, "sucesso");
    } else {
      mostrarStatusCatraca(`Acesso bloqueado: ${dados.motivo || "verifique a recepcao."}`, "erro");
    }
  } catch (erro) {
    mostrarStatusCatraca(erro.message || "Nao foi possivel liberar a catraca.", "erro");
  } finally {
    botao.disabled = Boolean(controleCatracaAtual?.limiteAtingido);
  }
}

window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  installPrompt = ev;
  $("btnInstalar").classList.remove("hidden");
});

$("btnInstalar").onclick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => null);
  installPrompt = null;
  $("btnInstalar").classList.add("hidden");
};

$("proximo").onclick = proximo;
$("anterior").onclick = anterior;
$("atualizar").onclick = carregar;
$("btnAvaliacao").onclick = abrirAvaliacao;
$("btnLiberarCatraca").onclick = liberarCatracaPortal;
$("checkConcluido").onchange = () => marcarConcluido($("checkConcluido").checked);
$("sair").onclick = () => {
  localStorage.removeItem("fusion_aluno_treino_login");
  location.replace("/pages/aluno-login/index.html");
};

document.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowRight") proximo();
  if (ev.key === "ArrowLeft") anterior();
});

const areaSwipe = $("areaSwipe");
areaSwipe.addEventListener("touchstart", (ev) => {
  const t = ev.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });
areaSwipe.addEventListener("touchend", (ev) => {
  const t = ev.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  // Portal do Aluno: troca de A/B/C somente por clique nos botões.
  // O swipe vertical foi removido porque, no celular, a rolagem da página
  // mudava a divisão sozinha de A para B/C.
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 45) {
    dx < 0 ? proximo() : anterior();
  }
}, { passive: true });

carregar();
