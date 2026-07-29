# Fase 0 - Banco Legado SCA

Data: 2026-07-29
Status: schema SQL localizado via analyzer Access e inventario inicial gerado.

## Objetivo

Criar a correspondencia formal entre o banco real do SCA e a arquitetura nova do Fusion ERP antes de migrar modulos, codigo ou dados.

## Entrada obrigatoria

Arquivo esperado:

```text
postgresql-schema.sql
```

Status atual: copiado para `docs/migration/legacy-database/postgresql-schema.sql`.

Fonte geradora localizada:

- `C:\Users\academia01\Desktop\FusionERP_chat_corrigido\banco-access-analise\Fusion.Legacy.Analyzer`

Arquivos gerados pelo analyzer:

- `postgresql-schema.sql`: copiado para o repositorio e usado nos inventarios.
- `postgresql-data.sql`: localizado, mas nao copiado por conter dados reais.
- `postgresql-full.sql`: localizado, mas nao copiado por conter estrutura junto com dados reais.

Fontes auxiliares existentes:

- `docs/MAPEAMENTO_MDB_LEGADO_CADASTRO_FINANCEIRO.md`
- `tools/mdb-legado/exportar-schema-mdb.ps1`

## Processo obrigatorio

1. Ler `postgresql-schema.sql`.
2. Inventariar todas as tabelas e colunas.
3. Inventariar PKs, FKs e indices.
4. Classificar tabelas por contexto.
5. Identificar tabelas temporarias, tecnicas e auxiliares.
6. Mapear tabela SCA para entidade Fusion.
7. Mapear coluna SCA para coluna ou atributo Fusion.
8. Definir transformacoes de dados.
9. Definir ordem de carga.
10. So depois migrar codigo e dados.

## Saidas obrigatorias

Cada tabela do SCA deve terminar classificada em uma destas categorias:

- migrar como entidade principal;
- migrar como vinculo;
- migrar como historico/auditoria;
- migrar como configuracao;
- migrar como tabela tecnica;
- nao migrar, com justificativa;
- pendente de interpretacao.

## Ordem inicial de carga sugerida

1. IAM: usuarios, permissoes e perfis.
2. Cadastros base: alunos, professores/funcionarios, fornecedores.
3. Comercial base: planos, modalidades comerciais, servicos.
4. Academico base: modalidades, turmas, horarios.
5. Matriculas e vinculos: matriculas, matriculas_turmas.
6. Financeiro estrutural: formas de pagamento, contas, caixa, plano de contas.
7. Financeiro transacional: pagamentos, recebimentos, recibos, mensalidades.
8. Acesso: biometrias/digitais, frequencia, logs e checkins.
9. Comercial transacional: vendas e itens.
10. Treinamento/avaliacoes, quando o schema correspondente estiver mapeado.

## Criterios de aceite da fase

- Todas as tabelas do schema foram listadas.
- Todas as colunas possuem classificacao ou pendencia documentada.
- Todas as tabelas temporarias possuem decisao: descartar, converter, ou investigar.
- PKs, FKs e indices foram registrados.
- Transformacoes de status, CPF, datas, valores e exclusao logica foram definidas.
- Ordem de carga foi validada contra dependencias.
- Riscos de perda de dados foram documentados.

## Inventario inicial gerado

- Tabelas: 123.
- Colunas: 1489.
- Tabelas com PK declarada: 58.
- Tabelas sem PK declarada: 65.
- FKs declaradas: 23.
- Indices declarados: 149.
- Tabelas temporarias/auxiliares por heuristica: 18.

Arquivos de apoio:

- `schema-inventory.md`
- `columns-inventory.md`
- `constraints-inventory.md`
- `temporary-tables.md`
