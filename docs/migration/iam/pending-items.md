# IAM Pending Items

Data: 2026-07-29

## Decisoes pendentes

1. Senha visivel para recepcao

   O sistema atual retorna `senhaAcesso` e `senhaPortal` em algumas listagens administrativas. Isso atende a uma necessidade operacional citada na recepcao, mas conflita com seguranca basica. A decisao arquitetural precisa escolher entre:

   - manter senha recuperavel com auditoria forte e permissao restrita;
   - substituir por botao de redefinir senha temporaria;
   - manter um campo separado de "senha operacional" nao igual ao hash principal.

2. Perfis e permissoes

   `PERFIS_PADRAO` esta hardcoded. Precisa decidir se perfis continuam em codigo, passam para JSON/Supabase, ou viram configuracao tenant.

3. Portal professor

   A regra de responsavel tecnico hoje aceita perfil, flags e permissoes (`professores`, `*`). Precisa consolidar esse conceito em uma policy unica.

4. Emergency access dentro do IAM

   O modulo usa financeiro, chat e catraca. Precisa decidir se ele fica como subcontexto IAM ou vira fluxo de Acesso com autorizacao IAM. A recomendacao inicial e manter a solicitacao em IAM/emergency-access, mas mover debito para Financeiro, mensagem para Comunicacao e liberacao para Acesso via eventos.

5. Persistencia de emergency access

   Hoje usa arquivo direto `data/emergency-access.json`. Precisa migrar para durable persistence ou repository Supabase equivalente.

6. Rate limit

   Hoje e em memoria por IP. Em producao horizontal, precisa store compartilhado ou aceitar limite por instancia.

## Riscos tecnicos

- Mudar resposta de `/api/auth/usuarios` pode quebrar telas administrativas.
- Remover `senhaAcesso` sem alternativa operacional pode prejudicar a recepcao.
- Reescrever `apiSecurity` sem mapa de rotas completo pode bloquear portais, professor ou integrações de access bridge.
- Emergency access tem efeito fisico em catraca; qualquer migracao precisa de idempotencia e auditoria.

## Testes que precisam nascer na migracao

- Login com bcrypt atual.
- Login com SHA-256 legado e migracao para bcrypt.
- Login com usuario inativo retorna 403.
- Token invalido retorna 401.
- Admin acessa `/api/auth/usuarios`.
- Usuario nao admin nao acessa `/api/auth/usuarios`.
- Portal aluno nao acessa outro `alunoId`.
- Portal professor nao altera professor de outro usuario, exceto responsavel tecnico.
- Rate limit bloqueia apos 10 falhas.
- Emergency access recusa sem debito vencido.
- Emergency access recusa segunda tentativa no mesmo mes.
- Emergency access valida arquivo de comprovante e limite de 8 MB.

