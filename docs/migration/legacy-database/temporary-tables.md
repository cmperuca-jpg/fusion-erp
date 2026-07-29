# Tabelas Temporarias, Tecnicas e Auxiliares

Data: 2026-07-29

Fonte: docs/migration/legacy-database/postgresql-schema.sql.

Regra inicial: tabelas com prefixo `tmp`, `cs` ou nomes de apoio nao devem virar tabelas definitivas sem justificativa funcional.

Total encontrado por heuristica: 18.

| Tabela | Colunas | PK | Contexto inicial | Decisao inicial |
| --- | ---: | --- | --- | --- |
| tmpAnalise | 6 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpAvisos | 13 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpBina | 2 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpBoletos | 7 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpBoletosGerar | 2 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpCartaoParcelas | 6 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpCatracaComando | 1 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpCheques | 8 | sim | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpCheques2 | 6 | sim | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpHorarios | 7 | sim | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpPermissoes | 8 | sim | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpPlanodeContas | 4 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpPlanodeContas2 | 6 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpSelecionados | 3 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpTurmasModalidades | 2 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpTurmasProfessores | 3 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpVendasItens | 7 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |
| tmpVendasParcelas | 4 | nao | tecnica/temporaria | nao migrar automaticamente; investigar se guarda estado real ou apenas resultado temporario |

Observacao: outras tabelas sem PK tambem podem ser auxiliares. Ver `constraints-inventory.md` antes de criar entidades definitivas.

