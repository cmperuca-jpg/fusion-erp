import express from 'express';
import {
  listarMensalidades,
  resumoMensalidades,
  criarMensalidade,
  gerarMensalidades,
  atualizarMensalidade,
  cancelarMensalidade,
  excluirMensalidade,
  historicoAluno,
  garantirLancamentoFinanceiroMensalidade
} from './mensalidades.service.mjs';
import { listarTitulos, receberTitulos, estornarRecibo } from './financeiro-ledger.service.mjs';
import { programarProximaCobrancaAposPagamento } from '../cobranca/cobranca.service.mjs';

const router = express.Router();

function tratarErro(res, erro) {
  const status = erro.status || 500;
  res.status(status).json({
    erro: true,
    mensagem: erro.message || 'Erro interno.'
  });
}

router.get('/', async (req, res) => {
  try {
    res.json(await listarMensalidades(req.query));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get('/resumo', async (req, res) => {
  try {
    res.json(await resumoMensalidades(req.query));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get('/aluno/:alunoId', async (req, res) => {
  try {
    res.json(await historicoAluno(req.params.alunoId));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await criarMensalidade(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/gerar', async (req, res) => {
  try {
    res.status(201).json(await gerarMensalidades(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await atualizarMensalidade(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/:id/financeiro', async (req, res) => {
  try {
    res.json(await garantirLancamentoFinanceiroMensalidade(req.params.id));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/:id/baixar', async (req, res) => {
  try {
    const mensalidades = await listarMensalidades({});
    const mensalidade = (Array.isArray(mensalidades) ? mensalidades : mensalidades.mensalidades || [])
      .find((item) => String(item.id) === String(req.params.id));
    if (!mensalidade) return res.status(404).json({ erro: true, mensagem: 'Mensalidade não encontrada.' });
    const titulos = await listarTitulos({});
    const titulo = titulos.find((item) => String(item.mensalidadeId) === String(mensalidade.id) ||
      String(item.id) === String(mensalidade.lancamentoFinanceiroId || mensalidade.financeiroId));
    if (!titulo) return res.status(409).json({ erro: true, mensagem: 'Esta mensalidade não possui título financeiro vinculado. Reconcilie o cadastro antes de baixar.' });
    const resultado = await receberTitulos({
      ...(req.body || {}),
      tituloId: titulo.id,
      valor: req.body?.valorPago ?? req.body?.valor,
      operacaoId: req.body?.operacaoId || `mensalidade-${mensalidade.id}-${Date.now()}`
    });
    let cobrancaAutomatica = { ok: true, programada: false };
    if (!resultado.idempotente) try {
      cobrancaAutomatica = await programarProximaCobrancaAposPagamento({
        financeiroId: titulo.id, mensalidadeId: mensalidade.id, alunoId: titulo.alunoId || mensalidade.alunoId,
        usuario: req.body?.usuario || 'mensalidades'
      });
    } catch (erroAgenda) { cobrancaAutomatica = { ok: false, aviso: true, programada: false, motivo: erroAgenda.message }; }
    res.json({ ok: true, ...resultado, cobrancaAutomatica });
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/:id/estornar', async (req, res) => {
  try {
    const mensalidades = await listarMensalidades({});
    const mensalidade = (Array.isArray(mensalidades) ? mensalidades : mensalidades.mensalidades || [])
      .find((item) => String(item.id) === String(req.params.id));
    if (!mensalidade) return res.status(404).json({ erro: true, mensagem: 'Mensalidade não encontrada.' });
    const titulos = await listarTitulos({});
    const titulo = titulos.find((item) => String(item.mensalidadeId) === String(mensalidade.id) ||
      String(item.id) === String(mensalidade.lancamentoFinanceiroId || mensalidade.financeiroId));
    const reciboId = mensalidade.ultimoReciboId || titulo?.ultimoReciboId;
    if (!reciboId) return res.status(409).json({ erro: true, mensagem: 'Baixa legada sem recibo. Não é seguro estornar por esta tela: use a reconciliação antes de alterar caixa ou financeiro.' });
    res.json(await estornarRecibo(reciboId, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/:id/cancelar', async (req, res) => {
  try {
    res.json(await cancelarMensalidade(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    res.json(await excluirMensalidade(req.params.id));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

export default router;
