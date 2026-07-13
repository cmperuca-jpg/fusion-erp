import { Router } from "express";
import {
  analisarAlunosTxt,
  importarAlunosLocal,
  importarAlunosSupabase,
  lerRelatorio
} from "./importador-access.service.mjs";
import {
  analisarFotosAccess,
  importarFotosAccess,
  analisarFotosAccessLocal,
  importarFotosAccessLocal,
  lerRelatorioFotosAccess
} from "./importador-fotos.service.mjs";
import {
  analisarAvaliacoesAccess,
  importarAvaliacoesAccessLocal,
  analisarAvaliacoesAccessLocal,
  importarAvaliacoesAccessLocalArquivos,
  lerRelatorioAvaliacoesAccess
} from "./importador-avaliacoes.service.mjs";

const router = Router();

function obterPayload(req) {
  return {
    conteudo: req.body?.conteudo || req.body?.texto || "",
    nomeArquivo: req.body?.nomeArquivo || req.body?.arquivo || "Alunos.txt"
  };
}

function erro(res, error, status = 500) {
  return res.status(error.status || status).json({ ok: false, erro: error.message, mensagem: error.message });
}

function obterPayloadFotos(req) {
  return {
    fotosTxt: req.body?.fotosTxt || req.body?.conteudoFotos || req.body?.textoFotos || "",
    zipBase64: req.body?.zipBase64 || req.body?.fotosZipBase64 || "",
    nomeZip: req.body?.nomeZip || req.body?.arquivoZip || "Fotos.zip"
  };
}

function obterArquivosAvaliacoes(req) {
  return req.body?.arquivos && typeof req.body.arquivos === "object" ? req.body.arquivos : {};
}

router.get("/status", async (req, res) => {
  try { res.json(await lerRelatorio()); } catch (error) { erro(res, error); }
});

router.post("/analisar", async (req, res) => {
  try {
    const { conteudo, nomeArquivo } = obterPayload(req);
    if (!conteudo) return res.status(400).json({ ok: false, mensagem: "Envie o conteúdo do arquivo exportado do Access." });
    const resultado = analisarAlunosTxt(conteudo, nomeArquivo);
    const { alunos, ...resumo } = resultado;
    res.json(resumo);
  } catch (error) { erro(res, error, 400); }
});

router.post("/importar-local", async (req, res) => {
  try {
    const { conteudo, nomeArquivo } = obterPayload(req);
    if (!conteudo) return res.status(400).json({ ok: false, mensagem: "Envie o conteúdo do arquivo exportado do Access." });
    const resultado = await importarAlunosLocal({ conteudo, nomeArquivo, dryRun: Boolean(req.body?.dryRun) });
    res.json(resultado);
  } catch (error) { erro(res, error, 400); }
});

router.post("/importar-supabase", async (req, res) => {
  try {
    const { conteudo, nomeArquivo } = obterPayload(req);
    if (!conteudo) return res.status(400).json({ ok: false, mensagem: "Envie o conteúdo do arquivo exportado do Access." });
    const resultado = await importarAlunosSupabase({
      conteudo,
      nomeArquivo,
      tabela: req.body?.tabela || "alunos",
      lote: Number(req.body?.lote || 500),
      dryRun: Boolean(req.body?.dryRun)
    });
    res.json(resultado);
  } catch (error) { erro(res, error, 400); }
});

router.get("/fotos/status", async (req, res) => {
  try { res.json(await lerRelatorioFotosAccess()); } catch (error) { erro(res, error); }
});

router.post("/fotos/analisar", async (req, res) => {
  try {
    const payload = obterPayloadFotos(req);
    if (!payload.fotosTxt) return res.status(400).json({ ok: false, mensagem: "Envie o arquivo Fotos.txt." });
    if (!payload.zipBase64) return res.status(400).json({ ok: false, mensagem: "Envie o arquivo Fotos.zip." });
    res.json(await analisarFotosAccess(payload));
  } catch (error) { erro(res, error, 400); }
});

router.post("/fotos/importar-local", async (req, res) => {
  try {
    const payload = obterPayloadFotos(req);
    if (!payload.fotosTxt) return res.status(400).json({ ok: false, mensagem: "Envie o arquivo Fotos.txt." });
    if (!payload.zipBase64) return res.status(400).json({ ok: false, mensagem: "Envie o arquivo Fotos.zip." });
    res.json(await importarFotosAccess(payload));
  } catch (error) { erro(res, error, 400); }
});

router.post("/fotos/analisar-local", async (req, res) => {
  try { res.json(await analisarFotosAccessLocal()); } catch (error) { erro(res, error, 400); }
});

router.post("/fotos/importar-local-arquivos", async (req, res) => {
  try { res.json(await importarFotosAccessLocal()); } catch (error) { erro(res, error, 400); }
});

router.get("/avaliacoes/status", async (req, res) => {
  try { res.json(await lerRelatorioAvaliacoesAccess()); } catch (error) { erro(res, error); }
});

router.post("/avaliacoes/analisar", async (req, res) => {
  try {
    const arquivos = obterArquivosAvaliacoes(req);
    const resultado = await analisarAvaliacoesAccess({ arquivos });
    res.json(resultado);
  } catch (error) { erro(res, error, 400); }
});

router.post("/avaliacoes/importar-local", async (req, res) => {
  try {
    const arquivos = obterArquivosAvaliacoes(req);
    const resultado = await importarAvaliacoesAccessLocal({ arquivos, dryRun: Boolean(req.body?.dryRun) });
    res.json(resultado);
  } catch (error) { erro(res, error, 400); }
});

router.post("/avaliacoes/analisar-local", async (req, res) => {
  try { res.json(await analisarAvaliacoesAccessLocal()); } catch (error) { erro(res, error, 400); }
});

router.post("/avaliacoes/importar-local-arquivos", async (req, res) => {
  try { res.json(await importarAvaliacoesAccessLocalArquivos({ dryRun: Boolean(req.body?.dryRun) })); } catch (error) { erro(res, error, 400); }
});

export default router;
