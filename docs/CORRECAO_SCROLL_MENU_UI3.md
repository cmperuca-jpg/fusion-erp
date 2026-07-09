# Correção Fusion UI 3.0 — Scroll do Menu

Correção aplicada para o menu lateral manter a posição de rolagem após clicar em qualquer link.

Arquivos alterados:

- public/assets/js/fusion-layout.js
- public/assets/css/fusion-ui.css

O menu agora salva o `scrollTop` no `sessionStorage` antes da navegação e restaura a posição quando a próxima página carrega.
