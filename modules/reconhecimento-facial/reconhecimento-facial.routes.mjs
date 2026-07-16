import crypto from "node:crypto";
import { Router } from "express";
import { validarToken } from "../auth/auth.service.mjs";
import { validateAgent } from "../access-bridge/access-bridge.service.mjs";
import {
  cadastrarRosto,
  finalizarTarefaFacial,
  identificarRosto,
  listarAlunosParaCadastro,
  listarCadastros,
  listarEventos,
  obterTarefaFacial,
  removerRosto,
  statusFacial,
  tokenTerminal,
  validarTokenTerminal
} from "./reconhecimento-facial.service.mjs";

const router = Router();
const acessos = new Map();
const desafios = new Map();
const pareamentos = new Map();
const tentativasPareamento = new Map();

function respostaErro(res, erro) {
  return res.status(erro.status || 500).json({ ok: false, mensagem: erro.message || "Erro no reconhecimento facial." });
}

async function autenticarGestor(req, res, next) {
  try {
    const usuario = await validarToken(req.headers.authorization || "");
    const perfil = String(usuario.perfil || "").toLowerCase();
    const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
    if (!["admin", "administrador", "recepcao", "responsavel_tecnico"].includes(perfil) && !permissoes.some(p => ["*", "alunos", "access-engine"].includes(p))) {
      return res.status(403).json({ ok: false, mensagem: "Usuário sem permissão para biometria facial." });
    }
    req.usuario = usuario;
    next();
  } catch (erro) { respostaErro(res, erro); }
}

function autenticarTerminal(req, res, next) {
  if (!validarTokenTerminal(req.get("x-facial-terminal-token"))) return res.status(401).json({ ok: false, mensagem: "Terminal facial não autorizado." });
  const chave = `${req.ip}:${req.get("x-facial-terminal-id") || "terminal"}`;
  const agora = Date.now();
  const janela = (acessos.get(chave) || []).filter(item => agora - item < 60_000);
  if (janela.length >= 40) return res.status(429).json({ ok: false, mensagem: "Aguarde alguns segundos antes de tentar novamente." });
  janela.push(agora); acessos.set(chave, janela);
  next();
}

router.post("/terminal/codigo", autenticarGestor, (req, res) => {
  const agora = Date.now();
  for (const [codigo, item] of pareamentos) if (item.expiraEm <= agora || item.usado) pareamentos.delete(codigo);
  let codigo;
  do { codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0"); } while (pareamentos.has(codigo));
  pareamentos.set(codigo, { expiraEm: agora + 10 * 60 * 1000, usado: false });
  res.status(201).json({ ok: true, codigo, expiraEm: new Date(agora + 10 * 60 * 1000).toISOString() });
});
router.post("/terminal/parear", (req, res) => {
  const chave = String(req.ip || "terminal");
  const agora = Date.now();
  const limite = tentativasPareamento.get(chave) || { inicio: agora, total: 0 };
  if (agora - limite.inicio > 10 * 60 * 1000) { limite.inicio = agora; limite.total = 0; }
  limite.total += 1; tentativasPareamento.set(chave, limite);
  if (limite.total > 12) return res.status(429).json({ ok: false, mensagem: "Muitas tentativas. Aguarde dez minutos." });
  const codigo = String(req.body?.codigo || "").replace(/\D/g, "").slice(0, 6);
  const item = pareamentos.get(codigo);
  if (!item || item.usado || item.expiraEm <= agora) return res.status(400).json({ ok: false, mensagem: "Código inválido ou expirado." });
  const token = tokenTerminal();
  if (!token) return res.status(503).json({ ok: false, mensagem: "Terminal ainda não habilitado no servidor." });
  item.usado = true;
  res.json({ ok: true, token, terminalId: textoTerminal(req.body?.terminalId) });
});

function textoTerminal(valor) { return String(valor || "entrada-principal").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "entrada-principal"; }

router.get("/terminal/status", autenticarTerminal, (req, res) => res.json({ ok: true, ...statusFacial() }));
router.get("/terminal/desafio", autenticarTerminal, (req, res) => {
  const desafio = crypto.randomInt(0, 2) ? "esquerda" : "direita";
  const terminalId = req.get("x-facial-terminal-id") || "terminal";
  const desafioId = crypto.randomUUID();
  desafios.set(terminalId, { desafioId, desafio, expiraEm: Date.now() + 20_000 });
  res.json({ ok: true, desafioId, desafio, instrucao: desafio === "esquerda" ? "Vire levemente o rosto para a esquerda" : "Vire levemente o rosto para a direita" });
});
router.post("/terminal/identificar", autenticarTerminal, async (req, res) => {
  try {
    const terminalId = req.get("x-facial-terminal-id") || "terminal";
    const esperado = desafios.get(terminalId);
    desafios.delete(terminalId);
    if (!esperado || esperado.expiraEm < Date.now() || esperado.desafioId !== req.body?.desafioId || esperado.desafio !== req.body?.desafio) {
      return res.status(400).json({ ok: false, mensagem: "Desafio facial expirado. Tente novamente." });
    }
    const resultado = await identificarRosto({ ...(req.body || {}), terminalId });
    res.json({ ok: true, ...resultado });
  } catch (erro) { respostaErro(res, erro); }
});

router.get("/status", autenticarGestor, (req, res) => res.json({ ok: true, ...statusFacial() }));
router.get("/alunos", autenticarGestor, async (req, res) => {
  try { res.json({ ok: true, alunos: await listarAlunosParaCadastro() }); } catch (erro) { respostaErro(res, erro); }
});
router.get("/cadastros", autenticarGestor, async (req, res) => {
  try { res.json({ ok: true, cadastros: await listarCadastros() }); } catch (erro) { respostaErro(res, erro); }
});
router.get("/eventos", autenticarGestor, async (req, res) => {
  try { res.json({ ok: true, eventos: await listarEventos(req.query.limite) }); } catch (erro) { respostaErro(res, erro); }
});
router.post("/cadastros/:alunoId", autenticarGestor, async (req, res) => {
  try { res.status(201).json({ ok: true, cadastro: await cadastrarRosto({ alunoId: req.params.alunoId, imagens: req.body?.imagens, consentimento: req.body?.consentimento === true, usuario: req.usuario }) }); } catch (erro) { respostaErro(res, erro); }
});
router.delete("/cadastros/:alunoId", autenticarGestor, async (req, res) => {
  try { res.json({ ok: true, cadastro: await removerRosto(req.params.alunoId, req.usuario) }); } catch (erro) { respostaErro(res, erro); }
});

router.get("/agent/next", (req, res) => {
  const agentId = validateAgent(req);
  if (!agentId) return res.status(401).json({ ok: false, mensagem: "Agente não autorizado." });
  const tarefa = obterTarefaFacial(agentId, { versao: req.get("x-facial-agent-version"), motor: req.get("x-facial-engine-status") });
  return res.json({ ok: true, tarefa });
});
router.post("/agent/tasks/:id/result", (req, res) => {
  const agentId = validateAgent(req);
  if (!agentId) return res.status(401).json({ ok: false, mensagem: "Agente não autorizado." });
  const tarefa = finalizarTarefaFacial(req.params.id, agentId, req.body || {});
  if (!tarefa) return res.status(404).json({ ok: false, mensagem: "Tarefa facial não encontrada ou expirada." });
  return res.json({ ok: true, tarefa });
});

export default router;
