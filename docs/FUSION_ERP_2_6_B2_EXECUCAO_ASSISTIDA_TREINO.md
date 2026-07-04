# Fusion ERP 2.6-B2 — Execução Assistida do Treino

Entrega incremental sobre o 2.6-B1.

## Escopo entregue

- Cronômetro de tempo total da execução.
- Barra de progresso do treino.
- Navegação por exercício atual.
- Botões Exercício anterior e Próximo exercício.
- Cronômetro de descanso por exercício.
- Indicador visual dos exercícios concluídos.
- Cálculo de volume estimado.
- Envio de tempo e volume para o backend operacional.
- Finalização inteligente com aviso quando existem exercícios pendentes.

## Arquivos alterados

- modules/treinos-operacional/treinos-operacional.service.mjs
- public/pages/treinos/index.js
- public/pages/treinos/style.css

## Teste recomendado

1. Abrir /pages/treinos/.
2. Clicar em Executar em um treino ativo.
3. Registrar carga e repetições.
4. Concluir exercício.
5. Validar avanço automático e descanso.
6. Finalizar treino.
7. Confirmar gravação em data/treinos_execucoes.json.
