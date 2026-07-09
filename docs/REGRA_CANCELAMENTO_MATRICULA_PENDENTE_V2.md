# Regra de cancelamento de matrícula pendente — v2

Correção aplicada para quando o aluno desiste/cancela matrícula pendente sem pagamento.

## Regra aplicada

Ao desligar/excluir/cancelar o aluno ou cancelar a matrícula:

- Mensalidades abertas vinculadas à matrícula são removidas.
- Lançamentos financeiros abertos vinculados são removidos.
- Recebimentos abertos vinculados são removidos.
- Check-ins/liberações pendentes são removidos ou bloqueados.
- Matrícula pendente sem pagamento é removida.
- Histórico pago, recebimento pago e movimento de caixa são preservados.

## Caso Adam Miguel

A matrícula `MAT-202607-000004` estava pendente e sem pagamento, mas gerou mensalidades e financeiro abertos. Agora, ao cancelar/desligar o aluno, essas pendências abertas deixam de aparecer no sistema.

Se houver pagamento confirmado, o sistema não apaga o histórico; apenas cancela a matrícula e limpa cobranças futuras em aberto.
