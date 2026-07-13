# Relatorio - Limite diario da catraca no portal do aluno

## Objetivo

Evitar que um aluno use o botao `Liberar catraca` para liberar acesso para outras pessoas.

## Regra aplicada

- Cada aluno pode usar ate 3 liberacoes autorizadas por dia pelo portal do aluno.
- A contagem considera somente acessos realmente autorizados pelo motor da catraca.
- Tentativas bloqueadas por financeiro, matricula, limite ou erro da catraca nao consomem o limite.
- Ao chegar em 3/3, o servidor bloqueia novas liberacoes pelo portal ate virar o dia.

## Onde foi alterado

- `modules/treinos/treinos.service.mjs`
- `modules/treinos/treinos.routes.mjs`
- `public/pages/aluno-treinos/index.html`
- `public/pages/aluno-treinos/index.js`
- `public/pages/aluno-treinos/style.css`

## Validacao

- `npm run check`: aprovado.
- Teste de inicializacao controlado: servidor iniciou na porta 3099.
- Consulta de contador sem acionar a catraca: aluno Marcos com 1 usado de 3 no dia.

## Como iniciar

Na raiz desta pasta, rode:

`npm start`

Depois abra:

`http://localhost:3000`
