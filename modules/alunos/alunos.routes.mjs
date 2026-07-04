import { Router } from "express";
import * as alunosService from "./alunos.service.mjs";

const router = Router();

function erro(res, error, status = 500) {
  return res.status(error.status || status).json({
    ok: false,
    erro: error.message,
    mensagem: error.message
  });
}

router.get("/", async (req, res) => {
  try {
    const alunos = await alunosService.listar();
    res.json(alunos);
  } catch (error) {
    erro(res, error);
  }
});

router.post("/:id/desligar", async (req, res) => {
  try {
    const resultado = await alunosService.desligar(req.params.id, {
      usuario: req.body?.usuario || "sistema",
      motivo: req.body?.motivo || "Desligamento manual do aluno."
    });

    if (!resultado) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    res.json({
      ok: true,
      sucesso: true,
      resultado,
      mensagem: "Aluno desligado. Matrículas e cobranças abertas vinculadas foram canceladas; histórico pago e caixa foram preservados."
    });
  } catch (error) {
    erro(res, error);
  }
});


router.get("/:id/prontuario", async (req, res) => {
  try {
    const resultado = await alunosService.prontuario(req.params.id);

    if (!resultado) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    res.json(resultado);
  } catch (error) {
    erro(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const aluno = await alunosService.buscar(req.params.id);

    if (!aluno) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    res.json(aluno);
  } catch (error) {
    erro(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const aluno = await alunosService.criar(req.body);
    res.status(201).json({ ok: true, aluno, mensagem: "Aluno cadastrado com sucesso" });
  } catch (error) {
    erro(res, error, 400);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const aluno = await alunosService.atualizar(req.params.id, req.body);

    if (!aluno) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    res.json({ ok: true, aluno, mensagem: "Aluno atualizado com sucesso" });
  } catch (error) {
    erro(res, error, 400);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const resultado = await alunosService.excluir(req.params.id, {
      usuario: req.body?.usuario || "sistema",
      motivo: req.body?.motivo || "Exclusão/desligamento pelo cadastro de alunos.",
      forcar: req.body?.forcar || req.query?.forcar
    });

    if (!resultado?.ok) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    const mensagem = resultado.desligado
      ? "Aluno possui histórico financeiro e foi desligado com segurança. Cobranças abertas foram canceladas e histórico pago/caixa foi preservado."
      : "Aluno excluído definitivamente. Vínculos abertos foram cancelados.";

    res.json({ ok: true, sucesso: true, resultado, mensagem });
  } catch (error) {
    erro(res, error);
  }
});

export default router;
