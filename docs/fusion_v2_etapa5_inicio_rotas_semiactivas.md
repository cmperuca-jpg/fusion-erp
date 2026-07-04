# Fusion ERP v2.0 - Etapa 5 Início

## Objetivo
Consolidar o primeiro ponto seguro da base: rotas existentes no projeto que estavam com páginas no menu, mas sem montagem no `server.mjs`.

## Rotas ativadas
- `GET /api/auth/me`
- `POST /api/auth/login` por router, mantendo compatibilidade com a rota direta já existente
- `/api/bi/executivo`
- `/api/bi/financeiro`
- `/api/bi/academia`
- `/api/bi/academia-operacional`
- `/api/modelos-treino`
- `/api/presencas`

## Preservado
- Financeiro
- Caixa
- Recebimentos
- Pagamentos
- Mensalidades
- Cobrança
- Matrículas por integração
- BI Financeiro já corrigido nas etapas anteriores

## Observação técnica
A rota `modules/matriculas/matriculas.routes.mjs` não foi montada nesta etapa para evitar conflito com `matricula.integracao.routes.mjs`, que já controla `/api/matriculas` e está funcionando no fluxo real de cadastro, matrícula, financeiro e cobrança.

## Testes sugeridos
1. `npm start`
2. Abrir `/api/bi/academia`
3. Abrir `/api/bi/academia-operacional`
4. Abrir `/api/presencas`
5. Abrir `/api/modelos-treino`
6. Testar páginas:
   - BI e Rankings
   - BI Comercial
   - BI Operacional
   - Presenças
   - Modelos de treino
7. Repetir o fluxo principal:
   - Aluno
   - Matrícula
   - Recebimento
   - Caixa
   - Relatório Caixa
   - BI Financeiro
