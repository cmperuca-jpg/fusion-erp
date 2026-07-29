# IAM Migration Inventory

Data: 2026-07-29
Escopo: `modules/auth`, `modules/security`, `modules/emergency-access`.

Este inventario foi criado antes da migracao de codigo do contexto IAM. O objetivo e registrar o comportamento atual para que o SCA e o Fusion legado sejam usados como fonte de regra, nao como modelo arquitetural.

## Arquivos legados analisados

| Arquivo | Responsabilidade atual | Dados acessados | Modulos chamados | Destino arquitetural |
| --- | --- | --- | --- | --- |
| `modules/auth/auth.service.mjs` | Autenticacao, usuarios, perfis, senha, JWT, bootstrap admin, token de portal. | `usuarios.json`, `data/CREDENCIAIS-INICIAIS.txt`, env JWT/admin/bcrypt. | `../core/persistence/durable-json.mjs`, `bcrypt`, `jsonwebtoken`, `crypto`, `fs`, `path`. | `src/contexts/iam/auth/domain`, `application/use-cases`, `infrastructure`, `presentation`. |
| `modules/auth/auth.routes.mjs` | Endpoints HTTP de login, sessao e administracao de usuarios. Tambem possui middleware local de token e admin. | Nenhum direto. | `auth.service.mjs`, `express`. | `iam/auth/presentation/routes`, `controllers`, middlewares compartilhados. |
| `modules/security/api-security.middleware.mjs` | Middleware global de seguranca HTTP, headers, rate limit, autenticacao de API, permissao de portal e prefixos admin. | Memoria local `loginAttempts`. | `../auth/auth.service.mjs`. | `iam/security/presentation/middlewares`, `iam/security/application/policies`, `shared/middlewares` para headers. |
| `modules/emergency-access/emergency-access.service.mjs` | Liberacao emergencial de aluno inadimplente por comprovante PIX, validacao temporaria, chat e catraca. | `emergency-access.json`, `alunos.json`, `mensalidades.json`, `financeiro.json`, `uploads/emergency-receipts`. | `access-bridge`, `chat`, `fs`, `path`, `crypto`, env PIX. | Regra de permissao em IAM/emergency-access; debito em Financeiro; liberacao em Acesso; chat em Comunicacao. |
| `modules/emergency-access/emergency-access.routes.mjs` | Endpoints HTTP de status, comprovante, validacao de acesso e atualizacao da solicitacao emergencial. | Nenhum direto. | `emergency-access.service.mjs`, `express`. | `iam/emergency-access/presentation/routes` e controllers finos. |

## Registro no servidor atual

`server.mjs` importa e registra:

- `securityHeaders` em `app.use(securityHeaders)`.
- `loginRateLimit` em `/api/auth/login`, `/api/professores/login` e `/api/treinos/aluno-login`.
- `apiSecurity` como middleware global antes das rotas.
- `authRoutes` em `/api/auth`.
- `emergencyAccessRoutes` em `/api/emergency-access`.

## Endpoints preservados

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/usuarios`
- `GET /api/auth/usuarios/:id`
- `POST /api/auth/usuarios`
- `PUT /api/auth/usuarios/:id`
- `POST /api/auth/usuarios/:id/status`
- `DELETE /api/auth/usuarios/:id`
- `GET /api/auth/perfis`

### Emergency Access

- `GET /api/emergency-access/alunos/:alunoId/status`
- `POST /api/emergency-access/comprovante`
- `GET /api/emergency-access/alunos/:alunoId/validar-acesso`
- `POST /api/emergency-access/solicitacoes/:id/:acao`

## Funcoes publicas encontradas

### `auth.service.mjs`

- `gerarTokenPortal`
- `validarTokenPortal`
- `listarUsuarios`
- `obterUsuario`
- `criarUsuario`
- `atualizarUsuario`
- `alternarStatusUsuario`
- `removerUsuario`
- `autenticar`
- `validarToken`
- `obterPerfis`
- `usuarioPadrao`

### `security/api-security.middleware.mjs`

- `loginRateLimit`
- `clearLoginRateLimit`
- `securityHeaders`
- `apiSecurity`

### `emergency-access.service.mjs`

- `studentEmergencyStatus`
- `sendEmergencyReceipt`
- `validateTemporaryEmergencyAccess`
- `updateEmergencyRequest`

## Dependencias externas e tecnicas

- `bcrypt`: hash e comparacao de senha.
- `jsonwebtoken`: emissao e validacao de token JWT.
- `crypto`: UUID local, senha inicial, hash legado SHA-256 e comparacao timing-safe.
- `fs`/`path`: credencial inicial, storage de comprovantes e JSON local.
- `durable-json`: persistencia de usuarios com fallback duravel.
- `access-bridge`: comando de liberacao de catraca em emergencia.
- `chat`: notificacao operacional da emergencia.
- Variaveis de ambiente: `JWT_SECRET`, `FUSION_JWT_SECRET`, `JWT_EXPIRES_IN`, `FUSION_BCRYPT_ROUNDS`, `FUSION_BOOTSTRAP_ADMIN_PASSWORD`, `FUSION_ADMIN_PASSWORD`, `FUSION_PIX_COPY_PASTE`, `FUSION_PIX_KEY`, `FUSION_PIX_RECEIVER`, `FUSION_PIX_CITY`, `NODE_ENV`.

## Riscos observados

- `auth.service.mjs` guarda `senhaAcesso` e `senhaPortal` em texto para retorno administrativo. A regra atual pode ser operacionalmente desejada, mas e risco alto de seguranca.
- `api-security.middleware.mjs` concentra regras de portal aluno, portal professor e administracao por caminho HTTP. Isso dificulta testes e aumenta risco de liberar/bloquear endpoint errado.
- `emergency-access.service.mjs` mistura IAM, financeiro, upload, chat e acesso fisico em uma unica unidade.
- `emergency-access.service.mjs` usa JSON direto, enquanto outros modulos ja usam persistencia duravel/Supabase. Isso pode gerar divergencia em producao.
- Permissoes estao hardcoded em `PERFIS_PADRAO` e tambem duplicadas em policies de caminho no middleware.

