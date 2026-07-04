# Fusion ERP 2.6-B1 — Execução Assistida do Treino

Entrega modular da primeira parte da execução assistida.

## Módulos alterados

- modules/treinos-operacional
- modules/treinos
- public/pages/treinos

## Funcionalidades

- Botão Executar na listagem de treinos ativos.
- Início de execução usando a rota existente POST /api/treinos-operacional/treinos/:treinoId/iniciar.
- Reutilização automática de execução em andamento do mesmo treino no mesmo dia.
- Modal de execução assistida com aluno, professor, status e progresso.
- Registro de carga utilizada, repetições realizadas e observação por exercício.
- Conclusão individual de exercício usando PUT /api/treinos-operacional/execucoes/:execucaoId/exercicios/:exercicioTreinoId.
- Finalização do treino usando POST /api/treinos-operacional/execucoes/:execucaoId/concluir.
- Compatibilidade do motor operacional com treinos vindos de data/treinos_integrados.json e data/treinos.json.

## Teste

1. Substitua as pastas do ZIP na raiz do projeto.
2. Execute: npm start
3. Acesse: /pages/treinos/
4. Clique em Executar em um treino ativo.
5. Preencha carga/repetições e conclua exercícios.
6. Finalize o treino.
7. Verifique data/treinos_execucoes.json.
