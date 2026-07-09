# Fusion ERP — Cancelamento de matrícula pendente v4

Arquivo alterado:

- `modules/matriculas/matricula.integracao.service.mjs`

Correção aplicada:

- Matrícula cancelada não é mais removida do JSON; ela permanece como histórico com status `Cancelada`.
- Pendências abertas continuam sendo removidas de mensalidades, financeiro e check-ins.
- Vínculos futuros da matrícula são limpos:
  - `mensalidadeProximaId`
  - `financeiroProximoId`
  - `proximoVencimento`
- Se não houve pagamento real, também limpa:
  - `mensalidadeInicialId`
  - `financeiroInicialId`
  - `recebimentoPromocionalId`
  - `valorTotalInicial`
  - `valorRestante`
  - `saldoRestante`
- Cadastro do aluno passa a refletir `statusMatricula = Cancelada` e remove vencimento futuro.

Após aplicar, cancele novamente a matrícula do Adam ou altere o status da matrícula para `Cancelada` para rodar a limpeza v4.
