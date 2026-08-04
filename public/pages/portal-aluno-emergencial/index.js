const $ = id => document.getElementById(id);

const fotoFallback = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><rect width='100%' height='100%' rx='90' fill='#e8eef8'/><text x='50%' y='54%' text-anchor='middle' font-size='24' font-family='Arial' font-weight='700' fill='#64748b'>Aluno</text></svg>`);
const PIX_CHAVE_MENSALIDADE = "82988450407";

let sessao = null;
let statusAtual = null;
let prontuarioAtual = null;
let controleCatracaAtual = null;
let comprovanteBase64 = "";

function numero(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const texto = String(v ?? "").trim();
  if (!texto) return 0;
  const limpo = texto.replace(/[^\d,.-]/g, "");
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

function moeda(v) {
  return numero(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataISO(v) {
  if (!v) return "";
  const s = String(v).slice(0, 10);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : s;
}

function dataBR(v) {
  const s = dataISO(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || "-");
}

function dataHora(v) {
  return v ? new Date(v).toLocaleString("pt-BR") : "-";
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function authHeaders(headers = {}) {
  const token = sessao?.token || sessao?.accessToken || sessao?.jwt || "";
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

function alunoId() {
  return String(new URLSearchParams(location.search).get("alunoId") || sessao?.alunoId || sessao?.id || "");
}

function alunoNome(aluno = {}) {
  return aluno.nome || aluno.nomeCompleto || sessao?.alunoNome || sessao?.nome || "Aluno";
}

function statusNormalizado(item = {}) {
  return String(item.statusPagamento || item.status || item.situacao || "").trim().toLowerCase();
}

function statusPago(item = {}) {
  return ["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada"].includes(statusNormalizado(item));
}

function statusCancelado(item = {}) {
  return ["cancelado", "cancelada", "estornado", "estornada", "excluido", "excluida"].includes(statusNormalizado(item));
}

function statusProgramado(item = {}) {
  return ["programada", "programado", "agendada", "agendado", "futura", "futuro", "prevista", "previsto"].includes(statusNormalizado(item));
}

function valorBase(item = {}) {
  return numero(item.valorOriginal ?? item.valorDevido ?? item.valorBruto ?? item.total ?? item.valor ?? item.valorMensal ?? item.valorPlano ?? item.valorTotal ?? 0);
}

function valorRecebido(item = {}) {
  return numero(item.valorPago ?? item.valorRecebido ?? item.recebido ?? item.valorBrutoRecebido ?? 0);
}

function saldoCobranca(item = {}) {
  if (!item || statusPago(item) || statusCancelado(item)) return 0;
  if (statusProgramado(item)) return Math.max(0, valorBase(item) - valorRecebido(item));
  const saldoInformado = item.valorRestante ?? item.saldoRestante ?? item.saldo ?? item.valorAberto;
  const saldo = numero(saldoInformado);
  if (saldoInformado !== undefined && saldoInformado !== null && saldo > 0) return saldo;
  return Math.max(0, valorBase(item) - valorRecebido(item));
}

function dataCobranca(item = {}) {
  return dataISO(item.vencimento || item.dataVencimento || item.data_vencimento || item.competencia || "");
}

function dataCheckin(item = {}) {
  return dataISO(item.data || item.dataEntrada || item.entradaEm || item.horaEntrada || item.criadoEm || item.criado_em || item.createdAt || "");
}

function checkinContaFrequencia(item = {}) {
  if (item.autorizado === true || item.liberado === true) return true;
  const status = String(item.status || item.situacao || item.resultado || "").trim().toLowerCase();
  if (["bloqueado", "bloqueada", "negado", "negada", "recusado", "recusada", "cancelado", "cancelada"].includes(status)) return false;
  return ["liberado", "liberada", "autorizado", "autorizada", "presente", "entrada", "registrado", "registrada"].includes(status);
}

function frequenciasDoMes(prontuario = {}, referencia = new Date()) {
  const ano = referencia.getFullYear();
  const mes = referencia.getMonth();
  const dias = new Set();
  const checkins = Array.isArray(prontuario.checkins) ? prontuario.checkins : [];
  for (const item of checkins) {
    if (!checkinContaFrequencia(item)) continue;
    const data = dataCheckin(item);
    const m = String(data).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) continue;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getFullYear() === ano && d.getMonth() === mes) dias.add(d.getDate());
  }
  return dias;
}

function renderCalendarioFrequencia(prontuario = {}) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const nomeMes = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const frequencias = frequenciasDoMes(prontuario, hoje);
  const celulas = [];

  for (let i = 0; i < primeiroDia; i += 1) celulas.push('<span class="calendario-dia vazio"></span>');
  for (let dia = 1; dia <= totalDias; dia += 1) {
    const marcado = frequencias.has(dia);
    const atual = dia === hoje.getDate();
    celulas.push(`<span class="calendario-dia ${marcado ? "marcado" : ""} ${atual ? "hoje" : ""}">${dia}</span>`);
  }

  $("calendarioTitulo").textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
  $("calendarioFrequencia").innerHTML = celulas.join("");
  $("totalFrequenciaMes").textContent = String(frequencias.size);
  $("frequenciaMes").textContent = `${frequencias.size} dia(s)`;
  $("frequenciaResumoTopo").textContent = frequencias.size
    ? "Presencas liberadas na catraca"
    : "Sem registros liberados";
  $("resumoFrequencia").textContent = frequencias.size
    ? `${frequencias.size} dia(s) com passagem liberada na catraca.`
    : "Dias marcados indicam passagem liberada na catraca.";
}

function mensagem(texto, erro = false) {
  $("mensagem").textContent = texto || "";
  $("mensagem").className = `mensagem ${erro ? "erro" : "ok"}`;
}

function carregarSessao() {
  try { sessao = JSON.parse(localStorage.getItem("fusion_aluno_treino_login") || "null"); } catch { sessao = null; }
  if (!sessao || !alunoId()) {
    location.replace(`/pages/aluno-login/index.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    return false;
  }
  atualizarLinks();
  return true;
}

function atualizarLinks() {
  const id = alunoId();
  $("linkTreino").href = `/pages/aluno-treinos/index.html?alunoId=${encodeURIComponent(id)}`;
  $("linkAvaliacao").href = `/pages/aluno-avaliacao/index.html?alunoId=${encodeURIComponent(id)}`;
}

async function buscarJson(url) {
  const resp = await fetch(url, { cache: "no-store", headers: authHeaders() });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `Erro HTTP ${resp.status}`);
  return json;
}

async function buscarProntuario() {
  return await buscarJson(`/api/alunos/${encodeURIComponent(alunoId())}/prontuario`);
}

async function buscarStatusEmergencial() {
  return await buscarJson(`/api/emergency-access/alunos/${encodeURIComponent(alunoId())}/status`);
}

async function buscarContadorCatraca() {
  if (!sessao?.token) return null;
  return await buscarJson(`/api/treinos/aluno-catraca-contador?alunoId=${encodeURIComponent(alunoId())}&token=${encodeURIComponent(sessao.token)}`);
}

function primeiraMatriculaAtiva(prontuario = {}) {
  const lista = Array.isArray(prontuario.matriculas) ? prontuario.matriculas : [];
  return lista.find(m => ["ativa", "ativo"].includes(String(m.status || "").trim().toLowerCase())) || lista[0] || {};
}

function ultimaAvaliacao(prontuario = {}) {
  const lista = Array.isArray(prontuario.avaliacoes) ? [...prontuario.avaliacoes] : [];
  const dataAvaliacao = item => dataISO(item?.data || item?.criadoEm || item?.criado_em || item?.createdAt || "");
  return lista.sort((a, b) => String(dataAvaliacao(b)).localeCompare(String(dataAvaliacao(a))))[0] || {};
}

function mensalidadePrincipal(prontuario = {}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const mensalidades = Array.isArray(prontuario.mensalidades) ? prontuario.mensalidades : [];
  const abertas = mensalidades
    .filter(item => !statusPago(item) && !statusCancelado(item) && saldoCobranca(item) > 0)
    .sort((a, b) => String(dataCobranca(a)).localeCompare(String(dataCobranca(b))));
  const proximoResumo = dataISO(prontuario.resumoFinanceiro?.proximoVencimento);
  return (proximoResumo && abertas.find(item => dataCobranca(item) === proximoResumo))
    || abertas.find(item => dataCobranca(item) < hoje)
    || abertas.find(item => dataCobranca(item) >= hoje)
    || abertas[0]
    || mensalidades[0]
    || {};
}

function statusMensalidade(item = {}, data = "") {
  const hoje = new Date().toISOString().slice(0, 10);
  if (!item || !Object.keys(item).length) return "Nao localizada";
  if (statusPago(item)) return "Pago";
  if (statusCancelado(item)) return "Cancelado";
  if (saldoCobranca(item) > 0 && data && data < hoje) return "Em atraso";
  if (statusProgramado(item)) return "Programado";
  return saldoCobranca(item) > 0 ? "Em aberto" : "Programado";
}

function renderPerfil(prontuario = {}) {
  const aluno = prontuario.aluno || {};
  const matricula = primeiraMatriculaAtiva(prontuario);
  const nome = alunoNome(aluno);
  const foto = aluno.foto_base64 || aluno.foto || sessao?.foto || "";
  $("fotoAluno").src = foto || fotoFallback;
  $("fotoAluno").onerror = () => { $("fotoAluno").src = fotoFallback; };
  $("nomeAluno").textContent = nome;
  $("saudacao").textContent = `Ola, ${nome}.`;
  $("statusAluno").textContent = `Status: ${aluno.status || aluno.situacao || "ativo"}`;
  $("planoAluno").textContent = `Plano: ${matricula.plano || aluno.plano || "-"}`;
}

function renderContadorCatraca(controle = null) {
  const dados = controle?.dados || controle || {};
  controleCatracaAtual = dados;
  const limite = Number(dados.limite ?? dados.limiteDiario ?? 3);
  const usados = Number(dados.usados ?? dados.acessosUsadosHoje ?? 0);
  const restantesRaw = dados.restantes ?? dados.acessosRestantesHoje;
  const restantes = restantesRaw === null || restantesRaw === undefined ? Math.max(0, limite - usados) : Number(restantesRaw);
  const ilimitado = !(limite > 0);
  const atingiuLimite = !ilimitado && (dados.limiteAtingido || usados >= limite || restantes <= 0);

  $("acessosCatraca").textContent = ilimitado ? String(usados) : `${usados} / ${limite}`;
  $("statusAcessosCatraca").textContent = ilimitado
    ? "Sem limite diario"
    : (atingiuLimite ? "Limite atingido" : `${Math.max(0, limite - usados)} restante(s)`);
  $("statusAcessosCatraca").classList.toggle("vencido", Boolean(atingiuLimite));
  $("btnLiberarCatraca").disabled = Boolean(atingiuLimite);
}

function mostrarStatusCatraca(texto, tipo = "info") {
  const el = $("statusCatraca");
  el.textContent = texto || "";
  el.dataset.tipo = tipo;
  el.classList.toggle("hidden", !texto);
}

async function liberarCatraca() {
  if (!sessao?.token) {
    mostrarStatusCatraca("Faca login novamente para liberar a catraca.", "erro");
    return;
  }

  const botao = $("btnLiberarCatraca");
  botao.disabled = true;
  mostrarStatusCatraca("Liberando catraca...", "info");
  try {
    const resp = await fetch("/api/treinos/aluno-liberar-catraca", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ alunoId: alunoId(), token: sessao.token, direcao: "entrada" })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || "Nao foi possivel liberar a catraca.");

    const dados = json.dados || {};
    if (dados.controleAcessos) renderContadorCatraca(dados.controleAcessos);
    if (dados.autorizado) {
      mostrarStatusCatraca("Acesso liberado. Pode passar.", "sucesso");
      await buscarContadorCatraca().then(renderContadorCatraca).catch(() => null);
    } else {
      mostrarStatusCatraca(`Acesso bloqueado: ${dados.motivo || "verifique a recepcao."}`, "erro");
    }
  } catch (e) {
    mostrarStatusCatraca(e.message || "Nao foi possivel liberar a catraca.", "erro");
  } finally {
    botao.disabled = Boolean(controleCatracaAtual?.limiteAtingido);
  }
}

function renderResumo(prontuario = {}) {
  const aluno = prontuario.aluno || {};
  const rf = prontuario.resumoFinanceiro || {};
  const matricula = primeiraMatriculaAtiva(prontuario);
  const mensalidade = mensalidadePrincipal(prontuario);
  const data = dataISO(rf.proximoVencimento || dataCobranca(mensalidade) || matricula.proximoVencimento || aluno.proximoVencimento);
  const valorMensal = saldoCobranca(mensalidade) || valorBase(mensalidade) || numero(matricula.valorMensal || aluno.valorMensal || aluno.valorPlano);
  const avaliacao = ultimaAvaliacao(prontuario);
  const status = statusMensalidade(mensalidade, data);

  $("valorAberto").textContent = moeda(rf.valorAberto || 0);
  $("valorPago").textContent = moeda(rf.valorPago || 0);
  $("ultimaBaixa").textContent = `Ultima baixa: ${dataBR(rf.ultimaBaixa)}`;
  $("ultimaAvaliacao").textContent = dataBR(avaliacao.data || avaliacao.criadoEm || prontuario.indicadores?.ultimaAvaliacao);
  $("proximaAvaliacao").textContent = "Visualize os detalhes na avaliacao";

  $("tituloMensalidade").textContent = statusProgramado(mensalidade) ? "Mensalidade programada" : "Mensalidade do aluno";
  $("valorMensalidade").textContent = moeda(valorMensal);
  $("mensalidadeResumoTexto").textContent = data
    ? `Vencimento ${dataBR(data)} · ${status}`
    : status;
  $("chavePixMensalidade").textContent = PIX_CHAVE_MENSALIDADE;

  $("dadosAluno").innerHTML = detalheHtml([
    ["Matricula", matricula.numero || aluno.numeroMatricula || "-"],
    ["Status matricula", matricula.status || aluno.statusMatricula || "-"],
    ["Professor", matricula.professor || aluno.professorNome || aluno.professor_responsavel || "-"],
    ["Modalidade", matricula.modalidade || aluno.modalidade || matricula.turma || "-"]
  ]);
  renderCalendarioFrequencia(prontuario);
}

function detalheHtml(itens = []) {
  return itens.map(([label, valor]) => `
    <div class="detalhe">
      <span>${esc(label)}</span>
      <strong>${esc(valor || "-")}</strong>
    </div>
  `).join("");
}

function renderStatusEmergencial() {
  const s = statusAtual;
  if (!s) {
    $("cardStatus").classList.add("hidden");
    return;
  }
  if (s.acessoAtivo) {
    $("cardStatus").classList.remove("hidden");
    $("cardStatus").innerHTML = `<h2>Acesso emergencial ativo</h2><p>Seu comprovante ja foi enviado. O acesso temporario esta registrado ate <strong>${esc(dataHora(s.acessoAtivo.acessoValidoAte))}</strong>.</p><p>Esta foi a tentativa da competencia ${esc(s.competencia)}.</p>`;
    return;
  }
  if (!s.elegivel) {
    $("cardStatus").classList.add("hidden");
    return;
  }

  const d = s.divida?.item || {};
  $("cardStatus").classList.remove("hidden");
  $("cardStatus").innerHTML = `<h2>Mensalidade em atraso</h2><div class="resumo"><div><span>Vencimento</span><strong>${esc(dataBR(d.vencimento || d.dataVencimento || "-"))}</strong></div><div><span>Valor</span><strong>${esc(moeda(d.valorRestante ?? d.saldo ?? d.total ?? d.valorOriginal ?? d.valor))}</strong></div><div><span>Tentativas</span><strong>1 por mes</strong></div></div>`;
  if (!s.pix?.configured) {
    $("cardStatus").insertAdjacentHTML("beforeend", '<div class="erro-box">PIX ainda nao configurado pela academia.</div>');
    return;
  }
  $("pixValor").textContent = moeda(s.pix.value);
  $("pixCodigo").value = s.pix.code;
  $("cardPix").classList.remove("hidden");
}

async function carregar() {
  $("cardPix").classList.add("hidden");
  $("cardStatus").classList.add("hidden");
  $("mensalidadeResumoTexto").textContent = "Consultando mensalidade...";
  $("calendarioFrequencia").innerHTML = '<span class="loading">Consultando frequencia...</span>';
  $("dadosAluno").innerHTML = '<div class="loading">Consultando matricula...</div>';
  $("statusAcessosCatraca").textContent = "Consultando...";
  $("btnLiberarCatraca").disabled = true;
  mostrarStatusCatraca("");
  try {
    const [prontuario, status, contador] = await Promise.all([
      buscarProntuario(),
      buscarStatusEmergencial().catch(() => null),
      buscarContadorCatraca().catch(() => null)
    ]);
    prontuarioAtual = prontuario;
    statusAtual = status;
    renderPerfil(prontuarioAtual);
    renderResumo(prontuarioAtual);
    renderContadorCatraca(contador);
    renderStatusEmergencial();
  } catch (e) {
    $("cardStatus").classList.remove("hidden");
    $("cardStatus").innerHTML = `<div class="erro-box">${esc(e.message || "Nao foi possivel carregar o portal.")}</div>`;
  }
}

$("btnCopiarPixMensalidade").onclick = async () => {
  const status = $("mensagemPixMensalidade");
  try {
    await navigator.clipboard.writeText(PIX_CHAVE_MENSALIDADE);
    status.textContent = `PIX ${PIX_CHAVE_MENSALIDADE} copiado.`;
    status.className = "pix-status ok";
  } catch {
    status.textContent = `Copie a chave PIX: ${PIX_CHAVE_MENSALIDADE}`;
    status.className = "pix-status";
  }
};

$("btnGerarBoleto").onclick = () => {};
$("btnLiberarCatraca").onclick = liberarCatraca;

$("copiarPix").onclick = async () => {
  try { await navigator.clipboard.writeText($("pixCodigo").value); mensagem("PIX copiado."); }
  catch { $("pixCodigo").select(); document.execCommand("copy"); mensagem("PIX copiado."); }
};

$("comprovante").onchange = () => {
  const file = $("comprovante").files[0];
  comprovanteBase64 = "";
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    mensagem("O arquivo deve ter no maximo 8 MB.", true);
    $("comprovante").value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    comprovanteBase64 = String(reader.result || "");
    $("preview").src = comprovanteBase64;
    $("preview").classList.remove("hidden");
  };
  reader.readAsDataURL(file);
};

$("enviar").onclick = async () => {
  if (!comprovanteBase64) return mensagem("Selecione a imagem do comprovante.", true);
  if (!confirm("Ao enviar, sua unica tentativa do mes sera consumida e o acesso sera liberado automaticamente por 24 horas. Continuar?")) return;
  $("enviar").disabled = true;
  mensagem("Enviando comprovante e solicitando liberacao...");
  try {
    const resp = await fetch("/api/emergency-access/comprovante", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ alunoId: alunoId(), comprovanteBase64 })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || "Falha ao enviar comprovante.");
    mensagem(`Comprovante enviado. Acesso temporario registrado ate ${dataHora(json.solicitacao.acessoValidoAte)}.`);
    await carregar();
  } catch (e) {
    mensagem(e.message, true);
  } finally {
    $("enviar").disabled = false;
  }
};

$("atualizar").onclick = carregar;
$("sair").onclick = () => {
  localStorage.removeItem("fusion_aluno_treino_login");
  localStorage.removeItem("fusion_aluno_treino_selecionado");
  location.replace("/pages/aluno-login/index.html");
};

if (carregarSessao()) carregar();
