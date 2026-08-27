import { Router } from "express";
import * as service from "./agenda-avaliacoes.service.mjs";

const router = Router();

function tratarErro(res, erro, padrao = 500) {
  return res.status(erro.status || padrao).json({
    ok: false,
    mensagem: erro.message || "Erro na agenda de avaliações."
  });
}

router.get("/", async (req, res) => {
  try {
    const filtros = { ...(req.query || {}) };

    if (
      req.usuario?.portal === true &&
      req.usuario?.portalTipo === "professor"
    ) {
      filtros.professorId = String(req.usuario.id || "").trim();
    }

    const agenda = await service.listar(filtros);
    res.json({ ok: true, agenda });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/", async (req, res) => {
  if (req.usuario?.portal === true) {
    return res.status(403).json({
      ok: false,
      mensagem: "Agendamentos devem ser criados pelo sistema administrativo."
    });
  }

  try {
    const agendamento = await service.criar(req.body || {});
    res.status(201).json({
      ok: true,
      agendamento,
      mensagem: "Avaliação agendada com sucesso."
    });
  } catch (erro) {
    tratarErro(res, erro, 400);
  }
});

export default router;
