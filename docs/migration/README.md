# Plano de Migracao Arquitetural

Data: 2026-07-29

## Ordem obrigatoria revisada

Antes de migrar codigo por contexto, a migracao deve passar pela fase de banco legado.

1. Fase 0 - Banco legado SCA.
2. Core tecnico.
3. IAM.
4. Cadastros.
5. Comercial.
6. Academico.
7. Financeiro.
8. Treinamento.
9. Acesso.
10. Portal.
11. Comunicacao.
12. Inteligencia.

## Regra de bloqueio

Nenhum modulo deve ser considerado migrado enquanto nao existir correspondencia formal entre:

- tabela/coluna do SCA;
- entidade/value object do Fusion;
- tabela/colecao destino do Fusion;
- transformacao de dados;
- ordem de carga;
- risco ou perda funcional conhecida.

O codigo novo pode estar bem organizado e ainda assim estar incompleto se nao houver mapeamento formal dos dados reais do SCA.

## Documentos da Fase 0

- `docs/migration/legacy-database/phase-plan.md`
- `docs/migration/legacy-database/access-analyzer.md`
- `docs/migration/legacy-database/postgresql-schema.sql`
- `docs/migration/legacy-database/table-context-map.md`
- `docs/migration/legacy-database/schema-inventory.md`
- `docs/migration/legacy-database/columns-inventory.md`
- `docs/migration/legacy-database/constraints-inventory.md`
- `docs/migration/legacy-database/temporary-tables.md`
- `docs/migration/legacy-database/pending-items.md`
