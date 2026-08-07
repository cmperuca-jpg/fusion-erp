# Fusion Sistema — Recuperação pública de acesso

Fluxo público:

1. `/pages/comecar/`
2. `Esqueceu seu código de acesso? Clique aqui`
3. `/pages/recuperar-acesso/`
4. Academia + e-mail cadastrado
5. Fusion envia OTP de 6 dígitos
6. Usuário confirma o OTP
7. Fusion mostra o código `FS-XXXX-XXXX`
8. Opcionalmente redefine a senha
9. Retorna para `/pages/comecar/` com academia e código preenchidos

## Segurança

- O código de acesso não é mostrado antes da confirmação do e-mail.
- OTP armazenado somente como HMAC/hash.
- OTP expira em 10 minutos.
- Máximo de 5 tentativas por OTP.
- Limite de solicitações por IP e usuário.
- Resposta inicial não confirma publicamente se academia/e-mail existem.
- O token de redefinição expira em 15 minutos.
- A nova senha é armazenada com bcrypt.
- O fluxo não usa nem revela a senha anterior.

## Envio de e-mail

O código usa a API HTTP do Resend e não adiciona dependência npm.

No Render, configure:

`RESEND_API_KEY=...`

`FUSION_RECOVERY_FROM_EMAIL=Fusion Sistema <acesso@fusionsistema.com.br>`

Opcional:

`FUSION_RECOVERY_REPLY_TO=suporte@fusionsistema.com.br`

Recomendado:

`FUSION_RECOVERY_SECRET=<segredo aleatório com 32+ caracteres>`

Se `FUSION_RECOVERY_SECRET` não existir, o backend usa `JWT_SECRET`/`FUSION_JWT_SECRET`.

O domínio do remetente precisa estar validado no provedor de e-mail.

## Banco

A migration `saas_recuperacao_acesso_email` já foi aplicada no Supabase de produção.
