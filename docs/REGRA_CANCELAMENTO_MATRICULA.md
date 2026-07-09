# Regra de cancelamento de matrícula

Quando o aluno desistir/cancelar matrícula pendente:

- Matrícula pendente sem pagamento: cancela a matrícula e remove mensalidades, lançamentos financeiros e recebimentos abertos gerados automaticamente.
- Matrícula com pagamento ou movimento de caixa: preserva histórico pago e cancela apenas cobranças abertas/futuras.
- Check-in/liberação do aluno é bloqueado.
- O aluno fica inativo quando o cancelamento ocorre pelo desligamento do aluno ou pela matrícula.
- A auditoria registra o resumo do que foi cancelado/removido.

Arquivos alterados:
- modules/alunos/alunos.service.mjs
- modules/alunos/alunos.routes.mjs
- modules/matriculas/matricula.integracao.service.mjs
- modules/matriculas/matricula.integracao.routes.mjs
