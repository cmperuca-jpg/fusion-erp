import express from 'express';
import {
  listarRecebimentos,
  resumoRecebimentos,
  criarRecebimento,
  obterRecebimento,
  atualizarRecebimento,
  cancelarRecebimento,
  excluirRecebimento
} from './recebimentos.service.mjs';
import { listarTitulos, receberTitulos, estornarRecibo } from './financeiro-ledger.service.mjs';
import { programarProximaCobrancaAposPagamento } from '../cobranca/cobranca.service.mjs';

const router = express.Router();

function tratarErro(res, erro) {
  res.status(erro.status || 500).json({
    erro: true,
    mensagem: erro.message || 'Erro interno.'
  });
}

router.get('/', async (req, res) => {
  try {
    res.json(await listarRecebimentos(req.query));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get('/resumo', async (req, res) => {
  try {
    res.json(await resumoRecebimentos(req.query));
  } catch (erro) {
    tratarErro(res, erro);
  }
});


router.get('/:id', async (req, res) => {
  try {
    res.json(await obterRecebimento(req.params.id));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await criarRecebimento(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await atualizarRecebimento(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});


async function confirmarPeloLedger(req, res) {
  try {
    const recebimento = await obterRecebimento(req.params.id);
    if (!recebimento) return res.status(404).json({ erro: true, mensagem: 'Recebimento não encontrado.' });
    const titulos = await listarTitulos({});
    const titulo = titulos.find((item) => String(item.id) === String(recebimento.lancamentoFinanceiroId || recebimento.financeiroId));
    if (!titulo) return res.status(409).json({ erro: true, mensagem: 'Recebimento sem título financeiro vinculado. Reconcilie o cadastro antes de confirmar.' });
    const resultado = await receberTitulos({ ...(req.body || {}), tituloId: titulo.id, operacaoId: req.body?.operacaoId || req.body?.idempotencyKey || `recebimento-${recebimento.id}-${Date.now()}` });
    let cobrancaAutomatica = { ok: true, programada: false };
    if (!resultado.idempotente) try { cobrancaAutomatica = await programarProximaCobrancaAposPagamento({ financeiroId: titulo.id, mensalidadeId: recebimento.mensalidadeId || titulo.mensalidadeId, alunoId: titulo.alunoId || recebimento.alunoId, usuario: req.body?.usuario || 'recebimentos' }); } catch (erroAgenda) { cobrancaAutomatica = { ok: false, aviso: true, programada: false, motivo: erroAgenda.message }; }
    res.json({ ok: true, ...resultado, cobrancaAutomatica });
  } catch (erro) {
    tratarErro(res, erro);
  }
}
router.post('/:id/baixar', confirmarPeloLedger);
router.post('/:id/confirmar', confirmarPeloLedger);

router.post('/:id/estornar', async (req, res) => {
  try {
    const recebimento = await obterRecebimento(req.params.id);
    if (!recebimento) return res.status(404).json({ erro: true, mensagem: 'Recebimento não encontrado.' });
    if (!recebimento.reciboId) return res.status(409).json({ erro: true, mensagem: 'Recebimento legado sem recibo. Não é seguro estornar por esta tela: reconcilie-o antes.' });
    res.json(await estornarRecibo(recebimento.reciboId, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/:id/cancelar', async (req, res) => {
  try {
    res.json(await cancelarRecebimento(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    res.json(await excluirRecebimento(req.params.id));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

export default router;
