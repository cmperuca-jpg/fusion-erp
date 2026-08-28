import { estornarRecibo } from "./financeiro-ledger.service.mjs";
import {
  marcarReembolsoLocalConcluido,
  marcarReembolsoLocalPendente,
  prepararReembolsoExterno
} from "../pagamentos-online/reembolso.service.mjs";

const txt = (v) => String(v ?? "").trim();

export async function estornarReciboIntegrado(reciboId, dados = {}, contexto = {}) {
  const operacaoId = txt(
    dados.operacaoId ||
    dados.idempotencyKey ||
    contexto.operacaoId ||
    contexto.idempotencyKey
  );

  if (!operacaoId) {
    const e = new Error("O estorno exige Idempotency-Key.");
    e.status = 428;
    e.code = "FINANCIAL_IDEMPOTENCY_REQUIRED";
    throw e;
  }

  const pre = await prepararReembolsoExterno({
    reciboId,
    recebimento: contexto.recebimento || {},
    motivo: dados.motivo,
    operacaoId
  });

  if (pre.localJaConcluido) {
    if (pre.registroId) await marcarReembolsoLocalConcluido(pre.registroId, operacaoId);
    return { ok: true, idempotente: true, recibo: pre.recibo, reembolsoExterno: pre.resumo };
  }

  if (pre.aguardandoExterno) {
    return {
      ok: true,
      pendente: true,
      mensagem: "A devolução foi solicitada ao gateway e ainda aguarda confirmação. O recebimento continua intacto no Fusion até a confirmação real.",
      recibo: pre.recibo,
      reembolsoExterno: pre.resumo
    };
  }

  try {
    const resultado = await estornarRecibo(reciboId, {
      ...dados,
      operacaoId,
      idempotencyKey: dados.idempotencyKey || operacaoId
    });

    if (pre.registroId && pre.externamenteConcluido) {
      await marcarReembolsoLocalConcluido(pre.registroId, operacaoId);
    }

    return { ...resultado, reembolsoExterno: pre.resumo };
  } catch (erroLocal) {
    if (pre.registroId && pre.externamenteConcluido) {
      try {
        await marcarReembolsoLocalPendente(pre.registroId, operacaoId, erroLocal);
      } catch {}
      const e = new Error(
        `A devolução no gateway foi aceita, mas o estorno local ficou pendente: ${erroLocal.message}. NÃO repita a devolução no provedor; repita apenas esta operação no Fusion.`
      );
      e.status = 409;
      e.code = "REFUND_LOCAL_RECONCILIATION_REQUIRED";
      throw e;
    }
    throw erroLocal;
  }
}
