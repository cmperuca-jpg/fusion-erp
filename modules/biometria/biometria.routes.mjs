import { Router } from "express";
import {
  executarBiometria,
  enfileirarBiometria,
  consultarComandoBiometria
} from "./biometria-bridge.service.mjs";
import {
  listarPessoasBiometria,
  obterPessoaBiometria
} from "./biometria-pessoas.service.mjs";

const router = Router();

function tratar(res, error) {
  res.status(error?.status || error?.statusCode || 500).json({
    ok: false,
    mensagem: error?.message || "Não foi possível concluir a operação com a digital."
  });
}

async function pessoaDoPayload(body = {}) {
  const tipoPessoa = String(
    body.tipoPessoa ||
    (body.pessoaId ? "aluno" : "aluno")
  ).trim().toLowerCase();

  const pessoaId = String(body.pessoaId || body.alunoId || "").trim();
  if (!pessoaId) {
    const erro = new Error("Selecione uma pessoa para cadastrar a digital.");
    erro.status = 400;
    throw erro;
  }

  return obterPessoaBiometria(tipoPessoa, pessoaId);
}

router.get("/status", async (req, res) => {
  try {
    const { result } = await executarBiometria(
      "biometria_status",
      {},
      { ttlSeconds: 15, timeoutMs: 9000 }
    );

    res.json({
      ok: true,
      local: {
        ok: result?.ok !== false,
        conectado: result?.conectado === true,
        monitorAtivo: result?.monitorAtivo === true,
        monitorSaudavel: result?.monitorSaudavel === true,
        sensor: result?.sensor || "Leitor de digital",
        templateExposto: false
      }
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.get("/pessoas", async (req, res) => {
  try {
    const pessoas = await listarPessoasBiometria({
      tipo: req.query?.tipo || "",
      busca: req.query?.busca || ""
    });

    res.json({
      ok: true,
      total: pessoas.length,
      pessoas
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.get("/pessoa/:tipoPessoa/:pessoaId", async (req, res) => {
  try {
    const pessoa = await obterPessoaBiometria(
      req.params.tipoPessoa,
      req.params.pessoaId
    );

    const { result } = await executarBiometria(
      "biometria_exists",
      { alunoId: pessoa.id },
      { ttlSeconds: 15, timeoutMs: 9000 }
    );

    res.json({
      ok: true,
      pessoa,
      biometria: {
        cadastrada: result?.existe === true,
        armazenamento: "local-protegido",
        templateExposto: false
      }
    });
  } catch (error) {
    tratar(res, error);
  }
});

// Compatibilidade com as telas de aluno já existentes.
router.get("/aluno/:alunoId", async (req, res) => {
  try {
    const pessoa = await obterPessoaBiometria("aluno", req.params.alunoId);
    const { result } = await executarBiometria(
      "biometria_exists",
      { alunoId: pessoa.id },
      { ttlSeconds: 15, timeoutMs: 9000 }
    );

    res.json({
      ok: true,
      biometria: result?.existe === true
        ? {
            alunoId: pessoa.id,
            cadastrada: true,
            armazenamento: "local-protegido",
            templateExposto: false
          }
        : null
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.post("/sdk/cadastrar", async (req, res) => {
  try {
    const pessoa = await pessoaDoPayload(req.body || {});

    const command = await enfileirarBiometria(
      "biometria_enroll",
      { alunoId: pessoa.id },
      120
    );

    res.status(202).json({
      ok: true,
      commandId: command.id,
      status: command.status,
      pessoa: {
        nome: pessoa.nome,
        tipoPessoa: pessoa.tipoPessoa,
        perfilRotulo: pessoa.perfilRotulo
      },
      progresso: {
        percentual: 2,
        etapa: "fila",
        mensagem: "Cadastro enviado ao leitor da academia.",
        atividade: 0
      }
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.get("/sdk/comandos/:commandId", async (req, res) => {
  try {
    const command = await consultarComandoBiometria(req.params.commandId);
    const result =
      command.result && typeof command.result === "object"
        ? command.result
        : {};
    const progress =
      result.progress && typeof result.progress === "object"
        ? result.progress
        : null;

    if (command.status === "completed") {
      const qualidade = Number(result.qualidade || 0);

      return res.json({
        ok: true,
        status: command.status,
        commandId: command.id,
        progresso: {
          percentual: 100,
          etapa: "concluido",
          mensagem: "Digital cadastrada e protegida no computador da academia.",
          atividade: 3
        },
        biometria: {
          cadastrada: true,
          qualidade: qualidade > 0 ? qualidade : undefined,
          qualidadeMedia: qualidade > 0 ? qualidade : undefined,
          armazenamento: "local-protegido",
          templateExposto: false
        },
        mensagem: "Digital cadastrada com sucesso."
      });
    }

    return res.json({
      ok: true,
      status: command.status,
      commandId: command.id,
      progresso: progress,
      erro:
        command.status === "failed"
          ? command.error || "Falha no cadastro da digital."
          : "",
      mensagem:
        command.status === "failed"
          ? command.error || "Falha no cadastro da digital."
          : ""
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.delete("/pessoa/:tipoPessoa/:pessoaId", async (req, res) => {
  try {
    const pessoa = await obterPessoaBiometria(
      req.params.tipoPessoa,
      req.params.pessoaId
    );

    const { command, result } = await executarBiometria(
      "biometria_delete",
      { alunoId: pessoa.id },
      { ttlSeconds: 20, timeoutMs: 12000 }
    );

    res.json({
      ok: true,
      removido: result?.removido === true,
      commandId: command.id,
      templateExposto: false
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.delete("/aluno/:alunoId", async (req, res) => {
  try {
    const pessoa = await obterPessoaBiometria("aluno", req.params.alunoId);
    const { command, result } = await executarBiometria(
      "biometria_delete",
      { alunoId: pessoa.id },
      { ttlSeconds: 20, timeoutMs: 12000 }
    );

    res.json({
      ok: true,
      removido: result?.removido === true,
      commandId: command.id,
      templateExposto: false
    });
  } catch (error) {
    tratar(res, error);
  }
});

export default router;
