# Ajuste do fluxo de matricula

Data: 2026-07-12

Regra retomada:

- Novo aluno precisa selecionar um plano.
- Ao salvar novo aluno, o sistema cria a matricula vinculada ao plano.
- O financeiro inicial e a mensalidade usam valor do plano, taxa de matricula e desconto.
- Turma nao entra no financeiro.
- Alterar turma de uma matricula existente nao cria, remove nem recalcula lancamentos financeiros.
- Alterar plano continua sendo uma alteracao financeira e deve ser feita com cuidado.

O que mudou:

- Removido o fluxo de "cadastro sem matricula" para novos alunos.
- Tela de matricula voltou a tratar turma como vinculo operacional.
- Backend recebeu rota para atualizar turma sem mexer em mensalidade/financeiro.
- Valores de turma passaram a ser ignorados no calculo financeiro da matricula.

Teste feito:

- Criacao de matricula com turma em base temporaria.
- Valor de turma ficou zero no financeiro.
- Alteracao de turma nao alterou a quantidade de lancamentos financeiros.
