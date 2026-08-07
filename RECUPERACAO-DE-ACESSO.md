# Fusion Sistema — Recuperação consolidada de acesso

## Fluxo oficial

### Entrada na academia

1. Acesse `/pages/comecar/`.
2. Informe o nome da academia e o **código da academia**.
3. O backend valida os dois dados e cria uma seleção temporária assinada.
4. O navegador abre `/pages/login/index.html?tenant=...`.
5. Administrador, gerente, recepção, comercial ou outro usuário interno entra com o próprio e-mail e senha.

O código `FS-XXXX-XXXX` pertence à **academia**, não ao usuário.

### Recuperação do código da academia

1. Em `/pages/comecar/`, clique em `Esqueceu o código da academia?`.
2. Informe academia + e-mail cadastrado de um usuário ativo.
3. O Fusion envia um OTP de 6 dígitos por e-mail.
4. Após confirmar o OTP, o código da academia é exibido.
5. O botão de retorno volta para `/pages/comecar/` já com academia e código preenchidos.

### Recuperação de senha

1. Depois de selecionar a academia, abra a tela de login interno.
2. Clique em `Esqueceu sua senha? Recuperar acesso`.
3. Confirme o mesmo OTP de e-mail.
4. Crie uma nova senha com pelo menos 10 caracteres.
5. Volte ao login da academia e entre com e-mail + nova senha.

## Segurança

- O código da academia não é enviado nem exibido antes da confirmação do e-mail.
- OTP expira em 10 minutos.
- Máximo de 5 tentativas por OTP.
- Limites de solicitações por IP/usuário.
- Token de redefinição de senha expira em 15 minutos.
- Seleção da academia expira em 20 minutos.
- Login interno exige uma seleção de academia válida; um `?tenant=` digitado manualmente não basta.
- A senha nova é armazenada com bcrypt.

## Envio de e-mail com Resend

O backend usa a API HTTP do Resend, sem dependência npm adicional.

No Render, configure obrigatoriamente:

`RESEND_API_KEY=<chave de envio>`

Para teste, se `FUSION_RECOVERY_FROM_EMAIL` não estiver definido, o sistema usa:

`Fusion Sistema <onboarding@resend.dev>`

O remetente `resend.dev` só pode enviar para o e-mail da própria conta Resend. Para produção, valide um domínio próprio e configure, por exemplo:

`FUSION_RECOVERY_FROM_EMAIL=Fusion Sistema <acesso@fusionsistema.com.br>`

Também existem os segredos:

- `FUSION_RECOVERY_SECRET`
- `FUSION_TENANT_SELECTION_SECRET`

O `render.yaml` foi preparado para gerá-los automaticamente quando a configuração Blueprint for sincronizada.

## Banco

A migration `saas_codigo_academia_fluxo_login_interno` já foi aplicada no Supabase de produção.

Ela adiciona um código exclusivo à tabela `fusion_tenants`, gera códigos para academias existentes e atualiza a criação de novas academias para retornar o código da própria academia.
