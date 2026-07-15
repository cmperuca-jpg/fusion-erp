# Segurança final V3

- APIs protegidas por autenticação central.
- Senhas em bcrypt com migração transparente do SHA-256 legado.
- Limite de login contabiliza somente respostas com falha.
- `Retry-After` é enviado quando o limite é atingido.
- Gravação de usuários é atômica para evitar corrupção do JSON.
