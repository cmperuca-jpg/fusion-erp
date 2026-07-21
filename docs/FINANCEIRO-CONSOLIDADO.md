# Fusion ERP — financeiro consolidado

Esta versão mantém os módulos existentes do Fusion (treinos, portal do aluno e portal do professor) e substitui as regras financeiras frágeis por um livro financeiro único, inspirado no fluxo operacional do SCA.

## Estrutura implantada

`Aluno → Matrícula → Título a receber → Item do recibo → Recibo → Forma de pagamento → Caixa → Movimento`

O plano de contas classifica contas a receber e contas a pagar. Os arquivos `mensalidades.json` e `recebimentos.json` continuam existindo apenas para compatibilidade das telas antigas; o título mestre é `financeiro.json`.

## Regras de segurança

- Valores monetários críticos também são gravados em centavos inteiros.
- Recebimentos e pagamentos exigem caixa aberto.
- Recibo possui cabeçalho e itens separados e pode quitar vários títulos do mesmo aluno.
- Um recebimento pode usar várias formas de pagamento.
- `operacaoId` impede recibo duplicado por clique/requisição repetida.
- Estorno não apaga: marca o recibo, reabre o título e gera contramovimento no caixa.
- Pagamento acima do saldo gera troco em dinheiro ou crédito para o aluno.
- Alunos, matrículas, títulos e movimentos financeiros não são excluídos fisicamente.
- Alteração de vencimento, cancelamento, recebimento e estorno ficam auditados.
- Contas a pagar não são mais espelhadas em `pagamentos.json`, `financeiro.json` e `db.json`; a fonte mestre é única.
- Gravações relacionadas usam a transação atômica da persistência do Fusion.

## Homologação local

1. Copie `.env.example` para `.env`.
2. Mantenha `FUSION_SYNC_DATA_ON_LOCAL=false` e `FUSION_REQUIRE_SUPABASE_DATA=false`.
3. Execute `npm install`.
4. Execute `npm run migrate:financeiro:simular`.
5. Execute `npm run migrate:financeiro`.
6. Execute `npm run check`, `npm run test:financeiro` e `npm run test:localhost`.
7. Execute `npm start` e abra `http://localhost:3000`.

Não configure a sincronização Supabase antes de concluir a homologação e gerar um backup verificável.

## Resultado da base recebida

- 392 alunos e 81 matrículas foram verificados.
- A estrutura financeira estava vazia e foi inicializada sem criar cobranças fictícias.
- A verificação de integridade foi aprovada.
- Permanecem três avisos de CPF repetido em histórico importado. Não houve mesclagem automática, pois os nomes são diferentes e uma decisão incorreta poderia unir pessoas distintas.

## Credenciais

Nunca distribua o ZIP com `.env`, chave `service_role` ou token do Access Agent. Como credenciais reais foram compartilhadas durante a homologação, revogue-as e gere novas antes de publicar ou vender o sistema.
