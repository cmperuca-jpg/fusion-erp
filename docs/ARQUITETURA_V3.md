# Fusion ERP 3.0 — Base de Arquitetura

Esta etapa adiciona governança técnica sem remover funcionalidades.

## Decisões
- Supabase é a fonte oficial de dados em produção.
- Supabase Storage é o armazenamento oficial de fotos e documentos em produção.
- JSON permanece apenas para desenvolvimento, contingência, backup e importação.
- Catraca e biometria permanecem no agente local.
- Antes de criar módulo, página ou serviço, verificar e consolidar o existente.
- Entregas são patches ZIP contendo somente arquivos alterados.

## Compatibilidade
O `server.mjs` atual continua carregando os módulos existentes. Esta base apenas centraliza configuração, diagnóstico e verificações.
