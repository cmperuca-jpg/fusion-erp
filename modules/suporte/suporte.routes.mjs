import express from "express";
import {
  obterOperadorSuporte,
  listarClientesSuporte,
  iniciarSessaoSuporte,
  encerrarSessaoSuporte
} from "./suporte.service.mjs";

const router = express.Router();

function tratar(res, error) {
  return res.status(error.status || 500).json({
    ok: false,
    mensagem: error.message || "Falha no serviço de suporte."
  });
}

router.get("/status", async (req, res) => {
  try {
    const operador = await obterOperadorSuporte(req.usuario || {});
    res.json({
      ok: true,
      autorizado: Boolean(operador),
      operador: operador || null
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.get("/clientes", async (req, res) => {
  try {
    res.json({ ok: true, clientes: await listarClientesSuporte(req.usuario || {}) });
  } catch (error) {
    tratar(res, error);
  }
});

router.post("/acesso", async (req, res) => {
  try {
    const resultado = await iniciarSessaoSuporte(req.usuario || {}, req.body || {}, {
      ip: req.ip || req.socket?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || ""
    });
    res.status(201).json(resultado);
  } catch (error) {
    tratar(res, error);
  }
});

router.post("/acesso/encerrar", async (req, res) => {
  try {
    res.json(await encerrarSessaoSuporte(req.usuario || {}));
  } catch (error) {
    tratar(res, error);
  }
});

export default router;
