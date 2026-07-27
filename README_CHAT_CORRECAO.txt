Fusion ERP — correção do Chat do Site

Arquivos:
- modules/site-chat/site-chat.repository.mjs
- modules/site-chat/site-chat.service.mjs
- modules/site-chat/site-chat.routes.mjs

Aplicar na raiz do projeto, substituindo os arquivos existentes.

Principais correções:
- gravação transacional serializada;
- persistência pelo durable-json/Supabase;
- prevenção de perda por gravações simultâneas;
- metadados de conversa separados em site_chat_conversas.json;
- status, prioridade, operador e etiquetas;
- marcação de leitura;
- compatibilidade com /api/site-chat existente.

Validação executada:
node --check nos três arquivos.
