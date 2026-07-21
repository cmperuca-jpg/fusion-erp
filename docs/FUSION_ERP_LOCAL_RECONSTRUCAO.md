# Fusion ERP Local - Reconstrucao fiel do legado

Data da entrega: 2026-07-21

## Objetivo

Esta entrega transforma a base piloto web em uma versao local mais fiel ao sistema antigo, com prioridade para cadastro, matricula e financeiro.

O sistema permanece local por padrao:

- abre pelo navegador;
- usa os arquivos JSON duraveis da pasta `data`;
- nao exige Supabase para iniciar;
- mantem sincronizacao externa apenas se `FUSION_SYNC_DATA_ON_LOCAL=true` for configurado;
- preserva as rotas e paginas ja existentes.

## Como aplicar

1. Extraia este ZIP na raiz do Fusion ERP existente.
2. Substitua os arquivos quando solicitado.
3. Abra `INICIAR-FUSION-LOCAL.bat`.
4. Acesse `http://127.0.0.1:3000`.

## Como validar

Execute:

```bat
npm.cmd run check
```

Rotas validadas nesta entrega:

- `GET /api/health`
- `GET /api/sistema/diagnostico`
- `GET /api/financeiro/estrutura/configuracao`
- `GET /pages/financeiro/index.html`

## Arquitetura preservada

A organizacao antiga foi mantida como dominios funcionais, nao como executaveis VB6:

- cadastro de alunos, funcionarios/professores, modalidades, planos e turmas;
- matricula vinculada a aluno, plano, turma e status;
- financeiro separado em contas a receber, recebimentos, pagamentos, caixa, recibos, formas de pagamento e plano de contas;
- historico/auditoria para operacoes criticas;
- controle de acesso/catraca mantido no Fusion Access Agent.

## Regras financeiras implantadas

- Caixa aberto e obrigatorio antes de qualquer recebimento ou pagamento.
- Recebimento gera movimento de caixa e recibo numerado.
- Um recibo pode liquidar um ou mais titulos.
- Titulo pago nao e apagado; deve ser estornado.
- Exclusoes abertas viram cancelamento logico.
- Mudanca de vencimento so ocorre em titulo aberto e fica auditada.
- Plano de contas separa receitas e despesas.
- Formas de pagamento sao padronizadas.
- Extrato por aluno junta matriculas, titulos, mensalidades, recebimentos, recibos e creditos.

## Limite tecnico do MDB nesta maquina

O arquivo Access principal localizado foi:

`C:\Users\academia01\Desktop\Nova pasta\dados_060726151439.mdb`

Tamanho: 90.763.264 bytes.

O Windows desta maquina nao possui `Microsoft.ACE.OLEDB` nem `Microsoft.Jet.OLEDB` registrados. Por isso, a leitura relacional completa de tabelas/campos do MDB nao pode ser executada neste ambiente sem instalar o driver Access Database Engine.

Mesmo assim, o MDB foi inspecionado por inventario binario de identificadores e logs internos. O mapeamento resultante esta em `docs/MAPEAMENTO_MDB_LEGADO_CADASTRO_FINANCEIRO.md`.

## Arquivos principais desta entrega

- `server.mjs`
- `package.json`
- `INICIAR-FUSION-LOCAL.bat`
- `modules/backup/supabase-data.service.mjs`
- `modules/financeiro/estrutura-financeira.routes.mjs`
- `modules/financeiro/estrutura-financeira.service.mjs`
- `modules/financeiro/financeiro.service.mjs`
- `modules/financeiro/recebimentos.service.mjs`
- `modules/financeiro/pagamentos.service.mjs`
- `modules/financeiro/pagamentos.repository.mjs`
- `public/pages/financeiro/index.html`
- `public/pages/financeiro/financeiro.js`
- `public/pages/financeiro/financeiro.css`
- `tools/mdb-legado/exportar-schema-mdb.ps1`
