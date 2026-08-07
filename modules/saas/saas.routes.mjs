import express from "express";
import { criarEmpresa } from "./saas.service.mjs";

const router = express.Router();

router.post("/empresas", async (req,res) => {
  try {
    const resultado = await criarEmpresa(req.body || {});
    res.status(201).json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ ok:false, mensagem:error.message || "Não foi possível criar a empresa." });
  }
});

export default router;
