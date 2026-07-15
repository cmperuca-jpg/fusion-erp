# Assets de exercícios — Fusion ERP V3

O diretório canônico é `public/assets/exercises`. Arquivos idênticos em `public/assets/exercicios/flash`, `IMPORTADOS_FLASH` e pastas musculares são consolidados por hash SHA-256.

O arquivo `config/exercise-assets-map.json` preserva os caminhos removidos. O middleware V3 serve o arquivo canônico quando uma página antiga solicita um caminho legado.

## Procedimento

1. Aplique o patch.
2. Execute `npm run v3:assets:dry-run` para conferir a economia.
3. Faça backup da pasta `public/assets`.
4. Execute `npm run v3:assets:consolidate` uma única vez.
5. Execute `npm run v3:check`.

O script remove apenas arquivos com conteúdo exatamente idêntico. Arquivos diferentes, mesmo com nomes semelhantes, permanecem intactos.
