# Inventário estrutural V3

Esta etapa mapeia referências reais antes de qualquer remoção.

Execute:

```bat
node scripts\inventariar-estrutura-v3.mjs
```

Os relatórios serão criados em:

```text
data\auditoria-v3\INVENTARIO_ESTRUTURAL_V3.md
data\auditoria-v3\inventario-estrutura-v3.json
data\auditoria-v3\candidatos-remocao-v3.csv
```

Classificação:

- `high`: asset sem referência textual encontrada; ainda exige revisão.
- `medium`: CSS/JS de frontend sem carregamento encontrado.
- `low`: páginas e módulos que podem ser acessados dinamicamente ou por URL direta.

Nenhum arquivo é apagado por estes scripts.
