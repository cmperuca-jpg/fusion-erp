Fusion ERP — manutenção conjunta Portal do Aluno + Chat de Suporte

Incluído nesta manutenção:

PORTAL DO ALUNO
- corrige a exibição de mensalidade futura para aluno ou matrícula inativa;
- mostra "Sem cobrança ativa";
- preserva histórico financeiro;
- mantém bloqueio da catraca;
- mantém o manifesto PWA do aluno na área interna.

CHAT DE SUPORTE
- mantém mensagens no mesmo módulo /api/site-chat;
- adiciona repositório e gravação transacional;
- evita perda por gravações simultâneas;
- aumenta a largura da lista e elimina sobreposição visual;
- exibe pendências, status e prioridade;
- permite assumir, resolver, encerrar e alterar prioridade;
- marca mensagens como lidas;
- usa autenticação administrativa;
- preserva abertura pelo sino.

Arquivos do pacote:
modules/site-chat/site-chat.repository.mjs
modules/site-chat/site-chat.service.mjs
modules/site-chat/site-chat.routes.mjs
public/pages/site-chat/index.html
public/pages/site-chat/index.js
public/pages/site-chat/style.css
public/pages/aluno-treinos/index.html
public/assets/js/aluno-portal-status-fix.js

Aplicação:
Extraia na raiz do projeto, substitua os arquivos e faça um único deploy.
Depois use Ctrl+F5 no painel administrativo e no portal do aluno.
