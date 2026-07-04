# Etapa 5.5 — Matrícula com fluxo sugestivo

Correção aplicada na tela de nova matrícula.

## Objetivo

Evitar que o operador tente criar uma segunda matrícula ativa para o mesmo aluno e receba apenas erro técnico da API.

## Alterações

- A tela consulta automaticamente matrículas ativas do aluno selecionado.
- Se o aluno não possui matrícula ativa, mantém o fluxo normal de criação.
- Se o aluno já possui matrícula ativa:
  - mostra um painel com matrícula, plano e status atuais;
  - altera o botão principal para `Abrir matrícula` quando o plano selecionado é o mesmo;
  - altera o botão principal para `Alterar plano` quando o plano selecionado é diferente;
  - usa `/api/matriculas/trocar-plano` para troca de plano.

## Arquivos alterados

- `public/pages/matriculas/cadastro.html`
- `public/js/matriculas/cadastro.js`

## Teste recomendado

1. Abra `Matrículas > Nova Matrícula`.
2. Selecione um aluno sem matrícula ativa e salve.
3. Selecione um aluno com matrícula ativa.
4. Confirme se o painel de matrícula existente aparece.
5. Selecione outro plano e clique em `Alterar plano`.
6. Confira `Matrículas`, `Mensalidades`, `Financeiro` e `BI Financeiro`.
