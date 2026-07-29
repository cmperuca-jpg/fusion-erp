# Analyzer Access Legado

Data: 2026-07-29

## Local encontrado

Projeto usado para ler o MDB/ACCDB legado:

```text
C:\Users\academia01\Desktop\FusionERP_chat_corrigido\banco-access-analise\Fusion.Legacy.Analyzer
```

Arquivos importantes:

- `Access/AccessColumnReader.cs`
- `Program.cs`
- `Fusion.Legacy.Analyzer.csproj`
- `postgresql-schema.sql`
- `postgresql-data.sql`
- `postgresql-full.sql`

## Situacao do leitor de colunas

O `AccessColumnReader.cs` ja esta adequado para a Fase 0:

- usa `connection.GetOleDbSchemaTable(OleDbSchemaGuid.Columns, ...)`;
- le nome, ordem, tipo, tamanho, precisao, escala e nulidade;
- traduz o codigo numerico para nome de `OleDbType`;
- detecta AutoNumber/AutoIncrement por `ExecuteReader(CommandBehavior.SchemaOnly)`.

Portanto, nao precisa substituir o arquivo pelo snippet mais simples, a menos que o analyzer volte a falhar. O arquivo atual preserva a melhoria de tipo e ainda acrescenta a deteccao de AutoNumber.

## Como executar novamente

No PowerShell:

```powershell
cd C:\Users\academia01\Desktop\FusionERP_chat_corrigido\banco-access-analise\Fusion.Legacy.Analyzer
dotnet run
```

Quando pedir o caminho do MDB/ACCDB, informar o banco legado usado na analise.

Saidas esperadas:

- `postgresql-schema.sql`
- `postgresql-data.sql`
- `postgresql-full.sql`

## Regra para o Git

Copiar para o Fusion ERP apenas:

```text
docs/migration/legacy-database/postgresql-schema.sql
```

Nao versionar `postgresql-data.sql` nem `postgresql-full.sql`, porque esses arquivos contem dados reais de alunos, funcionarios, pagamentos, recebimentos e operacao.

## Uso na migracao

O schema exportado deve alimentar:

1. inventario de tabelas;
2. inventario de colunas;
3. inventario de PKs, FKs e indices;
4. classificacao por contexto;
5. decisao sobre tabelas temporarias;
6. mapa SCA -> entidade Fusion;
7. mapa coluna SCA -> atributo Fusion;
8. transformacoes e ordem de carga.
