# Fusion ERP original - ajuste de turma, reativacao e recorrencia

Este pacote foi feito a partir do ZIP original `fusion-erp (3).zip`.

## Alteracoes

- Cadastro de matricula agora envia ID e nome da turma.
- Servidor aceita turma por `id`, `turmaId`, `turma_id`, `codigo` ou nome.
- Se a turma antiga/importada nao for encontrada pelo ID, o vinculo operacional e salvo sem travar o financeiro.
- Ficha da matricula mostra a proxima mensalidade gerada.
- Reativacao com cobranca cria uma nova matricula e ja gera a mensalidade recorrente do proximo mes.
- Novo aluno/matricula passa a gravar no aluno os IDs da mensalidade e financeiro recorrentes.
- Contraste da ficha e dos avisos de matricula foi corrigido.

## Arquivos incluidos

- `public/pages/matriculas/cadastro.html`
- `public/pages/matriculas/ficha.html`
- `public/js/matriculas/cadastro.js`
- `public/js/matriculas/ficha.js`
- `modules/matriculas/matricula.integracao.routes.mjs`
- `modules/matriculas/matricula.integracao.service.mjs`
- `modules/alunos/alunos.service.mjs`
- `modules/alunos/alunos.routes.mjs`

## Validacao

Foi feita checagem de sintaxe com Node.js nos arquivos JavaScript e MJS alterados.
