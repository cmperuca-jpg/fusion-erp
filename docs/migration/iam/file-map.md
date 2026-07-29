# IAM File Map

Data: 2026-07-29

Este mapa define o destino proposto dos arquivos legados do IAM. Ele nao marca migracao como concluida; serve como contrato de destino antes de mover codigo.

## Auth

| Legado | Conteudo atual | Destino novo |
| --- | --- | --- |
| `modules/auth/auth.service.mjs` | `PERFIS_PADRAO`, validacao de usuario, senha, JWT, CRUD, bootstrap admin. | Fachada temporaria chamando use cases em `src/contexts/iam/auth/application/use-cases`. |
| `modules/auth/auth.routes.mjs` | Rotas Express e middlewares locais `autenticarRequisicao` e `exigirAdministrador`. | `src/contexts/iam/auth/presentation/auth.routes.mjs`, `auth.controller.mjs`, `usuarios.controller.mjs`. |

## Security

| Legado | Conteudo atual | Destino novo |
| --- | --- | --- |
| `modules/security/api-security.middleware.mjs` | Public routes, admin prefixes, rate limit, headers, portal aluno/professor, autenticacao de sessao. | Dividir entre `src/contexts/iam/security/application/policies`, `presentation/middlewares` e `src/shared/middlewares/security-headers.middleware.mjs`. |

## Emergency Access

| Legado | Conteudo atual | Destino novo |
| --- | --- | --- |
| `modules/emergency-access/emergency-access.service.mjs` | Elegibilidade, divida vencida, comprovante, upload, chat, liberacao de catraca. | `iam/emergency-access` para regra de tentativa; query port para Financeiro; event handlers em Comunicacao e Acesso. |
| `modules/emergency-access/emergency-access.routes.mjs` | Rotas Express diretas para service. | `src/contexts/iam/emergency-access/presentation/emergency-access.routes.mjs` e controller. |

## Estrutura alvo inicial

```text
src/contexts/iam/
  auth/
    domain/
      entities/usuario.entity.mjs
      policies/autenticacao.policy.mjs
      policies/autorizacao.policy.mjs
      policies/senha.policy.mjs
      repositories/usuario.repository.port.mjs
    application/
      use-cases/autenticar-usuario.use-case.mjs
      use-cases/validar-token.use-case.mjs
      use-cases/gerar-token-portal.use-case.mjs
      use-cases/validar-token-portal.use-case.mjs
      use-cases/criar-usuario.use-case.mjs
      use-cases/atualizar-usuario.use-case.mjs
      use-cases/alternar-status-usuario.use-case.mjs
      use-cases/remover-usuario.use-case.mjs
      use-cases/listar-usuarios.use-case.mjs
      use-cases/obter-usuario.use-case.mjs
      use-cases/bootstrap-admin.use-case.mjs
      dto/usuario.dto.mjs
      mappers/usuario.mapper.mjs
    infrastructure/
      repositories/json-usuario.repository.mjs
      providers/password.provider.mjs
      providers/jwt.provider.mjs
      providers/bootstrap-credential-writer.provider.mjs
    presentation/
      controllers/auth.controller.mjs
      controllers/usuarios.controller.mjs
      routes/auth.routes.mjs
  security/
    application/
      policies/public-route.policy.mjs
      policies/admin-route.policy.mjs
      policies/portal-aluno-acesso.policy.mjs
      policies/portal-professor-acesso.policy.mjs
    infrastructure/
      login-attempt-store.memory.mjs
    presentation/
      middlewares/api-security.middleware.mjs
      middlewares/login-rate-limit.middleware.mjs
  emergency-access/
    domain/
      policies/tentativa-emergencial.policy.mjs
      entities/solicitacao-emergencial.entity.mjs
    application/
      use-cases/obter-status-emergencial-aluno.use-case.mjs
      use-cases/enviar-comprovante-emergencial.use-case.mjs
      use-cases/validar-acesso-temporario.use-case.mjs
      use-cases/atualizar-solicitacao-emergencial.use-case.mjs
      ports/financeiro-debitos.port.mjs
      ports/comunicacao.port.mjs
      ports/acesso-emergencial.port.mjs
    infrastructure/
      repositories/json-emergency-access.repository.mjs
      storage/emergency-receipt.storage.mjs
    presentation/
      emergency-access.controller.mjs
      emergency-access.routes.mjs
```

## Compatibilidade temporaria

Durante a migracao, manter:

- `modules/auth/auth.service.mjs` como fachada para nao quebrar imports atuais.
- `modules/auth/auth.routes.mjs` exportando o mesmo router ou delegando ao router novo.
- `modules/security/api-security.middleware.mjs` exportando os mesmos nomes publicos.
- `modules/emergency-access/*` exportando os mesmos nomes publicos ate as rotas serem religadas no bootstrap.

