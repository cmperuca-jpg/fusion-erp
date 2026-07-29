# Inventario de PKs, FKs e Indices

Data: 2026-07-29

Fonte: docs/migration/legacy-database/postgresql-schema.sql.

## Resumo

- Tabelas: 123
- Tabelas com chave primaria declarada: 58
- Tabelas sem chave primaria declarada: 65
- Chaves estrangeiras declaradas: 23
- Indices declarados: 149

## Tabelas sem PK

| Tabela | Colunas | Contexto inicial | Acao |
| --- | ---: | --- | --- |
| AgendaConfirmacoes | 4 | academico | definir chave natural, chave substituta ou descartar como tecnica |
| AlunosContatos | 11 | cadastros/alunos | definir chave natural, chave substituta ou descartar como tecnica |
| AnamneseConfig | 2 | cadastros/alunos | definir chave natural, chave substituta ou descartar como tecnica |
| Avaliacao | 7 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoAnamnese | 5 | cadastros/alunos | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoBioimpedancia | 5 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoBioimpedanciaConfig | 3 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoCardiorrespiratoria | 7 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoComparacao | 42 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoComparacaoT | 6 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoComposicao | 25 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoConfig | 19 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoNeuromotora | 8 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoObs | 3 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoPARQ | 11 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoPerimetros | 24 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoPerimetrosC | 4 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoPostural | 5 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoRisco | 11 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoTestes1a3 | 16 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| AvaliacaoTestes4a6 | 30 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| CaixaConfig | 15 | financeiro | definir chave natural, chave substituta ou descartar como tecnica |
| CartaoParcelas | 16 | financeiro | definir chave natural, chave substituta ou descartar como tecnica |
| Cartoes | 8 | pendente | definir chave natural, chave substituta ou descartar como tecnica |
| CatracaLiberacoes | 7 | acesso | definir chave natural, chave substituta ou descartar como tecnica |
| CieloChamadas | 19 | financeiro | definir chave natural, chave substituta ou descartar como tecnica |
| CieloChamadasRecebimentos | 2 | financeiro | definir chave natural, chave substituta ou descartar como tecnica |
| ConfigBoleto | 41 | inteligencia/configuracao | definir chave natural, chave substituta ou descartar como tecnica |
| ConfigBoleto2 | 50 | inteligencia/configuracao | definir chave natural, chave substituta ou descartar como tecnica |
| ConfigCarteira | 18 | inteligencia/configuracao | definir chave natural, chave substituta ou descartar como tecnica |
| ConfigReciboBematech | 29 | financeiro | definir chave natural, chave substituta ou descartar como tecnica |
| ConfigReciboDaruma | 54 | financeiro | definir chave natural, chave substituta ou descartar como tecnica |
| ConfigReciboMatricial | 28 | financeiro | definir chave natural, chave substituta ou descartar como tecnica |
| configRecorrente | 54 | inteligencia/configuracao | definir chave natural, chave substituta ou descartar como tecnica |
| ConfigTeclasModulos | 2 | cadastros/professores ou iam | definir chave natural, chave substituta ou descartar como tecnica |
| ConfigTeclasModulos2 | 2 | cadastros/professores ou iam | definir chave natural, chave substituta ou descartar como tecnica |
| Email | 10 | inteligencia/configuracao | definir chave natural, chave substituta ou descartar como tecnica |
| ExerciciosConfig | 29 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| ExerciciosFichas | 10 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| ExerciciosHistorico | 5 | treinamento | definir chave natural, chave substituta ou descartar como tecnica |
| FuncionariosFuncoes | 2 | cadastros/professores ou iam | definir chave natural, chave substituta ou descartar como tecnica |
| MatriculaAulas | 8 | academico/matriculas | definir chave natural, chave substituta ou descartar como tecnica |
| MatriculaNaoGerar | 5 | academico/matriculas | definir chave natural, chave substituta ou descartar como tecnica |
| MatriculaRenovacoes | 11 | academico/matriculas | definir chave natural, chave substituta ou descartar como tecnica |
| MatriculaTrancamentos | 6 | academico/matriculas | definir chave natural, chave substituta ou descartar como tecnica |
| PagamentosAuto | 6 | financeiro | definir chave natural, chave substituta ou descartar como tecnica |
| ProdutosCategorias | 4 | comercial/estoque | definir chave natural, chave substituta ou descartar como tecnica |
| RecebimentosBoletos | 4 | financeiro | definir chave natural, chave substituta ou descartar como tecnica |
| Telefones | 3 | pendente | definir chave natural, chave substituta ou descartar como tecnica |
| tmpAnalise | 6 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpAvisos | 13 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpBina | 2 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpBoletos | 7 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpBoletosGerar | 2 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpCartaoParcelas | 6 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpCatracaComando | 1 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpPlanodeContas | 4 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpPlanodeContas2 | 6 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpSelecionados | 3 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpTurmasModalidades | 2 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpTurmasProfessores | 3 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpVendasItens | 7 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| tmpVendasParcelas | 4 | tecnica/temporaria | definir chave natural, chave substituta ou descartar como tecnica |
| TurmasModalidades | 2 | academico | definir chave natural, chave substituta ou descartar como tecnica |
| VisaoGeralConfig | 4 | inteligencia/configuracao | definir chave natural, chave substituta ou descartar como tecnica |

## Chaves estrangeiras

| Tabela origem | Coluna origem | Tabela destino | Coluna destino | Nome da FK |
| --- | --- | --- | --- | --- |
| Agenda | funcionarioID | Funcionarios | funcID | Agenda__FuncionariosAgenda |
| ChequesEmitidos | pagamentoID | Pagamentos | pagamentoID | ChequesEmitidos__PagamentosChequesEmitidos |
| ChequesRecebidos | reciboID | Recibos | reciboID | ChequesRecebidos__RecibosCheques |
| ContasBanco | bancoID | Bancos | bancoID | ContasBanco__BancosContasBanco |
| Horarios | horarioDia | DiasSemana | ID | Horarios__DiasSemanaHorarios |
| Matricula | alunoID | Alunos | alunoID | Matricula__AlunosMatriculas |
| Matricula | modalidadeID | Modalidades | modalidadeID | Matricula__ModalidadesMatricula |
| MatriculaTurmas | matriculaID | Matricula | matriculaID | MatriculaTurmas__MatriculaMatriculaTurmas |
| MatriculaTurmas | turmaID | Turmas | turmaID | MatriculaTurmas__TurmasMatriculaTurmas |
| Pagamentos | planoID | PlanodeContas | planoID | Pagamentos__PlanodeContasPagamentos |
| Permissoes | funcID | Funcionarios | funcID | Permissoes__FuncionariosPermissoes |
| Permissoes | moduloID | Modulos | moduloID | Permissoes__ModulosPermissoes |
| Recebimentos | planoID | PlanodeContas | planoID | Recebimentos__PlanodeContasRecebimentos |
| Recibos | formaID | FormasPagamento | formaID | Recibos__FormasPagamentoRecibos |
| RecibosRecebimentos | recebID | Recebimentos | recebID | RecibosRecebimentos__RecebimentosRecibosRecebimentos |
| RecibosRecebimentos | reciboID | Recibos | reciboID | RecibosRecebimentos__RecibosRecibosRecebimentos |
| TerminalEnqueteVotos | alunoID | Alunos | alunoID | TerminalEnqueteVotos__AlunosTerminalEnqueteVotos |
| TerminalEnqueteVotos | enqueteID | TerminalEnquete | enqueteID | TerminalEnqueteVotos__TerminalEnqueteTerminalEnqueteVotos |
| Turmas | localID | Locais | localID | Turmas__LocaisTurmas |
| Turmas | modalidadeID | Modalidades | modalidadeID | Turmas__ModalidadesTurmas |
| TurmasProfessores | funcionarioID | Funcionarios | funcID | TurmasProfessores__FuncionariosTurmasProfessores |
| TurmasProfessores | turmaID | Turmas | turmaID | TurmasProfessores__TurmasTurmasProfessores |
| VendasItens | vendaID | Vendas | vendaID | VendasItens__VendasVendasItens |

## Indices

| Tabela | Indice | Unico | Colunas |
| --- | --- | --- | --- |
| Agenda | Agenda__agendaID | nao | agendaID |
| Agenda | Agenda__funcionarioID | nao | funcionarioID |
| Agenda | Agenda__FuncionariosAgenda | nao | funcionarioID |
| Alunos | Alunos__alunoID | nao | alunoID |
| Alunos | Alunos__funcID | nao | funcID |
| AlunosCreditos | AlunosCreditos__AlunoID | nao | AlunoID |
| AlunosCreditos | AlunosCreditos__CreditoID | nao | CreditoID |
| AlunosCreditos | AlunosCreditos__reciboID | nao | reciboID |
| Auditoria | Auditoria__auditoriaId | nao | auditoriaId |
| Auditoria | Auditoria__funcID | nao | funcID |
| Auditoria | Auditoria__moduloID | nao | moduloID |
| Bancos | Bancos__bancoID | nao | bancoID |
| Caixa | Caixa__caixaID | nao | caixaID |
| CaixaMovimentos | CaixaMovimentos__contaID | nao | contaID |
| CaixaMovimentos | CaixaMovimentos__movID | nao | movID |
| ChequesEmitidos | ChequesEmitidos__chequeID | nao | chequeID |
| ChequesEmitidos | ChequesEmitidos__pagamentoID | nao | pagamentoID |
| ChequesEmitidos | ChequesEmitidos__PagamentosChequesEmitidos | nao | pagamentoID |
| ChequesRecebidos | ChequesRecebidos__chequeID | nao | chequeID |
| ChequesRecebidos | ChequesRecebidos__contaID | nao | contaID |
| ChequesRecebidos | ChequesRecebidos__recebID | nao | reciboID |
| ChequesRecebidos | ChequesRecebidos__RecibosCheques | nao | reciboID |
| Config | Config__configID | nao | configID |
| Config | Config__microID | nao | microID |
| ConfigRecibo | ConfigRecibo__Id | nao | Id |
| ContasBanco | ContasBanco__bancoID | nao | bancoID |
| ContasBanco | ContasBanco__BancosContasBanco | nao | bancoID |
| ContasBanco | ContasBanco__contaID | nao | contaID |
| ContasBancoMovimentacao | ContasBancoMovimentacao__contaID | nao | contaID |
| ContasBancoMovimentacao | ContasBancoMovimentacao__movID | nao | movID |
| Descontos | Descontos__descontoID | nao | descontoID |
| DiasSemana | DiasSemana__id | nao | ID |
| Digitais | Digitais__ID | nao | digitalID |
| Digitais | Digitais__idRelaciona | nao | idRelaciona |
| Digitais | Digitais__UltimoAcesso | nao | UltimoAcesso |
| EmailGrupos | EmailGrupos__grupoID | nao | grupoID |
| EmailGruposLista | EmailGruposLista__grupoID | nao | grupoID |
| EmailGruposLista | EmailGruposLista__Id | nao | Id |
| EmailGruposLista | EmailGruposLista__idrelaciona | nao | idrelaciona |
| Empresa | Empresa__empresaID | nao | empresaID |
| ExerciciosFichas | ExerciciosFichas__exercicioID | nao | exercicioID |
| ExerciciosFichas | ExerciciosFichas__fichaNumero | nao | fichaNumero |
| ExerciciosFichas | ExerciciosFichas__treinoId | nao | treinoId |
| ExerciciosHistorico | ExerciciosHistorico__Data | nao | Data |
| ExerciciosHistorico | ExerciciosHistorico__treinoID | nao | treinoID |
| ExerciciosTreinos | ExerciciosTreinos__alunoID | nao | alunoID |
| ExerciciosTreinos | ExerciciosTreinos__objetivoID | nao | objetivoID |
| ExerciciosTreinos | ExerciciosTreinos__professorID | nao | professorID |
| ExerciciosTreinos | ExerciciosTreinos__treinoAtivo | nao | treinoAtivo |
| FormasPagamento | FormasPagamento__formaID | nao | formaID |
| Fornecedores | Fornecedores__fornecedorID | nao | fornID |
| Fotos | Fotos__fotoID | nao | fotoID |
| Frequencia | Frequencia__Data | nao | data |
| Frequencia | Frequencia__especie | nao | especie |
| Frequencia | Frequencia__Id | nao | Id |
| Frequencia | Frequencia__idRelaciona | nao | idRelaciona |
| Funcionarios | Funcionarios__Func_ID | nao | funcID |
| Horarios | Horarios__alunoID | nao | idRelaciona |
| Horarios | Horarios__DiasSemanaHorarios | nao | horarioDia |
| Horarios | Horarios__Id | nao | horarioID |
| Locais | Locais__localID | nao | localID |
| LogsAcesso | LogsAcesso__funcID | nao | funcID |
| LogsAcesso | LogsAcesso__logID | nao | logID |
| LogsAcesso | LogsAcesso__microID | nao | microID |
| Matricula | Matricula__alunoID | nao | alunoID |
| Matricula | Matricula__AlunosMatriculas | nao | alunoID |
| Matricula | Matricula__DescontoId | nao | descontoID |
| Matricula | Matricula__matriculaID | nao | matriculaID |
| Matricula | Matricula__modalidadeID | nao | modalidadeID |
| Matricula | Matricula__ModalidadesMatricula | nao | modalidadeID |
| MatriculaTurmas | MatriculaTurmas__matriculaID | nao | matriculaID |
| MatriculaTurmas | MatriculaTurmas__MatriculaMatriculaTurmas | nao | matriculaID |
| MatriculaTurmas | MatriculaTurmas__turmaID | nao | turmaID |
| MatriculaTurmas | MatriculaTurmas__TurmasMatriculaTurmas | nao | turmaID |
| Mensagens | Mensagens__mensagemID | nao | msgID |
| Modalidades | Modalidades__modalidadeID | nao | modalidadeID |
| Modulos | Modulos__moduloID | nao | moduloID |
| Pagamentos | Pagamentos__contaID | nao | contaID |
| Pagamentos | Pagamentos__idRelaciona | nao | idRelaciona |
| Pagamentos | Pagamentos__pagamentoID | nao | pagamentoID |
| Pagamentos | Pagamentos__PlanodeContasPagamentos | nao | planoID |
| Pagamentos | Pagamentos__planoID | nao | planoID |
| Permissoes | Permissoes__funcID | nao | funcID |
| Permissoes | Permissoes__FuncionariosPermissoes | nao | funcID |
| Permissoes | Permissoes__moduloID | nao | moduloID |
| Permissoes | Permissoes__ModulosPermissoes | nao | moduloID |
| Permissoes | Permissoes__permissaoID | nao | permissaoID |
| PlanodeContas | PlanodeContas__planoID | nao | planoID |
| Produtos | Produtos__FornID | nao | fornID |
| Produtos | Produtos__produtoID | nao | produtoID |
| Recebimentos | Recebimentos__alunoID | nao | alunoID |
| Recebimentos | Recebimentos__contaID | nao | contaID |
| Recebimentos | Recebimentos__idrelaciona | nao | idRelaciona |
| Recebimentos | Recebimentos__PlanodeContasRecebimentos | nao | planoID |
| Recebimentos | Recebimentos__planoID | nao | planoID |
| Recebimentos | Recebimentos__recebDtVencimento | nao | recebDtVencimento |
| Recebimentos | Recebimentos__recebID | nao | recebID |
| RecebimentosDebitos | RecebimentosDebitos__recebID | nao | recebID |
| RecebimentosDebitos | RecebimentosDebitos__reciboID | nao | reciboID |
| Recibos | Recibos__formaID | nao | formaID |
| Recibos | Recibos__FormasPagamentoRecibos | nao | formaID |
| Recibos | Recibos__funcionarioID | nao | funcionarioID |
| Recibos | Recibos__pagamentoID | nao | pagamentoID |
| Recibos | Recibos__reciboData | nao | reciboData |
| Recibos | Recibos__ReciboID | nao | reciboID |
| RecibosRecebimentos | RecibosRecebimentos__RecebimentoID | nao | recebID |
| RecibosRecebimentos | RecibosRecebimentos__RecebimentosRecibosRecebimentos | sim | recebID |
| RecibosRecebimentos | RecibosRecebimentos__ReciboID | nao | reciboID |
| RecibosRecebimentos | RecibosRecebimentos__RecibosRecibosRecebimentos | nao | reciboID |
| TerminalAcessos | TerminalAcessos__alunoID | nao | alunoID |
| TerminalAcessos | TerminalAcessos__ID | nao | ID |
| TerminalConfig | TerminalConfig__configID | nao | configID |
| TerminalEnquete | TerminalEnquete__enqueteID | nao | enqueteID |
| TerminalEnqueteVotos | TerminalEnqueteVotos__alunoID | nao | alunoID |
| TerminalEnqueteVotos | TerminalEnqueteVotos__AlunosTerminalEnqueteVotos | nao | alunoID |
| TerminalEnqueteVotos | TerminalEnqueteVotos__enqueteID | nao | enqueteID |
| TerminalEnqueteVotos | TerminalEnqueteVotos__TerminalEnqueteTerminalEnqueteVotos | nao | enqueteID |
| TerminalEnqueteVotos | TerminalEnqueteVotos__votoID | nao | ID |
| TerminalNoticias | TerminalNoticias__novidadeID | nao | noticiaID |
| tmpAvisos | tmpAvisos__avisoID | nao | avisoID |
| tmpCheques | tmpCheques__chequeID | nao | chequeID |
| tmpCheques | tmpCheques__recebID | nao | microID |
| tmpCheques2 | tmpCheques2__chequeID | nao | chequeID |
| tmpCheques2 | tmpCheques2__microID | nao | microID |
| tmpHorarios | tmpHorarios__alunoID | nao | microID |
| tmpHorarios | tmpHorarios__Id | nao | horarioID |
| tmpPermissoes | tmpPermissoes__funcID | nao | MicroID |
| tmpPermissoes | tmpPermissoes__moduloID | nao | moduloID |
| tmpPermissoes | tmpPermissoes__permissaoID | nao | permissaoID |
| tmpTurmasProfessores | tmpTurmasProfessores__funcionarioID | nao | funcionarioID |
| tmpTurmasProfessores | tmpTurmasProfessores__turmaID | nao | microID |
| tmpTurmasProfessores | tmpTurmasProfessores__turmaID1 | nao | turmaID |
| tmpVendasItens | tmpVendasItens__microID | nao | microID |
| tmpVendasItens | tmpVendasItens__produtoId | nao | produtoID |
| Turmas | Turmas__LocaisTurmas | nao | localID |
| Turmas | Turmas__localID | nao | localID |
| Turmas | Turmas__modalidadeID | nao | modalidadeID |
| Turmas | Turmas__ModalidadesTurmas | nao | modalidadeID |
| Turmas | Turmas__turmaID | nao | turmaID |
| TurmasProfessores | TurmasProfessores__funcionarioID | nao | funcionarioID |
| TurmasProfessores | TurmasProfessores__FuncionariosTurmasProfessores | nao | funcionarioID |
| TurmasProfessores | TurmasProfessores__turmaID | nao | turmaID |
| TurmasProfessores | TurmasProfessores__TurmasTurmasProfessores | nao | turmaID |
| Vendas | Vendas__vendaID | nao | vendaID |
| VendasItens | VendasItens__itemID | nao | itemID |
| VendasItens | VendasItens__produtoId | nao | produtoID |
| VendasItens | VendasItens__vendaID | nao | vendaID |
| VendasItens | VendasItens__VendasVendasItens | nao | vendaID |
| Visitantes | Visitantes__visitanteID | nao | visitanteID |

