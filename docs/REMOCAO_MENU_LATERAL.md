# Remoção do menu lateral

Esta etapa remove o menu lateral de todas as páginas ativas do Fusion ERP.

Alterações principais:

- `fusion-layout.js` deixou de criar sidebar.
- `fusion-menu-global.js` virou compatibilidade sem menu lateral.
- Criado `fusion-no-sidebar.css`.
- Criado `fusion-no-sidebar.js`.
- Todas as páginas HTML em `public/pages` receberam a camada `fusion-no-sidebar`.
- `public/components/sidebar.html` foi neutralizado.

Nada foi removido das regras de negócio, APIs ou formulários.
