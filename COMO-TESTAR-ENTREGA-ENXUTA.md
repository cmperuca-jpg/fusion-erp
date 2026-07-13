# Fusion ERP - entrega enxuta para testes

Entrega preparada em 2026-07-12.

## Como testar

1. Extraia o ZIP em uma pasta simples, por exemplo `C:\FusionERP_ENXUTO_TESTES`.
2. Abra o terminal dentro da pasta extraida.
3. Rode `npm install`.
4. Rode `npm run check`.
5. Rode `npm start`.
6. Acesse `http://localhost:3000`.

Login local padrao, se a base ainda nao tiver usuario:

- Email: `admin@fusionerp.local`
- Senha: `admin123`

## O que foi limpo

- Removidos da entrega os backups antigos, logs, documentacoes antigas e scripts de instalacao/homologacao que apontavam para modulos legados.
- Removida a biblioteca duplicada `public/assets/exercises`, mantendo a biblioteca usada pelo sistema em `public/assets/exercicios/flash`.
- Removidas da entrega paginas antigas de fluxo separado, como cadastros/fichas legados de agenda, turmas, financeiro e presencas.
- Removidos atalhos antigos de `pagamentos`, `bi`, `presencas`, `portal-aluno`, `treinos-v3-aluno`, `professor-painel` e `exercicios`.
- Mantidos redirecionamentos no servidor para que links antigos caiam nas paginas novas durante os testes.

## Paginas principais mantidas

- `/pages/login/index.html`
- `/pages/dashboard/index.html`
- `/pages/alunos/index.html`
- `/pages/professores/index.html`
- `/pages/turmas/index.html`
- `/pages/agenda/index.html`
- `/pages/checkin/index.html`
- `/pages/financeiro/index.html`
- `/pages/financeiro/pagamentos/index.html`
- `/pages/caixa/index.html`
- `/pages/relatorios-caixa/index.html`
- `/pages/bi-financeiro/index.html`
- `/pages/bi-academia/index.html`
- `/pages/bi-academia-operacional/index.html`
- `/pages/matricula-online/index.html`
- `/pages/matriculas-pendentes/index.html`
- `/pages/aluno-login/index.html`
- `/pages/aluno-treinos/index.html`
- `/pages/professor-area/index.html`

## Correcoes aplicadas

- Corrigido o botao de solicitar correcao em matriculas pendentes.
- Corrigido redirecionamento do perfil aluno para a area atual.
- Atualizadas permissoes de aluno/professor para nao dependerem de paginas antigas.
- Atualizado menu global para apontar somente para rotas oficiais.
- Atualizado PWA para usar as paginas atuais de aluno e professor.
