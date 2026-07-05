# Fusion ERP 2.7.5 — ZIP C2: Portal Professor / Treinos V3

Correções:
- Remove a rolagem horizontal inútil no painel lateral da biblioteca do Treinos V3.
- A lista de exercícios passa a rolar somente na vertical.
- Campo de busca e select do grupo ficam travados em 100% do painel.
- O botão "Editar treino" no Portal do Professor agora abre o treino ativo existente.
- Ao salvar em modo edição, o sistema usa PUT em `/api/treinos-integrado/:id`, atualizando o treino em vez de criar um novo.
- Caso o aluno não tenha treino ativo, o Portal avisa para usar "Novo treino".

Arquivos alterados:
- `public/pages/professor-painel/index.js`
- `public/pages/professor-painel/index.html`
- `public/pages/professor-painel/style.css`
- `public/pages/treinos-v3/index.js`
- `public/pages/treinos-v3/style.css`
- `public/pages/treinos-v3/index.html`

Aplicação:
1. Extraia na raiz do projeto.
2. Substitua os arquivos.
3. Reinicie com `CTRL + C` e `npm start`.
4. Use `CTRL + F5` no navegador.
5. Teste o Portal do Professor e o botão "Editar treino".
