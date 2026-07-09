# Correção — Prontuário Financeiro

Arquivo alterado:

- public/pages/alunos/prontuario.js

Correção aplicada:

- A aba Financeiro do prontuário deixou de priorizar valorPago/valorRecebido para lançamentos em aberto.
- Agora o valor exibido usa primeiro o valor original/base do título: valorOriginal, valorTotalInicial, valorTotal, valorBruto, total, valor, valorMensal ou valorPlano.
- valorPago/valorRecebido só entra como fallback quando o lançamento está pago.
- O vencimento também ficou mais tolerante: vencimento, dataVencimento, data_vencimento, data ou competência.

Resultado esperado no aluno Marcos André:

- Mensalidade 2026-08 - marcos andre
- Vencimento 03/08/2026
- Valor R$ 65,00
- Status Aberto
