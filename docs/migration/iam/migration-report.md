# IAM Migration Report

Data: 2026-07-29
Status: inventario inicial concluido; migracao de codigo ainda nao iniciada.

Observacao de ordem: a migracao real de IAM agora deve aguardar a Fase 0 - Banco Legado, documentada em `docs/migration/legacy-database`, para garantir correspondencia formal entre SCA, entidades Fusion e destino de dados.

## Entregue neste lote

- Inventario dos arquivos legados de IAM.
- Regras de negocio extraidas de `auth`, `security` e `emergency-access`.
- Mapa de destino dos arquivos para arquitetura em camadas.
- Lista de pendencias, riscos e testes obrigatorios antes da migracao real.

## Arquivos criados

- `docs/migration/iam/inventory.md`
- `docs/migration/iam/business-rules.md`
- `docs/migration/iam/file-map.md`
- `docs/migration/iam/pending-items.md`
- `docs/migration/iam/migration-report.md`

## APIs preservadas nesta fase

Nenhuma API foi alterada nesta fase documental. Endpoints atuais de `/api/auth` e `/api/emergency-access` permanecem intocados.

## Codigo alterado nesta sessao fora do IAM

- `modules/alunos/alunos.service.mjs`: reforco defensivo para preservar status cadastral/matricula quando uma edicao de aluno nao envia status explicitamente. Motivo: impedir que alteracao de professor, nascimento, telefone, foto ou observacao cancele aluno por efeito colateral.

## Proxima etapa recomendada

Implementar a migracao real de `auth` primeiro, mantendo fachada temporaria:

1. Criar provider de senha e JWT.
2. Criar repository de usuarios.
3. Criar use cases de login, validar token e CRUD de usuarios.
4. Transformar `auth.service.mjs` em fachada.
5. Preservar contrato das rotas atuais.
6. Adicionar testes de senha, token, admin e bootstrap.
