import express from "express";
import * as service from "./fornecedores.service.mjs";

const router = express.Router();

function tratarErro(res, erro) {
  return res.status(erro.status || 500).json({
    ok: false,
    mensagem: erro.message || "Erro no cadastro de fornecedores."
  });
}

router.get("/", async (req, res) => {
  try {
    const fornecedores = await service.listar(req.query || {});
    res.json({ ok: true, fornecedores, dados: fornecedores });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/", async (req, res) => {
  try {
    const fornecedor = await service.criar(req.body || {});
    res.status(fornecedor.existente ? 200 : 201).json({
      ok: true,
      fornecedor,
      mensagem: fornecedor.existente ? "Fornecedor já existia no cadastro." : "Fornecedor cadastrado com sucesso."
    });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const fornecedor = await service.atualizar(req.params.id, req.body || {});
    if (!fornecedor) return res.status(404).json({ ok: false, mensagem: "Fornecedor não encontrado." });
    res.json({ ok: true, fornecedor, mensagem: "Fornecedor atualizado com sucesso." });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

export default router;
