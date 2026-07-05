# Fusion ERP 2.7.4 — ZIP 2 Mobile First

## Objetivo
Aplicar uma camada mobile first no Fusion ERP para melhorar o uso real em Android, iPhone e tablets pequenos, sem alterar APIs, dados, rotas ou identidade visual.

## Arquivos incluídos

- `public/assets/css/fusion-mobile-first.css`
- `public/assets/js/fusion-mobile-first.js`
- `public/assets/js/fusion-layout.js`

## O que foi ajustado

- Menu lateral passa a abrir por botão hambúrguer em telas menores.
- Sidebar vira gaveta lateral no celular.
- Fundo escuro fecha o menu ao tocar fora.
- `Esc` fecha o menu em teclado físico.
- Cards, grids, painéis e formulários são reorganizados em uma coluna.
- Botões e campos recebem área mínima de toque.
- Tabelas são encapsuladas automaticamente em rolagem horizontal.
- Imagens e vídeos ficam fluidos.
- Topbar fixa no celular.
- Evita zoom indesejado no iPhone ao focar campos de formulário.

## Como aplicar

Extraia este ZIP na raiz do projeto e aceite substituir `public/assets/js/fusion-layout.js`.

Depois execute:

```bash
npm start
```

Teste principalmente:

- `/pages/dashboard/index.html`
- `/pages/alunos/index.html`
- `/pages/financeiro/index.html`
- `/pages/professor-painel/index.html`
- `/pages/portal-aluno/index.html`
- `/pages/treinos-v3/index.html`
- `/pages/treinos-v3-aluno/index.html`
- `/pages/avaliacoes/index.html`

## Observação
Este pacote depende do layout global já aplicado no ZIP 1. Não altera banco, JSONs, servidor nem módulos backend.
