# Pendencias - Fase Banco Legado

Data: 2026-07-29

## Pendencia critica resolvida

`postgresql-schema.sql` foi localizado fora do repositorio, no analyzer Access:

```text
C:\Users\academia01\Desktop\FusionERP_chat_corrigido\banco-access-analise\Fusion.Legacy.Analyzer\postgresql-schema.sql
```

O arquivo foi copiado para:

```text
docs/migration/legacy-database/postgresql-schema.sql
```

Tambem foi verificado o arquivo:

```text
C:\Users\academia01\Downloads\fusion-erp\src.zip
```

Resultado: o ZIP contem 682 entradas, mas nao contem `postgresql-schema.sql`. O unico arquivo `.sql` encontrado nele foi:

```text
modules/henry7x/docs/Firebird.sql
```

O ZIP contem material auxiliar util, incluindo `docs/MAPEAMENTO_MDB_LEGADO_CADASTRO_FINANCEIRO.md` e `docs/arquitetura/fusao-sca-fusion.md`, mas o schema completo usado agora veio do analyzer Access.

Os arquivos `postgresql-data.sql` e `postgresql-full.sql` tambem existem no analyzer, mas nao foram copiados para o Git porque contem dados reais de pessoas, pagamentos e operacao.

## Analises concluidas com o schema

1. Extrair lista completa de tabelas.
2. Extrair lista completa de colunas por tabela.
3. Extrair tipos de dados.
4. Extrair chaves primarias.
5. Extrair chaves estrangeiras.
6. Extrair indices.
7. Identificar tabelas temporarias por nome e por ausencia de FK.

Resultado inicial:

- 123 tabelas.
- 1489 colunas.
- 58 tabelas com PK declarada.
- 65 tabelas sem PK declarada.
- 23 FKs declaradas.
- 149 indices.
- 18 tabelas temporarias/auxiliares por heuristica.

## Analises ainda pendentes

1. Completar mapa tabela SCA para entidade Fusion.
2. Completar mapa coluna SCA para atributo Fusion.
3. Definir transformacoes por campo.
4. Definir ordem de carga real validada contra dependencias.
5. Definir validacoes pos-carga.
6. Decidir tabela a tabela o destino das 65 tabelas sem PK.
7. Decidir tabela a tabela o destino das 18 temporarias/auxiliares.
8. Conferir regras sensiveis: status de aluno, status de matricula, turma/modalidade sem financeiro, recebimentos/recibos e desconto.

## Risco se pular esta fase

- O codigo novo pode nascer organizado, mas desconectado dos dados reais.
- Situacao de aluno pode continuar misturada com situacao de matricula.
- Turmas/modalidades podem continuar caindo indevidamente no financeiro.
- Pagamentos, recebimentos e recibos podem perder rastreabilidade.
- Tabelas temporarias podem virar lixo permanente no Fusion.
