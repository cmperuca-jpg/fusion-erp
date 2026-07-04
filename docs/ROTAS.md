# Rotas adicionadas

Base:

```txt
/api/bi/avaliacoes-treinos-rankings
```

## Resumo geral

```http
GET /resumo?inicio=2026-01-01&fim=2026-12-31
```

Retorna KPIs de avaliações, treinos e rankings.

## Avaliações

```http
GET /avaliacoes/evolucao?aluno_id=1&inicio=2026-01-01&fim=2026-12-31
GET /avaliacoes/comparativo?inicio=2026-01-01&fim=2026-12-31
```

## Treinos

```http
GET /treinos/resumo?inicio=2026-01-01&fim=2026-12-31
GET /treinos/exercicios-mais-usados?inicio=2026-01-01&fim=2026-12-31&limite=10
```

## Rankings

```http
GET /rankings/alunos-frequencia?inicio=2026-01-01&fim=2026-12-31&limite=10
GET /rankings/alunos-evolucao?inicio=2026-01-01&fim=2026-12-31&limite=10
GET /rankings/instrutores?inicio=2026-01-01&fim=2026-12-31&limite=10
GET /rankings/modalidades?inicio=2026-01-01&fim=2026-12-31&limite=10
```
