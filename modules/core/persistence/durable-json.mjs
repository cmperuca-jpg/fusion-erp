import path from "node:path";
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { lerColecao, salvarColecao, salvarColecoesAtomicas } from "./collection-store.mjs";

const contextoTransacao = new AsyncLocalStorage();
let filaTransacoes = Promise.resolve();

function texto(valor = "") {
  return String(valor ?? "").trim();
}

function numero(valor, padrao = 0) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

function statusNormalizado(valor = "") {
  const s = texto(valor).toLowerCase();
  if (["cancelado", "cancelada"].includes(s)) return "cancelado";
  if (["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada"].includes(s)) return "pago";
  if (["programado", "programada", "agendado", "agendada", "previsto", "prevista", "futuro", "futura"].includes(s)) return "programado";
  if (["parcial", "parcialmente pago"].includes(s)) return "parcial";
  return "aberto";
}

function competenciaMensalidade(item = {}) {
  const direta = texto(item.competencia).slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(direta)) return direta;
  const vencimento = texto(item.vencimento || item.dataVencimento || item.data_vencimento).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(vencimento) ? vencimento.slice(0, 7) : "";
}

function ehProgramadaSemSaldo(item = {}) {
  const programada =
    item.programada === true ||
    statusNormalizado(item.status || item.situacao) === "programado";

  if (!programada || item.emitida === true) return false;

  const pago = numero(item.valorPago ?? item.valorQuitado ?? item.valorRecebido, 0);
  const restante = numero(item.valorRestante ?? item.saldoRestante, 0);

  return pago <= 0 && restante <= 0;
}

function chaveMensalidade(item = {}) {
  const competencia = competenciaMensalidade(item);
  if (!competencia) return "";

  const matriculaId = texto(item.matriculaId || item.matricula_id);
  const alunoId = texto(item.alunoId || item.aluno_id);
  if (!matriculaId && !alunoId) return "";

  return `${matriculaId ? `mat:${matriculaId}` : `aluno:${alunoId}`}|${competencia}`;
}

function adicionarMesesSeguro(dataISO = "", meses = 1, diaPreferido = null) {
  const data = texto(dataISO).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "";

  const [ano, mes, dia] = data.split("-").map(Number);
  const total = (ano * 12) + (mes - 1) + Math.max(1, Math.trunc(Number(meses) || 1));
  const novoAno = Math.floor(total / 12);
  const novoMesZero = total % 12;
  const ultimoDia = new Date(Date.UTC(novoAno, novoMesZero + 1, 0)).getUTCDate();
  const diaAlvo = Math.min(
    ultimoDia,
    Math.max(1, Math.trunc(Number(diaPreferido) || dia || 1))
  );

  return `${String(novoAno).padStart(4, "0")}-${String(novoMesZero + 1).padStart(2, "0")}-${String(diaAlvo).padStart(2, "0")}`;
}

function clonarLista(lista = []) {
  return (Array.isArray(lista) ? lista : []).map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return {
      ...item,
      historico: Array.isArray(item.historico) ? [...item.historico] : item.historico
    };
  });
}

function normalizarMensalidades(listaOriginal = []) {
  const lista = clonarLista(listaOriginal);
  const grupos = new Map();
  const cancelados = new Map();
  let alterou = false;

  for (let i = 0; i < lista.length; i += 1) {
    const item = lista[i];
    if (!item || typeof item !== "object") continue;
    if (statusNormalizado(item.status || item.situacao) === "cancelado") continue;

    const chave = chaveMensalidade(item);
    if (!chave) continue;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push({ item, indice: i });
  }

  const cancelarPrevisao = (registro, motivo) => {
    const { item, indice } = registro;
    const agora = new Date().toISOString();
    const competencia = competenciaMensalidade(item);
    const novo = {
      ...item,
      status: "cancelado",
      programada: false,
      canceladoEm: item.canceladoEm || agora,
      atualizadoEm: agora,
      motivoCancelamento: motivo,
      historico: [
        ...(Array.isArray(item.historico) ? item.historico : []),
        {
          id: `hist_integridade_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          acao: "cancelar_previsao_duplicada",
          descricao: motivo,
          competencia,
          criadoEm: agora,
          usuario: "integridade-financeira"
        }
      ]
    };
    lista[indice] = novo;
    cancelados.set(texto(item.id), {
      id: texto(item.id),
      alunoId: texto(item.alunoId || item.aluno_id),
      matriculaId: texto(item.matriculaId || item.matricula_id),
      competencia,
      vencimento: texto(item.vencimento || item.dataVencimento).slice(0, 10),
      financeiroId: texto(item.lancamentoFinanceiroId || item.financeiroId)
    });
    alterou = true;
  };

  for (const registros of grupos.values()) {
    if (registros.length <= 1) continue;

    const reais = registros.filter(({ item }) => !ehProgramadaSemSaldo(item));
    const previsoes = registros.filter(({ item }) => ehProgramadaSemSaldo(item));

    // Segurança: nunca cancela cobrança real, paga, parcial ou com saldo.
    // Apenas a previsão programada sem saldo é removida quando a competência
    // já possui uma mensalidade verdadeira.
    if (reais.length >= 1 && previsoes.length) {
      for (const previsao of previsoes) {
        cancelarPrevisao(
          previsao,
          "Correção automática: previsão duplicada cancelada; a mensalidade real desta matrícula e competência foi preservada."
        );
      }
      continue;
    }

    // Se existirem apenas previsões idênticas, mantém uma e cancela as extras.
    if (reais.length === 0 && previsoes.length > 1) {
      const ordenadas = [...previsoes].sort((a, b) =>
        texto(a.item.criadoEm || a.item.id).localeCompare(texto(b.item.criadoEm || b.item.id))
      );
      for (const extra of ordenadas.slice(1)) {
        cancelarPrevisao(
          extra,
          "Correção automática: havia mais de uma previsão para a mesma matrícula e competência; somente uma foi mantida."
        );
      }
    }
  }

  return { dados: alterou ? lista : listaOriginal, alterou, cancelados };
}

function mensalidadeAtiva(item = {}) {
  return statusNormalizado(item.status || item.situacao) !== "cancelado";
}

function proximaProgramadaValida(mensalidades, { matriculaId = "", alunoId = "", depoisCompetencia = "" } = {}) {
  return (Array.isArray(mensalidades) ? mensalidades : [])
    .filter((item) => {
      if (!mensalidadeAtiva(item) || !ehProgramadaSemSaldo(item)) return false;
      const mesmaMatricula = matriculaId
        ? texto(item.matriculaId || item.matricula_id) === matriculaId
        : texto(item.alunoId || item.aluno_id) === alunoId;
      if (!mesmaMatricula) return false;
      const comp = competenciaMensalidade(item);
      return comp && (!depoisCompetencia || comp > depoisCompetencia);
    })
    .sort((a, b) =>
      texto(a.vencimento || a.dataVencimento || a.id).localeCompare(
        texto(b.vencimento || b.dataVencimento || b.id)
      )
    )[0] || null;
}

function mensalidadeRealDaCompetencia(mensalidades, meta = {}) {
  return (Array.isArray(mensalidades) ? mensalidades : []).find((item) => {
    if (!mensalidadeAtiva(item) || ehProgramadaSemSaldo(item)) return false;
    if (competenciaMensalidade(item) !== meta.competencia) return false;
    if (meta.matriculaId) return texto(item.matriculaId || item.matricula_id) === meta.matriculaId;
    return texto(item.alunoId || item.aluno_id) === meta.alunoId;
  }) || null;
}

function corrigirPonteiroRegistro(registro = {}, mensalidades = [], cancelados = new Map()) {
  const ponteiro = texto(registro.mensalidadeProximaId);
  if (!ponteiro || !cancelados.has(ponteiro)) return { registro, alterou: false };

  const meta = cancelados.get(ponteiro);
  const matriculaId = texto(registro.id || registro.matriculaId) === meta.matriculaId
    ? meta.matriculaId
    : texto(registro.matriculaId || meta.matriculaId);
  const alunoId = texto(registro.alunoId || registro.id || meta.alunoId);

  const futura = proximaProgramadaValida(mensalidades, {
    matriculaId: meta.matriculaId || matriculaId,
    alunoId: meta.alunoId || alunoId,
    depoisCompetencia: meta.competencia
  });

  const real = mensalidadeRealDaCompetencia(mensalidades, meta);
  const meses = Math.max(
    1,
    Math.trunc(Number(registro.periodicidadeMeses ?? real?.periodicidadeMeses ?? 1) || 1)
  );
  const dia = Number(registro.diaVencimento || "") || null;
  const proximoCalculado = adicionarMesesSeguro(
    real?.vencimento || real?.dataVencimento || meta.vencimento,
    meses,
    dia
  );

  const agora = new Date().toISOString();
  return {
    alterou: true,
    registro: {
      ...registro,
      mensalidadeProximaId: futura?.id || "",
      financeiroProximoId: futura?.lancamentoFinanceiroId || futura?.financeiroId || "",
      proximoVencimento: futura?.vencimento || futura?.dataVencimento || proximoCalculado || registro.proximoVencimento || "",
      recorrenciaReparadaEm: agora,
      atualizadoEm: agora
    }
  };
}

function normalizarMapaColecoes(colecoes = {}, canceladosAnteriores = new Map()) {
  const resultado = { ...colecoes };
  const normalizacao = normalizarMensalidades(resultado.mensalidades || []);
  if (normalizacao.alterou) resultado.mensalidades = normalizacao.dados;

  const cancelados = new Map(canceladosAnteriores || []);
  for (const [id, meta] of normalizacao.cancelados) cancelados.set(id, meta);

  if (!cancelados.size) return resultado;

  if (Array.isArray(resultado.matriculas)) {
    resultado.matriculas = resultado.matriculas.map((item) =>
      corrigirPonteiroRegistro(item, resultado.mensalidades, cancelados).registro
    );
  }

  if (Array.isArray(resultado.alunos)) {
    resultado.alunos = resultado.alunos.map((item) =>
      corrigirPonteiroRegistro(item, resultado.mensalidades, cancelados).registro
    );
  }

  return resultado;
}

export function colecaoDoArquivo(arquivoOuNome = "") {
  return path.basename(String(arquivoOuNome)).replace(/\.json$/i, "");
}

export async function lerJsonDuravel(arquivoOuNome, padrao = []) {
  const colecao = colecaoDoArquivo(arquivoOuNome);
  const contexto = contextoTransacao.getStore();
  if (contexto?.colecoes.has(colecao)) return contexto.colecoes.get(colecao);

  let dados = await lerColecao(colecao, padrao);

  // A coleção mensalidades tem uma proteção estrutural: uma previsão sem saldo
  // nunca pode coexistir ativa com a mensalidade real da mesma matrícula/competência.
  if (colecao === "mensalidades") {
    const normalizacao = normalizarMensalidades(dados);
    if (normalizacao.alterou) {
      dados = normalizacao.dados;
      if (contexto) {
        contexto.alteradas.add(colecao);
        for (const [id, meta] of normalizacao.cancelados) {
          contexto.mensalidadesCanceladas.set(id, meta);
        }
      }
      // Leitura deve ser semanticamente pura. Fora de uma transação explícita,
      // a normalização é aplicada apenas em memória para preservar o comportamento
      // de leitura sem transformar GET/auditoria em operação de escrita. A
      // persistência da normalização acontece somente em fluxos que já gravam.
    }
  }

  if (contexto) contexto.colecoes.set(colecao, dados);
  return dados;
}

export function salvarJsonDuravel(arquivoOuNome, dados, opcoes = {}) {
  const colecao = colecaoDoArquivo(arquivoOuNome);
  const contexto = contextoTransacao.getStore();

  let dadosSeguros = dados;
  if (colecao === "mensalidades") {
    const normalizacao = normalizarMensalidades(dados);
    dadosSeguros = normalizacao.dados;
    if (contexto) {
      for (const [id, meta] of normalizacao.cancelados) {
        contexto.mensalidadesCanceladas.set(id, meta);
      }
    }
  }

  if (contexto) {
    contexto.colecoes.set(colecao, dadosSeguros);
    contexto.alteradas.add(colecao);
    return Promise.resolve(dadosSeguros);
  }
  return salvarColecao(colecao, dadosSeguros, opcoes);
}

export function salvarJsonMultiplosAtomico(entradas = {}, opcoes = {}) {
  const colecoes = {};
  for (const [arquivoOuNome, dados] of Object.entries(entradas)) {
    colecoes[colecaoDoArquivo(arquivoOuNome)] = dados;
  }

  const contexto = contextoTransacao.getStore();
  if (contexto) {
    for (const [nome, dados] of Object.entries(colecoes)) {
      contexto.colecoes.set(nome, dados);
      contexto.alteradas.add(nome);
    }
    return Promise.resolve({ ok: true, pendente: true, colecoes: Object.keys(colecoes).length });
  }

  return salvarColecoesAtomicas(normalizarMapaColecoes(colecoes), opcoes);
}

export async function executarTransacaoJson(executor, { operacaoId = crypto.randomUUID() } = {}) {
  if (contextoTransacao.getStore()) return executor();

  const anterior = filaTransacoes;
  let liberar;
  filaTransacoes = new Promise(resolve => { liberar = resolve; });
  await anterior;

  try {
    return await contextoTransacao.run(
      { colecoes: new Map(), alteradas: new Set(), mensalidadesCanceladas: new Map(), operacaoId },
      async () => {
        const resultado = await executor();
        const contexto = contextoTransacao.getStore();

        let alteradas = Object.fromEntries(
          [...contexto.alteradas].map(nome => [nome, contexto.colecoes.get(nome)])
        );

        // Se a transação tocou mensalidades, usa também as coleções relacionadas
        // já lidas no mesmo contexto para corrigir ponteiros para previsões canceladas.
        if (contexto.colecoes.has("mensalidades")) {
          for (const nome of ["mensalidades", "matriculas", "alunos"]) {
            if (contexto.colecoes.has(nome) && !(nome in alteradas)) {
              alteradas[nome] = contexto.colecoes.get(nome);
            }
          }
          alteradas = normalizarMapaColecoes(
            alteradas,
            contexto.mensalidadesCanceladas
          );
        }

        if (Object.keys(alteradas).length) {
          await salvarColecoesAtomicas(alteradas, { operacaoId });
        }
        return resultado;
      }
    );
  } finally {
    liberar();
  }
}
