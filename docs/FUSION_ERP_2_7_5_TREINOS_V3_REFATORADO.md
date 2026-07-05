# Fusion ERP 2.7.5 — Treinos V3 Refatorado

Objetivo:
Consolidar o fluxo de criação e edição de treinos para evitar duplicidade e permitir editar o treino pronto corretamente.

Regras aplicadas:
- Novo treino arquiva automaticamente o treino ativo anterior do mesmo aluno.
- Editar treino abre o treino ativo existente e salva por PUT.
- Cada aluno passa a ter somente 1 treino ativo.
- Se houver treino duplicado na base, o patch arquiva os antigos e mantém o mais recente ativo.
- O Treinos V3 passa a abrir em modo edição quando receber alunoId/treinoId ou modo=editar.
- O Treinos V3 não inicializa ficha vazia por cima de um treino carregado.
- A barra horizontal inútil da biblioteca lateral foi removida.

Arquivos alterados:
- public/pages/treinos-v3/index.html
- public/pages/treinos-v3/index.js
- public/pages/treinos-v3/style.css
- public/pages/treinos-v3/exercises-data.js
- modules/treinos-integrado/treinos-integrado.repository.mjs
- modules/treinos-integrado/treinos-integrado.routes.mjs
- modules/treinos-integrado/treinos-integrado.service.mjs
- data/treinos_integrados.json
- public/pages/professor-painel/index.js, se disponível

Como aplicar:
1. Extraia na raiz do projeto.
2. Substitua os arquivos.
3. Reinicie: CTRL + C e npm start.
4. Use CTRL + F5 no navegador.
5. Teste /api/treinos-integrado.
6. No Portal do Professor, use Editar treino para abrir o treino ativo.
