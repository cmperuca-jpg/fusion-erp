import express from "express";
import { executarTransacaoJson } from "../core/persistence/durable-json.mjs";
import {
  obterTaxasCartao,
  salvarTaxasCartao
} from "./financeiro.service.mjs";
import { programarProximaCobrancaAposPagamento } from "../cobranca/cobranca.service.mjs";
import {
  listarTitulos,
  resumoFinanceiro,
  criarTitulo,
  atualizarTitulo,
  receberTitulos,
  cancelarTitulo
} from "./financeiro-ledger.service.mjs";
import { baixarPagamento, cancelarPagamento } from "./pagamentos.service.mjs";
import { garantirLancamentoFinanceiroMensalidade } from "./mensalidade-financeiro-link.service.mjs";
import { notificarPagamentoConfirmado } from "../notificacoes/notificacao-pagamento.service.mjs";

const router = express.Router();

function tratarErro(res, erro) {
  const status = erro.status || 500;
  return res.status(status).json({
    ok: false,
    erro: erro.message || "Erro interno no financeiro.",
    mensagem: erro.message || "Erro interno no financeiro."
  });
}

router.get("/", async (req, res) => {
  try {
    // GET e somente leitura: nunca cria, corrige ou vincula lancamentos.
    const lancamentos = await listarTitulos(req.query);
    res.json({ ok: true, lancamentos });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/mensalidades/:mensalidadeId/garantir-lancamento", async (req, res) => {
  try {
    // Materializacao intencional e explicita. O service usa operacao
    // deterministica por mensalidade e reaproveita o titulo ja existente.
    const resultado = await garantirLancamentoFinanceiroMensalidade(
      req.params.mensalidadeId
    );

    return res.status(resultado.criado ? 201 : 200).json(resultado);
  } catch (erro) {
    return tratarErro(res, erro);
  }
});

router.get("/resumo", async (req, res) => {
  try {
    const resumo = await resumoFinanceiro();
    res.json({ ok: true, resumo });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/taxas-cartao", async (req, res) => {
  try {
    const taxas = await obterTaxasCartao();
    res.json({ ok: true, taxas });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.put("/taxas-cartao", async (req, res) => {
  try {
    const taxas = await salvarTaxasCartao(req.body?.taxas || req.body || []);
    res.json({ ok: true, taxas });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/", async (req, res) => {
  try {
    const opcoes = req.body?.operacaoId || req.body?.idempotencyKey
      ? { operacaoId: req.body.operacaoId || req.body.idempotencyKey }
      : {};

    const lancamento = await executarTransacaoJson(async () => {
      let atual = await criarTitulo(req.body);
      const tipoPagar = String(atual.tipo || "").toLowerCase() === "pagar";
      const baixaConfirmada = req.body?.registrarPagamento === true ||
        String(req.body?.status || "").toLowerCase() === "pago" ||
        Boolean(
          (req.body?.pagamento || req.body?.dataPagamento) &&
          (req.body?.formaPagamento || req.body?.forma)
        );

      if (tipoPagar && baixaConfirmada) {
        atual = await baixarPagamento(atual.id, {
          valor: atual.valor,
          formaPagamento: req.body?.formaPagamento || req.body?.forma || "",
          observacao: req.body?.observacoes || req.body?.observacao || "",
          operacaoId:
            req.body?.operacaoId ||
            req.body?.idempotencyKey ||
            `baixa-na-criacao-${atual.id}`
        });
      }

      return atual;
    }, opcoes);

    res.status(201).json({ ok: true, lancamento });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.patch("/:id/baixar", async (req, res) => {
  try {
    const tituloAtual = (await listarTitulos({})).find(
      item => String(item.id) === String(req.params.id)
    );

    if (!tituloAtual) {
      return res.status(404).json({ ok: false, mensagem: "Lançamento não encontrado" });
    }

    if (String(tituloAtual.tipo || "").toLowerCase() === "pagar") {
      const lancamento = await baixarPagamento(req.params.id, req.body || {});
      return res.json({ ok: true, lancamento });
    }

    const resultado = await receberTitulos({
      ...(req.body || {}),
      tituloId: req.params.id
    });

    const lancamento = {
      ...(resultado.lancamento || {}),
      recibo: resultado.recibo,
      itensRecibo: resultado.itens
    };

    let cobrancaAutomatica = {
      ok: true,
      programada: false,
      motivo: "Recebimento já processado."
    };

    if (!resultado.idempotente) {
      try {
        cobrancaAutomatica = await programarProximaCobrancaAposPagamento({
          financeiroId: req.params.id,
          mensalidadeId: lancamento.mensalidadeId || "",
          alunoId: lancamento.alunoId || "",
          usuario: req.body?.usuario || "financeiro"
        });
      } catch (erroCobranca) {
        cobrancaAutomatica = {
          ok: false,
          aviso: true,
          programada: false,
          motivo:
            `Pagamento confirmado no Supabase, mas a próxima cobrança não pôde ser programada: ${erroCobranca.message}`
        };
      }
    }

    if (!lancamento) {
      return res.status(404).json({ ok: false, mensagem: "Lançamento não encontrado" });
    }

    let notificacaoPagamento = { ok: true, status: "nao_processada", canais: {} };
    try {
      notificacaoPagamento = await notificarPagamentoConfirmado({
        eventoId: resultado.recibo?.id || resultado.recibo?.numero || req.idempotencyKey || req.body?.operacaoId || req.body?.idempotencyKey,
        operacaoId: req.idempotencyKey || req.body?.operacaoId || req.body?.idempotencyKey,
        referenciaId: req.params.id,
        lancamento,
        recibo: resultado.recibo,
        valorPago: req.body?.valorPago || req.body?.valorRecebido || req.body?.valor,
        dataPagamento: req.body?.dataPagamento || req.body?.pagamento,
        formaPagamento: req.body?.formaPagamento || req.body?.forma
      });
    } catch (erroNotificacao) {
      notificacaoPagamento = { ok: false, status: "falhou", canais: {}, mensagem: "Pagamento confirmado; comunicação ao cliente será reprocessada." };
      console.error(`[Financeiro] Falha não bloqueante na notificação de pagamento: ${erroNotificacao.message}`);
    }

    res.json({ ok: true, lancamento, cobrancaAutomatica, notificacaoPagamento });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const lancamento = await atualizarTitulo(req.params.id, req.body);

    if (!lancamento) {
      return res.status(404).json({
        ok: false,
        mensagem: "Lançamento não encontrado"
      });
    }

    res.json({ ok: true, lancamento });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const tituloAtual = (await listarTitulos({})).find(
      item => String(item.id) === String(req.params.id)
    );

    if (!tituloAtual) {
      return res.status(404).json({ ok: false, mensagem: "Lançamento não encontrado" });
    }

    if (String(tituloAtual.tipo || "").toLowerCase() === "pagar") {
      const lancamento = await cancelarPagamento(
        req.params.id,
        req.body?.motivo || "Cancelamento pela tela financeira."
      );
      return res.json({ ok: true, lancamento });
    }

    const lancamento = await cancelarTitulo(req.params.id, req.body || {});

    if (!lancamento) {
      return res.status(404).json({
        ok: false,
        mensagem: "Lançamento não encontrado"
      });
    }

    res.json({ ok: true, lancamento });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

export default router;
