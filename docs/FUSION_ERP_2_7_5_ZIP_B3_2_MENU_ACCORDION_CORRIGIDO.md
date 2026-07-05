# Fusion ERP 2.7.5 — ZIP B3.2 Menu Accordion Corrigido

Correção complementar do ZIP B3.

Problema observado:
- O grupo mudava visualmente, mas os itens continuavam visíveis.
- Alguns nomes perderam contraste no menu.

Correções:
- `fusion-layout.js` agora gera cada grupo dentro de `.fusion-menu-section`.
- Cada lista fica dentro de `.fusion-menu-items`.
- Ao recolher, `.fusion-menu-items` recebe `max-height: 0`, `opacity: 0` e `pointer-events: none`.
- Estado aberto/fechado salvo em `localStorage`.
- Grupo ativo permanece aberto automaticamente.
- Cores do menu corrigidas para manter legibilidade.
- Rodapé "Layout global" permanece removido.

Arquivos:
- `public/assets/js/fusion-layout.js`
- `public/assets/css/fusion-menu-accordion.css`

Aplicação:
1. Extrair na raiz do projeto.
2. Substituir arquivos.
3. Reiniciar `npm start`.
4. No navegador, usar CTRL + F5.
