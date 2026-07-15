import { Router } from "express";
import * as accessEngine from "../../access-engine/access-engine.service.mjs";
import * as biometria from "../../biometria/biometria.service.mjs";
import * as henry7x from "../../henry7x/henry7x.service.mjs";

const router = Router();

function respostaErro(res, error, status = 500) {
  return res.status(error?.status || status).json({
    ok: false,
    mensagem: error?.message || "Erro na central de acesso."
  });
}

async function capturar(nome, executor) {
  try {
    return { nome, disponivel: true, dados: await executor() };
  } catch (error) {
    return {
      nome,
      disponivel: false,
      erro: error?.message || String(error)
    };
  }
}

router.get("/status", async (_req, res) => {
  try {
    const [motorAcesso, agente, biometriaLocal] = await Promise.all([
      capturar("access-engine", () => accessEngine.dashboard()),
      capturar("fusion-access-agent", () => accessEngine.statusAgenteAcesso()),
      capturar("biometria-local", () => biometria.statusLocal())
    ]);

    const equipamentos = henry7x.listarEquipamentos();
    const motorBiometrico = biometria.statusMotor();

    res.json({
      ok: true,
      version: "3.0.0-acesso-final",
      canonicalApi: "/api/v3/access",
      canonicalPage: "/pages/access-engine/index.html",
      architecture: {
        accessEngine: "/api/access-engine",
        henry7x: "/api/henry7x",
        biometricAgent: process.env.BIOMETRIA_LOCAL_URL || "http://127.0.0.1:3041"
      },
      components: {
        motorAcesso,
        agente,
        biometriaLocal,
        motorBiometrico,
        henry7x: {
          disponivel: true,
          equipamentos: Array.isArray(equipamentos) ? equipamentos : (equipamentos?.equipamentos || equipamentos)
        }
      },
      policy: {
        physicalExecution: "fusion-access-agent",
        accessDecision: "access-engine",
        biometricSdk: "local-3041",
        directHenryRoutes: "compatibility-only"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    respostaErro(res, error);
  }
});

router.get("/dispositivos", async (_req, res) => {
  try {
    res.json({ ok: true, dispositivos: await accessEngine.listarDispositivos() });
  } catch (error) {
    respostaErro(res, error);
  }
});

router.post("/biometria/iniciar", async (_req, res) => {
  try {
    res.json(await biometria.iniciarMotorAcessoBiometrico());
  } catch (error) {
    respostaErro(res, error, 400);
  }
});

router.post("/biometria/parar", async (_req, res) => {
  try {
    res.json(await biometria.pararMotorAcessoBiometrico());
  } catch (error) {
    respostaErro(res, error, 400);
  }
});

router.post("/catraca/liberar", async (req, res) => {
  try {
    const payload = req.body || {};
    if (payload.modo === "direto") {
      return res.json(await henry7x.liberarCatraca(payload));
    }
    return res.status(202).json(await accessEngine.liberarRemoto({
      ...payload,
      operadorId: req.usuario?.id || payload.operadorId || null,
      origem: payload.origem || "v3-access-central"
    }));
  } catch (error) {
    return respostaErro(res, error, 400);
  }
});

router.get("/comandos/:id", async (req, res) => {
  try {
    res.json(await accessEngine.consultarComandoRemoto(req.params.id));
  } catch (error) {
    respostaErro(res, error, 404);
  }
});

export default router;
