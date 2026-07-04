# Fusion ERP 2.6-G1 — Consolidação Backend da Musculação

Arquivos consolidados:

- server.mjs
- modules/checkin/
- modules/treinos/
- modules/treinos-operacional/
- modules/professor-painel/
- modules/portal-aluno/

Mudanças principais:

- Check-in passa a usar `data/checkins.json` como arquivo oficial.
- Compatibilidade mantida com o legado `data/checkin.json`: se existir e `checkins.json` ainda não existir, o conteúdo é migrado automaticamente.
- Status do backend atualizado para a versão 2.6-G1.
- Mantida compatibilidade das rotas já usadas pelo Check-in, Treinos, Dashboard do Professor e Portal do Aluno.
- Consolidação preserva as APIs existentes para evitar quebra do frontend.

Teste recomendado:

```cmd
cd C:\Users\academia01\Desktop\site erp
npm run check
npm start
```

Rotas principais:

- GET /api/checkin/resumo
- GET /api/treinos
- GET /api/treinos-operacional/status
- GET /api/treinos-operacional/progressao/alunos/ID_DO_ALUNO
- GET /api/treinos-operacional/ia/alunos/ID_DO_ALUNO
- GET /api/professor-painel/professores
- GET /api/professor-painel/NOME_DO_PROFESSOR/dashboard
- POST /api/portal-aluno/acessar
