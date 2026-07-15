# Persistência e backup — academia piloto

## Variáveis obrigatórias no Render

Configure no serviço do Fusion ERP:

- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: chave **service_role**; nunca exponha no navegador.
- `SUPABASE_DATA_BUCKET=fusion-data`
- `FUSION_TENANT_ID=academia-piloto`
- `FUSION_REQUIRE_SUPABASE_DATA=true`
- `FUSION_DATA_SYNC_MS=5000`
- `SUPABASE_BACKUP_BUCKET=fusion-backups`
- `FUSION_BACKUP_AUTO=true`
- `FUSION_BACKUP_AUTO_MS=21600000`

Os buckets privados são criados automaticamente pela aplicação usando a chave `service_role`.

## Funcionamento

- Ao iniciar, o servidor restaura do Supabase os dados da academia antes de liberar o acesso.
- Durante o uso, alterações em `data/` e `uploads/` são sincronizadas automaticamente.
- A cada seis horas é criado um ZIP completo no bucket de backups.
- No **Painel administrativo > Backup e restauração**, o administrador pode gerar um backup manual ou restaurar um ZIP anterior.
- Antes de qualquer restauração, o sistema gera automaticamente um backup de segurança.

## Segurança da restauração

A rota de backup exige login de administrador. Para restaurar, também é necessário digitar `RESTAURAR`. Após a operação, atualize a página para recarregar todos os dados restaurados.
