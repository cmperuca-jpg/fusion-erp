# Fusion UI 3.0

Nova camada visual do Fusion ERP.

## Arquivos alterados

- public/assets/js/fusion-layout.js
- public/assets/js/fusion-menu-global.js
- public/assets/css/fusion-ui.css
- public/pages/dashboard/index.html
- public/pages/dashboard/index.js

## O que mudou

- Menu antigo descartado visualmente.
- Novo menu fixo com links manuais.
- Paleta padrão: turquesa e amarelo.
- Topbar nova.
- Sidebar nova.
- Dashboard inicial atualizado.
- Sem accordion.
- Sem redirecionamento automático escondido.

## O que não mudou

- APIs.
- Autenticação.
- Integrações de aluno, professor, avaliação, treino, matrícula e financeiro.
- Páginas internas existentes.

## Observação

Os arquivos antigos de CSS podem permanecer no projeto, mas o novo layout deve carregar `fusion-ui.css` e `fusion-layout.js` como núcleo principal.
