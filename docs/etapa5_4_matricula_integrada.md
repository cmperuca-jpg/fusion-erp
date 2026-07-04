# Fusion ERP v2 - Etapa 5.4

## Objetivo
Consolidar a tela de cadastro de matrícula para usar a integração oficial do ERP.

## Alterações
- `public/pages/matriculas/cadastro.html`
  - Aba Financeiro refeita com select de plano, valor automático, taxa de matrícula, desconto, forma de pagamento e primeiro vencimento.
  - Botão Salvar padronizado.

- `public/js/matriculas/cadastro.js`
  - Carrega alunos, turmas e planos das APIs reais.
  - Preenche selects.
  - Calcula valor inicial.
  - Envia para `POST /api/matriculas/integrar`.

- `modules/matriculas/matricula.integracao.routes.mjs`
  - Passa para o serviço os novos campos da tela: turma, forma de pagamento, datas, status e valores.

- `modules/matriculas/matricula.integracao.service.mjs`
  - Preserva compatibilidade com a integração existente.
  - Registra turma, datas, status e forma de pagamento na matrícula/financeiro inicial.

## Teste recomendado
1. Abrir `/pages/matriculas/cadastro.html`.
2. Selecionar aluno.
3. Selecionar turma.
4. Selecionar plano na aba Financeiro.
5. Conferir valor mensal, taxa e valor inicial.
6. Salvar.
7. Verificar Matrículas, Mensalidades, Financeiro e BI Financeiro.
