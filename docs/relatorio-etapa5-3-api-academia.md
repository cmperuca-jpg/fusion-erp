# Fusion ERP v2.0 — Etapa 5.3

## Objetivo
Corrigir a integração dos módulos de Academia sem alterar o fluxo financeiro já validado.

## Correções aplicadas

- Adicionada base comum `modules/core/api-response.mjs` para padronização gradual das respostas da API.
- Corrigido carregamento das páginas Modalidades, Planos e Turmas quando `carregarLayout()` ainda não está disponível.
- Tornado o consumo de API mais tolerante a diferentes formatos de resposta:
  - array direto;
  - `{ dados: [...] }`;
  - `{ modalidades: [...] }`;
  - `{ planos: [...] }`;
  - `{ turmas: [...] }`.
- Corrigida a aba Treinos para oferecer seletor de professores ativos no formulário de novo/edição.
- Mantida compatibilidade com o professor vinculado no cadastro do aluno.

## Arquivos alterados

- `modules/core/api-response.mjs`
- `public/pages/modalidades/modalidades.js`
- `public/pages/planos/planos.js`
- `public/pages/turmas/turmas.js`
- `public/pages/treinos/index.html`
- `public/pages/treinos/index.js`

## Testes sugeridos

1. Abrir Modalidades e verificar se aparecem os registros.
2. Abrir Planos e verificar se aparecem os registros.
3. Abrir Turmas e verificar se aparecem os registros.
4. Abrir Treinos, clicar em Novo treino e verificar seletor de professor.
5. Testar novamente Financeiro, Caixa, Relatório Caixa e BI Financeiro.
