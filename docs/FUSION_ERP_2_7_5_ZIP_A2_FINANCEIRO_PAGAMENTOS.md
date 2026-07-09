# Fusion ERP 2.7.5 — ZIP A2 Financeiro Pagamentos

Correção aplicada após teste local.

## Ajuste

A tela de Pagamentos não deve exibir alerta de erro quando a API responde `ok: true` com lista vazia.

No teste local, o endpoint `/api/financeiro/pagamentos` respondeu corretamente, porém sem contas a pagar cadastradas:

- `ok: true`
- `lancamentos: []`
- `pagamentos: []`

Isso representa estado vazio válido, não falha de integração.

## Arquivos alterados

- `public/pages/pagamentos/index.js`
- `public/pages/financeiro/pagamentos/index.js`

## Como aplicar

Extraia este ZIP na raiz do projeto e substitua os arquivos.
Reinicie o servidor com `npm start`.
