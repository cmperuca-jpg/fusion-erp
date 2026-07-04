# Fusion ERP 2.6-A — Check-in Inteligente da Musculação

Etapa integrada sobre a arquitetura existente do Fusion ERP. Não foi criado sistema paralelo.

## Arquivos alterados

- `modules/checkin/checkin.service.mjs`
- `modules/checkin/checkin.routes.mjs`
- `public/pages/checkin/checkin.js`
- `public/pages/checkin/index.html`

## Novas rotas

- `GET /api/checkin/musculacao/autorizacao?codigo=...`
- `POST /api/checkin/musculacao`

Payload mínimo do POST:

```json
{
  "codigo": "MAT-202607-000007",
  "usuario": "Recepção"
}
```

O campo `codigo` aceita matrícula, CPF, ID do aluno, QR Code ou código equivalente já gravado no cadastro.

## Integrações realizadas

1. Localiza o aluno no cadastro real (`data/alunos.json`).
2. Valida matrícula ativa (`data/matriculas.json`).
3. Valida contrato comercial, quando existente (`data/comercial/contratos.json`).
4. Confirma se o plano/matrícula permite musculação.
5. Verifica pendências vencidas em mensalidades e financeiro.
6. Registra check-in em `data/checkins.json`.
7. Registra presença em `data/frequencia.json`.
8. Localiza treino ativo no motor operacional de treinos.
9. Inicia execução de treino em `data/treinos_execucoes.json` quando houver treino ativo.
10. Mantém os dados disponíveis para Portal do Aluno e Painel do Professor pelas rotas já existentes.

## Testes executados

- `node --check server.mjs`
- `node --check modules/checkin/checkin.service.mjs`
- `node --check modules/checkin/checkin.routes.mjs`
- `node --check public/pages/checkin/checkin.js`
- `GET /api/checkin/musculacao/autorizacao?codigo=04877315497`
- `POST /api/checkin/musculacao` com matrícula sem treino ativo.
- `POST /api/checkin/musculacao` com matrícula com treino ativo, frequência e execução iniciadas.

## Observação operacional

A entrada rápida da tela de check-in agora usa o fluxo inteligente da musculação. O botão antigo não cria mais aluno fictício; ele consulta os dados reais do ERP antes de liberar ou bloquear a entrada.
