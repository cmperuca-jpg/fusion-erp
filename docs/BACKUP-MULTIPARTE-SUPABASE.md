# Backup multipartes no Supabase

Esta versão corrige o erro `The object exceeded the maximum allowed size` do Supabase Storage.

## Como funciona

- O backup inclui os arquivos de `data`, os uploads e um snapshot dos registros atuais da tabela `fusion_v3_records`.
- Backups pequenos continuam sendo enviados como um único arquivo ZIP.
- Backups maiores que 40 MB são divididos em partes. Cada parte possui tamanho e SHA-256 verificados durante a restauração.
- O manifesto JSON só é criado depois que todas as partes foram enviadas com sucesso.
- Antes de restaurar, o sistema cria automaticamente outro backup de segurança.
- A restauração do banco usa a função transacional `fusion_replace_collections` já instalada pela migração V4.

## Variáveis do Render

```text
FUSION_BACKUP_PART_MB=40
FUSION_BACKUP_RESTORE_MAX_MB=250
```

O tamanho de 40 MB mantém cada objeto abaixo do limite de 50 MB do plano gratuito do Supabase. Não aumente para mais de 45 MB.

## Teste depois do deploy

1. Abra **Painel administrativo > Backup e restauração**.
2. Clique em **Fazer backup agora**.
3. Aguarde a confirmação. Um backup grande será exibido na lista com o texto `(dividido)`.
4. Confira no bucket `fusion-backups` se existem o manifesto `.manifest.json` e a pasta de partes correspondente.
5. Não apague partes individuais. A restauração precisa do manifesto e de todas as partes.

Não é necessário executar uma nova migração SQL para esta correção, desde que a migração V4 e a função `fusion_replace_collections` já estejam instaladas.
