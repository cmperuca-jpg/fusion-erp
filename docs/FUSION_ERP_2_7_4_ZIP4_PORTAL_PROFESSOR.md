# Fusion ERP 2.7.4 — ZIP 4 — Ajustes do Portal do Professor

Pacote pequeno para aplicar na raiz do projeto.

## Arquivos alterados

- `public/pages/professor-painel/index.html`
- `public/pages/professor-painel/index.js`
- `public/pages/professor-painel/style.css`
- `public/pages/portal-professor/style.css`

## Ajustes aplicados

- Menu lateral do professor convertido para gaveta mobile com botão hambúrguer.
- Backdrop para fechar o menu no celular.
- Botões com área mínima de toque.
- Cards, KPIs e listas reorganizados para uma coluna no celular.
- Modal em tela cheia no mobile.
- Iframes do Treinos V3 e Avaliação Física V3 ajustados para usar altura útil da tela.
- Correção preventiva: `renderAvaliacoes()` agora não quebra quando a aba usa iframe e não existe `#listaAvaliacoes`.
- Login do portal do professor melhorado para Android, iPhone e tablets.

## Aplicação

Extraia este ZIP na raiz do projeto e substitua os arquivos.

## Teste recomendado

1. Abrir `/pages/portal-professor/`.
2. Acessar o painel.
3. Testar `/pages/professor-painel/` no computador.
4. Testar no celular ou DevTools: 360px, 390px, 430px, 768px.
5. Conferir abas: Início, Alunos, Avaliações, Treinos, Evolução, Chamada e Perfil.
