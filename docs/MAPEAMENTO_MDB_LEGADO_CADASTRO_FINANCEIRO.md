# Mapeamento MDB legado - cadastro e financeiro

Fonte analisada: `C:\Users\academia01\Desktop\Nova pasta\dados_060726151439.mdb`

Data do arquivo: 2026-07-06 15:13:46

Tamanho: 90.763.264 bytes

## Metodo

1. Tentativa de abertura por `Microsoft.ACE.OLEDB.16.0`, `Microsoft.ACE.OLEDB.12.0` e `Microsoft.Jet.OLEDB.4.0`.
2. Como os providers nao estao registrados nesta maquina, foi feito inventario binario de identificadores, nomes de tabelas/campos e mensagens gravadas no MDB.
3. Os nomes encontrados foram cruzados com a arquitetura da base Fusion ERP piloto.

Este documento registra o que foi preservado na reconstrucao. A extracao relacional completa deve ser refeita com `tools/mdb-legado/exportar-schema-mdb.ps1` quando o driver Access estiver instalado.

## Cadastros preservados

Entidades identificadas no legado:

- `Alunos`
- `Matricula`
- `MatriculaTurmas`
- `Turmas`
- `TurmasProfessores`
- `Modalidades`
- `Funcionarios`
- `Planos`
- `csMatriculados`
- `csAlunosTurma`
- `csAlunosHorario`

Campos/identificadores encontrados:

- `alunoID`
- `alunoNome`
- `alunoExcluido`
- `matriculaID`
- `matriculaSituacao`
- `matriculaExcluida`
- `turmaID`
- `planoID`
- `modalidadeID`
- `funcID`
- `funcNome`
- `funcSituacao`
- `funcExcluido`

Regras preservadas:

- aluno excluido no legado vira exclusao logica, nao remocao fisica;
- matricula guarda situacao propria, separada do cadastro do aluno;
- plano, modalidade e turma permanecem vinculados a matricula;
- alunos ativos podem gerar mensalidade e financeiro recorrente;
- alunos inativos/excluidos nao devem gerar nova mensalidade automaticamente;
- historico de alteracao de aluno e matricula deve ser mantido em auditoria.

## Financeiro preservado

Entidades identificadas no legado:

- `Receber`
- `Recebimentos`
- `Pagamentos`
- `Recibos`
- `RecibosRecebimentos`
- `PlanodeContas`
- `FormasPagamento`
- `ContasBanco`
- `ChequesRecebidos`
- `ChequesEmitidos`
- `Vendas`
- `VendasItens`

Campos/identificadores encontrados:

- `contaID`
- `recebID`
- `pagamentoID`
- `reciboID`
- `formaID`
- `bancoID`
- `caixaID`
- `movID`
- `movTipo`
- `movData`
- `movHistorico`
- `movValor`
- `recebDtVencimento`
- `recebValor`
- `recebPago`
- `recebHistorico`
- `recebExcluido`
- `reciboData`
- `reciboValorPago`
- `chequeNumero`
- `chequeValor`
- `chequeBomPara`
- `chequeDtCompensacao`
- `chequeExcluido`
- `produtoID`
- `produtoQtde`
- `produtoPreco`
- `produtoItem`
- `produtoTotal`

Mensagens e eventos encontrados no MDB:

- `Cadastrou a conta a receber MENSALIDADE REF`
- `Alterou a conta a receber MENSALIDADE REF`
- `Excluiu a conta a receber MENSALIDADE REF`
- `Recebeu conta do aluno`
- `Recebeu contas do aluno`
- `Alterou a conta para paga - Recibo`
- `Isentou o pagamento da conta do aluno`
- `Realizou a abertura do Caixa. Valor Inicial`
- `Realizou o fechamento do Caixa. Valor Final`
- `Efetuou retirada do caixa. Valor`
- `PGTO MENSALIDADE`
- `ATRASO NO PAGAMENTO DA MENSALIDADE`
- `VENDA DE PRODUTOS`

Regras preservadas:

- conta a receber nasce com vencimento, valor, historico e aluno/matricula;
- mensalidade usa descricao de referencia mensal;
- pagamento pode ter multa, juros, desconto e forma de pagamento;
- baixa parcial mantem saldo;
- baixa total marca o titulo como pago;
- exclusao de titulo pago nao remove o registro;
- recibo e vinculado a um ou mais recebimentos;
- caixa registra abertura, fechamento, entradas, saidas e retiradas;
- plano de contas diferencia receita e despesa;
- venda de produto gera movimento financeiro e itens de venda.

## Outros modulos identificados

Treinos e avaliacoes:

- `Avaliacao`
- `Exercicios`
- `ExerciciosFichas`
- `ExerciciosTreinos`
- `ExerciciosObjetivos`
- `ExerciciosHistorico`
- `ExerciciosGrupos`
- `FichaSeries`
- `FichaRepeticoes`
- `FichaCarga`
- `treinoID`
- `treinoAtivo`

Acesso e frequencia:

- `Frequencia`
- `csFrequencia`
- `CsFrequenciaFuncionario`
- `TerminalAcessos`
- `LogsAcesso`
- `CatracaLiberacoes`
- `tmpCatracaComando`
- `digitalID`
- `digitalEsq`
- `digitalDir`
- `digitalTipo`
- `alunoCartao`
- `funcCartao`

## Mapeamento para a versao web local

| Legado MDB | Fusion ERP Local |
| --- | --- |
| `Alunos` | `data/alunos.json`, `/api/alunos` |
| `Matricula`, `MatriculaTurmas` | `data/matriculas.json`, integracao de matricula |
| `Planos` | `data/planos.json`, `/api/planos` |
| `Modalidades` | `data/modalidades.json`, `/api/modalidades` |
| `Turmas`, `TurmasProfessores` | `data/turmas.json`, `/api/turmas` |
| `Receber` | `data/financeiro.json`, `/api/financeiro` |
| `Recebimentos` | `data/recebimentos.json`, `/api/recebimentos` |
| `Pagamentos` | `data/pagamentos.json`, `/api/financeiro/pagamentos` |
| `Recibos`, `RecibosRecebimentos` | `data/recibos.json`, `/api/financeiro/estrutura/recibos` |
| `PlanodeContas` | `data/plano_contas.json`, `/api/financeiro/estrutura/plano-contas` |
| `FormasPagamento` | `data/formas_pagamento.json`, `/api/financeiro/estrutura/configuracao` |
| `Caixa` / movimentos | `data/caixa.json`, `/api/caixa` |
| `Vendas`, `VendasItens` | modulo loja/estoque e financeiro |
| `Frequencia`, `LogsAcesso` | modulos frequencia, check-in e access engine |

## Pendencia objetiva

Para concluir o mapeamento relacional 100% fiel, falta executar a exportacao por driver Access em uma maquina com Access Database Engine instalado. O script `tools/mdb-legado/exportar-schema-mdb.ps1` ja foi incluido para essa etapa.
