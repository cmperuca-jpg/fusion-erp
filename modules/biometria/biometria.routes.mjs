import { Router } from "express";
import * as service from "./biometria.service.mjs";

const router = Router();

const tratar = (res, e) =>
  res.status(e.status || 500).json({
    ok: false,
    mensagem: e.message || "Erro biométrico."
  });


router.get("/status", async (req, res) => {
  try {
    res.json({
      ok: true,
      local: await service.statusLocal()
    });
  } catch (e) {
    tratar(res, e);
  }
});


router.get("/motor/status", (req, res) => {
  res.json(service.statusMotor());
});


router.post("/motor/iniciar", async (req, res) => {
  try {
    res.json(await service.iniciarMotorAcessoBiometrico());
  } catch (e) {
    tratar(res, e);
  }
});


router.post("/motor/parar", async (req, res) => {
  try {
    res.json(await service.pararMotorAcessoBiometrico());
  } catch (e) {
    tratar(res, e);
  }
});


router.post("/sdk/cadastrar", async (req, res) => {
  try {
    res.status(201).json({
      ok: true,
      biometria: await service.cadastrarSdk(req.body || {}),
      mensagem: "Template Futronic cadastrado."
    });
  } catch (e) {
    tratar(res, e);
  }
});


// ADICIONAR ESTA ROTA
router.get("/sdk/templates-monitor", async (req, res) => {
  try {
    const templates = await service.listarTemplatesMonitor();

    res.json({
      ok: true,
      templates
    });

  } catch (e) {
    tratar(res, e);
  }
});


router.post("/sdk/identificar", async (req, res) => {
  try {
    res.json({
      ok: true,
      resultado: await service.identificarSdk()
    });
  } catch (e) {
    tratar(res, e);
  }
});


router.post("/sdk/acesso", async (req, res) => {
  try {
    res.json(
      await service.processarAcessoBiometrico(req.body || {})
    );
  } catch (e) {
    tratar(res, e);
  }
});


router.get("/aluno/:alunoId", async (req, res) => {
  try {
    res.json({
      ok: true,
      biometria: await service.obterBiometriaAluno(req.params.alunoId)
    });
  } catch (e) {
    tratar(res, e);
  }
});


router.delete("/aluno/:alunoId", async (req, res) => {
  try {
    res.json({
      ok: true,
      ...await service.excluirBiometriaAluno(req.params.alunoId)
    });
  } catch (e) {
    tratar(res, e);
  }
});


export default router;