# Mapa Inicial de Tabelas SCA para Fusion

Data: 2026-07-29

Este mapa inicial consolida as tabelas citadas na analise operacional. Ele deve ser validado contra `postgresql-schema.sql` antes da migracao real.

| Tabela SCA | Contexto Fusion | Entidade / conceito | Destino proposto |
| --- | --- | --- | --- |
| `Alunos` | `contexts/cadastros/alunos` | `Aluno` | `alunos` |
| `Matricula` | `contexts/academico/matriculas` | `Matricula` | `matriculas` |
| `MatriculaTurmas` | `contexts/academico/matriculas` | vinculo `MatriculaTurma` | `matriculas_turmas` |
| `Modalidades` | `contexts/academico/modalidades` | `Modalidade` | `modalidades` |
| `Turmas` | `contexts/academico/turmas` | `Turma` | `turmas` |
| `Funcionarios` | `contexts/cadastros/professores` ou `contexts/iam` | `Professor` / `Usuario` | `professores` / `usuarios` |
| `Permissoes` | `contexts/iam/security` | `Permissao` | `permissoes` |
| `Pagamentos` | `contexts/financeiro/financeiro` | `Pagamento` | `pagamentos` |
| `Recebimentos` | `contexts/financeiro/recebimentos` | `Recebimento` | `recebimentos` |
| `Recibos` | `contexts/financeiro/recebimentos` | `Recibo` | `recibos` |
| `Frequencia` | `contexts/academico/frequencia` | `RegistroFrequencia` | `frequencias` |
| `Digitais` | `contexts/acesso/biometria` | `Biometria` | `biometrias` |
| `Vendas` | `contexts/comercial/comercial` | `Venda` | `vendas` |
| `VendasItens` | `contexts/comercial/comercial` | `ItemVenda` | `vendas_itens` |

## Tabelas ja citadas no mapeamento MDB legado

| Tabela / identificador legado | Classificacao inicial |
| --- | --- |
| `TurmasProfessores` | vinculo academico entre turma e professor; validar destino `turmas_professores`. |
| `Planos` | comercial/planos; destino `planos`. |
| `csMatriculados` | visao/consulta tecnica ou tabela auxiliar de matriculados; investigar antes de migrar. |
| `csAlunosTurma` | possivel consulta/tabela auxiliar de aluno por turma; investigar contra `MatriculaTurmas`. |
| `csAlunosHorario` | possivel consulta/tabela auxiliar de horario; investigar contra turmas/agenda. |
| `Receber` | financeiro/contas a receber; destino provavel `financeiro` ou `mensalidades`, conforme origem. |
| `RecibosRecebimentos` | vinculo recibo-recebimento; destino `recibos_itens` ou tabela de vinculo. |
| `PlanodeContas` | financeiro/configuracao; destino `plano_contas`. |
| `FormasPagamento` | financeiro/configuracao; destino `formas_pagamento`. |
| `ContasBanco` | financeiro/configuracao; destino `contas_banco`. |
| `ChequesRecebidos` | financeiro/recebimentos; destino pendente. |
| `ChequesEmitidos` | financeiro/pagamentos; destino pendente. |
| `Caixa` / movimentos | financeiro/caixa; destino `caixa` e movimentos de caixa. |
| `Avaliacao` | treinamento/avaliacoes; destino `avaliacoes`. |
| `Exercicios` | treinamento/exercicios; destino `exercicios`. |
| `ExerciciosFichas` | treinamento/treinos; destino pendente. |
| `ExerciciosTreinos` | treinamento/treinos; destino pendente. |
| `ExerciciosObjetivos` | treinamento/biblioteca; destino pendente. |
| `ExerciciosHistorico` | treinamento/historico; destino pendente. |
| `ExerciciosGrupos` | treinamento/biblioteca; destino pendente. |
| `FichaSeries` | treinamento/treinos; destino pendente. |
| `FichaRepeticoes` | treinamento/treinos; destino pendente. |
| `FichaCarga` | treinamento/treinos; destino pendente. |
| `TerminalAcessos` | acesso/access-engine; destino `access_dispositivos` ou `terminais_acesso`. |
| `LogsAcesso` | acesso/access-engine; destino `access_logs`. |
| `CatracaLiberacoes` | acesso/access-engine; destino pendente. |

## Regras de transformacao conhecidas

- Exclusao logica do legado nao deve virar remocao fisica no Fusion.
- Situacao de aluno e situacao de matricula devem ser preservadas separadamente.
- Plano, modalidade, turma e professor devem ser vinculados a matricula ou a vinculos operacionais, nao ao financeiro sem necessidade.
- Pagamento recebido deve preservar recibo, forma, valor pago, desconto, multa, juros e data.
- Tabelas de frequencia/acesso devem preservar data/hora, aluno, terminal e resultado quando existirem.

