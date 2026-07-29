# Inventario do Schema PostgreSQL exportado do Access

Data: 2026-07-29

Fonte: docs/migration/legacy-database/postgresql-schema.sql.

Total de tabelas: 123.
Total de colunas: 1489.
Tabelas com PK: 58.
Tabelas sem PK: 65.

Esta classificacao inicial foi gerada por nome de tabela e precisa ser revisada contra regras de negocio, telas do SCA e dados reais.

| Tabela | Colunas | PK | Colunas PK | Contexto inicial | Decisao inicial |
| --- | ---: | --- | --- | --- | --- |
| Agenda | 12 | sim | agendaID | academico | organizacao operacional: modalidade, turma, horario, local ou frequencia |
| AgendaConfirmacoes | 4 | nao |  | academico | organizacao operacional: modalidade, turma, horario, local ou frequencia |
| Alunos | 55 | sim | alunoID | cadastros/alunos | migrar cadastro, responsaveis, contatos ou dados complementares |
| AlunosContatos | 11 | nao |  | cadastros/alunos | migrar cadastro, responsaveis, contatos ou dados complementares |
| AlunosCreditos | 7 | sim | CreditoID | cadastros/alunos | migrar cadastro, responsaveis, contatos ou dados complementares |
| AnamneseConfig | 2 | nao |  | cadastros/alunos | migrar cadastro, responsaveis, contatos ou dados complementares |
| Auditoria | 7 | sim | auditoriaId | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| Avaliacao | 7 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoAnamnese | 5 | nao |  | cadastros/alunos | migrar cadastro, responsaveis, contatos ou dados complementares |
| AvaliacaoBioimpedancia | 5 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoBioimpedanciaConfig | 3 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoCardiorrespiratoria | 7 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoComparacao | 42 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoComparacaoT | 6 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoComposicao | 25 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoConfig | 19 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoNeuromotora | 8 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoObs | 3 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoPARQ | 11 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoPerimetros | 24 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoPerimetrosC | 4 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoPostural | 5 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoRisco | 11 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoTestes1a3 | 16 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| AvaliacaoTestes4a6 | 30 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| Bancos | 4 | sim | bancoID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| Caixa | 25 | sim | caixaID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| CaixaConfig | 15 | nao |  | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| CaixaMovimentos | 11 | sim | movID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| CartaoParcelas | 16 | nao |  | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| Cartoes | 8 | nao |  | pendente | classificar apos leitura funcional |
| CatracaLiberacoes | 7 | nao |  | acesso | biometria, catraca, terminal ou log de acesso |
| ChequesEmitidos | 13 | sim | chequeID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| ChequesRecebidos | 17 | sim | chequeID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| CieloChamadas | 19 | nao |  | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| CieloChamadasRecebimentos | 2 | nao |  | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| Config | 47 | sim | configID | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| ConfigBoleto | 41 | nao |  | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| ConfigBoleto2 | 50 | nao |  | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| ConfigCarteira | 18 | nao |  | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| ConfigRecibo | 50 | sim | Id | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| ConfigReciboBematech | 29 | nao |  | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| ConfigReciboDaruma | 54 | nao |  | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| ConfigReciboMatricial | 28 | nao |  | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| configRecorrente | 54 | nao |  | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| ConfigTeclasModulos | 2 | nao |  | cadastros/professores ou iam | separar pessoa/professor de usuario, permissao e papel |
| ConfigTeclasModulos2 | 2 | nao |  | cadastros/professores ou iam | separar pessoa/professor de usuario, permissao e papel |
| ContasBanco | 7 | sim | contaID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| ContasBancoMovimentacao | 8 | sim | movID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| Descontos | 6 | sim | descontoID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| DiasSemana | 2 | sim | ID | academico | organizacao operacional: modalidade, turma, horario, local ou frequencia |
| Digitais | 6 | sim | digitalID | pendente | classificar apos leitura funcional |
| Email | 10 | nao |  | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| EmailGrupos | 2 | sim | grupoID | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| EmailGruposLista | 6 | sim | Id | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| Empresa | 67 | sim | empresaID | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| Exercicios | 10 | sim | exercicioId | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| ExerciciosConfig | 29 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| ExerciciosFichas | 10 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| ExerciciosGrupos | 2 | sim | grupoId | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| ExerciciosHistorico | 5 | nao |  | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| ExerciciosObjetivos | 2 | sim | objetivoId | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| ExerciciosTreinos | 13 | sim | treinoId | treinamento | avaliacoes, treinos, exercicios ou historico fisico |
| FormasPagamento | 3 | sim | formaID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| Fornecedores | 16 | sim | fornID | comercial/estoque | vendas, itens, produtos, estoque ou fornecedor |
| Fotos | 5 | sim | fotoID | pendente | classificar apos leitura funcional |
| Frequencia | 7 | sim | Id | academico | organizacao operacional: modalidade, turma, horario, local ou frequencia |
| Funcionarios | 39 | sim | funcID | cadastros/professores ou iam | separar pessoa/professor de usuario, permissao e papel |
| FuncionariosFuncoes | 2 | nao |  | cadastros/professores ou iam | separar pessoa/professor de usuario, permissao e papel |
| Horarios | 7 | sim | horarioID | academico | organizacao operacional: modalidade, turma, horario, local ou frequencia |
| Locais | 4 | sim | localID | pendente | classificar apos leitura funcional |
| LogsAcesso | 5 | sim | logID | acesso | biometria, catraca, terminal ou log de acesso |
| Matricula | 29 | sim | matriculaID | academico/matriculas | separar vinculo academico de cobranca financeira |
| MatriculaAulas | 8 | nao |  | academico/matriculas | separar vinculo academico de cobranca financeira |
| MatriculaNaoGerar | 5 | nao |  | academico/matriculas | separar vinculo academico de cobranca financeira |
| MatriculaRenovacoes | 11 | nao |  | academico/matriculas | separar vinculo academico de cobranca financeira |
| MatriculaTrancamentos | 6 | nao |  | academico/matriculas | separar vinculo academico de cobranca financeira |
| MatriculaTurmas | 2 | sim | matriculaID,turmaID | academico/matriculas | separar vinculo academico de cobranca financeira |
| Mensagens | 10 | sim | msgID | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| Modalidades | 9 | sim | modalidadeID | academico | organizacao operacional: modalidade, turma, horario, local ou frequencia |
| Modulos | 7 | sim | moduloID | cadastros/professores ou iam | separar pessoa/professor de usuario, permissao e papel |
| Pagamentos | 12 | sim | pagamentoID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| PagamentosAuto | 6 | nao |  | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| Permissoes | 8 | sim | permissaoID | cadastros/professores ou iam | separar pessoa/professor de usuario, permissao e papel |
| PlanodeContas | 6 | sim | planoID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| Produtos | 14 | sim | produtoID | comercial/estoque | vendas, itens, produtos, estoque ou fornecedor |
| ProdutosCategorias | 4 | nao |  | comercial/estoque | vendas, itens, produtos, estoque ou fornecedor |
| Recebimentos | 16 | sim | recebID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| RecebimentosBoletos | 4 | nao |  | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| RecebimentosDebitos | 6 | sim | DebitoId,recebID_Debito | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| Recibos | 15 | sim | reciboID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| RecibosRecebimentos | 2 | sim | recebID | financeiro | financeiro, recebimentos, pagamentos, caixa ou plano de contas |
| Telefones | 3 | nao |  | pendente | classificar apos leitura funcional |
| TerminalAcessos | 3 | sim | ID | acesso | biometria, catraca, terminal ou log de acesso |
| TerminalConfig | 30 | sim | configID | acesso | biometria, catraca, terminal ou log de acesso |
| TerminalEnquete | 6 | sim | enqueteID | acesso | biometria, catraca, terminal ou log de acesso |
| TerminalEnqueteVotos | 4 | sim | ID | acesso | biometria, catraca, terminal ou log de acesso |
| TerminalNoticias | 2 | sim | noticiaID | acesso | biometria, catraca, terminal ou log de acesso |
| tmpAnalise | 6 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpAvisos | 13 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpBina | 2 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpBoletos | 7 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpBoletosGerar | 2 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpCartaoParcelas | 6 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpCatracaComando | 1 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpCheques | 8 | sim | chequeID | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpCheques2 | 6 | sim | chequeID | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpHorarios | 7 | sim | horarioID | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpPermissoes | 8 | sim | permissaoID | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpPlanodeContas | 4 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpPlanodeContas2 | 6 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpSelecionados | 3 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpTurmasModalidades | 2 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpTurmasProfessores | 3 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpVendasItens | 7 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| tmpVendasParcelas | 4 | nao |  | tecnica/temporaria | investigar antes de migrar; provavelmente nao vira tabela definitiva |
| Turmas | 10 | sim | turmaID | academico | organizacao operacional: modalidade, turma, horario, local ou frequencia |
| TurmasModalidades | 2 | nao |  | academico | organizacao operacional: modalidade, turma, horario, local ou frequencia |
| TurmasProfessores | 2 | sim | turmaID,funcionarioID | academico | organizacao operacional: modalidade, turma, horario, local ou frequencia |
| Vendas | 7 | sim | vendaID | comercial/estoque | vendas, itens, produtos, estoque ou fornecedor |
| VendasItens | 9 | sim | itemID | comercial/estoque | vendas, itens, produtos, estoque ou fornecedor |
| VisaoGeralConfig | 4 | nao |  | inteligencia/configuracao | configuracao, auditoria, comunicacao ou administracao |
| Visitantes | 18 | sim | visitanteID | pendente | classificar apos leitura funcional |

