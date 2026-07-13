# Relatorio - Matricula, recebimento e chat

## Corrigido na matricula

- A taxa de matricula digitada na tela nao e mais zerada automaticamente quando o plano recalcula.
- A entrada inicial agora soma: taxa de matricula + plano mensal - desconto.
- O servidor grava os valores separados e o total nos registros de matricula, mensalidade, financeiro e recebimentos.
- O recebimento inicial nasce vinculado ao financeiro e a mensalidade inicial, pronto para baixa no fluxo oficial.
- A ficha da matricula mostra taxa, mensalidade, desconto e total inicial para conferencia.

## Chat adicionado

- Portal do aluno: botao flutuante de chat em `/pages/aluno-treinos/index.html`.
- Matricula online: botao flutuante de chat em `/pages/matricula-online/index.html`.
- Atendimento interno: tela em `/pages/site-chat/index.html`.
- As mensagens ficam salvas em `data/site_chat.json`.
- O chat responde automaticamente duvidas comuns de pagamentos, recebimentos, matricula, horario e acesso, e a recepcao pode responder manualmente pela tela interna.

## Arquivos principais alterados

- `public/js/matriculas/cadastro.js`
- `modules/matriculas/matricula.integracao.service.mjs`
- `public/js/matriculas/ficha.js`
- `modules/site-chat/site-chat.service.mjs`
- `modules/site-chat/site-chat.routes.mjs`
- `public/assets/js/fusion-site-chat.js`
- `public/assets/css/fusion-site-chat.css`
- `public/pages/site-chat/index.html`

## Validacao feita

- `node --check` nos arquivos alterados.
- `npm.cmd run check`.
- Servidor iniciado em porta de teste.
- `/api/health` respondeu OK.
- `/api/site-chat/conversas` respondeu OK.
- Atalho criado: `INICIAR-FUSIONERP-MATRICULA-CHAT.bat`.

## Teste recomendado

1. Abrir `/pages/matriculas/cadastro.html`.
2. Selecionar aluno e plano.
3. Digitar a taxa de matricula.
4. Conferir o total inicial.
5. Salvar a matricula.
6. Abrir `/pages/recebimentos/index.html` e conferir se o recebimento mostra o total completo.
7. Abrir o portal do aluno ou matricula online e enviar uma mensagem pelo chat.
8. Abrir `/pages/site-chat/index.html` e responder pela recepcao.
