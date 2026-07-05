# Fusion ERP 2.7.5 — ZIP C3: Regra de Treino Único Ativo

Objetivo:
Eliminar duplicidade de treinos ativos e permitir edição correta do treino pronto.

Correções aplicadas:
- `data/treinos_integrados.json`: arquiva treinos ativos duplicados, mantendo somente o mais recente por aluno.
- `criarTreinoIntegrado`: ao criar um novo treino, arquiva automaticamente qualquer treino ativo anterior do mesmo aluno.
- `atualizarTreinoIntegrado`: ao editar um treino existente, mantém esse treino ativo e arquiva outros ativos do mesmo aluno.
- Portal do Professor: `Editar treino` passa a selecionar o treino ativo mais recente pelo `atualizadoEm`.
- Treinos V3: em modo edição, busca todos os treinos do aluno, filtra ativos no frontend e abre o ID enviado pelo Portal.
- Treinos V3: ao salvar em modo edição, usa `PUT /api/treinos-integrado/:id`.
- CSS reforçado para remover a rolagem horizontal inútil da biblioteca lateral.

Regra final:
- Novo treino = substitui o treino ativo anterior.
- Editar treino = atualiza o treino existente.
- Cada aluno pode ter somente 1 treino ativo.

Arquivos alterados:
- `modules/treinos-integrado/treinos-integrado.service.mjs`
- `modules/treinos-integrado/treinos-integrado.routes.mjs`
- `modules/treinos-integrado/treinos-integrado.repository.mjs`
- `data/treinos_integrados.json`
- `public/pages/professor-painel/index.js`
- `public/pages/treinos-v3/index.js`
- `public/pages/treinos-v3/style.css`

Aplicação:
1. Extraia na raiz do projeto.
2. Substitua os arquivos.
3. Reinicie com `CTRL + C` e `npm start`.
4. Use `CTRL + F5`.
5. Teste:
   - `/api/treinos-integrado`
   - Portal do Professor > Alunos > Editar treino
   - Portal do Professor > Novo treino
