# Fusion Sistema — Códigos de acesso

## Conceito

O código é individual por usuário, não compartilhado pela academia.

Login geral:
1. Nome da academia
2. Código do usuário
3. Senha do usuário

Isso permite auditoria e revogação individual sem trocar o acesso de toda a equipe.

## Nova academia

Ao criar uma academia:
- o tenant é criado;
- o administrador inicial é criado;
- o código `FS-XXXX-XXXX` é gerado automaticamente;
- a página mostra esse código antes do primeiro acesso.

## Novo usuário criado depois

Ao criar um novo usuário interno:
- o índice de login é criado;
- se ainda não existir código, o backend solicita um novo código ao Supabase;
- o usuário recebe seu próprio código;
- a resposta de criação do usuário inclui `codigoAcesso`.

## Consultar o próprio código

Página:
`/pages/meu-acesso/index.html`

API:
`GET /api/auth/codigo-acesso`

## Regenerar

`POST /api/auth/codigo-acesso/regenerar`

Ao regenerar, o código anterior deixa de funcionar imediatamente.
