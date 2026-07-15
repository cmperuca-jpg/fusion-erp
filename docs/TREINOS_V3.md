# Fusion ERP 3.0 — Consolidação de Treinos

## Módulo oficial

O módulo oficial para regras, persistência e API de treinos é `modules/treinos`.

- API oficial: `/api/treinos`
- Biblioteca oficial: `/api/treinos/biblioteca`
- Página administrativa: `/pages/treinos/index.html`
- Portal do aluno: `/pages/aluno-treinos/index.html`

## Módulos legados

Os módulos abaixo permanecem no projeto apenas para análise e compatibilidade. Não devem receber novas funções:

- `biblioteca-inteligente`
- `exercicios`
- `exercicios-biblioteca`
- `modelos-treino`
- `treinos-ciclo`
- `treinos-consolidacao`
- `treinos-editor`
- `treinos-integrado`
- `treinos-montador`
- `treinos-operacional`

Nenhuma pasta é removida neste patch. A remoção só poderá ocorrer após testes funcionais e confirmação de que não existem consumidores ativos.
