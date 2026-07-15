# Fusion ERP 3.0 — Frontend consolidado

Este patch adiciona uma camada visual final carregada depois dos CSS legados. O objetivo é corrigir layout e responsividade sem remover estilos específicos das páginas nesta etapa.

Arquivos oficiais:
- `fusion-v3-variables.css`
- `fusion-v3-layout.css`
- `fusion-v3-components.css`
- `fusion-v3-responsive.css`

Regras:
1. Novos componentes devem usar variáveis `--fusion-*` e `--fusion-v3-*`.
2. Não criar novos CSS globais paralelos.
3. Estilos específicos permanecem dentro da pasta da página.
4. O menu móvel é controlado por `fusion-layout.js`.
5. A remoção dos CSS legados ocorrerá apenas após migração página por página.
