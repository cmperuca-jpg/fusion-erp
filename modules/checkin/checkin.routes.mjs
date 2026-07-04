import express from "express";
import {
  listarRegistros,
  obterResumoCheckin,
  registrarEntrada,
  registrarEntradaComercial,
  autorizarCheckinComercial,
  autorizarCheckinMusculacao,
  registrarCheckinMusculacaoInteligente,
  registrarSaida,
  atualizarRegistro,
  excluirRegistro
} from "./checkin.service.mjs";

const router = express.Router();

function tratarErro(res, erro) {
  return res.status(erro.status || 500).json({
    ok: false,
    mensagem: erro.message || "Erro no módulo de check-in."
  });
}

router.get("/", async (req, res) => {
  try {
    const registros = await listarRegistros(req.query);
    res.json({ ok: true, registros });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/resumo", async (req, res) => {
  try {
    const resumo = await obterResumoCheckin();
    res.json({ ok: true, resumo });
  } catch (erro) {
    tratarErro(res, erro);
  }
});


router.get("/musculacao/autorizacao", async (req, res) => {
  try {
    const autorizacao = await autorizarCheckinMusculacao(req.query || {});
    res.json(autorizacao);
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/musculacao", async (req, res) => {
  try {
    const resultado = await registrarCheckinMusculacaoInteligente(req.body || {});
    res.status(201).json(resultado);
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/comercial/autorizacao", async (req, res) => {
  try {
    const autorizacao = await autorizarCheckinComercial(req.query || {});
    res.json(autorizacao);
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/comercial", async (req, res) => {
  try {
    const resultado = await registrarEntradaComercial(req.body || {});
    res.status(201).json(resultado);
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/", async (req, res) => {
  try {
    const registro = await registrarEntrada(req.body);
    res.status(201).json({ ok: true, registro });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.patch("/:id/saida", async (req, res) => {
  try {
    const registro = await registrarSaida(req.params.id);

    if (!registro) {
      return res.status(404).json({
        ok: false,
        mensagem: "Registro não encontrado"
      });
    }

    res.json({ ok: true, registro });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const registro = await atualizarRegistro(req.params.id, req.body);

    if (!registro) {
      return res.status(404).json({
        ok: false,
        mensagem: "Registro não encontrado"
      });
    }

    res.json({ ok: true, registro });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const registro = await excluirRegistro(req.params.id);

    if (!registro) {
      return res.status(404).json({
        ok: false,
        mensagem: "Registro não encontrado"
      });
    }

    res.json({ ok: true, registro });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

export default router;
