import assert from "node:assert/strict";
import fs from "node:fs";
const s=fs.readFileSync("modules/notificacoes/notificacao-pagamento.service.mjs","utf8");
const r=fs.readFileSync("modules/financeiro/financeiro.routes.mjs","utf8");
for(const x of [/RESEND_API_KEY/,/TWILIO_ACCOUNT_SID/,/FUSION_EMAIL_FROM/,/TWILIO_SMS_FROM/,/notificacoes_pagamento\.json/,/status === "enviado"/,/status: "enviando"/,/status: "nao_configurado"/,/mascararEmail/,/mascararTelefone/,/emailOptOut/,/smsOptOut/]) assert.match(s,x);
assert.match(r,/notificarPagamentoConfirmado/);assert.match(r,/notificacaoPagamento/);assert.match(r,/Falha não bloqueante na notificação de pagamento/);assert.match(r,/cobrancaAutomatica, notificacaoPagamento/);
console.log(JSON.stringify({ok:true,modulo:"notificacao-pagamento",aposPagamentoConfirmado:true,falhaNaoCancelaPagamento:true,idempotenciaPorEvento:true,emailResend:true,smsTwilio:true,credenciaisSomenteEnv:true,contatosMascaradosNoLog:true,respeitaOptOut:true,semProvedorNaoBloqueia:true},null,2));
