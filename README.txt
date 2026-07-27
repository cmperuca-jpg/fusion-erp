Fusion ERP — correção do painel Chat do Site

Problema identificado:
O painel public/pages/site-chat/index.js consultava /api/chat, enquanto o widget e as notificações usam /api/site-chat.
Além disso, as requisições do painel não enviavam o token por FusionAuth.fetchAuth.
Resultado: a notificação aparecia no sino, mas o painel mostrava "Nenhuma conversa encontrada".

Correções:
- painel passa a consultar /api/site-chat/conversas;
- painel passa a consultar e responder em /api/site-chat/mensagens;
- requisições administrativas usam FusionAuth.fetchAuth;
- leitura da conversa é marcada ao abrir;
- link vindo do sino limpa o filtro de origem;
- erros HTTP deixam de ser ocultados;
- preservado suporte às solicitações emergenciais.

Aplicação:
Extraia na raiz do projeto, substituindo public/pages/site-chat/index.js.
Depois faça deploy e Ctrl+F5.
