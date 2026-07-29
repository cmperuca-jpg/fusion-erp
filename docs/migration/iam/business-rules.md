# IAM Business Rules

Data: 2026-07-29

## Auth

### IAM-AUTH-001 - Producao exige segredo JWT configurado

Origem: `modules/auth/auth.service.mjs`.

Em `NODE_ENV=production`, o sistema deve falhar na inicializacao se `JWT_SECRET` ou `FUSION_JWT_SECRET` nao estiver configurado. Se configurado, deve ter no minimo 32 caracteres.

Destino: `src/config/jwt.config.mjs` e validacao de bootstrap em `src/bootstrap/security.bootstrap.mjs`.

### IAM-AUTH-002 - Tempo de token vem de configuracao

Origem: `modules/auth/auth.service.mjs`.

Tokens usam `JWT_EXPIRES_IN` ou o padrao `12h`.

Destino: `src/config/jwt.config.mjs` e `iam/auth/infrastructure/jwt.provider.mjs`.

### IAM-AUTH-003 - Custo bcrypt limitado

Origem: `modules/auth/auth.service.mjs`.

`FUSION_BCRYPT_ROUNDS` deve ficar entre 10 e 14, com padrao 12.

Destino: `iam/auth/infrastructure/password.provider.mjs`.

### IAM-AUTH-004 - Senhas legadas devem autenticar e migrar

Origem: `verificarSenhaUsuario`.

O login aceita bcrypt em `senhaHash` ou `senhaBcrypt`, SHA-256 legado em `senhaHashLegado` ou `senhaHash` nao-bcrypt, e texto legado em `senhaAcesso`/`senhaPortal`. Quando a senha legada confere, o registro deve migrar para bcrypt.

Destino: `iam/auth/domain/policies/senha.policy.mjs` e `iam/auth/application/use-cases/autenticar-usuario.use-case.mjs`.

### IAM-AUTH-005 - Usuario inativo nao autentica

Origem: `autenticar` e `validarToken`.

Usuario com status diferente de `ativo` recebe erro 403.

Destino: `iam/auth/domain/policies/autenticacao.policy.mjs`.

### IAM-AUTH-006 - Login invalido nao revela qual campo falhou

Origem: `autenticar`.

E-mail inexistente e senha incorreta retornam a mesma mensagem: `E-mail ou senha invalidos.`

Destino: `AutenticarUsuarioUseCase`.

### IAM-AUTH-007 - Usuario precisa de nome, e-mail valido e senha no cadastro

Origem: `validarPayloadUsuario`.

Criacao exige nome, e-mail contendo `@` e senha. Edicao permite senha vazia.

Destino: validators de presentation e policy/application validation.

### IAM-AUTH-008 - E-mail de usuario deve ser unico

Origem: `criarUsuario` e `atualizarUsuario`.

Nao pode haver dois usuarios com mesmo e-mail normalizado.

Destino: `IUsuarioRepository.existsByEmail` e use cases de criacao/atualizacao.

### IAM-AUTH-009 - Administrador padrao nao pode ser removido

Origem: `removerUsuario`.

Usuario `usr_admin` nao pode ser excluido.

Destino: `RemoverUsuarioUseCase`.

### IAM-AUTH-010 - Bootstrap admin local e idempotente

Origem: `garantirArquivoUsuarios`.

Se `usuarios.json` ja possui usuarios, nao cria admin. Em producao, se nao houver usuario migrado, bloqueia implantacao. Em ambiente local, cria `usr_admin`.

Destino: `BootstrapAdminUseCase`.

### IAM-AUTH-011 - Credencial inicial gerada deve ser registrada em arquivo local

Origem: `gravarCredenciaisIniciais`.

Quando a senha inicial e gerada automaticamente, o sistema escreve `data/CREDENCIAIS-INICIAIS.txt`.

Destino: `iam/auth/infrastructure/bootstrap-credential-writer.provider.mjs`.

### IAM-AUTH-012 - Perfis padrao definem permissoes

Origem: `PERFIS_PADRAO`.

Perfis atuais: Administrador, Gerente, Recepcao, Comercial, Professor, Aluno. Permissao `*` representa acesso administrativo total.

Destino: `iam/auth/domain/policies/autorizacao.policy.mjs` e seed/config de permissoes.

### IAM-AUTH-013 - Tokens de portal sao separados por tipo

Origem: `gerarTokenPortal` e `validarTokenPortal`.

Token de portal exige `sub` e `tipo`; validacao pode exigir tipo esperado.

Destino: `iam/auth/application/use-cases/gerar-token-portal.use-case.mjs` e `validar-token-portal.use-case.mjs`.

## Security Middleware

### IAM-SEC-001 - Rotas publicas nao exigem token

Origem: `PUBLIC_RULES`.

Rotas de health, login, matricula online, planos, leads, chat publico, access bridge/terminal, aparencia e parte do emergency-access sao publicas.

Destino: `iam/security/application/policies/public-route.policy.mjs`.

### IAM-SEC-002 - Prefixos administrativos exigem admin

Origem: `ADMIN_PREFIXES`.

Rotas como auth usuarios, backup, importador access, access engine, sistema, v3 persistence/access e aparencia exigem administrador ou permissao `*`.

Destino: `iam/security/application/policies/admin-route.policy.mjs`.

### IAM-SEC-003 - Rate limit de login por IP

Origem: `loginRateLimit`.

Maximo de 10 tentativas em 15 minutos por IP. Sucesso limpa contador. Falha incrementa contador. Excesso retorna 429 e `Retry-After`.

Destino: `iam/security/infrastructure/login-attempt-store.mjs` e middleware.

### IAM-SEC-004 - Portal aluno so acessa seus proprios dados

Origem: `portalAlunoPermitido`.

Aluno em portal so pode consultar/acionar rotas vinculadas ao proprio `alunoId`.

Destino: `iam/security/domain/policies/portal-aluno-acesso.policy.mjs`.

### IAM-SEC-005 - Portal professor tem escopo limitado

Origem: `portalProfessorPermitido`.

Professor pode acessar sessao, biblioteca, alunos em GET, avaliacoes e treinos em metodos especificos. Responsavel tecnico tem permissoes ampliadas para professores.

Destino: `iam/security/domain/policies/portal-professor-acesso.policy.mjs`.

### IAM-SEC-006 - Headers minimos de seguranca

Origem: `securityHeaders`.

Aplica `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e `Cross-Origin-Resource-Policy`.

Destino: shared HTTP middleware ou `src/core/security`.

## Emergency Access

### IAM-EMERG-001 - Status emergencial exige aluno existente

Origem: `studentEmergencyStatus`.

Se o aluno nao existe, retorna 404.

Destino: `ObterStatusEmergencialAlunoUseCase`.

### IAM-EMERG-002 - Uma tentativa emergencial por competencia

Origem: `studentEmergencyStatus`.

Se ja existe solicitacao no mes atual com status diferente de `cancelado`, nova tentativa nao e elegivel.

Destino: `iam/emergency-access/domain/policies/tentativa-emergencial.policy.mjs`.

### IAM-EMERG-003 - Somente debito vencido aberto torna aluno elegivel

Origem: `overdueDebt`.

Mensalidades e financeiro sao somados. Itens pagos, recebidos, quitados, baixados, cancelados, estornados ou excluidos nao contam. Precisa haver vencimento anterior a hoje e valor aberto maior que zero.

Destino: regra financeira em `financeiro` exposta por query port para IAM/emergency-access.

### IAM-EMERG-004 - PIX deve estar configurado para enviar comprovante

Origem: `sendEmergencyReceipt`.

Sem `FUSION_PIX_KEY` ou `FUSION_PIX_COPY_PASTE`, comprovante emergencial retorna 503.

Destino: `src/config/payment.config.mjs` ou porta de pagamento emergencial.

### IAM-EMERG-005 - Comprovante deve ser imagem base64 valida

Origem: `saveReceipt`.

Aceita PNG, JPG/JPEG ou WEBP em data URL. Tamanho maximo 8 MB.

Destino: `iam/emergency-access/presentation/validators` e storage provider.

### IAM-EMERG-006 - Acesso temporario dura 24 horas

Origem: `sendEmergencyReceipt`.

Ao enviar comprovante elegivel, `acessoValidoAte` recebe agora + 24 horas.

Destino: policy/config de emergency access.

### IAM-EMERG-007 - Envio de comprovante cria chat e tenta liberar acesso

Origem: `sendEmergencyReceipt`.

A solicitacao e salva, uma mensagem e enviada ao chat e o sistema tenta enfileirar liberacao no access bridge por 5 segundos.

Destino: use case com eventos/outbox: `ComprovanteEmergencialEnviado`, handlers em Comunicacao e Acesso.

### IAM-EMERG-008 - Atualizacao de solicitacao aceita apenas tres acoes

Origem: `updateEmergencyRequest`.

Acoes permitidas: `confirmado`, `recusado`, `baixado`.

Destino: `AtualizarSolicitacaoEmergencialUseCase`.

