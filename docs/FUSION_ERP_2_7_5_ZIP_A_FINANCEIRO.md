# Fusion ERP 2.7.5 — ZIP A Financeiro

## Objetivo
Consolidar a integração do módulo de Pagamentos com a base real do Fusion ERP antes do envio para o Render.

## Correções aplicadas
- A rota de pagamentos passa a ler `data/pagamentos.json`, `data/financeiro.json` e `data/db.json`.
- A criação de conta a pagar grava simultaneamente em `pagamentos.json`, `financeiro.json` e `db.json`.
- Baixa, estorno, cancelamento, edição e exclusão passam a sincronizar os repositórios usados pelo sistema.
- O caixa recebe movimento de saída ao baixar pagamento.
- A tela de Pagamentos deixa de tratar lista vazia como falha de API.
- A mensagem da tela agora diferencia ausência de contas a pagar de erro real de rota.

## Arquivos alterados
- `modules/financeiro/pagamentos.repository.mjs`
- `public/pages/pagamentos/index.js`
- `public/pages/financeiro/pagamentos/index.js`

## Teste local recomendado
1. Extrair o ZIP na raiz da cópia de teste.
2. Rodar:

```bash
npm run render:check
npm start
```

3. Abrir:

```text
http://localhost:3000/pages/pagamentos/index.html
http://localhost:3000/api/financeiro/pagamentos
```

4. Criar uma nova conta a pagar na tela de Pagamentos.
5. Verificar se ela aparece no financeiro e se a baixa gera movimento no caixa.

## Observação
Os lançamentos existentes em `data/financeiro.json` do tipo `receber` continuam aparecendo no Financeiro e Recebimentos. A tela Pagamentos exibe apenas contas a pagar, despesas, fornecedores e pagamentos cadastrados.
