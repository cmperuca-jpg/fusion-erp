import express from "express";
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
    const lancamentos = await listarTitulos(req.query);
    res.json({ ok: true, lancamentos });
  } catch (erro) {
    tratarErro(res, erro);
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
    let lancamento = await criarTitulo(req.body);
    // Quando o operador informa explicitamente que a conta a pagar já foi
    // quitada, a criação e a baixa devem ocorrer juntas, com saída no caixa.
    const tipoPagar = String(lancamento.tipo || '').toLowerCase() === 'pagar';
    const baixaConfirmada = req.body?.registrarPagamento === true ||
      String(req.body?.status || '').toLowerCase() === 'pago' ||
      Boolean((req.body?.pagamento || req.body?.dataPagamento) && (req.body?.formaPagamento || req.body?.forma));
    if (tipoPagar && baixaConfirmada) {
      lancamento = await baixarPagamento(lancamento.id, {
        valor: lancamento.valor,
        formaPagamento: req.body?.formaPagamento || req.body?.forma || '',
        observacao: req.body?.observacoes || req.body?.observacao || '',
        operacaoId: req.body?.operacaoId || `baixa-na-criacao-${lancamento.id}`
      });
    }
    res.status(201).json({ ok: true, lancamento });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.patch("/:id/baixar", async (req, res) => {
  try {
    const tituloAtual = (await listarTitulos({})).find((item) => String(item.id) === String(req.params.id));
    if (!tituloAtual) return res.status(404).json({ ok: false, mensagem: "Lançamento não encontrado" });
    if (String(tituloAtual.tipo || "").toLowerCase() === "pagar") {
      const lancamento = await baixarPagamento(req.params.id, req.body || {});
      return res.json({ ok: true, lancamento });
    }
    const resultado = await receberTitulos({ ...(req.body || {}), tituloId: req.params.id });
    const lancamento = { ...(resultado.lancamento || {}), recibo: resultado.recibo, itensRecibo: resultado.itens };
    let cobrancaAutomatica = { ok: true, programada: false, motivo: 'Recebimento já processado.' };
    if (!resultado.idempotente) {
      try {
        cobrancaAutomatica = await programarProximaCobrancaAposPagamento({
          financeiroId: req.params.id,
          mensalidadeId: lancamento.mensalidadeId || '',
          alunoId: lancamento.alunoId || '',
          usuario: req.body?.usuario || 'financeiro'
        });
      } catch (erroCobranca) {
        // A baixa já foi confirmada atomicamente no banco. Uma falha na agenda
        // da próxima cobrança não pode devolver erro de pagamento e induzir o
        // operador a tentar receber o mesmo valor novamente.
        cobrancaAutomatica = {
          ok: false,
          aviso: true,
          programada: false,
          motivo: `Pagamento confirmado no Supabase, mas a próxima cobrança não pôde ser programada: ${erroCobranca.message}`
        };
      }
    }

    if (!lancamento) {
      return res.status(404).json({
        ok: false,
        mensagem: "Lançamento não encontrado"
      });
    }

    res.json({ ok: true, lancamento, cobrancaAutomatica });
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
    const tituloAtual = (await listarTitulos({})).find((item) => String(item.id) === String(req.params.id));
    if (!tituloAtual) return res.status(404).json({ ok: false, mensagem: "Lançamento não encontrado" });
    if (String(tituloAtual.tipo || "").toLowerCase() === "pagar") {
      const lancamento = await cancelarPagamento(req.params.id, req.body?.motivo || "Cancelamento pela tela financeira.");
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
