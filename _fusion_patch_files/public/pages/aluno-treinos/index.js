const $ = (id) => document.getElementById(id);

const fotoFallback = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='420'><rect width='100%' height='100%' fill='#edf2f7'/><text x='50%' y='50%' text-anchor='middle' font-size='28' fill='#64748b'>Exercício</text></svg>`);

let treinoAtual = null;
let divisaoAtual = 0;
let exercicioAtual = 0;
let installPrompt = null;
let touchStartX = 0;
let touchStartY = 0;

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

function setTexto(id, valor, padrao = "-") {
  const el = $(id);
  if (el) el.textContent = valor || padrao;
}

function dataBR(valor) {
  if (!valor) return "-";
  const s = String(valor).slice(0, 10);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
}

function toDate(valor) {
  if (!valor) return null;
  const s = String(valor).slice(0, 10);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDias(data, dias) {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

function isoDate(data) {
  if (!data) return "";
  return data.toISOString().slice(0, 10);
}

function moeda(valor) {
  const numero = Number(String(valor ?? 0).replace(",", "."));
  if (!Number.isFinite(numero)) return "-";
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function extrairLista(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.dados)) return payload.dados;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.itens)) return payload.itens;
  if (Array.isArray(payload?.registros)) return payload.registros;
  if (Array.isArray(payload?.mensalidades)) return payload.mensalidades;
  if (Array.isArray(payload?.avaliacoes)) return payload.avaliacoes;
  return [];
}

async function fetchLista(url) {
  try {
    const resp = await fetch(url, { cache: "no-store" });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) return [];
    return extrairLista(json);
  } catch {
    return [];
  }
}

function renderCabecalho() {
  setTexto("alunoNome", treinoAtual?.alunoNome || sessaoAluno()?.alunoNome);
  setTexto("professorNome", treinoAtual?.professorNome);
  setTexto("objetivoTreino", treinoAtual?.objetivo);
  setTexto("validadeTreino", dataBR(treinoAtual?.validade));
  $("subtituloAluno").textContent = `Treino prescrito para ${treinoAtual?.alunoNome || sessaoAluno()?.alunoNome || "aluno"}.`;
}

function renderTabs() {
  const divisoes = divisoesValidas(treinoAtual);
  $("tabsDivisoes").innerHTML = divisoes.map((d, idx) => `
    <button type="button" class="tab-divisao ${idx === divisaoAtual ? "active" : ""}" data-divisao="${idx}">
      Treino ${esc(d.nome || String.fromCharCode(65 + idx))}
      <small>${(d.itens || []).length}</small>
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
  setTexto("grupoMuscular", [ex.grupo, ex.musculos].filter(Boolean).join(" · "));
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
  if (!treinoAtual || !divisoesValidas(treinoAtual).length) {
    $("semTreino").classList.remove("hidden");
    $("cardExercicio").classList.add("hidden");
    $("tabsDivisoes").innerHTML = "";
    return;
  }
  if (divisaoAtual >= divisoesValidas(treinoAtual).length) divisaoAtual = 0;
  if (exercicioAtual >= exerciciosDaDivisao().length) exercicioAtual = 0;
  renderCabecalho();
  renderTabs();
  renderExercicio();
}

async function carregarPagamento(alunoId) {
  setTexto("proximoPagamento", "Carregando...");
  setTexto("statusPagamento", "");
  const urls = [
    `/api/mensalidades?alunoId=${encodeURIComponent(alunoId)}`,
    `/api/mensalidades?aluno_id=${encodeURIComponent(alunoId)}`,
    `/api/financeiro/mensalidades?alunoId=${encodeURIComponent(alunoId)}`,
    `/api/financeiro?alunoId=${encodeURIComponent(alunoId)}`
  ];
  let lista = [];
  for (const url of urls) {
    lista = await fetchLista(url);
    if (lista.length) break;
  }

  if (!lista.length) {
    setTexto("proximoPagamento", "Não localizado");
    setTexto("statusPagamento", "");
    return;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const pendentes = lista.map((m) => {
    const vencimento = m.vencimento || m.dataVencimento || m.data_vencimento || m.data || m.competencia;
    return { ...m, _data: toDate(vencimento), _status: String(m.status || m.situacao || "").toLowerCase() };
  }).filter((m) => m._data && !["pago", "recebido", "quitado", "cancelado"].includes(m._status))
    .sort((a, b) => a._data - b._data);

  const prox = pendentes[0];
  if (!prox) {
    setTexto("proximoPagamento", "Em dia");
    setTexto("statusPagamento", "Nenhuma mensalidade aberta");
    return;
  }

  const valor = prox.valorTotal ?? prox.total ?? prox.valor ?? prox.valorLiquido ?? prox.valorMensal;
  setTexto("proximoPagamento", `${dataBR(isoDate(prox._data))}${valor ? ` · ${moeda(valor)}` : ""}`);
  const atrasado = prox._data < hoje;
  setTexto("statusPagamento", atrasado ? "Em atraso" : "Aberto");
  $("statusPagamento").className = atrasado ? "status-bad" : "status-warn";
}

async function carregarAvaliacao(alunoId) {
  setTexto("proximaAvaliacao", "Carregando...");
  setTexto("statusAvaliacao", "");
  const lista = await fetchLista(`/api/avaliacoes?alunoId=${encodeURIComponent(alunoId)}`);
  if (!lista.length) {
    setTexto("proximaAvaliacao", "Sem avaliação");
    setTexto("statusAvaliacao", "Solicitar primeira avaliação");
    $("statusAvaliacao").className = "status-bad";
    mostrarAlerta("Sua avaliação física ainda não foi registrada. Solicite uma avaliação ao professor.");
    return;
  }

  const ordenadas = lista.map((a) => ({ ...a, _data: toDate(a.data || a.criado_em || a.criadoEm || a.createdAt) }))
    .filter((a) => a._data)
    .sort((a, b) => b._data - a._data);
  const ultima = ordenadas[0];
  if (!ultima) {
    setTexto("proximaAvaliacao", "Sem data");
    return;
  }

  const validadeDias = Number(ultima.validadeDias || ultima.validade_dias || 30) || 30;
  const proxima = addDias(ultima._data, validadeDias);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencida = proxima < hoje;

  setTexto("proximaAvaliacao", dataBR(isoDate(proxima)));
  setTexto("statusAvaliacao", vencida ? "Avaliação vencida" : `Última: ${dataBR(isoDate(ultima._data))}`);
  $("statusAvaliacao").className = vencida ? "status-bad" : "status-ok";

  if (vencida) {
    mostrarAlerta("Sua avaliação física venceu. Solicite uma nova avaliação ao professor.");
    registrarAlertaProfessor(alunoId, ultima, proxima);
  }
}

function mostrarAlerta(texto) {
  const el = $("alertaAluno");
  if (!el) return;
  el.textContent = texto;
  el.classList.remove("hidden");
}

function registrarAlertaProfessor(alunoId, ultima, proxima) {
  try {
    const sessao = sessaoAluno();
    const chave = "fusion_alertas_professor_avaliacao";
    const lista = JSON.parse(localStorage.getItem(chave) || "[]");
    const alerta = {
      id: `avaliacao_vencida_${alunoId}`,
      tipo: "avaliacao_vencida",
      alunoId,
      alunoNome: treinoAtual?.alunoNome || sessao?.alunoNome || "Aluno",
      professorId: treinoAtual?.professorId || "",
      professorNome: treinoAtual?.professorNome || "",
      ultimaAvaliacao: isoDate(ultima._data),
      proximaAvaliacao: isoDate(proxima),
      mensagem: "Avaliação física vencida.",
      criadoEm: new Date().toISOString()
    };
    const filtrada = lista.filter((item) => item.id !== alerta.id);
    filtrada.unshift(alerta);
    localStorage.setItem(chave, JSON.stringify(filtrada.slice(0, 100)));
  } catch {}
}

async function carregar() {
  const sessao = exigirLogin();
  if (!sessao) return;

  setTexto("alunoNome", sessao.alunoNome || "Aluno");
  await Promise.all([carregarPagamento(sessao.alunoId), carregarAvaliacao(sessao.alunoId)]);

  const resp = await fetch(`/api/treinos?alunoId=${encodeURIComponent(sessao.alunoId)}`, { cache: "no-store" });
  const json = await resp.json().catch(() => ({}));
  const treinos = Array.isArray(json.dados) ? json.dados : [];
  treinoAtual = treinos.find((t) => t.ativo !== false) || treinos[0] || null;
  divisaoAtual = 0;
  exercicioAtual = 0;
  renderTudo();
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

function proximaDivisao(delta) {
  const total = divisoesValidas(treinoAtual).length;
  if (!total) return;
  divisaoAtual = (divisaoAtual + delta + total) % total;
  exercicioAtual = 0;
  renderTudo();
}

function abrirAvaliacao() {
  const sessao = exigirLogin();
  if (!sessao) return;
  location.href = `/pages/avaliacoes/index.html?alunoId=${encodeURIComponent(sessao.alunoId)}`;
}

function configurarPwa() {
  window.addEventListener("beforeinstallprompt", (ev) => {
    ev.preventDefault();
    installPrompt = ev;
    $("btnInstalar")?.classList.remove("hidden");
  });
  $("btnInstalar").onclick = async () => {
    if (!installPrompt) return alert("Instalação não disponível neste navegador. No celular, use o menu do navegador e escolha Adicionar à tela inicial.");
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    installPrompt = null;
    $("btnInstalar")?.classList.add("hidden");
  };
}

function configurarSwipe() {
  const stage = $("imagemStage");
  if (!stage) return;
  stage.addEventListener("touchstart", (ev) => {
    const t = ev.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });
  stage.addEventListener("touchend", (ev) => {
    const t = ev.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) proximo(); else anterior();
  }, { passive: true });

  const tabs = $("tabsDivisoes");
  tabs.addEventListener("touchstart", (ev) => {
    const t = ev.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });
  tabs.addEventListener("touchend", (ev) => {
    const t = ev.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    proximaDivisao(dx < 0 ? 1 : -1);
  }, { passive: true });
}

$("proximo").onclick = proximo;
$("anterior").onclick = anterior;
$("atualizar").onclick = carregar;
$("btnAvaliacao").onclick = abrirAvaliacao;
$("checkConcluido").onchange = () => marcarConcluido($("checkConcluido").checked);
$("sair").onclick = () => {
  localStorage.removeItem("fusion_aluno_treino_login");
  location.replace("/pages/aluno-login/index.html");
};

document.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowRight") proximo();
  if (ev.key === "ArrowLeft") anterior();
});

configurarPwa();
configurarSwipe();
carregar();
