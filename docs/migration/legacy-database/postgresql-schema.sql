-- Gerado por Fusion.Legacy.Analyzer
-- Estrutura extraída do Microsoft Access
BEGIN;

CREATE TABLE "Agenda" (
    "agendaID" integer NOT NULL,
    "funcionarioID" integer,
    "agendaAssunto" character varying(50),
    "agendaCompromisso" text,
    "agendaTipo" integer,
    "agendaData" timestamp without time zone,
    "agendaHora" timestamp without time zone,
    "agendaConfirmado" boolean NOT NULL,
    "agendaPessoal" boolean NOT NULL,
    "agendaDias" integer,
    "agendaDiaSemana" integer,
    "agendaDiaMes" integer,
    CONSTRAINT "Agenda__PrimaryKey" PRIMARY KEY ("agendaID")
);

CREATE TABLE "AgendaConfirmacoes" (
    "Id" integer NOT NULL,
    "agendaID" double precision,
    "mes" double precision,
    "ano" double precision
);

CREATE TABLE "Alunos" (
    "alunoID" integer NOT NULL,
    "alunoMatricula" integer,
    "alunoNome" character varying(50),
    "alunoEndereco" character varying(70),
    "alunoBairro" character varying(30),
    "alunoCidade" character varying(50),
    "alunoCEP" character varying(10),
    "alunoEstado" character varying(2),
    "alunoTelefone" character varying(15),
    "alunoCelular" character varying(15),
    "alunoSexo" integer,
    "alunoCPF" character varying(14),
    "alunoIdentidade" character varying(20),
    "alunoUFIdentidade" character varying(2),
    "alunoEmail" character varying(250),
    "alunoDataNascimento" timestamp without time zone,
    "alunoPai" character varying(50),
    "alunoMae" character varying(50),
    "alunoObjetivo" character varying(50),
    "alunoProfissao" character varying(30),
    "alunoEstadoCivil" character varying(30),
    "alunoEmpresa" character varying(30),
    "alunoTelefoneEmpresa" character varying(15),
    "alunoResponsavel" character varying(50),
    "alunoTelefoneResponsavel" character varying(15),
    "alunoDataExame" timestamp without time zone,
    "alunoDataAvaliacao" timestamp without time zone,
    "alunoTemCartao" boolean NOT NULL,
    "alunoCartao" character varying(20),
    "alunoExcluido" boolean NOT NULL,
    "alunoSenha" character varying(100),
    "alunoObs" text,
    "alunoDtCadastro" timestamp without time zone,
    "alunoSoubeAcademia" character varying(255),
    "alunoHorario" boolean NOT NULL,
    "funcID" integer,
    "alunoCatracaReentrada" character varying(1),
    "alunoCatracaMinutos" double precision,
    "alunoCatracaSegundos" double precision,
    "alunoCatracaSemana" character varying(1),
    "alunoCatracaVezesSemana" double precision,
    "alunoCatracaDia" character varying(1),
    "alunoCatracaVezesDia" double precision,
    "alunoDigitosCelular" double precision,
    "RecorrenteForma" double precision,
    "RecorrenteToken" character varying(200),
    "RecorrenteTruncado" character varying(200),
    "RecorrenteValidade" timestamp without time zone,
    "recorrenteAtivo" character varying(1),
    "RecorrenteSeguranca" character varying(20),
    "alunoMaeCPF" character varying(14),
    "alunoPaiCPF" character varying(14),
    "alunoResponsavelCPF" character varying(14),
    "alunoTelefoneMae" character varying(15),
    "alunoTelefonePai" character varying(15),
    CONSTRAINT "Alunos__PrimaryKey" PRIMARY KEY ("alunoID")
);

CREATE TABLE "AlunosContatos" (
    "contatoID" integer NOT NULL,
    "alunoID" double precision,
    "contatoAssunto" character varying(255),
    "contatoMensagem" text,
    "contatoDataAgendado" timestamp without time zone,
    "contatoDataEfetuado" timestamp without time zone,
    "funcIDAgenda" double precision,
    "funcIDRealiza" double precision,
    "contatoPor" character varying(1),
    "contatoStatus" character varying(1),
    "contatoExcluido" character varying(1)
);

CREATE TABLE "AlunosCreditos" (
    "CreditoID" integer NOT NULL,
    "CreditoValor" numeric(19,4),
    "CreditoData" timestamp without time zone,
    "CreditoDescontado" boolean NOT NULL,
    "AlunoID" integer,
    "reciboID" integer,
    "reciboDescontado" integer,
    CONSTRAINT "AlunosCreditos__PrimaryKey" PRIMARY KEY ("CreditoID")
);

CREATE TABLE "AnamneseConfig" (
    "itemId" integer NOT NULL,
    "Pergunta" character varying(100)
);

CREATE TABLE "Auditoria" (
    "auditoriaId" integer NOT NULL,
    "funcID" integer,
    "moduloID" integer,
    "auditoriaData" timestamp without time zone,
    "auditoriaHora" timestamp without time zone,
    "auditoriaOperacao" character varying(20),
    "auditoriaHistorico" character varying(255),
    CONSTRAINT "Auditoria__PrimaryKey" PRIMARY KEY ("auditoriaId")
);

CREATE TABLE "Avaliacao" (
    "avaliacaoID" integer NOT NULL,
    "alunoId" double precision,
    "avaliacaoNumero" double precision,
    "avaliacaoData" timestamp without time zone,
    "avaliacaoAvaliador" double precision,
    "avaliadoIdade" double precision,
    "AnamneseObs" text
);

CREATE TABLE "AvaliacaoAnamnese" (
    "Id" integer NOT NULL,
    "alunoID" double precision,
    "anamneseID" double precision,
    "anamneseValor" character varying(255),
    "avaliacaoID" double precision
);

CREATE TABLE "AvaliacaoBioimpedancia" (
    "Id" integer NOT NULL,
    "alunoID" double precision,
    "itemID" double precision,
    "bioimpedanciaValor" double precision,
    "avaliacaoID" double precision
);

CREATE TABLE "AvaliacaoBioimpedanciaConfig" (
    "itemId" integer NOT NULL,
    "itemDescricao" character varying(20),
    "itemMedida" character varying(5)
);

CREATE TABLE "AvaliacaoCardiorrespiratoria" (
    "Id" integer NOT NULL,
    "avaliacaoID" double precision,
    "Vo2" double precision,
    "Avaliacao" character varying(100),
    "Teste" character varying(255),
    "TesteId" double precision,
    "Sedentario" double precision
);

CREATE TABLE "AvaliacaoComparacao" (
    "Id" integer NOT NULL,
    "op1" character varying(1),
    "op2" character varying(1),
    "op3" character varying(1),
    "op4" character varying(1),
    "op5" character varying(1),
    "op6" character varying(1),
    "op7" character varying(1),
    "op72" character varying(1),
    "op8" character varying(1),
    "op82" character varying(1),
    "op9" character varying(1),
    "op10" character varying(1),
    "op11" character varying(1),
    "op12" character varying(1),
    "op13" character varying(1),
    "op14" character varying(1),
    "op15" character varying(1),
    "op16" character varying(1),
    "op17" character varying(1),
    "op18" character varying(1),
    "op19" character varying(1),
    "op20" character varying(1),
    "op21" character varying(1),
    "op22" character varying(1),
    "op23" character varying(1),
    "op24" character varying(1),
    "op25" character varying(1),
    "op26" character varying(1),
    "op27" character varying(1),
    "op30" character varying(1),
    "op31" character varying(1),
    "op32" character varying(1),
    "op33" character varying(1),
    "op34" character varying(1),
    "op35" character varying(1),
    "op36" character varying(1),
    "op37" character varying(1),
    "op38" character varying(1),
    "op39" character varying(1),
    "op40" character varying(1),
    "op41" character varying(1)
);

CREATE TABLE "AvaliacaoComparacaoT" (
    "Campos" character varying(30),
    "Coluna1" character varying(50),
    "Coluna2" character varying(50),
    "Coluna3" character varying(50),
    "Coluna4" character varying(50),
    "Coluna5" character varying(50)
);

CREATE TABLE "AvaliacaoComposicao" (
    "Id" integer NOT NULL,
    "avaliacaoID" double precision,
    "Peso" double precision,
    "PesoIdeal" character varying(100),
    "Altura" double precision,
    "IMC" double precision,
    "Dobra1" double precision,
    "Dobra2" double precision,
    "Dobra3" double precision,
    "Dobra4" double precision,
    "Dobra5" double precision,
    "Dobra6" double precision,
    "Dobra7" double precision,
    "Dobra8" double precision,
    "Dobra9" double precision,
    "Gordura" double precision,
    "GorduraIdeal" double precision,
    "MassaMagra" double precision,
    "MassaGorda" double precision,
    "Protocolo" double precision,
    "BioMassaMagra" double precision,
    "BioMassaGorda" double precision,
    "BioMassaMagrakg" double precision,
    "BioMassaGordaKg" double precision,
    "TMB" double precision
);

CREATE TABLE "AvaliacaoConfig" (
    "linhaDestacada" character varying(1),
    "Exibir" character varying(255),
    "ComposicaoExibir" double precision,
    "ComposicaoRelatorioExibir" character varying(1),
    "TextoRodape" character varying(255),
    "TextoPARQ" text,
    "TextoRisco" text,
    "TextoComposicao" text,
    "TextoVO2" text,
    "AnamneseConfig" character varying(1),
    "ComparacaoFoto" character varying(1),
    "IMC1" character varying(1),
    "IMC2" character varying(1),
    "IMC3" character varying(1),
    "IMC4" character varying(1),
    "posturalZoom" double precision,
    "posturalGradeZoom" double precision,
    "posturalGradeMostrar" double precision,
    "formatoRelatorio" double precision
);

CREATE TABLE "AvaliacaoNeuromotora" (
    "Id" integer NOT NULL,
    "avaliacaoID" double precision,
    "FlexaoTotal" double precision,
    "FlexaoResultado" character varying(100),
    "AbdominalTotal" double precision,
    "AbdominalResultado" character varying(100),
    "WellsTotal" double precision,
    "WellsResultado" character varying(100)
);

CREATE TABLE "AvaliacaoObs" (
    "Id" integer NOT NULL,
    "alunoID" double precision,
    "ObsComparacao" text
);

CREATE TABLE "AvaliacaoPARQ" (
    "Id" integer NOT NULL,
    "alunoID" double precision,
    "opt1" character varying(1),
    "opt2" character varying(1),
    "opt3" character varying(1),
    "opt4" character varying(1),
    "opt5" character varying(1),
    "opt6" character varying(1),
    "opt7" character varying(1),
    "obs" text,
    "avaliacaoID" double precision
);

CREATE TABLE "AvaliacaoPerimetros" (
    "Id" integer NOT NULL,
    "avaliacaoID" double precision,
    "AnteBracoE" double precision,
    "AnteBracoD" double precision,
    "BracoRE" double precision,
    "BracoRD" double precision,
    "BracoCE" double precision,
    "BracoCD" double precision,
    "CoxaE" double precision,
    "CoxaD" double precision,
    "PanturrilhaE" double precision,
    "PanturrilhaD" double precision,
    "Torax" double precision,
    "Torax2" double precision,
    "Abdomen" double precision,
    "Quadril" double precision,
    "Cintura" double precision,
    "RCQ" double precision,
    "Pescoco" double precision,
    "Bimaleolar" double precision,
    "Umeral" double precision,
    "Femural" double precision,
    "Biestiloide" double precision,
    "Ombro" double precision
);

CREATE TABLE "AvaliacaoPerimetrosC" (
    "itemId" integer NOT NULL,
    "Item" character varying(30),
    "ItemPosicao" double precision,
    "Mostrar" character varying(1)
);

CREATE TABLE "AvaliacaoPostural" (
    "Id" integer NOT NULL,
    "avaliacaoID" double precision,
    "fotoAnterior" text,
    "fotoPosterior" text,
    "fotoLateral" text
);

CREATE TABLE "AvaliacaoRisco" (
    "Id" integer NOT NULL,
    "avaliacaoID" double precision,
    "opt1" double precision,
    "opt2" double precision,
    "opt3" double precision,
    "opt4" double precision,
    "opt5" double precision,
    "opt6" double precision,
    "opt7" double precision,
    "opt8" double precision,
    "resultado" double precision
);

CREATE TABLE "AvaliacaoTestes1a3" (
    "testeID" integer NOT NULL,
    "avaliacaoId" double precision,
    "Teste1Distancia" double precision,
    "Teste2Tempo" character varying(10),
    "Teste2FC" double precision,
    "Teste3Carga" double precision,
    "Teste3FC1" double precision,
    "Teste3FC2" double precision,
    "Teste3FC3" double precision,
    "Teste3FC4" double precision,
    "Teste3FC5" double precision,
    "Teste3PA1" character varying(30),
    "Teste3PA2" character varying(30),
    "Teste3PA3" character varying(30),
    "Teste3PA4" character varying(30),
    "Teste3PA5" character varying(30)
);

CREATE TABLE "AvaliacaoTestes4a6" (
    "testeID" integer NOT NULL,
    "avaliacaoId" double precision,
    "Teste4FC1" double precision,
    "Teste4FC2" double precision,
    "Teste4FC3" double precision,
    "Teste4FC4" double precision,
    "Teste4FC5" double precision,
    "Teste4FC6" double precision,
    "Teste4FC7" double precision,
    "Teste4Formula" double precision,
    "Teste4TempoFinal" double precision,
    "Teste5FC1" double precision,
    "Teste5FC2" double precision,
    "Teste5FC3" double precision,
    "Teste5FC4" double precision,
    "Teste5FC5" double precision,
    "Teste5FC6" double precision,
    "Teste5FC7" double precision,
    "Teste5FC8" double precision,
    "Teste5FC9" double precision,
    "Teste5Inclinacao" double precision,
    "Teste6FC1" double precision,
    "Teste6FC2" double precision,
    "Teste6FC3" double precision,
    "Teste6FC4" double precision,
    "Teste6FC5" double precision,
    "Teste6FC6" double precision,
    "Teste6FC7" double precision,
    "Teste6FC8" double precision,
    "Teste6TempoFinal" double precision
);

CREATE TABLE "Bancos" (
    "bancoID" integer NOT NULL,
    "bancoNome" character varying(100),
    "bancoNumero" integer,
    "bancoExcluido" boolean NOT NULL,
    CONSTRAINT "Bancos__PrimaryKey" PRIMARY KEY ("bancoID")
);

CREATE TABLE "Caixa" (
    "caixaID" integer NOT NULL,
    "caixaDataInicial" timestamp without time zone,
    "caixaDataFinal" timestamp without time zone,
    "caixaHoraInicial" timestamp without time zone,
    "caixaHoraFinal" timestamp without time zone,
    "caixaValorInicial" numeric(19,4),
    "caixaValorFinal" numeric(19,4),
    "caixaValorEntradas" numeric(19,4),
    "caixaValorSaidas" numeric(19,4),
    "caixaFechado" boolean NOT NULL,
    "funcionarioAbertura" integer,
    "funcionarioFechamento" integer,
    "caixaValorInicialDIN" numeric(19,4),
    "caixaValorInicialCHE" numeric(19,4),
    "caixaValorInicialBOL" numeric(19,4),
    "caixaValorInicialCAR" numeric(19,4),
    "caixaValorInicialDEP" numeric(19,4),
    "caixaValorFinalDIN" numeric(19,4),
    "caixaValorFinalCHE" numeric(19,4),
    "caixaValorFinalBOL" numeric(19,4),
    "caixaValorFinalCAR" numeric(19,4),
    "caixaValorFinalDEP" numeric(19,4),
    "CaixaFormaAbertura" double precision,
    "caixaValorInicialPIX" numeric(19,4),
    "caixaValorFinalPIX" numeric(19,4),
    CONSTRAINT "Caixa__PrimaryKey" PRIMARY KEY ("caixaID")
);

CREATE TABLE "CaixaConfig" (
    "op1" character varying(1),
    "op2" character varying(1),
    "op21" character varying(1),
    "op22" character varying(1),
    "op3" character varying(1),
    "op4" character varying(1),
    "op5" character varying(1),
    "op41" character varying(1),
    "op42" character varying(1),
    "CaixaExibirCartaoAgrupado" character varying(1),
    "CaixaExibirCartaoCaixaAtual" character varying(1),
    "DatasPassadas1" character varying(1),
    "DatasPassadas2" character varying(1),
    "CartaoCompensacao" character varying(1),
    "op6" character varying(1)
);

CREATE TABLE "CaixaMovimentos" (
    "movID" integer NOT NULL,
    "movTipo" character varying(20),
    "movData" timestamp without time zone,
    "movHora" timestamp without time zone,
    "movHistorico" character varying(100),
    "movValor" numeric(19,4),
    "movCompensado" boolean NOT NULL,
    "contaID" integer,
    "funcID" double precision,
    "movRD" character varying(1),
    "movForma" character varying(30),
    CONSTRAINT "CaixaMovimentos__PrimaryKey" PRIMARY KEY ("movID")
);

CREATE TABLE "CartaoParcelas" (
    "Id" integer NOT NULL,
    "reciboID" double precision,
    "contaID" double precision,
    "cartaoID" double precision,
    "parcelaNumero" double precision,
    "parcelaValor" numeric(19,4),
    "parcelaData" timestamp without time zone,
    "parcelaExcluida" character varying(1),
    "creditoouDebito" character varying(1),
    "parcelaDataCaixa" timestamp without time zone,
    "parcelaCaixa" character varying(1),
    "caixaID" double precision,
    "parcelasTotal" double precision,
    "parcelaTaxa" numeric(19,4),
    "parcelaValorFinal" numeric(19,4),
    "pagoRecorrente" character varying(1)
);

CREATE TABLE "Cartoes" (
    "cartaoID" integer NOT NULL,
    "cartaoNome" character varying(200),
    "cartaoAtivo" character varying(1),
    "cartaoExcluido" character varying(1),
    "taxaDebito" double precision,
    "taxaCreditoaVista" double precision,
    "taxaCreditoParcelado" double precision,
    "cartaoFoto" character varying(10)
);

CREATE TABLE "CatracaLiberacoes" (
    "liberacaoID" integer NOT NULL,
    "liberacaoData" timestamp without time zone,
    "liberacaoHora" timestamp without time zone,
    "liberacaoAlunoId" double precision,
    "liberacaoFuncId" double precision,
    "liberacaoMotivo" character varying(250),
    "liberacaoAlunoSituacao" character varying(1)
);

CREATE TABLE "ChequesEmitidos" (
    "chequeID" integer NOT NULL,
    "pagamentoID" integer,
    "contaID" integer,
    "chequeNumero" character varying(10),
    "chequeValor" numeric(19,4),
    "chequeBomPara" timestamp without time zone,
    "chequeCompensado" boolean NOT NULL,
    "chequeDtCompensacao" timestamp without time zone,
    "chequeExcluido" boolean NOT NULL,
    "chequeDataCaixa" timestamp without time zone,
    "chequeCaixa" character varying(1),
    "chequeObs" text,
    "caixaID" double precision,
    CONSTRAINT "ChequesEmitidos__PrimaryKey" PRIMARY KEY ("chequeID")
);

CREATE TABLE "ChequesRecebidos" (
    "chequeID" integer NOT NULL,
    "reciboID" integer,
    "contaID" integer,
    "chequeNumero" character varying(10),
    "chequeBanco" integer,
    "chequeAgencia" character varying(10),
    "chequeConta" character varying(10),
    "chequeValor" numeric(19,4),
    "chequeBomPara" timestamp without time zone,
    "chequeCompensado" boolean NOT NULL,
    "chequeSemFundo" boolean NOT NULL,
    "chequeDtCompensacao" timestamp without time zone,
    "chequeExcluido" boolean NOT NULL,
    "chequeDataCaixa" timestamp without time zone,
    "chequeCaixa" character varying(1),
    "chequeObs" text,
    "caixaID" double precision,
    CONSTRAINT "ChequesRecebidos__PrimaryKey" PRIMARY KEY ("chequeID")
);

CREATE TABLE "CieloChamadas" (
    "Id" integer NOT NULL,
    "Data" timestamp without time zone,
    "Hora" timestamp without time zone,
    "alunoID" double precision,
    "funcID" double precision,
    "Valor" numeric(19,4),
    "Parcelas" numeric(19,4),
    "aprovado" character varying(1),
    "identificacao" character varying(30),
    "resposta" character varying(5),
    "comprovante" character varying(10),
    "autorizacao" character varying(10),
    "microID" character varying(8),
    "recorrente" character varying(1),
    "CartaoTruncado" character varying(100),
    "recebID" double precision,
    "Cancelado" character varying(1),
    "Resposta1" character varying(250),
    "Transacao" character varying(40)
);

CREATE TABLE "CieloChamadasRecebimentos" (
    "chamadaID" double precision,
    "recebID" double precision
);

CREATE TABLE "Config" (
    "configID" integer NOT NULL,
    "microID" character varying(20),
    "configAcesso" character varying(100),
    "configExibir1" boolean NOT NULL,
    "configExibir2" boolean NOT NULL,
    "configExibir3" boolean NOT NULL,
    "configImagem" boolean NOT NULL,
    "configImagemCaminho" character varying(100),
    "configCorInicial" character varying(50),
    "configCorFinal" character varying(50),
    "configImpressora" integer,
    "configVisualizar" boolean NOT NULL,
    "configDetalhado" boolean NOT NULL,
    "configVias" integer,
    "configGeraCodigo" boolean NOT NULL,
    "configAgenda" boolean NOT NULL,
    "configMinimizar" boolean NOT NULL,
    "configTelaToda" boolean NOT NULL,
    "configMostraGeral" boolean NOT NULL,
    "funcAcesso" integer,
    "funcListar" integer,
    "alunoListar" integer,
    "alunoProcurar" integer,
    "alunoOrdem" character varying(50),
    "modalidadeOrdem" character varying(50),
    "produtoOrdem" character varying(50),
    "recebporAluno" integer,
    "recebDetalhes" boolean NOT NULL,
    "pagListar" integer,
    "freqListar" integer,
    "freqDetalhes" boolean NOT NULL,
    "reciboExibir" double precision,
    "corFocus" character varying(50),
    "usarBina" double precision,
    "usarBinaAdaptador" double precision,
    "catracaMicro" double precision,
    "configFiltros" character varying(254),
    "configExibirCabecalho" character varying(1),
    "configExibirRodape" character varying(1),
    "configInicializarVerif" character varying(1),
    "configCatracaAtalho" character varying(1),
    "usarBinaAdaptadorModelo" double precision,
    "icBoxPortaSerial" double precision,
    "alunoOrdemA" character varying(4),
    "turmaOrdem" character varying(50),
    "configFrenteVerso" character varying(1),
    "matriculaOrdem" character varying(50),
    CONSTRAINT "Config__PrimaryKey" PRIMARY KEY ("configID")
);

CREATE TABLE "ConfigBoleto" (
    "boletoUsar" character varying(1),
    "boletoBanco" character varying(100),
    "boletoCarteira" character varying(100),
    "boletoAgencia" character varying(30),
    "boletoConta" character varying(30),
    "boletoCedente" character varying(30),
    "boletoAdicional1" character varying(30),
    "boletoAdicional2" character varying(30),
    "boletoLayout" character varying(75),
    "boletoProximo" double precision,
    "boletoInstrucoes" text,
    "boletoInstrucoesExibir" double precision,
    "boletoInstrucoes2" text,
    "boletoVias" double precision,
    "boletoContas" character varying(1),
    "boletoVencimento" character varying(1),
    "boletoRemessa" character varying(1),
    "adaptacaoSCA" character varying(50),
    "vendaDigitos" character varying(5),
    "ArquivoRemessaData" timestamp without time zone,
    "ArquivoRemessaSequencia" double precision,
    "RelContasReceberFiltro" character varying(50),
    "boletoMenor" character varying(1),
    "boletoTipoDocumento" character varying(10),
    "boletoPercentualJuros" double precision,
    "boletoDiasProtesto" double precision,
    "boletoValorJurosDiaAtraso" double precision,
    "boletoBancoEmiteBoleto" character varying(1),
    "boletoCadastroCompleto" character varying(1),
    "boletoAcrescimosRecibo" character varying(1),
    "boletoAcrescimosReceb" character varying(1),
    "boletoCedilha" character varying(1),
    "boletoTipoMulta" character varying(1),
    "boletoZeraSequencial" character varying(1),
    "boletoTipoJuros" character varying(1),
    "boletoZeraSequencial2" character varying(1),
    "ArquivoRemessaSequencia2" double precision,
    "boletoAceite" character varying(50),
    "boletoParcela" character varying(1),
    "boletoRetornoLayout" double precision,
    "boletoSicoobConta" character varying(1)
);

CREATE TABLE "ConfigBoleto2" (
    "boletoProximoNossoNumero" double precision,
    "boletoBanco" character varying(100),
    "boletoCarteira" character varying(100),
    "boletoCarteiraAcBrBoleto" character varying(10),
    "boletoTipoCarteira" character varying(1),
    "boletoAgencia" character varying(30),
    "boletoAgenciaDigito" character varying(3),
    "boletoConta" character varying(30),
    "boletoContaDigito" character varying(3),
    "boletoCedente" character varying(30),
    "boletoConvenio" character varying(30),
    "boletoModalidade" character varying(30),
    "boletoCodTransmissao" character varying(30),
    "boletoLayoutRemessa" character varying(1),
    "boletoTipoDesconto" character varying(1),
    "boletoSQL" text,
    "boletoLayoutRetorno" character varying(1),
    "boletoDescontoConceder" character varying(1),
    "boletoDescontoValor" double precision,
    "boletoDescontoDias" double precision,
    "boletoEspecieDoc" character varying(30),
    "boletoQuemEmite" character varying(1),
    "boletoHabilitaSemRegistro" character varying(1),
    "boletoImprimirRemessa" character varying(1),
    "boletoCNPJ" character varying(1),
    "boletoCNPJouCPF" character varying(30),
    "boletoRazaoSocialouNome" character varying(250),
    "boletoEndereco" character varying(250),
    "boletoBairro" character varying(30),
    "boletoCidade" character varying(50),
    "boletoCEP" character varying(10),
    "boletoEstado" character varying(3),
    "boletoCaracTitulo" character varying(1),
    "boletoBaixa" double precision,
    "boletoSacadorSN" character varying(1),
    "boletoCNPJSacador" character varying(1),
    "boletoCNPJouCPFSacador" character varying(30),
    "boletoRazaoSocialouNomeSacador" character varying(250),
    "boletoEnderecoSacador" character varying(250),
    "boletoBairroSacador" character varying(30),
    "boletoCidadeSacador" character varying(50),
    "boletoCEPSacador" character varying(10),
    "boletoEstadoSacador" character varying(3),
    "boletoByteGeracao" double precision,
    "sicoobDigito" character varying(2),
    "sicoobLayout" character varying(3),
    "sicoobLayoutLote" character varying(3),
    "MultaExibir1" character varying(2),
    "MultaExibir2" character varying(2),
    "LerNossoNumeroCompletoArqRetorno" character varying(2)
);

CREATE TABLE "ConfigCarteira" (
    "Id" integer NOT NULL,
    "Linha1Config" character varying(255),
    "Linha2Config" character varying(255),
    "Linha3Config" character varying(255),
    "Linha4Config" character varying(255),
    "BarrasConfig" character varying(255),
    "FotoConfig" character varying(255),
    "BarrasDigitos" double precision,
    "BarrasDigitosBanco" double precision,
    "BarrasLargura" double precision,
    "FormaImpressao" character varying(1),
    "FuncLinha1Config" character varying(255),
    "FuncLinha2Config" character varying(255),
    "FuncLinha3Config" character varying(255),
    "FuncBarrasConfig" character varying(255),
    "FuncFotoConfig" character varying(255),
    "FuncBarrasDigitos" double precision,
    "FuncBarrasLargura" double precision
);

CREATE TABLE "ConfigRecibo" (
    "Id" integer NOT NULL,
    "modeloRecibo" integer,
    "exibirRegua" boolean NOT NULL,
    "largura" integer,
    "altura" integer,
    "cabecalho" integer,
    "rodape" integer,
    "margemSup" integer,
    "margemInf" integer,
    "margemEsq" integer,
    "margemDir" integer,
    "Linha1Texto" character varying(255),
    "Linha1Config" character varying(255),
    "Linha2Texto" character varying(255),
    "Linha2Config" character varying(255),
    "Linha3Texto" character varying(255),
    "Linha3Config" character varying(255),
    "Linha4Config" character varying(255),
    "Linha5Texto" character varying(255),
    "Linha5Config" character varying(255),
    "Linha6Config" character varying(255),
    "Linha7Texto" character varying(255),
    "Linha7Config" character varying(255),
    "Linha8Config" character varying(255),
    "Linha9Texto" character varying(255),
    "Linha9Config" character varying(255),
    "Linha10Texto" character varying(255),
    "Linha10Config" character varying(255),
    "Linha11Texto" character varying(255),
    "Linha11Config" character varying(255),
    "Linha12Texto" character varying(255),
    "Linha12Config" character varying(255),
    "Linha13Config" character varying(255),
    "Linha14Config" character varying(255),
    "Linha15Config" character varying(255),
    "Linha16Texto" character varying(255),
    "Linha16Config" character varying(255),
    "Linha17Config" character varying(255),
    "Linha18Texto" character varying(255),
    "Linha18Config" character varying(255),
    "Linha19Config" character varying(255),
    "Linha20Config" character varying(255),
    "Linha21Texto" character varying(255),
    "Linha21Config" character varying(255),
    "Traco1" character varying(255),
    "Traco2" character varying(255),
    "Traco3" character varying(255),
    "Logo" character varying(255),
    "Tipo" character varying(255),
    "Lado" double precision,
    CONSTRAINT "ConfigRecibo__PrimaryKey" PRIMARY KEY ("Id")
);

CREATE TABLE "ConfigReciboBematech" (
    "Id" integer NOT NULL,
    "Opt1" character varying(1),
    "Opt2" character varying(1),
    "Opt3" character varying(1),
    "Opt4" character varying(3),
    "Opt5" character varying(100),
    "Opt6" character varying(1),
    "Opt7" character varying(250),
    "Opt9" character varying(250),
    "Opt11" character varying(1),
    "Opt15" character varying(1),
    "Atu17Carta" character varying(1),
    "TotalContaPagar" character varying(1),
    "RelCaixaDetalhado" character varying(1),
    "IpImpressora" character varying(100),
    "modeloImpressora" double precision,
    "vendaVendedor" character varying(1),
    "MensagemFinal" character varying(1),
    "mensagemFinalVia" character varying(1),
    "msgFinal1" character varying(80),
    "msgFinal2" character varying(80),
    "Opt16" character varying(1),
    "Opt17" double precision,
    "Opt18" character varying(1),
    "comandoGaveta" character varying(1),
    "imprimeEndereco" character varying(1),
    "imprimeCidadeEstado" character varying(1),
    "imprimeTelefone" character varying(1),
    "imprimeCNPJ" character varying(1)
);

CREATE TABLE "ConfigReciboDaruma" (
    "Id" integer NOT NULL,
    "Opt1" character varying(1),
    "Opt2" character varying(1),
    "Opt3" character varying(1),
    "Opt4" character varying(1),
    "Opt5" character varying(10),
    "Opt6" double precision,
    "telaAdicionalTempo" double precision,
    "telaAdicionalFormato" double precision,
    "telaAdicionasMsgLiberado" character varying(100),
    "telaAdicionasMsgNegado" character varying(100),
    "agendaNaoConfirmados" character varying(1),
    "agendaNaoConfirmadosTelaP" character varying(1),
    "treinoFrequenciaExibir" character varying(1),
    "contaPagarCaixa" character varying(1),
    "filtrarConsulta" character varying(1),
    "ManternaFicha" character varying(1),
    "FormatoCelular" double precision,
    "DigitosCelular" double precision,
    "Rotina9DigitosExecutada" double precision,
    "alunoTurmaMatriculaTrancada" character varying(1),
    "matriculaTurmas" character varying(1),
    "DoisCliquesListagemCheques" character varying(1),
    "RelatorioCaixaAtualSel" character varying(1),
    "RelatorioRecebTurmasDebito" character varying(1),
    "Rotina9DigitosExecutada2" double precision,
    "importarFichaOutroAluno" character varying(1),
    "GymStyle" character varying(1),
    "graficoMatriculaData" character varying(1),
    "Rotina9DigitosExecutada3" double precision,
    "Rotina9DigitosExecutada4" double precision,
    "boletoConfigAntiga" character varying(1),
    "ContaExibirCartao" character varying(1),
    "terminalEndereco1" double precision,
    "terminalEndereco2" character varying(50),
    "atualizacaoAutomatica" character varying(1),
    "VerificaComputadorScaCartao" character varying(1),
    "FacialUsar" character varying(1),
    "facialLogo" character varying(1),
    "FiltrarModalidade" character varying(1),
    "DataRotinaDuplicacao" character varying(12),
    "TelaAlunoMonitor" character varying(1),
    "FacialMemoryLimit" double precision,
    "FacialSeiscentos" double precision,
    "facialTempoAguardo" double precision,
    "facialMensagemOla" double precision,
    "facialTempoMensagemOla" double precision,
    "facialTempoReinicio" double precision,
    "facialTempoReinicioMesmaPessoa" double precision,
    "facialImagemInstrucoes" double precision,
    "facialProcessamento" double precision,
    "facialImagemFundo" double precision,
    "frequenciaTurmaDiaSemana" double precision,
    "facialPrecisao" double precision
);

CREATE TABLE "ConfigReciboMatricial" (
    "Id" integer NOT NULL,
    "Opt1" character varying(1),
    "Opt2" character varying(1),
    "Opt3" character varying(1),
    "Opt4" character varying(1),
    "Opt5" character varying(1),
    "Opt6" character varying(1),
    "Opt7" double precision,
    "Opt8" double precision,
    "reciboA41" double precision,
    "reciboA42" character varying(50),
    "reciboA43" double precision,
    "reciboA44" character varying(5),
    "Opt9" character varying(1),
    "Opt10" character varying(1),
    "Opt11" character varying(1),
    "Opt12" double precision,
    "configAlunoListaCheque" character varying(1),
    "configRecebTurmasData" character varying(1),
    "AlunosDebitoSituacao" double precision,
    "AlunosAusentesDias" character varying(30),
    "PlanosVencerSituacao" double precision,
    "PlanosVencerDias" character varying(30),
    "CamposObrigatorios" character varying(200),
    "imprimeEndereco" character varying(1),
    "imprimeCidadeEstado" character varying(1),
    "imprimeTelefone" character varying(1),
    "imprimeCNPJ" character varying(1)
);

CREATE TABLE "configRecorrente" (
    "Id" integer NOT NULL,
    "recorrenteLeitor" character varying(1),
    "recorrenteDigitacao" character varying(1),
    "recorrenteParcelamento" character varying(1),
    "recorrenteMensagemPadrao" character varying(40),
    "Faixa1Valor1" numeric(19,4),
    "Faixa1Valor2" numeric(19,4),
    "Faixa1Parcelas" double precision,
    "Faixa2Valor1" numeric(19,4),
    "Faixa2Valor2" numeric(19,4),
    "Faixa2Parcelas" double precision,
    "Faixa3Valor1" numeric(19,4),
    "Faixa3Valor2" numeric(19,4),
    "Faixa3Parcelas" double precision,
    "Faixa4Valor1" numeric(19,4),
    "Faixa4Valor2" numeric(19,4),
    "Faixa4Parcelas" double precision,
    "Faixa5Valor1" numeric(19,4),
    "Faixa5Valor2" numeric(19,4),
    "Faixa5Parcelas" double precision,
    "visaC" double precision,
    "visaP" double precision,
    "MasterCardC" double precision,
    "MasterCardP" double precision,
    "EloC" double precision,
    "EloP" double precision,
    "AmexC" double precision,
    "AmexP" double precision,
    "dinnersC" double precision,
    "dinnersP" double precision,
    "DiscoverC" double precision,
    "DiscoverP" double precision,
    "JcbC" double precision,
    "JcbP" double precision,
    "AuraC" double precision,
    "AuraP" double precision,
    "recorrenteConta" double precision,
    "recorrenteHabilitado" character varying(1),
    "recorrenteAposPagamento" character varying(1),
    "recorrenteDebitoDias" double precision,
    "recorrenteDebitoVezesDia" double precision,
    "recorrenteHora1" timestamp without time zone,
    "recorrenteHora2" timestamp without time zone,
    "recorrenteHora3" timestamp without time zone,
    "recorrenteHora4" timestamp without time zone,
    "recorrenteDataExecucao" timestamp without time zone,
    "recorrenteExecucao1" double precision,
    "recorrenteExecucao2" double precision,
    "recorrenteExecucao3" double precision,
    "recorrenteExecucao4" double precision,
    "recorrenteTrancada" character varying(1),
    "recorrenteMaximoParcelas" double precision,
    "hiperCardC" double precision,
    "hiperCardP" double precision
);

CREATE TABLE "ConfigTeclasModulos" (
    "moduloID" integer NOT NULL,
    "moduloDescricao" character varying(255)
);

CREATE TABLE "ConfigTeclasModulos2" (
    "ID" integer NOT NULL,
    "moduloID" double precision
);

CREATE TABLE "ContasBanco" (
    "contaID" integer NOT NULL,
    "bancoID" integer,
    "contaAgencia" character varying(10),
    "contaConta" character varying(10),
    "contaTitular" character varying(50),
    "contaExcluida" boolean NOT NULL,
    "contaRetornoBoletos" double precision,
    CONSTRAINT "ContasBanco__PrimaryKey" PRIMARY KEY ("contaID")
);

CREATE TABLE "ContasBancoMovimentacao" (
    "movID" integer NOT NULL,
    "contaID" integer,
    "movTipo" character varying(1),
    "movHistorico" character varying(50),
    "movData" timestamp without time zone,
    "movValor" numeric(19,4),
    "movCompensado" boolean NOT NULL,
    "movHistoricoNovo" character varying(255),
    CONSTRAINT "ContasBancoMovimentacao__PrimaryKey" PRIMARY KEY ("movID")
);

CREATE TABLE "Descontos" (
    "descontoID" integer NOT NULL,
    "descontoDescricao" character varying(100),
    "descontoTipo" character varying(20),
    "descontoValor" numeric(19,4),
    "descontoDesativado" boolean NOT NULL,
    "descontoExcluido" boolean NOT NULL,
    CONSTRAINT "Descontos__PrimaryKey" PRIMARY KEY ("descontoID")
);

CREATE TABLE "DiasSemana" (
    "ID" integer NOT NULL,
    "DiaSemana" character varying(50),
    CONSTRAINT "DiasSemana__PrimaryKey" PRIMARY KEY ("ID")
);

CREATE TABLE "Digitais" (
    "digitalID" integer NOT NULL,
    "digitalEsq" bytea,
    "digitalDir" bytea,
    "idRelaciona" integer,
    "digitalTipo" integer,
    "UltimoAcesso" timestamp without time zone NOT NULL,
    CONSTRAINT "Digitais__PrimaryKey" PRIMARY KEY ("digitalID")
);

CREATE TABLE "Email" (
    "Email" character varying(255),
    "Smtp" character varying(50),
    "Usuario" character varying(50),
    "Senha" character varying(255),
    "tiUsuario" character varying(50),
    "tiSenha" character varying(100),
    "Porta" character varying(15),
    "Nome" character varying(200),
    "SmsUsuario" character varying(30),
    "SmsSenha" character varying(255)
);

CREATE TABLE "EmailGrupos" (
    "grupoID" integer NOT NULL,
    "grupoNome" character varying(50),
    CONSTRAINT "EmailGrupos__PrimaryKey" PRIMARY KEY ("grupoID")
);

CREATE TABLE "EmailGruposLista" (
    "Id" integer NOT NULL,
    "grupoID" integer,
    "Nome" character varying(50),
    "Email" character varying(255),
    "idrelaciona" integer,
    "Celular" character varying(15),
    CONSTRAINT "EmailGruposLista__PrimaryKey" PRIMARY KEY ("Id")
);

CREATE TABLE "Empresa" (
    "empresaID" integer NOT NULL,
    "empresaRazaoSocial" character varying(50),
    "empresaNomeFantasia" character varying(50),
    "empresaCNPJ" character varying(18),
    "empresaInscEstadual" character varying(20),
    "empresaEndereco" character varying(70),
    "empresaBairro" character varying(30),
    "empresaCidade" character varying(50),
    "empresaCEP" character varying(10),
    "empresaEstado" character varying(2),
    "empresaTelefone" character varying(15),
    "empresaFAX" character varying(15),
    "empresaEmail" character varying(100),
    "empresaSite" character varying(100),
    "empresaLogomarca" character varying(100),
    "empresaBloqueia" boolean NOT NULL,
    "empresaDiasBloqueio" integer,
    "empresaCobrarMulta" boolean NOT NULL,
    "empresaTipoMulta" character varying(20),
    "empresaValorMulta" numeric(19,4),
    "empresaTipoMora" character varying(20),
    "empresaValorMora" numeric(19,4),
    "empresaDiaVencimento" integer,
    "empresaRegistro" character varying(255),
    "empresaDataBackup" timestamp without time zone,
    "empresaDataBackupAuto" timestamp without time zone,
    "empresaCatraca" double precision,
    "empresaExame" double precision,
    "empresaAvaliacao" double precision,
    "empresaInativar" double precision,
    "empresaInativarDias" double precision,
    "empresaInativarDiasPlano" double precision,
    "empresaVincularTurma" double precision,
    "empresaLeitor" character varying(255),
    "empresaBloqueia2" double precision,
    "empresaDiasBloqueio2" double precision,
    "empresaDiasPlano" double precision,
    "empresaTela" character varying(1),
    "empresaReavaliacaoUsar" double precision,
    "empresaReavaliacaoDias" double precision,
    "empresaNumeroCadastro" double precision,
    "empresaSuporte" double precision,
    "empresaFrequenciaM" double precision,
    "empresaAlunoPgtoOrdem" double precision,
    "catracaMotivo" double precision,
    "catracaMonitor" double precision,
    "empresaCatracaReentrada" character varying(1),
    "empresaCatracaMinutos" double precision,
    "empresaCatracaSegundos" double precision,
    "empresaMultaDias" double precision,
    "empresaCatracaVarias" double precision,
    "empresaAlunoMatriculaOrdem" double precision,
    "empresaAlunoInfoListagem" double precision,
    "empresaFuncInfoListagem" double precision,
    "empresaPais" double precision,
    "empresaFormaChamarCliente" double precision,
    "empresaAlunosDigitos" double precision,
    "empresaFormadeCalculoFluxoCaixa" double precision,
    "empresaRecorrenteNro" character varying(40),
    "empresaRecorrenteSituacao" character varying(1),
    "empresaRecorrenteAcesso" character varying(200),
    "cartaoContaId" double precision,
    "cartaoExibirConta" double precision,
    "cartaoDiasDebito" double precision,
    "cartaoDiasCredito" double precision,
    "cartaoDiasUsar" double precision,
    "cartaoTaxasUsar" double precision,
    CONSTRAINT "Empresa__PrimaryKey" PRIMARY KEY ("empresaID")
);

CREATE TABLE "Exercicios" (
    "exercicioId" integer NOT NULL,
    "exercicioCodigo" double precision,
    "exercicioNome" character varying(250),
    "exercicioDescricao" text,
    "exercicioMusculos" character varying(250),
    "grupoId" double precision,
    "exercicioAnimacao" double precision,
    "exercicioImagem" character varying(200),
    "exercicioYoutube" character varying(250),
    "exercicioVisual" double precision,
    CONSTRAINT "Exercicios__exercicioId" PRIMARY KEY ("exercicioId")
);

CREATE TABLE "ExerciciosConfig" (
    "mostrarFicha" double precision,
    "ImpressaoFicha" double precision,
    "FichaExluir" double precision,
    "FichaSeries" double precision,
    "FichaRepeticoes" character varying(250),
    "FichaCarga" character varying(250),
    "Ficha01Config" character varying(250),
    "Ficha02Config" character varying(250),
    "Ficha03Config" character varying(250),
    "Ficha04Config" character varying(250),
    "Ficha05Config" character varying(250),
    "Ficha06Config" character varying(250),
    "Ficha05ConfigTerminal" character varying(250),
    "Ficha06ConfigTerminal" character varying(250),
    "ContagemSessoesForma" double precision,
    "Ficha07Config" character varying(250),
    "Ficha07ConfigTerminal" character varying(250),
    "FichaCatraca1Treino" character varying(1),
    "FichaCatracaModelo" character varying(1),
    "Ficha05ConfigCatraca" character varying(250),
    "Ficha06ConfigCatraca" character varying(250),
    "Ficha07ConfigCatraca" character varying(250),
    "ContagemPorImpressaoForma" double precision,
    "ExibirCampoDescanso" double precision,
    "ExibirAnimacao" double precision,
    "FichaDescanso" double precision,
    "Ficha04Carga" double precision,
    "Ficha04Metodo" double precision,
    "ContinuarIncluindo" double precision
);

CREATE TABLE "ExerciciosFichas" (
    "serieID" integer NOT NULL,
    "treinoId" double precision,
    "fichaNumero" double precision,
    "exercicioID" double precision,
    "serieOrdem" double precision,
    "serieSeries" double precision,
    "serieRepeticoes" character varying(100),
    "serieCargas" character varying(100),
    "serieDescanso" double precision,
    "serieMetodo" double precision
);

CREATE TABLE "ExerciciosGrupos" (
    "grupoId" integer NOT NULL,
    "grupoNome" character varying(200),
    CONSTRAINT "ExerciciosGrupos__grupoId" PRIMARY KEY ("grupoId")
);

CREATE TABLE "ExerciciosHistorico" (
    "ID" integer NOT NULL,
    "treinoID" double precision,
    "fichaNumero" double precision,
    "Data" timestamp without time zone,
    "Hora" character varying(5)
);

CREATE TABLE "ExerciciosObjetivos" (
    "objetivoId" integer NOT NULL,
    "objetivoDescricao" character varying(200),
    CONSTRAINT "ExerciciosObjetivos__objetivoId" PRIMARY KEY ("objetivoId")
);

CREATE TABLE "ExerciciosTreinos" (
    "treinoId" integer NOT NULL,
    "treinoNumero" double precision,
    "alunoID" double precision,
    "professorID" double precision,
    "objetivoID" double precision,
    "treinoDataInicio" timestamp without time zone,
    "treinoDataMudanca" timestamp without time zone,
    "treinoFichas" double precision,
    "treinoSessoes" double precision,
    "treinoAtivo" double precision,
    "fichaPadraoNome" character varying(250),
    "treinoObs" text,
    "treinoSessoesRealizadas" double precision,
    CONSTRAINT "ExerciciosTreinos__treinoId" PRIMARY KEY ("treinoId")
);

CREATE TABLE "FormasPagamento" (
    "formaID" integer NOT NULL,
    "formaDescricao" character varying(100),
    "formaDesativado" boolean NOT NULL,
    CONSTRAINT "FormasPagamento__PrimaryKey" PRIMARY KEY ("formaID")
);

CREATE TABLE "Fornecedores" (
    "fornID" integer NOT NULL,
    "fornNomeFantasia" character varying(50),
    "fornRazaoSocial" character varying(50),
    "fornCNPJ" character varying(18),
    "fornIE" character varying(20),
    "fornEndereco" character varying(70),
    "fornBairro" character varying(30),
    "fornCidade" character varying(50),
    "fornCEP" character varying(10),
    "fornEstado" character varying(2),
    "fornTelefone" character varying(15),
    "fornFax" character varying(15),
    "fornEmail" character varying(255),
    "fornSite" character varying(255),
    "fornContato" character varying(50),
    "fornExcluido" boolean NOT NULL,
    CONSTRAINT "Fornecedores__PrimaryKey" PRIMARY KEY ("fornID")
);

CREATE TABLE "Fotos" (
    "fotoID" integer NOT NULL,
    "fotoCaminho" character varying(255),
    "fotoData" timestamp without time zone,
    "fotoTipo" integer,
    "fotoIDRelaciona" integer,
    CONSTRAINT "Fotos__PrimaryKey" PRIMARY KEY ("fotoID")
);

CREATE TABLE "Frequencia" (
    "Id" integer NOT NULL,
    "idRelaciona" integer,
    "especie" integer,
    "data" timestamp without time zone,
    "hora" timestamp without time zone,
    "bloqueado" character varying(1),
    "tipo" character varying(1),
    CONSTRAINT "Frequencia__PrimaryKey" PRIMARY KEY ("Id")
);

CREATE TABLE "Funcionarios" (
    "funcID" integer NOT NULL,
    "funcNome" character varying(50),
    "funcEndereco" character varying(70),
    "funcBairro" character varying(30),
    "funcCidade" character varying(50),
    "funcCEP" character varying(10),
    "funcEstado" character varying(2),
    "funcTelefone" character varying(15),
    "funcCelular" character varying(15),
    "funcSexo" integer,
    "funcCPF" character varying(14),
    "funcIdentidade" character varying(20),
    "FuncUFIdentidade" character varying(2),
    "FuncEmail" character varying(100),
    "funcDataNascimento" timestamp without time zone,
    "funcSalarioFixo" numeric(19,4),
    "funcAcesso" boolean NOT NULL,
    "funcTemCartao" boolean NOT NULL,
    "funcCartao" character varying(20),
    "funcExcluido" boolean NOT NULL,
    "funcSituacao" character varying(20),
    "funcAdmissao" timestamp without time zone,
    "funcDemissao" timestamp without time zone,
    "funcSenha" character varying(100),
    "funcProfessor" boolean NOT NULL,
    "funcaoID" double precision,
    "funcObs" text,
    "funcCREF" character varying(50),
    "funcPCaixa" character varying(250),
    "funcPContasR" character varying(250),
    "funcPAlunos" character varying(250),
    "funcPRelatorios" character varying(250),
    "funcPMatriculas" character varying(250),
    "funcDigitosCelular" double precision,
    "funcPPesquisa" character varying(250),
    "funcPFrequencia" character varying(250),
    "funcPConfig" character varying(250),
    "funcPTreinos" character varying(250),
    "funcPSCAADM" character varying(250),
    CONSTRAINT "Funcionarios__PrimaryKey" PRIMARY KEY ("funcID")
);

CREATE TABLE "FuncionariosFuncoes" (
    "funcaoID" integer NOT NULL,
    "funcaoDescricao" character varying(50)
);

CREATE TABLE "Horarios" (
    "horarioID" integer NOT NULL,
    "idRelaciona" integer,
    "horarioDia" integer,
    "horarioE" timestamp without time zone,
    "horarioS" timestamp without time zone,
    "horarioTipo" integer,
    "horarioLocal" integer,
    CONSTRAINT "Horarios__PrimaryKey" PRIMARY KEY ("horarioID")
);

CREATE TABLE "Locais" (
    "localID" integer NOT NULL,
    "localNome" character varying(50),
    "localAtivo" boolean NOT NULL,
    "localExcluido" boolean NOT NULL,
    CONSTRAINT "Locais__PrimaryKey" PRIMARY KEY ("localID")
);

CREATE TABLE "LogsAcesso" (
    "logID" integer NOT NULL,
    "funcID" integer,
    "microID" character varying(20),
    "logDataHora" timestamp without time zone,
    "logInfo" character varying(100),
    CONSTRAINT "LogsAcesso__PrimaryKey" PRIMARY KEY ("logID")
);

CREATE TABLE "Matricula" (
    "matriculaID" integer NOT NULL,
    "alunoID" integer,
    "modalidadeID" integer,
    "descontoID" integer,
    "matriculaNumero" integer,
    "matriculaDtInicio" timestamp without time zone,
    "matriculaDtFim" timestamp without time zone,
    "matriculaDesconto" numeric(19,4),
    "matriculaValor" numeric(19,4),
    "matriculaForma" character varying(50),
    "matriculaSituacao" character varying(20),
    "matriculaDiaVencimento" integer,
    "matriculaDtBloqueio" timestamp without time zone,
    "matriculaDtTrancamento" timestamp without time zone,
    "matriculaDtEncerramento" timestamp without time zone,
    "matriculaMotivoBloqueio" character varying(255),
    "matriculaMotivoEncerramento" character varying(255),
    "matriculaMotivoTrancamento" character varying(255),
    "matriculaExcluida" boolean NOT NULL,
    "matriculaDiasTrancamento" double precision,
    "matriculaAulas" double precision,
    "matriculaValorAula" numeric(19,4),
    "matriculaDtInicioGeral" timestamp without time zone,
    "matriculaRecorrente" character varying(1),
    "RecorrenteForma" double precision,
    "RecorrenteToken" character varying(200),
    "RecorrenteTruncado" character varying(200),
    "RecorrenteValidade" timestamp without time zone,
    "RecorrenteSeguranca" character varying(20),
    CONSTRAINT "Matricula__PrimaryKey" PRIMARY KEY ("matriculaID")
);

CREATE TABLE "MatriculaAulas" (
    "aulaID" integer NOT NULL,
    "matriculaID" double precision,
    "aulaNumero" double precision,
    "aulaValor" numeric(19,4),
    "aulaPresenca" double precision,
    "funcID" double precision,
    "aulaDataAgendamento" timestamp without time zone,
    "aulaHoraAgendamento" timestamp without time zone
);

CREATE TABLE "MatriculaNaoGerar" (
    "ID" integer NOT NULL,
    "matriculaID" double precision,
    "alunoID" double precision,
    "Ano" double precision,
    "Mes" double precision
);

CREATE TABLE "MatriculaRenovacoes" (
    "ID" integer NOT NULL,
    "matriculaID" double precision,
    "DataRenovacao" timestamp without time zone,
    "DataInicioAnterior" timestamp without time zone,
    "DataFimAnterior" timestamp without time zone,
    "DataInicio" timestamp without time zone,
    "DataFim" timestamp without time zone,
    "ValorFinalAnterior" numeric(19,4),
    "ValorFinal" numeric(19,4),
    "DescontoAnterior" numeric(19,4),
    "Desconto" numeric(19,4)
);

CREATE TABLE "MatriculaTrancamentos" (
    "ID" integer NOT NULL,
    "matriculaID" double precision,
    "DataTrancamento" timestamp without time zone,
    "DataDestrancamento" timestamp without time zone,
    "TrancadoPor" double precision,
    "Motivo" character varying(255)
);

CREATE TABLE "MatriculaTurmas" (
    "matriculaID" integer,
    "turmaID" integer,
    CONSTRAINT "MatriculaTurmas__PrimaryKey" PRIMARY KEY ("matriculaID", "turmaID")
);

CREATE TABLE "Mensagens" (
    "msgID" integer NOT NULL,
    "msgDe" integer,
    "msgPara" integer,
    "msgTipo" integer,
    "msgTodos" boolean NOT NULL,
    "msgData" timestamp without time zone,
    "msgHora" timestamp without time zone,
    "msgAssunto" character varying(50),
    "msgMensagem" text,
    "msgLido" boolean NOT NULL,
    CONSTRAINT "Mensagens__PrimaryKey" PRIMARY KEY ("msgID")
);

CREATE TABLE "Modalidades" (
    "modalidadeID" integer NOT NULL,
    "modalidadeNome" character varying(50),
    "modalidadeMensal" numeric(19,4),
    "modalidadeAula" numeric(19,4),
    "modalidadeAtiva" boolean NOT NULL,
    "modalidadeExcluida" boolean NOT NULL,
    "modalidadePlano" double precision,
    "modalidadeMeses" double precision,
    "modalidadeDias" double precision,
    CONSTRAINT "Modalidades__PrimaryKey" PRIMARY KEY ("modalidadeID")
);

CREATE TABLE "Modulos" (
    "moduloID" integer NOT NULL,
    "moduloDescricao" character varying(50),
    "moduloAcesso" boolean NOT NULL,
    "moduloInclusao" boolean NOT NULL,
    "moduloAlteracao" boolean NOT NULL,
    "moduloExclusao" boolean NOT NULL,
    "moduloReceber" boolean NOT NULL,
    CONSTRAINT "Modulos__PrimaryKey" PRIMARY KEY ("moduloID")
);

CREATE TABLE "Pagamentos" (
    "pagamentoID" integer NOT NULL,
    "idRelaciona" integer,
    "planoID" integer,
    "contaID" integer,
    "pagamentoDtVencimento" timestamp without time zone,
    "pagamentoValor" numeric(19,4),
    "pagamentoPago" boolean NOT NULL,
    "pagamentoHistorico" character varying(255),
    "pagamentoExcluido" boolean NOT NULL,
    "pagamentoAuto" double precision,
    "pagamentoCaixa" double precision,
    "pagamentoObs" text,
    CONSTRAINT "Pagamentos__PrimaryKey" PRIMARY KEY ("pagamentoID")
);

CREATE TABLE "PagamentosAuto" (
    "ID" integer NOT NULL,
    "todoDia" double precision,
    "pagamentoDescricao" character varying(255),
    "pagamentoValor" numeric(19,4),
    "planoID" double precision,
    "funcID" double precision
);

CREATE TABLE "Permissoes" (
    "permissaoID" integer NOT NULL,
    "moduloID" integer,
    "funcID" integer,
    "Acessar" boolean NOT NULL,
    "Cadastrar" boolean NOT NULL,
    "Alterar" boolean NOT NULL,
    "Excluir" boolean NOT NULL,
    "Receber" boolean NOT NULL,
    CONSTRAINT "Permissoes__PrimaryKey" PRIMARY KEY ("permissaoID")
);

CREATE TABLE "PlanodeContas" (
    "planoID" integer NOT NULL,
    "planoDescricao" character varying(50),
    "planoTipo" character varying(1),
    "planoAtivo" boolean NOT NULL,
    "planoExcluido" boolean NOT NULL,
    "planoValor" numeric(19,4),
    CONSTRAINT "PlanodeContas__PrimaryKey" PRIMARY KEY ("planoID")
);

CREATE TABLE "Produtos" (
    "produtoID" integer NOT NULL,
    "fornID" integer,
    "produtoNome" character varying(50),
    "produtoCusto" numeric(19,4),
    "produtoVenda" numeric(19,4),
    "produtoEstoque" integer,
    "produtoEstoqueMin" integer,
    "produtoBarras" character varying(30),
    "produtoImagem" character varying(255),
    "produtoAtivo" boolean NOT NULL,
    "produtoExcluido" boolean NOT NULL,
    "categoriaID" double precision,
    "produtoObs" text,
    "produtoCodigo" character varying(30),
    CONSTRAINT "Produtos__PrimaryKey" PRIMARY KEY ("produtoID")
);

CREATE TABLE "ProdutosCategorias" (
    "categoriaID" integer NOT NULL,
    "categoriaDescricao" character varying(255),
    "categoriaAtiva" character varying(1),
    "categoriaExcluida" character varying(1)
);

CREATE TABLE "Recebimentos" (
    "recebID" integer NOT NULL,
    "idRelaciona" integer,
    "planoID" integer,
    "alunoID" integer,
    "contaID" integer,
    "recebDtVencimento" timestamp without time zone,
    "recebValor" numeric(19,4),
    "recebMulta" numeric(19,4),
    "recebPago" boolean NOT NULL,
    "recebHistorico" character varying(255),
    "recebExcluido" boolean NOT NULL,
    "recebDtEmissao" timestamp without time zone,
    "funcID" double precision,
    "pagoRecorrente" character varying(1),
    "RecebDesconto" numeric(19,4),
    "recebFuncIdIsentou" double precision,
    CONSTRAINT "Recebimentos__PrimaryKey" PRIMARY KEY ("recebID")
);

CREATE TABLE "RecebimentosBoletos" (
    "NossoNumero" character varying(20),
    "recebID" double precision,
    "variasContas" double precision,
    "boletoExcluido" character varying(1)
);

CREATE TABLE "RecebimentosDebitos" (
    "DebitoId" integer NOT NULL,
    "recebID" integer NOT NULL,
    "reciboID" integer NOT NULL,
    "recebID_Debito" integer NOT NULL,
    "itemID" integer NOT NULL,
    "itemIDValorDebito" numeric(19,4),
    CONSTRAINT "RecebimentosDebitos__PK_RecebimentosDebitos" PRIMARY KEY ("DebitoId", "recebID_Debito")
);

CREATE TABLE "Recibos" (
    "reciboID" integer NOT NULL,
    "funcionarioID" integer,
    "formaID" integer,
    "reciboData" timestamp without time zone,
    "reciboHora" timestamp without time zone,
    "reciboValorPagar" numeric(19,4),
    "reciboValorPago" numeric(19,4),
    "reciboDesconto" numeric(19,4),
    "reciboHistorico" character varying(255),
    "reciboCancelado" boolean NOT NULL,
    "pagamentoID" integer,
    "reciboObs" character varying(255),
    "pagoRecorrente" character varying(1),
    "CieloRetorno" character varying(150),
    "CieloChamada" double precision,
    CONSTRAINT "Recibos__PrimaryKey" PRIMARY KEY ("reciboID")
);

CREATE TABLE "RecibosRecebimentos" (
    "recebID" integer NOT NULL,
    "reciboID" integer,
    CONSTRAINT "RecibosRecebimentos__PrimaryKey" PRIMARY KEY ("recebID")
);

CREATE TABLE "Telefones" (
    "telefoneID" integer NOT NULL,
    "telefoneDescricao" character varying(255),
    "telefoneNumero" character varying(100)
);

CREATE TABLE "TerminalAcessos" (
    "ID" integer NOT NULL,
    "alunoID" integer,
    "Data" timestamp without time zone,
    CONSTRAINT "TerminalAcessos__PrimaryKey" PRIMARY KEY ("ID")
);

CREATE TABLE "TerminalConfig" (
    "configID" integer NOT NULL,
    "configSenha" character varying(50),
    "configEnquete" integer,
    "DataAtualizacaoTerminal" timestamp without time zone,
    "HoraAtualizacaoTerminal" timestamp without time zone,
    "EnvioAutomatico" double precision,
    "Hora1" timestamp without time zone,
    "Hora2" timestamp without time zone,
    "EnvioAutomaticoData" timestamp without time zone,
    "EnvioAutomaticoHora" timestamp without time zone,
    "CodigoSCAFit" character varying(50),
    "contarSessoesApp" boolean NOT NULL,
    "configAviso" double precision,
    "configImpressora" double precision,
    "configBotaTreino" double precision,
    "configDigitalFaz" double precision,
    "configBotaTreino2" double precision,
    "configBotaoMSG" double precision,
    "configBotaoMSG2" double precision,
    "config1TreinoaoDia" double precision,
    "configFundo" double precision,
    "configFundoImagem" character varying(100),
    "configFormaImpressao" double precision,
    "configAvisoSenha" double precision,
    "configConsultaMatricula" double precision,
    "configBotaoPgtos" double precision,
    "configConsulta" character varying(1),
    "configTrava" character varying(1),
    "facialData" timestamp without time zone,
    "qrCodeData" timestamp without time zone,
    CONSTRAINT "TerminalConfig__PrimaryKey" PRIMARY KEY ("configID")
);

CREATE TABLE "TerminalEnquete" (
    "enqueteID" integer NOT NULL,
    "enquetePergunta" character varying(70),
    "enqueteOpcao1" character varying(70),
    "enqueteOpcao2" character varying(70),
    "enqueteOpcao3" character varying(70),
    "enqueteOpcao4" character varying(70),
    CONSTRAINT "TerminalEnquete__PrimaryKey" PRIMARY KEY ("enqueteID")
);

CREATE TABLE "TerminalEnqueteVotos" (
    "ID" integer NOT NULL,
    "alunoID" integer,
    "enqueteID" integer,
    "Opcao" integer,
    CONSTRAINT "TerminalEnqueteVotos__PrimaryKey" PRIMARY KEY ("ID")
);

CREATE TABLE "TerminalNoticias" (
    "noticiaID" integer NOT NULL,
    "noticiaMsg" character varying(250),
    CONSTRAINT "TerminalNoticias__PrimaryKey" PRIMARY KEY ("noticiaID")
);

CREATE TABLE "tmpAnalise" (
    "Data" character varying(50),
    "SaldoInicial" numeric(19,4),
    "Receitas" numeric(19,4),
    "Despesas" numeric(19,4),
    "SaldoDia" numeric(19,4),
    "SaldoAcumulado" numeric(19,4)
);

CREATE TABLE "tmpAvisos" (
    "avisoID" integer NOT NULL,
    "titulo" character varying(250) NOT NULL,
    "mensagem" character varying(250) NOT NULL,
    "link" character varying(250),
    "imagem" character varying(250),
    "destaque" boolean NOT NULL,
    "dataInicio" timestamp without time zone,
    "HoraInicio" timestamp without time zone,
    "DataFim" timestamp without time zone,
    "HoraFim" timestamp without time zone,
    "microID" character varying(8) NOT NULL,
    "importante" boolean NOT NULL,
    "temp" integer NOT NULL
);

CREATE TABLE "tmpBina" (
    "telefone" character varying(20),
    "tipo" character varying(10)
);

CREATE TABLE "tmpBoletos" (
    "NossoNumero" character varying(20),
    "DataOcorrencia" timestamp without time zone,
    "ValorPago" numeric(19,4),
    "ValorMultaPaga" numeric(19,4),
    "ValorJurosPago" numeric(19,4),
    "ValorDesconto" numeric(19,4),
    "ValorOutrosAcrescimos" numeric(19,4)
);

CREATE TABLE "tmpBoletosGerar" (
    "microID" character varying(20),
    "recebID" double precision
);

CREATE TABLE "tmpCartaoParcelas" (
    "Id" integer NOT NULL,
    "microID" character varying(10),
    "cartaoID" double precision,
    "parcelaNumero" double precision,
    "parcelaValor" numeric(19,4),
    "parcelaData" timestamp without time zone
);

CREATE TABLE "tmpCatracaComando" (
    "catracaComando" character varying(1)
);

CREATE TABLE "tmpCheques" (
    "chequeID" integer NOT NULL,
    "microID" character varying(15),
    "chequeNumero" character varying(10),
    "chequeBanco" integer,
    "chequeAgencia" character varying(10),
    "chequeConta" character varying(10),
    "chequeValor" numeric(19,4),
    "chequeBomPara" timestamp without time zone,
    CONSTRAINT "tmpCheques__PrimaryKey" PRIMARY KEY ("chequeID")
);

CREATE TABLE "tmpCheques2" (
    "chequeID" integer NOT NULL,
    "microID" character varying(15),
    "contaID" integer,
    "chequeNumero" character varying(10),
    "chequeValor" numeric(19,4),
    "chequeBomPara" timestamp without time zone,
    CONSTRAINT "tmpCheques2__PrimaryKey" PRIMARY KEY ("chequeID")
);

CREATE TABLE "tmpHorarios" (
    "horarioID" integer NOT NULL,
    "microID" character varying(15),
    "horarioDia" integer,
    "horarioE" timestamp without time zone,
    "horarioS" timestamp without time zone,
    "horarioTipo" integer,
    "horarioLocal" integer,
    CONSTRAINT "tmpHorarios__PrimaryKey" PRIMARY KEY ("horarioID")
);

CREATE TABLE "tmpPermissoes" (
    "permissaoID" integer NOT NULL,
    "moduloID" integer,
    "MicroID" character varying(14),
    "Acessar" boolean NOT NULL,
    "Cadastrar" boolean NOT NULL,
    "Alterar" boolean NOT NULL,
    "Excluir" boolean NOT NULL,
    "Receber" boolean NOT NULL,
    CONSTRAINT "tmpPermissoes__PrimaryKey" PRIMARY KEY ("permissaoID")
);

CREATE TABLE "tmpPlanodeContas" (
    "Valor" numeric(19,4),
    "PlanoID" double precision,
    "MatriculaID" double precision,
    "DebitoRecibo" double precision
);

CREATE TABLE "tmpPlanodeContas2" (
    "microID" character varying(50),
    "PlanoID" double precision,
    "PlanodeConta" character varying(255),
    "Qtde" double precision,
    "Total" numeric(19,4),
    "PlanoTipo" character varying(2)
);

CREATE TABLE "tmpSelecionados" (
    "Codigo" double precision,
    "Tipo" double precision,
    "microID" character varying(8)
);

CREATE TABLE "tmpTurmasModalidades" (
    "microID" character varying(15),
    "modalidadeID" double precision
);

CREATE TABLE "tmpTurmasProfessores" (
    "microID" character varying(15),
    "funcionarioID" integer,
    "turmaID" integer
);

CREATE TABLE "tmpVendasItens" (
    "microID" character varying(50),
    "produtoID" integer,
    "produtoItem" integer,
    "produtoQtde" integer,
    "produtoPreco" numeric(19,4),
    "produtoTotal" numeric(19,4),
    "produtoPrecoCusto" numeric(19,4)
);

CREATE TABLE "tmpVendasParcelas" (
    "microID" character varying(50),
    "parcela" double precision,
    "vencimento" timestamp without time zone,
    "valor" numeric(19,4)
);

CREATE TABLE "Turmas" (
    "turmaID" integer NOT NULL,
    "localID" integer,
    "modalidadeID" integer,
    "turmaNome" character varying(50),
    "turmaMaxAlunos" integer,
    "turmaAtiva" boolean NOT NULL,
    "turmaSexo" character varying(10),
    "turmaMensalidade" numeric(19,4),
    "turmaExcluida" boolean NOT NULL,
    "turmaObs" text,
    CONSTRAINT "Turmas__PrimaryKey" PRIMARY KEY ("turmaID")
);

CREATE TABLE "TurmasModalidades" (
    "turmaID" double precision,
    "modalidadeID" double precision
);

CREATE TABLE "TurmasProfessores" (
    "turmaID" integer,
    "funcionarioID" integer,
    CONSTRAINT "TurmasProfessores__PrimaryKey" PRIMARY KEY ("turmaID", "funcionarioID")
);

CREATE TABLE "Vendas" (
    "vendaID" integer NOT NULL,
    "vendaIDRelaciona" integer,
    "vendaData" timestamp without time zone,
    "vendaHora" timestamp without time zone,
    "vendaValor" numeric(19,4),
    "funcID" double precision,
    "funcVendedor" double precision,
    CONSTRAINT "Vendas__PrimaryKey" PRIMARY KEY ("vendaID")
);

CREATE TABLE "VendasItens" (
    "itemID" integer NOT NULL,
    "vendaID" integer,
    "produtoID" integer,
    "produtoItem" integer,
    "produtoQtde" integer,
    "produtoPreco" numeric(19,4),
    "produtoTotal" numeric(19,4),
    "produtoPrecoCusto" numeric(19,4),
    "produtoDesconto" numeric(19,4),
    CONSTRAINT "VendasItens__PrimaryKey" PRIMARY KEY ("itemID")
);

CREATE TABLE "VisaoGeralConfig" (
    "itemId" integer NOT NULL,
    "Item" character varying(30),
    "ItemPosicao" double precision,
    "Mostrar" character varying(1)
);

CREATE TABLE "Visitantes" (
    "visitanteID" integer NOT NULL,
    "visitanteNome" character varying(50),
    "visitanteEndereco" character varying(70),
    "visitanteBairro" character varying(30),
    "visitanteCidade" character varying(50),
    "visitanteCEP" character varying(10),
    "visitanteEstado" character varying(2),
    "visitanteTelefone" character varying(15),
    "visitanteCelular" character varying(15),
    "visitanteSexo" integer,
    "visitanteEmail" character varying(250),
    "visitanteObs" text,
    "visitanteDtVisita" timestamp without time zone,
    "visitanteDtMatricula" timestamp without time zone,
    "visitanteAluno" double precision,
    "funcId" double precision,
    "visitanteDigitosCelular" double precision,
    "visitanteNascimento" timestamp without time zone,
    CONSTRAINT "Visitantes__PrimaryKey" PRIMARY KEY ("visitanteID")
);

CREATE INDEX "Agenda__agendaID" ON "Agenda" ("agendaID");
CREATE INDEX "Agenda__funcionarioID" ON "Agenda" ("funcionarioID");
CREATE INDEX "Agenda__FuncionariosAgenda" ON "Agenda" ("funcionarioID");

CREATE INDEX "Alunos__alunoID" ON "Alunos" ("alunoID");
CREATE INDEX "Alunos__funcID" ON "Alunos" ("funcID");

CREATE INDEX "AlunosCreditos__AlunoID" ON "AlunosCreditos" ("AlunoID");
CREATE INDEX "AlunosCreditos__CreditoID" ON "AlunosCreditos" ("CreditoID");
CREATE INDEX "AlunosCreditos__reciboID" ON "AlunosCreditos" ("reciboID");

CREATE INDEX "Auditoria__auditoriaId" ON "Auditoria" ("auditoriaId");
CREATE INDEX "Auditoria__funcID" ON "Auditoria" ("funcID");
CREATE INDEX "Auditoria__moduloID" ON "Auditoria" ("moduloID");

CREATE INDEX "Bancos__bancoID" ON "Bancos" ("bancoID");

CREATE INDEX "Caixa__caixaID" ON "Caixa" ("caixaID");

CREATE INDEX "CaixaMovimentos__contaID" ON "CaixaMovimentos" ("contaID");
CREATE INDEX "CaixaMovimentos__movID" ON "CaixaMovimentos" ("movID");

CREATE INDEX "ChequesEmitidos__chequeID" ON "ChequesEmitidos" ("chequeID");
CREATE INDEX "ChequesEmitidos__pagamentoID" ON "ChequesEmitidos" ("pagamentoID");
CREATE INDEX "ChequesEmitidos__PagamentosChequesEmitidos" ON "ChequesEmitidos" ("pagamentoID");

CREATE INDEX "ChequesRecebidos__chequeID" ON "ChequesRecebidos" ("chequeID");
CREATE INDEX "ChequesRecebidos__contaID" ON "ChequesRecebidos" ("contaID");
CREATE INDEX "ChequesRecebidos__recebID" ON "ChequesRecebidos" ("reciboID");
CREATE INDEX "ChequesRecebidos__RecibosCheques" ON "ChequesRecebidos" ("reciboID");

CREATE INDEX "Config__configID" ON "Config" ("configID");
CREATE INDEX "Config__microID" ON "Config" ("microID");

CREATE INDEX "ConfigRecibo__Id" ON "ConfigRecibo" ("Id");

CREATE INDEX "ContasBanco__bancoID" ON "ContasBanco" ("bancoID");
CREATE INDEX "ContasBanco__BancosContasBanco" ON "ContasBanco" ("bancoID");
CREATE INDEX "ContasBanco__contaID" ON "ContasBanco" ("contaID");

CREATE INDEX "ContasBancoMovimentacao__contaID" ON "ContasBancoMovimentacao" ("contaID");
CREATE INDEX "ContasBancoMovimentacao__movID" ON "ContasBancoMovimentacao" ("movID");

CREATE INDEX "Descontos__descontoID" ON "Descontos" ("descontoID");

CREATE INDEX "DiasSemana__id" ON "DiasSemana" ("ID");

CREATE INDEX "Digitais__ID" ON "Digitais" ("digitalID");
CREATE INDEX "Digitais__idRelaciona" ON "Digitais" ("idRelaciona");
CREATE INDEX "Digitais__UltimoAcesso" ON "Digitais" ("UltimoAcesso");

CREATE INDEX "EmailGrupos__grupoID" ON "EmailGrupos" ("grupoID");

CREATE INDEX "EmailGruposLista__grupoID" ON "EmailGruposLista" ("grupoID");
CREATE INDEX "EmailGruposLista__Id" ON "EmailGruposLista" ("Id");
CREATE INDEX "EmailGruposLista__idrelaciona" ON "EmailGruposLista" ("idrelaciona");

CREATE INDEX "Empresa__empresaID" ON "Empresa" ("empresaID");

CREATE INDEX "ExerciciosFichas__exercicioID" ON "ExerciciosFichas" ("exercicioID");
CREATE INDEX "ExerciciosFichas__fichaNumero" ON "ExerciciosFichas" ("fichaNumero");
CREATE INDEX "ExerciciosFichas__treinoId" ON "ExerciciosFichas" ("treinoId");

CREATE INDEX "ExerciciosHistorico__Data" ON "ExerciciosHistorico" ("Data");
CREATE INDEX "ExerciciosHistorico__treinoID" ON "ExerciciosHistorico" ("treinoID");

CREATE INDEX "ExerciciosTreinos__alunoID" ON "ExerciciosTreinos" ("alunoID");
CREATE INDEX "ExerciciosTreinos__objetivoID" ON "ExerciciosTreinos" ("objetivoID");
CREATE INDEX "ExerciciosTreinos__professorID" ON "ExerciciosTreinos" ("professorID");
CREATE INDEX "ExerciciosTreinos__treinoAtivo" ON "ExerciciosTreinos" ("treinoAtivo");

CREATE INDEX "FormasPagamento__formaID" ON "FormasPagamento" ("formaID");

CREATE INDEX "Fornecedores__fornecedorID" ON "Fornecedores" ("fornID");

CREATE INDEX "Fotos__fotoID" ON "Fotos" ("fotoID");

CREATE INDEX "Frequencia__Data" ON "Frequencia" ("data");
CREATE INDEX "Frequencia__especie" ON "Frequencia" ("especie");
CREATE INDEX "Frequencia__Id" ON "Frequencia" ("Id");
CREATE INDEX "Frequencia__idRelaciona" ON "Frequencia" ("idRelaciona");

CREATE INDEX "Funcionarios__Func_ID" ON "Funcionarios" ("funcID");

CREATE INDEX "Horarios__alunoID" ON "Horarios" ("idRelaciona");
CREATE INDEX "Horarios__DiasSemanaHorarios" ON "Horarios" ("horarioDia");
CREATE INDEX "Horarios__Id" ON "Horarios" ("horarioID");

CREATE INDEX "Locais__localID" ON "Locais" ("localID");

CREATE INDEX "LogsAcesso__funcID" ON "LogsAcesso" ("funcID");
CREATE INDEX "LogsAcesso__logID" ON "LogsAcesso" ("logID");
CREATE INDEX "LogsAcesso__microID" ON "LogsAcesso" ("microID");

CREATE INDEX "Matricula__alunoID" ON "Matricula" ("alunoID");
CREATE INDEX "Matricula__AlunosMatriculas" ON "Matricula" ("alunoID");
CREATE INDEX "Matricula__DescontoId" ON "Matricula" ("descontoID");
CREATE INDEX "Matricula__matriculaID" ON "Matricula" ("matriculaID");
CREATE INDEX "Matricula__modalidadeID" ON "Matricula" ("modalidadeID");
CREATE INDEX "Matricula__ModalidadesMatricula" ON "Matricula" ("modalidadeID");

CREATE INDEX "MatriculaTurmas__matriculaID" ON "MatriculaTurmas" ("matriculaID");
CREATE INDEX "MatriculaTurmas__MatriculaMatriculaTurmas" ON "MatriculaTurmas" ("matriculaID");
CREATE INDEX "MatriculaTurmas__turmaID" ON "MatriculaTurmas" ("turmaID");
CREATE INDEX "MatriculaTurmas__TurmasMatriculaTurmas" ON "MatriculaTurmas" ("turmaID");

CREATE INDEX "Mensagens__mensagemID" ON "Mensagens" ("msgID");

CREATE INDEX "Modalidades__modalidadeID" ON "Modalidades" ("modalidadeID");

CREATE INDEX "Modulos__moduloID" ON "Modulos" ("moduloID");

CREATE INDEX "Pagamentos__contaID" ON "Pagamentos" ("contaID");
CREATE INDEX "Pagamentos__idRelaciona" ON "Pagamentos" ("idRelaciona");
CREATE INDEX "Pagamentos__pagamentoID" ON "Pagamentos" ("pagamentoID");
CREATE INDEX "Pagamentos__PlanodeContasPagamentos" ON "Pagamentos" ("planoID");
CREATE INDEX "Pagamentos__planoID" ON "Pagamentos" ("planoID");

CREATE INDEX "Permissoes__funcID" ON "Permissoes" ("funcID");
CREATE INDEX "Permissoes__FuncionariosPermissoes" ON "Permissoes" ("funcID");
CREATE INDEX "Permissoes__moduloID" ON "Permissoes" ("moduloID");
CREATE INDEX "Permissoes__ModulosPermissoes" ON "Permissoes" ("moduloID");
CREATE INDEX "Permissoes__permissaoID" ON "Permissoes" ("permissaoID");

CREATE INDEX "PlanodeContas__planoID" ON "PlanodeContas" ("planoID");

CREATE INDEX "Produtos__FornID" ON "Produtos" ("fornID");
CREATE INDEX "Produtos__produtoID" ON "Produtos" ("produtoID");

CREATE INDEX "Recebimentos__alunoID" ON "Recebimentos" ("alunoID");
CREATE INDEX "Recebimentos__contaID" ON "Recebimentos" ("contaID");
CREATE INDEX "Recebimentos__idrelaciona" ON "Recebimentos" ("idRelaciona");
CREATE INDEX "Recebimentos__PlanodeContasRecebimentos" ON "Recebimentos" ("planoID");
CREATE INDEX "Recebimentos__planoID" ON "Recebimentos" ("planoID");
CREATE INDEX "Recebimentos__recebDtVencimento" ON "Recebimentos" ("recebDtVencimento");
CREATE INDEX "Recebimentos__recebID" ON "Recebimentos" ("recebID");

CREATE INDEX "RecebimentosDebitos__recebID" ON "RecebimentosDebitos" ("recebID");
CREATE INDEX "RecebimentosDebitos__reciboID" ON "RecebimentosDebitos" ("reciboID");

CREATE INDEX "Recibos__formaID" ON "Recibos" ("formaID");
CREATE INDEX "Recibos__FormasPagamentoRecibos" ON "Recibos" ("formaID");
CREATE INDEX "Recibos__funcionarioID" ON "Recibos" ("funcionarioID");
CREATE INDEX "Recibos__pagamentoID" ON "Recibos" ("pagamentoID");
CREATE INDEX "Recibos__reciboData" ON "Recibos" ("reciboData");
CREATE INDEX "Recibos__ReciboID" ON "Recibos" ("reciboID");

CREATE INDEX "RecibosRecebimentos__RecebimentoID" ON "RecibosRecebimentos" ("recebID");
CREATE UNIQUE INDEX "RecibosRecebimentos__RecebimentosRecibosRecebimentos" ON "RecibosRecebimentos" ("recebID");
CREATE INDEX "RecibosRecebimentos__ReciboID" ON "RecibosRecebimentos" ("reciboID");
CREATE INDEX "RecibosRecebimentos__RecibosRecibosRecebimentos" ON "RecibosRecebimentos" ("reciboID");

CREATE INDEX "TerminalAcessos__alunoID" ON "TerminalAcessos" ("alunoID");
CREATE INDEX "TerminalAcessos__ID" ON "TerminalAcessos" ("ID");

CREATE INDEX "TerminalConfig__configID" ON "TerminalConfig" ("configID");

CREATE INDEX "TerminalEnquete__enqueteID" ON "TerminalEnquete" ("enqueteID");

CREATE INDEX "TerminalEnqueteVotos__alunoID" ON "TerminalEnqueteVotos" ("alunoID");
CREATE INDEX "TerminalEnqueteVotos__AlunosTerminalEnqueteVotos" ON "TerminalEnqueteVotos" ("alunoID");
CREATE INDEX "TerminalEnqueteVotos__enqueteID" ON "TerminalEnqueteVotos" ("enqueteID");
CREATE INDEX "TerminalEnqueteVotos__TerminalEnqueteTerminalEnqueteVotos" ON "TerminalEnqueteVotos" ("enqueteID");
CREATE INDEX "TerminalEnqueteVotos__votoID" ON "TerminalEnqueteVotos" ("ID");

CREATE INDEX "TerminalNoticias__novidadeID" ON "TerminalNoticias" ("noticiaID");

CREATE INDEX "tmpAvisos__avisoID" ON "tmpAvisos" ("avisoID");

CREATE INDEX "tmpCheques__chequeID" ON "tmpCheques" ("chequeID");
CREATE INDEX "tmpCheques__recebID" ON "tmpCheques" ("microID");

CREATE INDEX "tmpCheques2__chequeID" ON "tmpCheques2" ("chequeID");
CREATE INDEX "tmpCheques2__microID" ON "tmpCheques2" ("microID");

CREATE INDEX "tmpHorarios__alunoID" ON "tmpHorarios" ("microID");
CREATE INDEX "tmpHorarios__Id" ON "tmpHorarios" ("horarioID");

CREATE INDEX "tmpPermissoes__funcID" ON "tmpPermissoes" ("MicroID");
CREATE INDEX "tmpPermissoes__moduloID" ON "tmpPermissoes" ("moduloID");
CREATE INDEX "tmpPermissoes__permissaoID" ON "tmpPermissoes" ("permissaoID");

CREATE INDEX "tmpTurmasProfessores__funcionarioID" ON "tmpTurmasProfessores" ("funcionarioID");
CREATE INDEX "tmpTurmasProfessores__turmaID" ON "tmpTurmasProfessores" ("microID");
CREATE INDEX "tmpTurmasProfessores__turmaID1" ON "tmpTurmasProfessores" ("turmaID");

CREATE INDEX "tmpVendasItens__microID" ON "tmpVendasItens" ("microID");
CREATE INDEX "tmpVendasItens__produtoId" ON "tmpVendasItens" ("produtoID");

CREATE INDEX "Turmas__LocaisTurmas" ON "Turmas" ("localID");
CREATE INDEX "Turmas__localID" ON "Turmas" ("localID");
CREATE INDEX "Turmas__modalidadeID" ON "Turmas" ("modalidadeID");
CREATE INDEX "Turmas__ModalidadesTurmas" ON "Turmas" ("modalidadeID");
CREATE INDEX "Turmas__turmaID" ON "Turmas" ("turmaID");

CREATE INDEX "TurmasProfessores__funcionarioID" ON "TurmasProfessores" ("funcionarioID");
CREATE INDEX "TurmasProfessores__FuncionariosTurmasProfessores" ON "TurmasProfessores" ("funcionarioID");
CREATE INDEX "TurmasProfessores__turmaID" ON "TurmasProfessores" ("turmaID");
CREATE INDEX "TurmasProfessores__TurmasTurmasProfessores" ON "TurmasProfessores" ("turmaID");

CREATE INDEX "Vendas__vendaID" ON "Vendas" ("vendaID");

CREATE INDEX "VendasItens__itemID" ON "VendasItens" ("itemID");
CREATE INDEX "VendasItens__produtoId" ON "VendasItens" ("produtoID");
CREATE INDEX "VendasItens__vendaID" ON "VendasItens" ("vendaID");
CREATE INDEX "VendasItens__VendasVendasItens" ON "VendasItens" ("vendaID");

CREATE INDEX "Visitantes__visitanteID" ON "Visitantes" ("visitanteID");

ALTER TABLE "Agenda" ADD CONSTRAINT "Agenda__FuncionariosAgenda" FOREIGN KEY ("funcionarioID") REFERENCES "Funcionarios" ("funcID");

ALTER TABLE "ChequesEmitidos" ADD CONSTRAINT "ChequesEmitidos__PagamentosChequesEmitidos" FOREIGN KEY ("pagamentoID") REFERENCES "Pagamentos" ("pagamentoID");

ALTER TABLE "ChequesRecebidos" ADD CONSTRAINT "ChequesRecebidos__RecibosCheques" FOREIGN KEY ("reciboID") REFERENCES "Recibos" ("reciboID");

ALTER TABLE "ContasBanco" ADD CONSTRAINT "ContasBanco__BancosContasBanco" FOREIGN KEY ("bancoID") REFERENCES "Bancos" ("bancoID");

ALTER TABLE "Horarios" ADD CONSTRAINT "Horarios__DiasSemanaHorarios" FOREIGN KEY ("horarioDia") REFERENCES "DiasSemana" ("ID");

ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula__AlunosMatriculas" FOREIGN KEY ("alunoID") REFERENCES "Alunos" ("alunoID");
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula__ModalidadesMatricula" FOREIGN KEY ("modalidadeID") REFERENCES "Modalidades" ("modalidadeID");

ALTER TABLE "MatriculaTurmas" ADD CONSTRAINT "MatriculaTurmas__MatriculaMatriculaTurmas" FOREIGN KEY ("matriculaID") REFERENCES "Matricula" ("matriculaID");
ALTER TABLE "MatriculaTurmas" ADD CONSTRAINT "MatriculaTurmas__TurmasMatriculaTurmas" FOREIGN KEY ("turmaID") REFERENCES "Turmas" ("turmaID");

ALTER TABLE "Pagamentos" ADD CONSTRAINT "Pagamentos__PlanodeContasPagamentos" FOREIGN KEY ("planoID") REFERENCES "PlanodeContas" ("planoID");

ALTER TABLE "Permissoes" ADD CONSTRAINT "Permissoes__FuncionariosPermissoes" FOREIGN KEY ("funcID") REFERENCES "Funcionarios" ("funcID");
ALTER TABLE "Permissoes" ADD CONSTRAINT "Permissoes__ModulosPermissoes" FOREIGN KEY ("moduloID") REFERENCES "Modulos" ("moduloID");

ALTER TABLE "Recebimentos" ADD CONSTRAINT "Recebimentos__PlanodeContasRecebimentos" FOREIGN KEY ("planoID") REFERENCES "PlanodeContas" ("planoID");

ALTER TABLE "Recibos" ADD CONSTRAINT "Recibos__FormasPagamentoRecibos" FOREIGN KEY ("formaID") REFERENCES "FormasPagamento" ("formaID");

ALTER TABLE "RecibosRecebimentos" ADD CONSTRAINT "RecibosRecebimentos__RecebimentosRecibosRecebimentos" FOREIGN KEY ("recebID") REFERENCES "Recebimentos" ("recebID");
ALTER TABLE "RecibosRecebimentos" ADD CONSTRAINT "RecibosRecebimentos__RecibosRecibosRecebimentos" FOREIGN KEY ("reciboID") REFERENCES "Recibos" ("reciboID");

ALTER TABLE "TerminalEnqueteVotos" ADD CONSTRAINT "TerminalEnqueteVotos__AlunosTerminalEnqueteVotos" FOREIGN KEY ("alunoID") REFERENCES "Alunos" ("alunoID");
ALTER TABLE "TerminalEnqueteVotos" ADD CONSTRAINT "TerminalEnqueteVotos__TerminalEnqueteTerminalEnqueteVotos" FOREIGN KEY ("enqueteID") REFERENCES "TerminalEnquete" ("enqueteID");

ALTER TABLE "Turmas" ADD CONSTRAINT "Turmas__LocaisTurmas" FOREIGN KEY ("localID") REFERENCES "Locais" ("localID");
ALTER TABLE "Turmas" ADD CONSTRAINT "Turmas__ModalidadesTurmas" FOREIGN KEY ("modalidadeID") REFERENCES "Modalidades" ("modalidadeID");

ALTER TABLE "TurmasProfessores" ADD CONSTRAINT "TurmasProfessores__FuncionariosTurmasProfessores" FOREIGN KEY ("funcionarioID") REFERENCES "Funcionarios" ("funcID");
ALTER TABLE "TurmasProfessores" ADD CONSTRAINT "TurmasProfessores__TurmasTurmasProfessores" FOREIGN KEY ("turmaID") REFERENCES "Turmas" ("turmaID");

ALTER TABLE "VendasItens" ADD CONSTRAINT "VendasItens__VendasVendasItens" FOREIGN KEY ("vendaID") REFERENCES "Vendas" ("vendaID");

COMMIT;
