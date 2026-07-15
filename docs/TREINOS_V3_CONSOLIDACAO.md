# Fusion ERP 3.0 — Consolidação de Treinos

O módulo oficial continua sendo `modules/treinos`.

As funções dos módulos legados passam a ser expostas sob a API canônica `/api/treinos`, sem remoção física nesta etapa.

## Rotas canônicas

- `/api/treinos/exercicios`
- `/api/treinos/catalogo`
- `/api/treinos/biblioteca-inteligente`
- `/api/treinos/modelos`
- `/api/treinos/ciclo`
- `/api/treinos/consolidacao`
- `/api/treinos/editor`
- `/api/treinos/integrado`
- `/api/treinos/montador`
- `/api/treinos/operacional`

A rota `/api/treinos/v3/status` informa quais grupos estão montados.

As APIs antigas permanecem preservadas apenas para compatibilidade. Novas páginas e funções devem usar exclusivamente `/api/treinos`.
