import express from "express";
import {
  listarFinanceiro,
  obterResumoFinanceiro,
  criarLancamento,
  atualizarLancamento,
  baixarLancamento,
  excluirLancamento,
  obterTaxasCartao,
  salvarTaxasCartao
} from "./financeiro.service.mjs";

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
    const lancamentos = await listarFinanceiro(req.query);
    res.json({ ok: true, lancamentos });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/resumo", async (req, res) => {
  try {
    const resumo = await obterResumoFinanceiro();
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
    const lancamento = await criarLancamento(req.body);
    res.status(201).json({ ok: true, lancamento });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.patch("/:id/baixar", async (req, res) => {
  try {
    const lancamento = await baixarLancamento(req.params.id, req.body);

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

router.put("/:id", async (req, res) => {
  try {
    const lancamento = await atualizarLancamento(req.params.id, req.body);

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
    const lancamento = await excluirLancamento(req.params.id);

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
