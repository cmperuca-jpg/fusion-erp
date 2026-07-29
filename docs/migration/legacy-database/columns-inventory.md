# Inventario de Colunas do Banco Legado

Data: 2026-07-29

Fonte: docs/migration/legacy-database/postgresql-schema.sql.

Total de colunas inventariadas: 1489.

| Tabela | Coluna | Tipo PostgreSQL exportado | Aceita nulo | PK | Contexto inicial |
| --- | --- | --- | --- | --- | --- |
| Agenda | agendaAssunto | character varying(50) | sim | nao | academico |
| Agenda | agendaCompromisso | text | sim | nao | academico |
| Agenda | agendaConfirmado | boolean NOT NULL | nao | nao | academico |
| Agenda | agendaData | timestamp without time zone | sim | nao | academico |
| Agenda | agendaDiaMes | integer | sim | nao | academico |
| Agenda | agendaDias | integer | sim | nao | academico |
| Agenda | agendaDiaSemana | integer | sim | nao | academico |
| Agenda | agendaHora | timestamp without time zone | sim | nao | academico |
| Agenda | agendaID | integer NOT NULL | nao | sim | academico |
| Agenda | agendaPessoal | boolean NOT NULL | nao | nao | academico |
| Agenda | agendaTipo | integer | sim | nao | academico |
| Agenda | funcionarioID | integer | sim | nao | academico |
| AgendaConfirmacoes | agendaID | double precision | sim | nao | academico |
| AgendaConfirmacoes | ano | double precision | sim | nao | academico |
| AgendaConfirmacoes | Id | integer NOT NULL | nao | nao | academico |
| AgendaConfirmacoes | mes | double precision | sim | nao | academico |
| Alunos | alunoBairro | character varying(30) | sim | nao | cadastros/alunos |
| Alunos | alunoCartao | character varying(20) | sim | nao | cadastros/alunos |
| Alunos | alunoCatracaDia | character varying(1) | sim | nao | cadastros/alunos |
| Alunos | alunoCatracaMinutos | double precision | sim | nao | cadastros/alunos |
| Alunos | alunoCatracaReentrada | character varying(1) | sim | nao | cadastros/alunos |
| Alunos | alunoCatracaSegundos | double precision | sim | nao | cadastros/alunos |
| Alunos | alunoCatracaSemana | character varying(1) | sim | nao | cadastros/alunos |
| Alunos | alunoCatracaVezesDia | double precision | sim | nao | cadastros/alunos |
| Alunos | alunoCatracaVezesSemana | double precision | sim | nao | cadastros/alunos |
| Alunos | alunoCelular | character varying(15) | sim | nao | cadastros/alunos |
| Alunos | alunoCEP | character varying(10) | sim | nao | cadastros/alunos |
| Alunos | alunoCidade | character varying(50) | sim | nao | cadastros/alunos |
| Alunos | alunoCPF | character varying(14) | sim | nao | cadastros/alunos |
| Alunos | alunoDataAvaliacao | timestamp without time zone | sim | nao | cadastros/alunos |
| Alunos | alunoDataExame | timestamp without time zone | sim | nao | cadastros/alunos |
| Alunos | alunoDataNascimento | timestamp without time zone | sim | nao | cadastros/alunos |
| Alunos | alunoDigitosCelular | double precision | sim | nao | cadastros/alunos |
| Alunos | alunoDtCadastro | timestamp without time zone | sim | nao | cadastros/alunos |
| Alunos | alunoEmail | character varying(250) | sim | nao | cadastros/alunos |
| Alunos | alunoEmpresa | character varying(30) | sim | nao | cadastros/alunos |
| Alunos | alunoEndereco | character varying(70) | sim | nao | cadastros/alunos |
| Alunos | alunoEstado | character varying(2) | sim | nao | cadastros/alunos |
| Alunos | alunoEstadoCivil | character varying(30) | sim | nao | cadastros/alunos |
| Alunos | alunoExcluido | boolean NOT NULL | nao | nao | cadastros/alunos |
| Alunos | alunoHorario | boolean NOT NULL | nao | nao | cadastros/alunos |
| Alunos | alunoID | integer NOT NULL | nao | sim | cadastros/alunos |
| Alunos | alunoIdentidade | character varying(20) | sim | nao | cadastros/alunos |
| Alunos | alunoMae | character varying(50) | sim | nao | cadastros/alunos |
| Alunos | alunoMaeCPF | character varying(14) | sim | nao | cadastros/alunos |
| Alunos | alunoMatricula | integer | sim | nao | cadastros/alunos |
| Alunos | alunoNome | character varying(50) | sim | nao | cadastros/alunos |
| Alunos | alunoObjetivo | character varying(50) | sim | nao | cadastros/alunos |
| Alunos | alunoObs | text | sim | nao | cadastros/alunos |
| Alunos | alunoPai | character varying(50) | sim | nao | cadastros/alunos |
| Alunos | alunoPaiCPF | character varying(14) | sim | nao | cadastros/alunos |
| Alunos | alunoProfissao | character varying(30) | sim | nao | cadastros/alunos |
| Alunos | alunoResponsavel | character varying(50) | sim | nao | cadastros/alunos |
| Alunos | alunoResponsavelCPF | character varying(14) | sim | nao | cadastros/alunos |
| Alunos | alunoSenha | character varying(100) | sim | nao | cadastros/alunos |
| Alunos | alunoSexo | integer | sim | nao | cadastros/alunos |
| Alunos | alunoSoubeAcademia | character varying(255) | sim | nao | cadastros/alunos |
| Alunos | alunoTelefone | character varying(15) | sim | nao | cadastros/alunos |
| Alunos | alunoTelefoneEmpresa | character varying(15) | sim | nao | cadastros/alunos |
| Alunos | alunoTelefoneMae | character varying(15) | sim | nao | cadastros/alunos |
| Alunos | alunoTelefonePai | character varying(15) | sim | nao | cadastros/alunos |
| Alunos | alunoTelefoneResponsavel | character varying(15) | sim | nao | cadastros/alunos |
| Alunos | alunoTemCartao | boolean NOT NULL | nao | nao | cadastros/alunos |
| Alunos | alunoUFIdentidade | character varying(2) | sim | nao | cadastros/alunos |
| Alunos | funcID | integer | sim | nao | cadastros/alunos |
| Alunos | recorrenteAtivo | character varying(1) | sim | nao | cadastros/alunos |
| Alunos | RecorrenteForma | double precision | sim | nao | cadastros/alunos |
| Alunos | RecorrenteSeguranca | character varying(20) | sim | nao | cadastros/alunos |
| Alunos | RecorrenteToken | character varying(200) | sim | nao | cadastros/alunos |
| Alunos | RecorrenteTruncado | character varying(200) | sim | nao | cadastros/alunos |
| Alunos | RecorrenteValidade | timestamp without time zone | sim | nao | cadastros/alunos |
| AlunosContatos | alunoID | double precision | sim | nao | cadastros/alunos |
| AlunosContatos | contatoAssunto | character varying(255) | sim | nao | cadastros/alunos |
| AlunosContatos | contatoDataAgendado | timestamp without time zone | sim | nao | cadastros/alunos |
| AlunosContatos | contatoDataEfetuado | timestamp without time zone | sim | nao | cadastros/alunos |
| AlunosContatos | contatoExcluido | character varying(1) | sim | nao | cadastros/alunos |
| AlunosContatos | contatoID | integer NOT NULL | nao | nao | cadastros/alunos |
| AlunosContatos | contatoMensagem | text | sim | nao | cadastros/alunos |
| AlunosContatos | contatoPor | character varying(1) | sim | nao | cadastros/alunos |
| AlunosContatos | contatoStatus | character varying(1) | sim | nao | cadastros/alunos |
| AlunosContatos | funcIDAgenda | double precision | sim | nao | cadastros/alunos |
| AlunosContatos | funcIDRealiza | double precision | sim | nao | cadastros/alunos |
| AlunosCreditos | AlunoID | integer | sim | nao | cadastros/alunos |
| AlunosCreditos | CreditoData | timestamp without time zone | sim | nao | cadastros/alunos |
| AlunosCreditos | CreditoDescontado | boolean NOT NULL | nao | nao | cadastros/alunos |
| AlunosCreditos | CreditoID | integer NOT NULL | nao | sim | cadastros/alunos |
| AlunosCreditos | CreditoValor | numeric(19,4) | sim | nao | cadastros/alunos |
| AlunosCreditos | reciboDescontado | integer | sim | nao | cadastros/alunos |
| AlunosCreditos | reciboID | integer | sim | nao | cadastros/alunos |
| AnamneseConfig | itemId | integer NOT NULL | nao | nao | cadastros/alunos |
| AnamneseConfig | Pergunta | character varying(100) | sim | nao | cadastros/alunos |
| Auditoria | auditoriaData | timestamp without time zone | sim | nao | inteligencia/configuracao |
| Auditoria | auditoriaHistorico | character varying(255) | sim | nao | inteligencia/configuracao |
| Auditoria | auditoriaHora | timestamp without time zone | sim | nao | inteligencia/configuracao |
| Auditoria | auditoriaId | integer NOT NULL | nao | sim | inteligencia/configuracao |
| Auditoria | auditoriaOperacao | character varying(20) | sim | nao | inteligencia/configuracao |
| Auditoria | funcID | integer | sim | nao | inteligencia/configuracao |
| Auditoria | moduloID | integer | sim | nao | inteligencia/configuracao |
| Avaliacao | alunoId | double precision | sim | nao | treinamento |
| Avaliacao | AnamneseObs | text | sim | nao | treinamento |
| Avaliacao | avaliacaoAvaliador | double precision | sim | nao | treinamento |
| Avaliacao | avaliacaoData | timestamp without time zone | sim | nao | treinamento |
| Avaliacao | avaliacaoID | integer NOT NULL | nao | nao | treinamento |
| Avaliacao | avaliacaoNumero | double precision | sim | nao | treinamento |
| Avaliacao | avaliadoIdade | double precision | sim | nao | treinamento |
| AvaliacaoAnamnese | alunoID | double precision | sim | nao | cadastros/alunos |
| AvaliacaoAnamnese | anamneseID | double precision | sim | nao | cadastros/alunos |
| AvaliacaoAnamnese | anamneseValor | character varying(255) | sim | nao | cadastros/alunos |
| AvaliacaoAnamnese | avaliacaoID | double precision | sim | nao | cadastros/alunos |
| AvaliacaoAnamnese | Id | integer NOT NULL | nao | nao | cadastros/alunos |
| AvaliacaoBioimpedancia | alunoID | double precision | sim | nao | treinamento |
| AvaliacaoBioimpedancia | avaliacaoID | double precision | sim | nao | treinamento |
| AvaliacaoBioimpedancia | bioimpedanciaValor | double precision | sim | nao | treinamento |
| AvaliacaoBioimpedancia | Id | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoBioimpedancia | itemID | double precision | sim | nao | treinamento |
| AvaliacaoBioimpedanciaConfig | itemDescricao | character varying(20) | sim | nao | treinamento |
| AvaliacaoBioimpedanciaConfig | itemId | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoBioimpedanciaConfig | itemMedida | character varying(5) | sim | nao | treinamento |
| AvaliacaoCardiorrespiratoria | Avaliacao | character varying(100) | sim | nao | treinamento |
| AvaliacaoCardiorrespiratoria | avaliacaoID | double precision | sim | nao | treinamento |
| AvaliacaoCardiorrespiratoria | Id | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoCardiorrespiratoria | Sedentario | double precision | sim | nao | treinamento |
| AvaliacaoCardiorrespiratoria | Teste | character varying(255) | sim | nao | treinamento |
| AvaliacaoCardiorrespiratoria | TesteId | double precision | sim | nao | treinamento |
| AvaliacaoCardiorrespiratoria | Vo2 | double precision | sim | nao | treinamento |
| AvaliacaoComparacao | Id | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoComparacao | op1 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op10 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op11 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op12 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op13 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op14 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op15 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op16 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op17 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op18 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op19 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op2 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op20 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op21 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op22 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op23 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op24 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op25 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op26 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op27 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op3 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op30 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op31 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op32 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op33 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op34 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op35 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op36 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op37 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op38 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op39 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op4 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op40 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op41 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op5 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op6 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op7 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op72 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op8 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op82 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacao | op9 | character varying(1) | sim | nao | treinamento |
| AvaliacaoComparacaoT | Campos | character varying(30) | sim | nao | treinamento |
| AvaliacaoComparacaoT | Coluna1 | character varying(50) | sim | nao | treinamento |
| AvaliacaoComparacaoT | Coluna2 | character varying(50) | sim | nao | treinamento |
| AvaliacaoComparacaoT | Coluna3 | character varying(50) | sim | nao | treinamento |
| AvaliacaoComparacaoT | Coluna4 | character varying(50) | sim | nao | treinamento |
| AvaliacaoComparacaoT | Coluna5 | character varying(50) | sim | nao | treinamento |
| AvaliacaoComposicao | Altura | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | avaliacaoID | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | BioMassaGorda | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | BioMassaGordaKg | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | BioMassaMagra | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | BioMassaMagrakg | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Dobra1 | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Dobra2 | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Dobra3 | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Dobra4 | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Dobra5 | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Dobra6 | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Dobra7 | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Dobra8 | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Dobra9 | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Gordura | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | GorduraIdeal | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Id | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoComposicao | IMC | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | MassaGorda | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | MassaMagra | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | Peso | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | PesoIdeal | character varying(100) | sim | nao | treinamento |
| AvaliacaoComposicao | Protocolo | double precision | sim | nao | treinamento |
| AvaliacaoComposicao | TMB | double precision | sim | nao | treinamento |
| AvaliacaoConfig | AnamneseConfig | character varying(1) | sim | nao | treinamento |
| AvaliacaoConfig | ComparacaoFoto | character varying(1) | sim | nao | treinamento |
| AvaliacaoConfig | ComposicaoExibir | double precision | sim | nao | treinamento |
| AvaliacaoConfig | ComposicaoRelatorioExibir | character varying(1) | sim | nao | treinamento |
| AvaliacaoConfig | Exibir | character varying(255) | sim | nao | treinamento |
| AvaliacaoConfig | formatoRelatorio | double precision | sim | nao | treinamento |
| AvaliacaoConfig | IMC1 | character varying(1) | sim | nao | treinamento |
| AvaliacaoConfig | IMC2 | character varying(1) | sim | nao | treinamento |
| AvaliacaoConfig | IMC3 | character varying(1) | sim | nao | treinamento |
| AvaliacaoConfig | IMC4 | character varying(1) | sim | nao | treinamento |
| AvaliacaoConfig | linhaDestacada | character varying(1) | sim | nao | treinamento |
| AvaliacaoConfig | posturalGradeMostrar | double precision | sim | nao | treinamento |
| AvaliacaoConfig | posturalGradeZoom | double precision | sim | nao | treinamento |
| AvaliacaoConfig | posturalZoom | double precision | sim | nao | treinamento |
| AvaliacaoConfig | TextoComposicao | text | sim | nao | treinamento |
| AvaliacaoConfig | TextoPARQ | text | sim | nao | treinamento |
| AvaliacaoConfig | TextoRisco | text | sim | nao | treinamento |
| AvaliacaoConfig | TextoRodape | character varying(255) | sim | nao | treinamento |
| AvaliacaoConfig | TextoVO2 | text | sim | nao | treinamento |
| AvaliacaoNeuromotora | AbdominalResultado | character varying(100) | sim | nao | treinamento |
| AvaliacaoNeuromotora | AbdominalTotal | double precision | sim | nao | treinamento |
| AvaliacaoNeuromotora | avaliacaoID | double precision | sim | nao | treinamento |
| AvaliacaoNeuromotora | FlexaoResultado | character varying(100) | sim | nao | treinamento |
| AvaliacaoNeuromotora | FlexaoTotal | double precision | sim | nao | treinamento |
| AvaliacaoNeuromotora | Id | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoNeuromotora | WellsResultado | character varying(100) | sim | nao | treinamento |
| AvaliacaoNeuromotora | WellsTotal | double precision | sim | nao | treinamento |
| AvaliacaoObs | alunoID | double precision | sim | nao | treinamento |
| AvaliacaoObs | Id | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoObs | ObsComparacao | text | sim | nao | treinamento |
| AvaliacaoPARQ | alunoID | double precision | sim | nao | treinamento |
| AvaliacaoPARQ | avaliacaoID | double precision | sim | nao | treinamento |
| AvaliacaoPARQ | Id | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoPARQ | obs | text | sim | nao | treinamento |
| AvaliacaoPARQ | opt1 | character varying(1) | sim | nao | treinamento |
| AvaliacaoPARQ | opt2 | character varying(1) | sim | nao | treinamento |
| AvaliacaoPARQ | opt3 | character varying(1) | sim | nao | treinamento |
| AvaliacaoPARQ | opt4 | character varying(1) | sim | nao | treinamento |
| AvaliacaoPARQ | opt5 | character varying(1) | sim | nao | treinamento |
| AvaliacaoPARQ | opt6 | character varying(1) | sim | nao | treinamento |
| AvaliacaoPARQ | opt7 | character varying(1) | sim | nao | treinamento |
| AvaliacaoPerimetros | Abdomen | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | AnteBracoD | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | AnteBracoE | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | avaliacaoID | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | Biestiloide | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | Bimaleolar | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | BracoCD | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | BracoCE | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | BracoRD | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | BracoRE | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | Cintura | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | CoxaD | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | CoxaE | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | Femural | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | Id | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoPerimetros | Ombro | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | PanturrilhaD | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | PanturrilhaE | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | Pescoco | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | Quadril | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | RCQ | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | Torax | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | Torax2 | double precision | sim | nao | treinamento |
| AvaliacaoPerimetros | Umeral | double precision | sim | nao | treinamento |
| AvaliacaoPerimetrosC | Item | character varying(30) | sim | nao | treinamento |
| AvaliacaoPerimetrosC | itemId | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoPerimetrosC | ItemPosicao | double precision | sim | nao | treinamento |
| AvaliacaoPerimetrosC | Mostrar | character varying(1) | sim | nao | treinamento |
| AvaliacaoPostural | avaliacaoID | double precision | sim | nao | treinamento |
| AvaliacaoPostural | fotoAnterior | text | sim | nao | treinamento |
| AvaliacaoPostural | fotoLateral | text | sim | nao | treinamento |
| AvaliacaoPostural | fotoPosterior | text | sim | nao | treinamento |
| AvaliacaoPostural | Id | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoRisco | avaliacaoID | double precision | sim | nao | treinamento |
| AvaliacaoRisco | Id | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoRisco | opt1 | double precision | sim | nao | treinamento |
| AvaliacaoRisco | opt2 | double precision | sim | nao | treinamento |
| AvaliacaoRisco | opt3 | double precision | sim | nao | treinamento |
| AvaliacaoRisco | opt4 | double precision | sim | nao | treinamento |
| AvaliacaoRisco | opt5 | double precision | sim | nao | treinamento |
| AvaliacaoRisco | opt6 | double precision | sim | nao | treinamento |
| AvaliacaoRisco | opt7 | double precision | sim | nao | treinamento |
| AvaliacaoRisco | opt8 | double precision | sim | nao | treinamento |
| AvaliacaoRisco | resultado | double precision | sim | nao | treinamento |
| AvaliacaoTestes1a3 | avaliacaoId | double precision | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste1Distancia | double precision | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste2FC | double precision | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste2Tempo | character varying(10) | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste3Carga | double precision | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste3FC1 | double precision | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste3FC2 | double precision | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste3FC3 | double precision | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste3FC4 | double precision | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste3FC5 | double precision | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste3PA1 | character varying(30) | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste3PA2 | character varying(30) | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste3PA3 | character varying(30) | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste3PA4 | character varying(30) | sim | nao | treinamento |
| AvaliacaoTestes1a3 | Teste3PA5 | character varying(30) | sim | nao | treinamento |
| AvaliacaoTestes1a3 | testeID | integer NOT NULL | nao | nao | treinamento |
| AvaliacaoTestes4a6 | avaliacaoId | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste4FC1 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste4FC2 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste4FC3 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste4FC4 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste4FC5 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste4FC6 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste4FC7 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste4Formula | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste4TempoFinal | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste5FC1 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste5FC2 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste5FC3 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste5FC4 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste5FC5 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste5FC6 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste5FC7 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste5FC8 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste5FC9 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste5Inclinacao | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste6FC1 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste6FC2 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste6FC3 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste6FC4 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste6FC5 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste6FC6 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste6FC7 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste6FC8 | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | Teste6TempoFinal | double precision | sim | nao | treinamento |
| AvaliacaoTestes4a6 | testeID | integer NOT NULL | nao | nao | treinamento |
| Bancos | bancoExcluido | boolean NOT NULL | nao | nao | financeiro |
| Bancos | bancoID | integer NOT NULL | nao | sim | financeiro |
| Bancos | bancoNome | character varying(100) | sim | nao | financeiro |
| Bancos | bancoNumero | integer | sim | nao | financeiro |
| Caixa | caixaDataFinal | timestamp without time zone | sim | nao | financeiro |
| Caixa | caixaDataInicial | timestamp without time zone | sim | nao | financeiro |
| Caixa | caixaFechado | boolean NOT NULL | nao | nao | financeiro |
| Caixa | CaixaFormaAbertura | double precision | sim | nao | financeiro |
| Caixa | caixaHoraFinal | timestamp without time zone | sim | nao | financeiro |
| Caixa | caixaHoraInicial | timestamp without time zone | sim | nao | financeiro |
| Caixa | caixaID | integer NOT NULL | nao | sim | financeiro |
| Caixa | caixaValorEntradas | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorFinal | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorFinalBOL | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorFinalCAR | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorFinalCHE | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorFinalDEP | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorFinalDIN | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorFinalPIX | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorInicial | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorInicialBOL | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorInicialCAR | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorInicialCHE | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorInicialDEP | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorInicialDIN | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorInicialPIX | numeric(19,4) | sim | nao | financeiro |
| Caixa | caixaValorSaidas | numeric(19,4) | sim | nao | financeiro |
| Caixa | funcionarioAbertura | integer | sim | nao | financeiro |
| Caixa | funcionarioFechamento | integer | sim | nao | financeiro |
| CaixaConfig | CaixaExibirCartaoAgrupado | character varying(1) | sim | nao | financeiro |
| CaixaConfig | CaixaExibirCartaoCaixaAtual | character varying(1) | sim | nao | financeiro |
| CaixaConfig | CartaoCompensacao | character varying(1) | sim | nao | financeiro |
| CaixaConfig | DatasPassadas1 | character varying(1) | sim | nao | financeiro |
| CaixaConfig | DatasPassadas2 | character varying(1) | sim | nao | financeiro |
| CaixaConfig | op1 | character varying(1) | sim | nao | financeiro |
| CaixaConfig | op2 | character varying(1) | sim | nao | financeiro |
| CaixaConfig | op21 | character varying(1) | sim | nao | financeiro |
| CaixaConfig | op22 | character varying(1) | sim | nao | financeiro |
| CaixaConfig | op3 | character varying(1) | sim | nao | financeiro |
| CaixaConfig | op4 | character varying(1) | sim | nao | financeiro |
| CaixaConfig | op41 | character varying(1) | sim | nao | financeiro |
| CaixaConfig | op42 | character varying(1) | sim | nao | financeiro |
| CaixaConfig | op5 | character varying(1) | sim | nao | financeiro |
| CaixaConfig | op6 | character varying(1) | sim | nao | financeiro |
| CaixaMovimentos | contaID | integer | sim | nao | financeiro |
| CaixaMovimentos | funcID | double precision | sim | nao | financeiro |
| CaixaMovimentos | movCompensado | boolean NOT NULL | nao | nao | financeiro |
| CaixaMovimentos | movData | timestamp without time zone | sim | nao | financeiro |
| CaixaMovimentos | movForma | character varying(30) | sim | nao | financeiro |
| CaixaMovimentos | movHistorico | character varying(100) | sim | nao | financeiro |
| CaixaMovimentos | movHora | timestamp without time zone | sim | nao | financeiro |
| CaixaMovimentos | movID | integer NOT NULL | nao | sim | financeiro |
| CaixaMovimentos | movRD | character varying(1) | sim | nao | financeiro |
| CaixaMovimentos | movTipo | character varying(20) | sim | nao | financeiro |
| CaixaMovimentos | movValor | numeric(19,4) | sim | nao | financeiro |
| CartaoParcelas | caixaID | double precision | sim | nao | financeiro |
| CartaoParcelas | cartaoID | double precision | sim | nao | financeiro |
| CartaoParcelas | contaID | double precision | sim | nao | financeiro |
| CartaoParcelas | creditoouDebito | character varying(1) | sim | nao | financeiro |
| CartaoParcelas | Id | integer NOT NULL | nao | nao | financeiro |
| CartaoParcelas | pagoRecorrente | character varying(1) | sim | nao | financeiro |
| CartaoParcelas | parcelaCaixa | character varying(1) | sim | nao | financeiro |
| CartaoParcelas | parcelaData | timestamp without time zone | sim | nao | financeiro |
| CartaoParcelas | parcelaDataCaixa | timestamp without time zone | sim | nao | financeiro |
| CartaoParcelas | parcelaExcluida | character varying(1) | sim | nao | financeiro |
| CartaoParcelas | parcelaNumero | double precision | sim | nao | financeiro |
| CartaoParcelas | parcelasTotal | double precision | sim | nao | financeiro |
| CartaoParcelas | parcelaTaxa | numeric(19,4) | sim | nao | financeiro |
| CartaoParcelas | parcelaValor | numeric(19,4) | sim | nao | financeiro |
| CartaoParcelas | parcelaValorFinal | numeric(19,4) | sim | nao | financeiro |
| CartaoParcelas | reciboID | double precision | sim | nao | financeiro |
| Cartoes | cartaoAtivo | character varying(1) | sim | nao | pendente |
| Cartoes | cartaoExcluido | character varying(1) | sim | nao | pendente |
| Cartoes | cartaoFoto | character varying(10) | sim | nao | pendente |
| Cartoes | cartaoID | integer NOT NULL | nao | nao | pendente |
| Cartoes | cartaoNome | character varying(200) | sim | nao | pendente |
| Cartoes | taxaCreditoaVista | double precision | sim | nao | pendente |
| Cartoes | taxaCreditoParcelado | double precision | sim | nao | pendente |
| Cartoes | taxaDebito | double precision | sim | nao | pendente |
| CatracaLiberacoes | liberacaoAlunoId | double precision | sim | nao | acesso |
| CatracaLiberacoes | liberacaoAlunoSituacao | character varying(1) | sim | nao | acesso |
| CatracaLiberacoes | liberacaoData | timestamp without time zone | sim | nao | acesso |
| CatracaLiberacoes | liberacaoFuncId | double precision | sim | nao | acesso |
| CatracaLiberacoes | liberacaoHora | timestamp without time zone | sim | nao | acesso |
| CatracaLiberacoes | liberacaoID | integer NOT NULL | nao | nao | acesso |
| CatracaLiberacoes | liberacaoMotivo | character varying(250) | sim | nao | acesso |
| ChequesEmitidos | caixaID | double precision | sim | nao | financeiro |
| ChequesEmitidos | chequeBomPara | timestamp without time zone | sim | nao | financeiro |
| ChequesEmitidos | chequeCaixa | character varying(1) | sim | nao | financeiro |
| ChequesEmitidos | chequeCompensado | boolean NOT NULL | nao | nao | financeiro |
| ChequesEmitidos | chequeDataCaixa | timestamp without time zone | sim | nao | financeiro |
| ChequesEmitidos | chequeDtCompensacao | timestamp without time zone | sim | nao | financeiro |
| ChequesEmitidos | chequeExcluido | boolean NOT NULL | nao | nao | financeiro |
| ChequesEmitidos | chequeID | integer NOT NULL | nao | sim | financeiro |
| ChequesEmitidos | chequeNumero | character varying(10) | sim | nao | financeiro |
| ChequesEmitidos | chequeObs | text | sim | nao | financeiro |
| ChequesEmitidos | chequeValor | numeric(19,4) | sim | nao | financeiro |
| ChequesEmitidos | contaID | integer | sim | nao | financeiro |
| ChequesEmitidos | pagamentoID | integer | sim | nao | financeiro |
| ChequesRecebidos | caixaID | double precision | sim | nao | financeiro |
| ChequesRecebidos | chequeAgencia | character varying(10) | sim | nao | financeiro |
| ChequesRecebidos | chequeBanco | integer | sim | nao | financeiro |
| ChequesRecebidos | chequeBomPara | timestamp without time zone | sim | nao | financeiro |
| ChequesRecebidos | chequeCaixa | character varying(1) | sim | nao | financeiro |
| ChequesRecebidos | chequeCompensado | boolean NOT NULL | nao | nao | financeiro |
| ChequesRecebidos | chequeConta | character varying(10) | sim | nao | financeiro |
| ChequesRecebidos | chequeDataCaixa | timestamp without time zone | sim | nao | financeiro |
| ChequesRecebidos | chequeDtCompensacao | timestamp without time zone | sim | nao | financeiro |
| ChequesRecebidos | chequeExcluido | boolean NOT NULL | nao | nao | financeiro |
| ChequesRecebidos | chequeID | integer NOT NULL | nao | sim | financeiro |
| ChequesRecebidos | chequeNumero | character varying(10) | sim | nao | financeiro |
| ChequesRecebidos | chequeObs | text | sim | nao | financeiro |
| ChequesRecebidos | chequeSemFundo | boolean NOT NULL | nao | nao | financeiro |
| ChequesRecebidos | chequeValor | numeric(19,4) | sim | nao | financeiro |
| ChequesRecebidos | contaID | integer | sim | nao | financeiro |
| ChequesRecebidos | reciboID | integer | sim | nao | financeiro |
| CieloChamadas | alunoID | double precision | sim | nao | financeiro |
| CieloChamadas | aprovado | character varying(1) | sim | nao | financeiro |
| CieloChamadas | autorizacao | character varying(10) | sim | nao | financeiro |
| CieloChamadas | Cancelado | character varying(1) | sim | nao | financeiro |
| CieloChamadas | CartaoTruncado | character varying(100) | sim | nao | financeiro |
| CieloChamadas | comprovante | character varying(10) | sim | nao | financeiro |
| CieloChamadas | Data | timestamp without time zone | sim | nao | financeiro |
| CieloChamadas | funcID | double precision | sim | nao | financeiro |
| CieloChamadas | Hora | timestamp without time zone | sim | nao | financeiro |
| CieloChamadas | Id | integer NOT NULL | nao | nao | financeiro |
| CieloChamadas | identificacao | character varying(30) | sim | nao | financeiro |
| CieloChamadas | microID | character varying(8) | sim | nao | financeiro |
| CieloChamadas | Parcelas | numeric(19,4) | sim | nao | financeiro |
| CieloChamadas | recebID | double precision | sim | nao | financeiro |
| CieloChamadas | recorrente | character varying(1) | sim | nao | financeiro |
| CieloChamadas | resposta | character varying(5) | sim | nao | financeiro |
| CieloChamadas | Resposta1 | character varying(250) | sim | nao | financeiro |
| CieloChamadas | Transacao | character varying(40) | sim | nao | financeiro |
| CieloChamadas | Valor | numeric(19,4) | sim | nao | financeiro |
| CieloChamadasRecebimentos | chamadaID | double precision | sim | nao | financeiro |
| CieloChamadasRecebimentos | recebID | double precision | sim | nao | financeiro |
| Config | alunoListar | integer | sim | nao | inteligencia/configuracao |
| Config | alunoOrdem | character varying(50) | sim | nao | inteligencia/configuracao |
| Config | alunoOrdemA | character varying(4) | sim | nao | inteligencia/configuracao |
| Config | alunoProcurar | integer | sim | nao | inteligencia/configuracao |
| Config | catracaMicro | double precision | sim | nao | inteligencia/configuracao |
| Config | configAcesso | character varying(100) | sim | nao | inteligencia/configuracao |
| Config | configAgenda | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | configCatracaAtalho | character varying(1) | sim | nao | inteligencia/configuracao |
| Config | configCorFinal | character varying(50) | sim | nao | inteligencia/configuracao |
| Config | configCorInicial | character varying(50) | sim | nao | inteligencia/configuracao |
| Config | configDetalhado | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | configExibir1 | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | configExibir2 | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | configExibir3 | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | configExibirCabecalho | character varying(1) | sim | nao | inteligencia/configuracao |
| Config | configExibirRodape | character varying(1) | sim | nao | inteligencia/configuracao |
| Config | configFiltros | character varying(254) | sim | nao | inteligencia/configuracao |
| Config | configFrenteVerso | character varying(1) | sim | nao | inteligencia/configuracao |
| Config | configGeraCodigo | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | configID | integer NOT NULL | nao | sim | inteligencia/configuracao |
| Config | configImagem | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | configImagemCaminho | character varying(100) | sim | nao | inteligencia/configuracao |
| Config | configImpressora | integer | sim | nao | inteligencia/configuracao |
| Config | configInicializarVerif | character varying(1) | sim | nao | inteligencia/configuracao |
| Config | configMinimizar | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | configMostraGeral | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | configTelaToda | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | configVias | integer | sim | nao | inteligencia/configuracao |
| Config | configVisualizar | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | corFocus | character varying(50) | sim | nao | inteligencia/configuracao |
| Config | freqDetalhes | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | freqListar | integer | sim | nao | inteligencia/configuracao |
| Config | funcAcesso | integer | sim | nao | inteligencia/configuracao |
| Config | funcListar | integer | sim | nao | inteligencia/configuracao |
| Config | icBoxPortaSerial | double precision | sim | nao | inteligencia/configuracao |
| Config | matriculaOrdem | character varying(50) | sim | nao | inteligencia/configuracao |
| Config | microID | character varying(20) | sim | nao | inteligencia/configuracao |
| Config | modalidadeOrdem | character varying(50) | sim | nao | inteligencia/configuracao |
| Config | pagListar | integer | sim | nao | inteligencia/configuracao |
| Config | produtoOrdem | character varying(50) | sim | nao | inteligencia/configuracao |
| Config | recebDetalhes | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Config | recebporAluno | integer | sim | nao | inteligencia/configuracao |
| Config | reciboExibir | double precision | sim | nao | inteligencia/configuracao |
| Config | turmaOrdem | character varying(50) | sim | nao | inteligencia/configuracao |
| Config | usarBina | double precision | sim | nao | inteligencia/configuracao |
| Config | usarBinaAdaptador | double precision | sim | nao | inteligencia/configuracao |
| Config | usarBinaAdaptadorModelo | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto | adaptacaoSCA | character varying(50) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | ArquivoRemessaData | timestamp without time zone | sim | nao | inteligencia/configuracao |
| ConfigBoleto | ArquivoRemessaSequencia | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto | ArquivoRemessaSequencia2 | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoAceite | character varying(50) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoAcrescimosReceb | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoAcrescimosRecibo | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoAdicional1 | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoAdicional2 | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoAgencia | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoBanco | character varying(100) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoBancoEmiteBoleto | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoCadastroCompleto | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoCarteira | character varying(100) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoCedente | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoCedilha | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoConta | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoContas | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoDiasProtesto | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoInstrucoes | text | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoInstrucoes2 | text | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoInstrucoesExibir | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoLayout | character varying(75) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoMenor | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoParcela | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoPercentualJuros | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoProximo | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoRemessa | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoRetornoLayout | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoSicoobConta | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoTipoDocumento | character varying(10) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoTipoJuros | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoTipoMulta | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoUsar | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoValorJurosDiaAtraso | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoVencimento | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoVias | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoZeraSequencial | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | boletoZeraSequencial2 | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | RelContasReceberFiltro | character varying(50) | sim | nao | inteligencia/configuracao |
| ConfigBoleto | vendaDigitos | character varying(5) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoAgencia | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoAgenciaDigito | character varying(3) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoBairro | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoBairroSacador | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoBaixa | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoBanco | character varying(100) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoByteGeracao | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCaracTitulo | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCarteira | character varying(100) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCarteiraAcBrBoleto | character varying(10) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCedente | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCEP | character varying(10) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCEPSacador | character varying(10) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCidade | character varying(50) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCidadeSacador | character varying(50) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCNPJ | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCNPJouCPF | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCNPJouCPFSacador | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCNPJSacador | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoCodTransmissao | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoConta | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoContaDigito | character varying(3) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoConvenio | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoDescontoConceder | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoDescontoDias | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoDescontoValor | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoEndereco | character varying(250) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoEnderecoSacador | character varying(250) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoEspecieDoc | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoEstado | character varying(3) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoEstadoSacador | character varying(3) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoHabilitaSemRegistro | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoImprimirRemessa | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoLayoutRemessa | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoLayoutRetorno | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoModalidade | character varying(30) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoProximoNossoNumero | double precision | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoQuemEmite | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoRazaoSocialouNome | character varying(250) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoRazaoSocialouNomeSacador | character varying(250) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoSacadorSN | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoSQL | text | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoTipoCarteira | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | boletoTipoDesconto | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | LerNossoNumeroCompletoArqRetorno | character varying(2) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | MultaExibir1 | character varying(2) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | MultaExibir2 | character varying(2) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | sicoobDigito | character varying(2) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | sicoobLayout | character varying(3) | sim | nao | inteligencia/configuracao |
| ConfigBoleto2 | sicoobLayoutLote | character varying(3) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | BarrasConfig | character varying(255) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | BarrasDigitos | double precision | sim | nao | inteligencia/configuracao |
| ConfigCarteira | BarrasDigitosBanco | double precision | sim | nao | inteligencia/configuracao |
| ConfigCarteira | BarrasLargura | double precision | sim | nao | inteligencia/configuracao |
| ConfigCarteira | FormaImpressao | character varying(1) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | FotoConfig | character varying(255) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | FuncBarrasConfig | character varying(255) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | FuncBarrasDigitos | double precision | sim | nao | inteligencia/configuracao |
| ConfigCarteira | FuncBarrasLargura | double precision | sim | nao | inteligencia/configuracao |
| ConfigCarteira | FuncFotoConfig | character varying(255) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | FuncLinha1Config | character varying(255) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | FuncLinha2Config | character varying(255) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | FuncLinha3Config | character varying(255) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | Id | integer NOT NULL | nao | nao | inteligencia/configuracao |
| ConfigCarteira | Linha1Config | character varying(255) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | Linha2Config | character varying(255) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | Linha3Config | character varying(255) | sim | nao | inteligencia/configuracao |
| ConfigCarteira | Linha4Config | character varying(255) | sim | nao | inteligencia/configuracao |
| ConfigRecibo | altura | integer | sim | nao | financeiro |
| ConfigRecibo | cabecalho | integer | sim | nao | financeiro |
| ConfigRecibo | exibirRegua | boolean NOT NULL | nao | nao | financeiro |
| ConfigRecibo | Id | integer NOT NULL | nao | sim | financeiro |
| ConfigRecibo | Lado | double precision | sim | nao | financeiro |
| ConfigRecibo | largura | integer | sim | nao | financeiro |
| ConfigRecibo | Linha10Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha10Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha11Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha11Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha12Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha12Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha13Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha14Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha15Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha16Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha16Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha17Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha18Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha18Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha19Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha1Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha1Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha20Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha21Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha21Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha2Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha2Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha3Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha3Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha4Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha5Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha5Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha6Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha7Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha7Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha8Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha9Config | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Linha9Texto | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Logo | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | margemDir | integer | sim | nao | financeiro |
| ConfigRecibo | margemEsq | integer | sim | nao | financeiro |
| ConfigRecibo | margemInf | integer | sim | nao | financeiro |
| ConfigRecibo | margemSup | integer | sim | nao | financeiro |
| ConfigRecibo | modeloRecibo | integer | sim | nao | financeiro |
| ConfigRecibo | rodape | integer | sim | nao | financeiro |
| ConfigRecibo | Tipo | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Traco1 | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Traco2 | character varying(255) | sim | nao | financeiro |
| ConfigRecibo | Traco3 | character varying(255) | sim | nao | financeiro |
| ConfigReciboBematech | Atu17Carta | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | comandoGaveta | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | Id | integer NOT NULL | nao | nao | financeiro |
| ConfigReciboBematech | imprimeCidadeEstado | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | imprimeCNPJ | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | imprimeEndereco | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | imprimeTelefone | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | IpImpressora | character varying(100) | sim | nao | financeiro |
| ConfigReciboBematech | MensagemFinal | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | mensagemFinalVia | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | modeloImpressora | double precision | sim | nao | financeiro |
| ConfigReciboBematech | msgFinal1 | character varying(80) | sim | nao | financeiro |
| ConfigReciboBematech | msgFinal2 | character varying(80) | sim | nao | financeiro |
| ConfigReciboBematech | Opt1 | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | Opt11 | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | Opt15 | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | Opt16 | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | Opt17 | double precision | sim | nao | financeiro |
| ConfigReciboBematech | Opt18 | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | Opt2 | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | Opt3 | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | Opt4 | character varying(3) | sim | nao | financeiro |
| ConfigReciboBematech | Opt5 | character varying(100) | sim | nao | financeiro |
| ConfigReciboBematech | Opt6 | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | Opt7 | character varying(250) | sim | nao | financeiro |
| ConfigReciboBematech | Opt9 | character varying(250) | sim | nao | financeiro |
| ConfigReciboBematech | RelCaixaDetalhado | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | TotalContaPagar | character varying(1) | sim | nao | financeiro |
| ConfigReciboBematech | vendaVendedor | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | agendaNaoConfirmados | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | agendaNaoConfirmadosTelaP | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | alunoTurmaMatriculaTrancada | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | atualizacaoAutomatica | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | boletoConfigAntiga | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | ContaExibirCartao | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | contaPagarCaixa | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | DataRotinaDuplicacao | character varying(12) | sim | nao | financeiro |
| ConfigReciboDaruma | DigitosCelular | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | DoisCliquesListagemCheques | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | facialImagemFundo | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | facialImagemInstrucoes | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | facialLogo | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | FacialMemoryLimit | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | facialMensagemOla | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | facialPrecisao | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | facialProcessamento | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | FacialSeiscentos | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | facialTempoAguardo | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | facialTempoMensagemOla | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | facialTempoReinicio | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | facialTempoReinicioMesmaPessoa | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | FacialUsar | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | filtrarConsulta | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | FiltrarModalidade | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | FormatoCelular | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | frequenciaTurmaDiaSemana | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | graficoMatriculaData | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | GymStyle | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | Id | integer NOT NULL | nao | nao | financeiro |
| ConfigReciboDaruma | importarFichaOutroAluno | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | ManternaFicha | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | matriculaTurmas | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | Opt1 | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | Opt2 | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | Opt3 | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | Opt4 | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | Opt5 | character varying(10) | sim | nao | financeiro |
| ConfigReciboDaruma | Opt6 | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | RelatorioCaixaAtualSel | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | RelatorioRecebTurmasDebito | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | Rotina9DigitosExecutada | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | Rotina9DigitosExecutada2 | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | Rotina9DigitosExecutada3 | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | Rotina9DigitosExecutada4 | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | telaAdicionalFormato | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | telaAdicionalTempo | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | telaAdicionasMsgLiberado | character varying(100) | sim | nao | financeiro |
| ConfigReciboDaruma | telaAdicionasMsgNegado | character varying(100) | sim | nao | financeiro |
| ConfigReciboDaruma | TelaAlunoMonitor | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | terminalEndereco1 | double precision | sim | nao | financeiro |
| ConfigReciboDaruma | terminalEndereco2 | character varying(50) | sim | nao | financeiro |
| ConfigReciboDaruma | treinoFrequenciaExibir | character varying(1) | sim | nao | financeiro |
| ConfigReciboDaruma | VerificaComputadorScaCartao | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | AlunosAusentesDias | character varying(30) | sim | nao | financeiro |
| ConfigReciboMatricial | AlunosDebitoSituacao | double precision | sim | nao | financeiro |
| ConfigReciboMatricial | CamposObrigatorios | character varying(200) | sim | nao | financeiro |
| ConfigReciboMatricial | configAlunoListaCheque | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | configRecebTurmasData | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | Id | integer NOT NULL | nao | nao | financeiro |
| ConfigReciboMatricial | imprimeCidadeEstado | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | imprimeCNPJ | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | imprimeEndereco | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | imprimeTelefone | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | Opt1 | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | Opt10 | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | Opt11 | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | Opt12 | double precision | sim | nao | financeiro |
| ConfigReciboMatricial | Opt2 | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | Opt3 | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | Opt4 | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | Opt5 | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | Opt6 | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | Opt7 | double precision | sim | nao | financeiro |
| ConfigReciboMatricial | Opt8 | double precision | sim | nao | financeiro |
| ConfigReciboMatricial | Opt9 | character varying(1) | sim | nao | financeiro |
| ConfigReciboMatricial | PlanosVencerDias | character varying(30) | sim | nao | financeiro |
| ConfigReciboMatricial | PlanosVencerSituacao | double precision | sim | nao | financeiro |
| ConfigReciboMatricial | reciboA41 | double precision | sim | nao | financeiro |
| ConfigReciboMatricial | reciboA42 | character varying(50) | sim | nao | financeiro |
| ConfigReciboMatricial | reciboA43 | double precision | sim | nao | financeiro |
| ConfigReciboMatricial | reciboA44 | character varying(5) | sim | nao | financeiro |
| configRecorrente | AmexC | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | AmexP | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | AuraC | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | AuraP | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | dinnersC | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | dinnersP | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | DiscoverC | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | DiscoverP | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | EloC | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | EloP | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa1Parcelas | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa1Valor1 | numeric(19,4) | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa1Valor2 | numeric(19,4) | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa2Parcelas | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa2Valor1 | numeric(19,4) | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa2Valor2 | numeric(19,4) | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa3Parcelas | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa3Valor1 | numeric(19,4) | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa3Valor2 | numeric(19,4) | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa4Parcelas | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa4Valor1 | numeric(19,4) | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa4Valor2 | numeric(19,4) | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa5Parcelas | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa5Valor1 | numeric(19,4) | sim | nao | inteligencia/configuracao |
| configRecorrente | Faixa5Valor2 | numeric(19,4) | sim | nao | inteligencia/configuracao |
| configRecorrente | hiperCardC | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | hiperCardP | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | Id | integer NOT NULL | nao | nao | inteligencia/configuracao |
| configRecorrente | JcbC | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | JcbP | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | MasterCardC | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | MasterCardP | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteAposPagamento | character varying(1) | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteConta | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteDataExecucao | timestamp without time zone | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteDebitoDias | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteDebitoVezesDia | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteDigitacao | character varying(1) | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteExecucao1 | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteExecucao2 | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteExecucao3 | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteExecucao4 | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteHabilitado | character varying(1) | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteHora1 | timestamp without time zone | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteHora2 | timestamp without time zone | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteHora3 | timestamp without time zone | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteHora4 | timestamp without time zone | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteLeitor | character varying(1) | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteMaximoParcelas | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteMensagemPadrao | character varying(40) | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteParcelamento | character varying(1) | sim | nao | inteligencia/configuracao |
| configRecorrente | recorrenteTrancada | character varying(1) | sim | nao | inteligencia/configuracao |
| configRecorrente | visaC | double precision | sim | nao | inteligencia/configuracao |
| configRecorrente | visaP | double precision | sim | nao | inteligencia/configuracao |
| ConfigTeclasModulos | moduloDescricao | character varying(255) | sim | nao | cadastros/professores ou iam |
| ConfigTeclasModulos | moduloID | integer NOT NULL | nao | nao | cadastros/professores ou iam |
| ConfigTeclasModulos2 | ID | integer NOT NULL | nao | nao | cadastros/professores ou iam |
| ConfigTeclasModulos2 | moduloID | double precision | sim | nao | cadastros/professores ou iam |
| ContasBanco | bancoID | integer | sim | nao | financeiro |
| ContasBanco | contaAgencia | character varying(10) | sim | nao | financeiro |
| ContasBanco | contaConta | character varying(10) | sim | nao | financeiro |
| ContasBanco | contaExcluida | boolean NOT NULL | nao | nao | financeiro |
| ContasBanco | contaID | integer NOT NULL | nao | sim | financeiro |
| ContasBanco | contaRetornoBoletos | double precision | sim | nao | financeiro |
| ContasBanco | contaTitular | character varying(50) | sim | nao | financeiro |
| ContasBancoMovimentacao | contaID | integer | sim | nao | financeiro |
| ContasBancoMovimentacao | movCompensado | boolean NOT NULL | nao | nao | financeiro |
| ContasBancoMovimentacao | movData | timestamp without time zone | sim | nao | financeiro |
| ContasBancoMovimentacao | movHistorico | character varying(50) | sim | nao | financeiro |
| ContasBancoMovimentacao | movHistoricoNovo | character varying(255) | sim | nao | financeiro |
| ContasBancoMovimentacao | movID | integer NOT NULL | nao | sim | financeiro |
| ContasBancoMovimentacao | movTipo | character varying(1) | sim | nao | financeiro |
| ContasBancoMovimentacao | movValor | numeric(19,4) | sim | nao | financeiro |
| Descontos | descontoDesativado | boolean NOT NULL | nao | nao | financeiro |
| Descontos | descontoDescricao | character varying(100) | sim | nao | financeiro |
| Descontos | descontoExcluido | boolean NOT NULL | nao | nao | financeiro |
| Descontos | descontoID | integer NOT NULL | nao | sim | financeiro |
| Descontos | descontoTipo | character varying(20) | sim | nao | financeiro |
| Descontos | descontoValor | numeric(19,4) | sim | nao | financeiro |
| DiasSemana | DiaSemana | character varying(50) | sim | nao | academico |
| DiasSemana | ID | integer NOT NULL | nao | sim | academico |
| Digitais | digitalDir | bytea | sim | nao | pendente |
| Digitais | digitalEsq | bytea | sim | nao | pendente |
| Digitais | digitalID | integer NOT NULL | nao | sim | pendente |
| Digitais | digitalTipo | integer | sim | nao | pendente |
| Digitais | idRelaciona | integer | sim | nao | pendente |
| Digitais | UltimoAcesso | timestamp without time zone NOT NULL | nao | nao | pendente |
| Email | Email | character varying(255) | sim | nao | inteligencia/configuracao |
| Email | Nome | character varying(200) | sim | nao | inteligencia/configuracao |
| Email | Porta | character varying(15) | sim | nao | inteligencia/configuracao |
| Email | Senha | character varying(255) | sim | nao | inteligencia/configuracao |
| Email | SmsSenha | character varying(255) | sim | nao | inteligencia/configuracao |
| Email | SmsUsuario | character varying(30) | sim | nao | inteligencia/configuracao |
| Email | Smtp | character varying(50) | sim | nao | inteligencia/configuracao |
| Email | tiSenha | character varying(100) | sim | nao | inteligencia/configuracao |
| Email | tiUsuario | character varying(50) | sim | nao | inteligencia/configuracao |
| Email | Usuario | character varying(50) | sim | nao | inteligencia/configuracao |
| EmailGrupos | grupoID | integer NOT NULL | nao | sim | inteligencia/configuracao |
| EmailGrupos | grupoNome | character varying(50) | sim | nao | inteligencia/configuracao |
| EmailGruposLista | Celular | character varying(15) | sim | nao | inteligencia/configuracao |
| EmailGruposLista | Email | character varying(255) | sim | nao | inteligencia/configuracao |
| EmailGruposLista | grupoID | integer | sim | nao | inteligencia/configuracao |
| EmailGruposLista | Id | integer NOT NULL | nao | sim | inteligencia/configuracao |
| EmailGruposLista | idrelaciona | integer | sim | nao | inteligencia/configuracao |
| EmailGruposLista | Nome | character varying(50) | sim | nao | inteligencia/configuracao |
| Empresa | cartaoContaId | double precision | sim | nao | inteligencia/configuracao |
| Empresa | cartaoDiasCredito | double precision | sim | nao | inteligencia/configuracao |
| Empresa | cartaoDiasDebito | double precision | sim | nao | inteligencia/configuracao |
| Empresa | cartaoDiasUsar | double precision | sim | nao | inteligencia/configuracao |
| Empresa | cartaoExibirConta | double precision | sim | nao | inteligencia/configuracao |
| Empresa | cartaoTaxasUsar | double precision | sim | nao | inteligencia/configuracao |
| Empresa | catracaMonitor | double precision | sim | nao | inteligencia/configuracao |
| Empresa | catracaMotivo | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaAlunoInfoListagem | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaAlunoMatriculaOrdem | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaAlunoPgtoOrdem | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaAlunosDigitos | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaAvaliacao | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaBairro | character varying(30) | sim | nao | inteligencia/configuracao |
| Empresa | empresaBloqueia | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Empresa | empresaBloqueia2 | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaCatraca | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaCatracaMinutos | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaCatracaReentrada | character varying(1) | sim | nao | inteligencia/configuracao |
| Empresa | empresaCatracaSegundos | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaCatracaVarias | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaCEP | character varying(10) | sim | nao | inteligencia/configuracao |
| Empresa | empresaCidade | character varying(50) | sim | nao | inteligencia/configuracao |
| Empresa | empresaCNPJ | character varying(18) | sim | nao | inteligencia/configuracao |
| Empresa | empresaCobrarMulta | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Empresa | empresaDataBackup | timestamp without time zone | sim | nao | inteligencia/configuracao |
| Empresa | empresaDataBackupAuto | timestamp without time zone | sim | nao | inteligencia/configuracao |
| Empresa | empresaDiasBloqueio | integer | sim | nao | inteligencia/configuracao |
| Empresa | empresaDiasBloqueio2 | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaDiasPlano | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaDiaVencimento | integer | sim | nao | inteligencia/configuracao |
| Empresa | empresaEmail | character varying(100) | sim | nao | inteligencia/configuracao |
| Empresa | empresaEndereco | character varying(70) | sim | nao | inteligencia/configuracao |
| Empresa | empresaEstado | character varying(2) | sim | nao | inteligencia/configuracao |
| Empresa | empresaExame | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaFAX | character varying(15) | sim | nao | inteligencia/configuracao |
| Empresa | empresaFormaChamarCliente | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaFormadeCalculoFluxoCaixa | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaFrequenciaM | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaFuncInfoListagem | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaID | integer NOT NULL | nao | sim | inteligencia/configuracao |
| Empresa | empresaInativar | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaInativarDias | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaInativarDiasPlano | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaInscEstadual | character varying(20) | sim | nao | inteligencia/configuracao |
| Empresa | empresaLeitor | character varying(255) | sim | nao | inteligencia/configuracao |
| Empresa | empresaLogomarca | character varying(100) | sim | nao | inteligencia/configuracao |
| Empresa | empresaMultaDias | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaNomeFantasia | character varying(50) | sim | nao | inteligencia/configuracao |
| Empresa | empresaNumeroCadastro | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaPais | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaRazaoSocial | character varying(50) | sim | nao | inteligencia/configuracao |
| Empresa | empresaReavaliacaoDias | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaReavaliacaoUsar | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaRecorrenteAcesso | character varying(200) | sim | nao | inteligencia/configuracao |
| Empresa | empresaRecorrenteNro | character varying(40) | sim | nao | inteligencia/configuracao |
| Empresa | empresaRecorrenteSituacao | character varying(1) | sim | nao | inteligencia/configuracao |
| Empresa | empresaRegistro | character varying(255) | sim | nao | inteligencia/configuracao |
| Empresa | empresaSite | character varying(100) | sim | nao | inteligencia/configuracao |
| Empresa | empresaSuporte | double precision | sim | nao | inteligencia/configuracao |
| Empresa | empresaTela | character varying(1) | sim | nao | inteligencia/configuracao |
| Empresa | empresaTelefone | character varying(15) | sim | nao | inteligencia/configuracao |
| Empresa | empresaTipoMora | character varying(20) | sim | nao | inteligencia/configuracao |
| Empresa | empresaTipoMulta | character varying(20) | sim | nao | inteligencia/configuracao |
| Empresa | empresaValorMora | numeric(19,4) | sim | nao | inteligencia/configuracao |
| Empresa | empresaValorMulta | numeric(19,4) | sim | nao | inteligencia/configuracao |
| Empresa | empresaVincularTurma | double precision | sim | nao | inteligencia/configuracao |
| Exercicios | exercicioAnimacao | double precision | sim | nao | treinamento |
| Exercicios | exercicioCodigo | double precision | sim | nao | treinamento |
| Exercicios | exercicioDescricao | text | sim | nao | treinamento |
| Exercicios | exercicioId | integer NOT NULL | nao | sim | treinamento |
| Exercicios | exercicioImagem | character varying(200) | sim | nao | treinamento |
| Exercicios | exercicioMusculos | character varying(250) | sim | nao | treinamento |
| Exercicios | exercicioNome | character varying(250) | sim | nao | treinamento |
| Exercicios | exercicioVisual | double precision | sim | nao | treinamento |
| Exercicios | exercicioYoutube | character varying(250) | sim | nao | treinamento |
| Exercicios | grupoId | double precision | sim | nao | treinamento |
| ExerciciosConfig | ContagemPorImpressaoForma | double precision | sim | nao | treinamento |
| ExerciciosConfig | ContagemSessoesForma | double precision | sim | nao | treinamento |
| ExerciciosConfig | ContinuarIncluindo | double precision | sim | nao | treinamento |
| ExerciciosConfig | ExibirAnimacao | double precision | sim | nao | treinamento |
| ExerciciosConfig | ExibirCampoDescanso | double precision | sim | nao | treinamento |
| ExerciciosConfig | Ficha01Config | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha02Config | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha03Config | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha04Carga | double precision | sim | nao | treinamento |
| ExerciciosConfig | Ficha04Config | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha04Metodo | double precision | sim | nao | treinamento |
| ExerciciosConfig | Ficha05Config | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha05ConfigCatraca | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha05ConfigTerminal | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha06Config | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha06ConfigCatraca | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha06ConfigTerminal | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha07Config | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha07ConfigCatraca | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | Ficha07ConfigTerminal | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | FichaCarga | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | FichaCatraca1Treino | character varying(1) | sim | nao | treinamento |
| ExerciciosConfig | FichaCatracaModelo | character varying(1) | sim | nao | treinamento |
| ExerciciosConfig | FichaDescanso | double precision | sim | nao | treinamento |
| ExerciciosConfig | FichaExluir | double precision | sim | nao | treinamento |
| ExerciciosConfig | FichaRepeticoes | character varying(250) | sim | nao | treinamento |
| ExerciciosConfig | FichaSeries | double precision | sim | nao | treinamento |
| ExerciciosConfig | ImpressaoFicha | double precision | sim | nao | treinamento |
| ExerciciosConfig | mostrarFicha | double precision | sim | nao | treinamento |
| ExerciciosFichas | exercicioID | double precision | sim | nao | treinamento |
| ExerciciosFichas | fichaNumero | double precision | sim | nao | treinamento |
| ExerciciosFichas | serieCargas | character varying(100) | sim | nao | treinamento |
| ExerciciosFichas | serieDescanso | double precision | sim | nao | treinamento |
| ExerciciosFichas | serieID | integer NOT NULL | nao | nao | treinamento |
| ExerciciosFichas | serieMetodo | double precision | sim | nao | treinamento |
| ExerciciosFichas | serieOrdem | double precision | sim | nao | treinamento |
| ExerciciosFichas | serieRepeticoes | character varying(100) | sim | nao | treinamento |
| ExerciciosFichas | serieSeries | double precision | sim | nao | treinamento |
| ExerciciosFichas | treinoId | double precision | sim | nao | treinamento |
| ExerciciosGrupos | grupoId | integer NOT NULL | nao | sim | treinamento |
| ExerciciosGrupos | grupoNome | character varying(200) | sim | nao | treinamento |
| ExerciciosHistorico | Data | timestamp without time zone | sim | nao | treinamento |
| ExerciciosHistorico | fichaNumero | double precision | sim | nao | treinamento |
| ExerciciosHistorico | Hora | character varying(5) | sim | nao | treinamento |
| ExerciciosHistorico | ID | integer NOT NULL | nao | nao | treinamento |
| ExerciciosHistorico | treinoID | double precision | sim | nao | treinamento |
| ExerciciosObjetivos | objetivoDescricao | character varying(200) | sim | nao | treinamento |
| ExerciciosObjetivos | objetivoId | integer NOT NULL | nao | sim | treinamento |
| ExerciciosTreinos | alunoID | double precision | sim | nao | treinamento |
| ExerciciosTreinos | fichaPadraoNome | character varying(250) | sim | nao | treinamento |
| ExerciciosTreinos | objetivoID | double precision | sim | nao | treinamento |
| ExerciciosTreinos | professorID | double precision | sim | nao | treinamento |
| ExerciciosTreinos | treinoAtivo | double precision | sim | nao | treinamento |
| ExerciciosTreinos | treinoDataInicio | timestamp without time zone | sim | nao | treinamento |
| ExerciciosTreinos | treinoDataMudanca | timestamp without time zone | sim | nao | treinamento |
| ExerciciosTreinos | treinoFichas | double precision | sim | nao | treinamento |
| ExerciciosTreinos | treinoId | integer NOT NULL | nao | sim | treinamento |
| ExerciciosTreinos | treinoNumero | double precision | sim | nao | treinamento |
| ExerciciosTreinos | treinoObs | text | sim | nao | treinamento |
| ExerciciosTreinos | treinoSessoes | double precision | sim | nao | treinamento |
| ExerciciosTreinos | treinoSessoesRealizadas | double precision | sim | nao | treinamento |
| FormasPagamento | formaDesativado | boolean NOT NULL | nao | nao | financeiro |
| FormasPagamento | formaDescricao | character varying(100) | sim | nao | financeiro |
| FormasPagamento | formaID | integer NOT NULL | nao | sim | financeiro |
| Fornecedores | fornBairro | character varying(30) | sim | nao | comercial/estoque |
| Fornecedores | fornCEP | character varying(10) | sim | nao | comercial/estoque |
| Fornecedores | fornCidade | character varying(50) | sim | nao | comercial/estoque |
| Fornecedores | fornCNPJ | character varying(18) | sim | nao | comercial/estoque |
| Fornecedores | fornContato | character varying(50) | sim | nao | comercial/estoque |
| Fornecedores | fornEmail | character varying(255) | sim | nao | comercial/estoque |
| Fornecedores | fornEndereco | character varying(70) | sim | nao | comercial/estoque |
| Fornecedores | fornEstado | character varying(2) | sim | nao | comercial/estoque |
| Fornecedores | fornExcluido | boolean NOT NULL | nao | nao | comercial/estoque |
| Fornecedores | fornFax | character varying(15) | sim | nao | comercial/estoque |
| Fornecedores | fornID | integer NOT NULL | nao | sim | comercial/estoque |
| Fornecedores | fornIE | character varying(20) | sim | nao | comercial/estoque |
| Fornecedores | fornNomeFantasia | character varying(50) | sim | nao | comercial/estoque |
| Fornecedores | fornRazaoSocial | character varying(50) | sim | nao | comercial/estoque |
| Fornecedores | fornSite | character varying(255) | sim | nao | comercial/estoque |
| Fornecedores | fornTelefone | character varying(15) | sim | nao | comercial/estoque |
| Fotos | fotoCaminho | character varying(255) | sim | nao | pendente |
| Fotos | fotoData | timestamp without time zone | sim | nao | pendente |
| Fotos | fotoID | integer NOT NULL | nao | sim | pendente |
| Fotos | fotoIDRelaciona | integer | sim | nao | pendente |
| Fotos | fotoTipo | integer | sim | nao | pendente |
| Frequencia | bloqueado | character varying(1) | sim | nao | academico |
| Frequencia | data | timestamp without time zone | sim | nao | academico |
| Frequencia | especie | integer | sim | nao | academico |
| Frequencia | hora | timestamp without time zone | sim | nao | academico |
| Frequencia | Id | integer NOT NULL | nao | sim | academico |
| Frequencia | idRelaciona | integer | sim | nao | academico |
| Frequencia | tipo | character varying(1) | sim | nao | academico |
| Funcionarios | funcAcesso | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Funcionarios | funcAdmissao | timestamp without time zone | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcaoID | double precision | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcBairro | character varying(30) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcCartao | character varying(20) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcCelular | character varying(15) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcCEP | character varying(10) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcCidade | character varying(50) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcCPF | character varying(14) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcCREF | character varying(50) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcDataNascimento | timestamp without time zone | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcDemissao | timestamp without time zone | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcDigitosCelular | double precision | sim | nao | cadastros/professores ou iam |
| Funcionarios | FuncEmail | character varying(100) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcEndereco | character varying(70) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcEstado | character varying(2) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcExcluido | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Funcionarios | funcID | integer NOT NULL | nao | sim | cadastros/professores ou iam |
| Funcionarios | funcIdentidade | character varying(20) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcNome | character varying(50) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcObs | text | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcPAlunos | character varying(250) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcPCaixa | character varying(250) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcPConfig | character varying(250) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcPContasR | character varying(250) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcPFrequencia | character varying(250) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcPMatriculas | character varying(250) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcPPesquisa | character varying(250) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcPRelatorios | character varying(250) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcProfessor | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Funcionarios | funcPSCAADM | character varying(250) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcPTreinos | character varying(250) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcSalarioFixo | numeric(19,4) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcSenha | character varying(100) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcSexo | integer | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcSituacao | character varying(20) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcTelefone | character varying(15) | sim | nao | cadastros/professores ou iam |
| Funcionarios | funcTemCartao | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Funcionarios | FuncUFIdentidade | character varying(2) | sim | nao | cadastros/professores ou iam |
| FuncionariosFuncoes | funcaoDescricao | character varying(50) | sim | nao | cadastros/professores ou iam |
| FuncionariosFuncoes | funcaoID | integer NOT NULL | nao | nao | cadastros/professores ou iam |
| Horarios | horarioDia | integer | sim | nao | academico |
| Horarios | horarioE | timestamp without time zone | sim | nao | academico |
| Horarios | horarioID | integer NOT NULL | nao | sim | academico |
| Horarios | horarioLocal | integer | sim | nao | academico |
| Horarios | horarioS | timestamp without time zone | sim | nao | academico |
| Horarios | horarioTipo | integer | sim | nao | academico |
| Horarios | idRelaciona | integer | sim | nao | academico |
| Locais | localAtivo | boolean NOT NULL | nao | nao | pendente |
| Locais | localExcluido | boolean NOT NULL | nao | nao | pendente |
| Locais | localID | integer NOT NULL | nao | sim | pendente |
| Locais | localNome | character varying(50) | sim | nao | pendente |
| LogsAcesso | funcID | integer | sim | nao | acesso |
| LogsAcesso | logDataHora | timestamp without time zone | sim | nao | acesso |
| LogsAcesso | logID | integer NOT NULL | nao | sim | acesso |
| LogsAcesso | logInfo | character varying(100) | sim | nao | acesso |
| LogsAcesso | microID | character varying(20) | sim | nao | acesso |
| Matricula | alunoID | integer | sim | nao | academico/matriculas |
| Matricula | descontoID | integer | sim | nao | academico/matriculas |
| Matricula | matriculaAulas | double precision | sim | nao | academico/matriculas |
| Matricula | matriculaDesconto | numeric(19,4) | sim | nao | academico/matriculas |
| Matricula | matriculaDiasTrancamento | double precision | sim | nao | academico/matriculas |
| Matricula | matriculaDiaVencimento | integer | sim | nao | academico/matriculas |
| Matricula | matriculaDtBloqueio | timestamp without time zone | sim | nao | academico/matriculas |
| Matricula | matriculaDtEncerramento | timestamp without time zone | sim | nao | academico/matriculas |
| Matricula | matriculaDtFim | timestamp without time zone | sim | nao | academico/matriculas |
| Matricula | matriculaDtInicio | timestamp without time zone | sim | nao | academico/matriculas |
| Matricula | matriculaDtInicioGeral | timestamp without time zone | sim | nao | academico/matriculas |
| Matricula | matriculaDtTrancamento | timestamp without time zone | sim | nao | academico/matriculas |
| Matricula | matriculaExcluida | boolean NOT NULL | nao | nao | academico/matriculas |
| Matricula | matriculaForma | character varying(50) | sim | nao | academico/matriculas |
| Matricula | matriculaID | integer NOT NULL | nao | sim | academico/matriculas |
| Matricula | matriculaMotivoBloqueio | character varying(255) | sim | nao | academico/matriculas |
| Matricula | matriculaMotivoEncerramento | character varying(255) | sim | nao | academico/matriculas |
| Matricula | matriculaMotivoTrancamento | character varying(255) | sim | nao | academico/matriculas |
| Matricula | matriculaNumero | integer | sim | nao | academico/matriculas |
| Matricula | matriculaRecorrente | character varying(1) | sim | nao | academico/matriculas |
| Matricula | matriculaSituacao | character varying(20) | sim | nao | academico/matriculas |
| Matricula | matriculaValor | numeric(19,4) | sim | nao | academico/matriculas |
| Matricula | matriculaValorAula | numeric(19,4) | sim | nao | academico/matriculas |
| Matricula | modalidadeID | integer | sim | nao | academico/matriculas |
| Matricula | RecorrenteForma | double precision | sim | nao | academico/matriculas |
| Matricula | RecorrenteSeguranca | character varying(20) | sim | nao | academico/matriculas |
| Matricula | RecorrenteToken | character varying(200) | sim | nao | academico/matriculas |
| Matricula | RecorrenteTruncado | character varying(200) | sim | nao | academico/matriculas |
| Matricula | RecorrenteValidade | timestamp without time zone | sim | nao | academico/matriculas |
| MatriculaAulas | aulaDataAgendamento | timestamp without time zone | sim | nao | academico/matriculas |
| MatriculaAulas | aulaHoraAgendamento | timestamp without time zone | sim | nao | academico/matriculas |
| MatriculaAulas | aulaID | integer NOT NULL | nao | nao | academico/matriculas |
| MatriculaAulas | aulaNumero | double precision | sim | nao | academico/matriculas |
| MatriculaAulas | aulaPresenca | double precision | sim | nao | academico/matriculas |
| MatriculaAulas | aulaValor | numeric(19,4) | sim | nao | academico/matriculas |
| MatriculaAulas | funcID | double precision | sim | nao | academico/matriculas |
| MatriculaAulas | matriculaID | double precision | sim | nao | academico/matriculas |
| MatriculaNaoGerar | alunoID | double precision | sim | nao | academico/matriculas |
| MatriculaNaoGerar | Ano | double precision | sim | nao | academico/matriculas |
| MatriculaNaoGerar | ID | integer NOT NULL | nao | nao | academico/matriculas |
| MatriculaNaoGerar | matriculaID | double precision | sim | nao | academico/matriculas |
| MatriculaNaoGerar | Mes | double precision | sim | nao | academico/matriculas |
| MatriculaRenovacoes | DataFim | timestamp without time zone | sim | nao | academico/matriculas |
| MatriculaRenovacoes | DataFimAnterior | timestamp without time zone | sim | nao | academico/matriculas |
| MatriculaRenovacoes | DataInicio | timestamp without time zone | sim | nao | academico/matriculas |
| MatriculaRenovacoes | DataInicioAnterior | timestamp without time zone | sim | nao | academico/matriculas |
| MatriculaRenovacoes | DataRenovacao | timestamp without time zone | sim | nao | academico/matriculas |
| MatriculaRenovacoes | Desconto | numeric(19,4) | sim | nao | academico/matriculas |
| MatriculaRenovacoes | DescontoAnterior | numeric(19,4) | sim | nao | academico/matriculas |
| MatriculaRenovacoes | ID | integer NOT NULL | nao | nao | academico/matriculas |
| MatriculaRenovacoes | matriculaID | double precision | sim | nao | academico/matriculas |
| MatriculaRenovacoes | ValorFinal | numeric(19,4) | sim | nao | academico/matriculas |
| MatriculaRenovacoes | ValorFinalAnterior | numeric(19,4) | sim | nao | academico/matriculas |
| MatriculaTrancamentos | DataDestrancamento | timestamp without time zone | sim | nao | academico/matriculas |
| MatriculaTrancamentos | DataTrancamento | timestamp without time zone | sim | nao | academico/matriculas |
| MatriculaTrancamentos | ID | integer NOT NULL | nao | nao | academico/matriculas |
| MatriculaTrancamentos | matriculaID | double precision | sim | nao | academico/matriculas |
| MatriculaTrancamentos | Motivo | character varying(255) | sim | nao | academico/matriculas |
| MatriculaTrancamentos | TrancadoPor | double precision | sim | nao | academico/matriculas |
| MatriculaTurmas | matriculaID | integer | sim | sim | academico/matriculas |
| MatriculaTurmas | turmaID | integer | sim | sim | academico/matriculas |
| Mensagens | msgAssunto | character varying(50) | sim | nao | inteligencia/configuracao |
| Mensagens | msgData | timestamp without time zone | sim | nao | inteligencia/configuracao |
| Mensagens | msgDe | integer | sim | nao | inteligencia/configuracao |
| Mensagens | msgHora | timestamp without time zone | sim | nao | inteligencia/configuracao |
| Mensagens | msgID | integer NOT NULL | nao | sim | inteligencia/configuracao |
| Mensagens | msgLido | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Mensagens | msgMensagem | text | sim | nao | inteligencia/configuracao |
| Mensagens | msgPara | integer | sim | nao | inteligencia/configuracao |
| Mensagens | msgTipo | integer | sim | nao | inteligencia/configuracao |
| Mensagens | msgTodos | boolean NOT NULL | nao | nao | inteligencia/configuracao |
| Modalidades | modalidadeAtiva | boolean NOT NULL | nao | nao | academico |
| Modalidades | modalidadeAula | numeric(19,4) | sim | nao | academico |
| Modalidades | modalidadeDias | double precision | sim | nao | academico |
| Modalidades | modalidadeExcluida | boolean NOT NULL | nao | nao | academico |
| Modalidades | modalidadeID | integer NOT NULL | nao | sim | academico |
| Modalidades | modalidadeMensal | numeric(19,4) | sim | nao | academico |
| Modalidades | modalidadeMeses | double precision | sim | nao | academico |
| Modalidades | modalidadeNome | character varying(50) | sim | nao | academico |
| Modalidades | modalidadePlano | double precision | sim | nao | academico |
| Modulos | moduloAcesso | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Modulos | moduloAlteracao | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Modulos | moduloDescricao | character varying(50) | sim | nao | cadastros/professores ou iam |
| Modulos | moduloExclusao | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Modulos | moduloID | integer NOT NULL | nao | sim | cadastros/professores ou iam |
| Modulos | moduloInclusao | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Modulos | moduloReceber | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Pagamentos | contaID | integer | sim | nao | financeiro |
| Pagamentos | idRelaciona | integer | sim | nao | financeiro |
| Pagamentos | pagamentoAuto | double precision | sim | nao | financeiro |
| Pagamentos | pagamentoCaixa | double precision | sim | nao | financeiro |
| Pagamentos | pagamentoDtVencimento | timestamp without time zone | sim | nao | financeiro |
| Pagamentos | pagamentoExcluido | boolean NOT NULL | nao | nao | financeiro |
| Pagamentos | pagamentoHistorico | character varying(255) | sim | nao | financeiro |
| Pagamentos | pagamentoID | integer NOT NULL | nao | sim | financeiro |
| Pagamentos | pagamentoObs | text | sim | nao | financeiro |
| Pagamentos | pagamentoPago | boolean NOT NULL | nao | nao | financeiro |
| Pagamentos | pagamentoValor | numeric(19,4) | sim | nao | financeiro |
| Pagamentos | planoID | integer | sim | nao | financeiro |
| PagamentosAuto | funcID | double precision | sim | nao | financeiro |
| PagamentosAuto | ID | integer NOT NULL | nao | nao | financeiro |
| PagamentosAuto | pagamentoDescricao | character varying(255) | sim | nao | financeiro |
| PagamentosAuto | pagamentoValor | numeric(19,4) | sim | nao | financeiro |
| PagamentosAuto | planoID | double precision | sim | nao | financeiro |
| PagamentosAuto | todoDia | double precision | sim | nao | financeiro |
| Permissoes | Acessar | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Permissoes | Alterar | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Permissoes | Cadastrar | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Permissoes | Excluir | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| Permissoes | funcID | integer | sim | nao | cadastros/professores ou iam |
| Permissoes | moduloID | integer | sim | nao | cadastros/professores ou iam |
| Permissoes | permissaoID | integer NOT NULL | nao | sim | cadastros/professores ou iam |
| Permissoes | Receber | boolean NOT NULL | nao | nao | cadastros/professores ou iam |
| PlanodeContas | planoAtivo | boolean NOT NULL | nao | nao | financeiro |
| PlanodeContas | planoDescricao | character varying(50) | sim | nao | financeiro |
| PlanodeContas | planoExcluido | boolean NOT NULL | nao | nao | financeiro |
| PlanodeContas | planoID | integer NOT NULL | nao | sim | financeiro |
| PlanodeContas | planoTipo | character varying(1) | sim | nao | financeiro |
| PlanodeContas | planoValor | numeric(19,4) | sim | nao | financeiro |
| Produtos | categoriaID | double precision | sim | nao | comercial/estoque |
| Produtos | fornID | integer | sim | nao | comercial/estoque |
| Produtos | produtoAtivo | boolean NOT NULL | nao | nao | comercial/estoque |
| Produtos | produtoBarras | character varying(30) | sim | nao | comercial/estoque |
| Produtos | produtoCodigo | character varying(30) | sim | nao | comercial/estoque |
| Produtos | produtoCusto | numeric(19,4) | sim | nao | comercial/estoque |
| Produtos | produtoEstoque | integer | sim | nao | comercial/estoque |
| Produtos | produtoEstoqueMin | integer | sim | nao | comercial/estoque |
| Produtos | produtoExcluido | boolean NOT NULL | nao | nao | comercial/estoque |
| Produtos | produtoID | integer NOT NULL | nao | sim | comercial/estoque |
| Produtos | produtoImagem | character varying(255) | sim | nao | comercial/estoque |
| Produtos | produtoNome | character varying(50) | sim | nao | comercial/estoque |
| Produtos | produtoObs | text | sim | nao | comercial/estoque |
| Produtos | produtoVenda | numeric(19,4) | sim | nao | comercial/estoque |
| ProdutosCategorias | categoriaAtiva | character varying(1) | sim | nao | comercial/estoque |
| ProdutosCategorias | categoriaDescricao | character varying(255) | sim | nao | comercial/estoque |
| ProdutosCategorias | categoriaExcluida | character varying(1) | sim | nao | comercial/estoque |
| ProdutosCategorias | categoriaID | integer NOT NULL | nao | nao | comercial/estoque |
| Recebimentos | alunoID | integer | sim | nao | financeiro |
| Recebimentos | contaID | integer | sim | nao | financeiro |
| Recebimentos | funcID | double precision | sim | nao | financeiro |
| Recebimentos | idRelaciona | integer | sim | nao | financeiro |
| Recebimentos | pagoRecorrente | character varying(1) | sim | nao | financeiro |
| Recebimentos | planoID | integer | sim | nao | financeiro |
| Recebimentos | RecebDesconto | numeric(19,4) | sim | nao | financeiro |
| Recebimentos | recebDtEmissao | timestamp without time zone | sim | nao | financeiro |
| Recebimentos | recebDtVencimento | timestamp without time zone | sim | nao | financeiro |
| Recebimentos | recebExcluido | boolean NOT NULL | nao | nao | financeiro |
| Recebimentos | recebFuncIdIsentou | double precision | sim | nao | financeiro |
| Recebimentos | recebHistorico | character varying(255) | sim | nao | financeiro |
| Recebimentos | recebID | integer NOT NULL | nao | sim | financeiro |
| Recebimentos | recebMulta | numeric(19,4) | sim | nao | financeiro |
| Recebimentos | recebPago | boolean NOT NULL | nao | nao | financeiro |
| Recebimentos | recebValor | numeric(19,4) | sim | nao | financeiro |
| RecebimentosBoletos | boletoExcluido | character varying(1) | sim | nao | financeiro |
| RecebimentosBoletos | NossoNumero | character varying(20) | sim | nao | financeiro |
| RecebimentosBoletos | recebID | double precision | sim | nao | financeiro |
| RecebimentosBoletos | variasContas | double precision | sim | nao | financeiro |
| RecebimentosDebitos | DebitoId | integer NOT NULL | nao | sim | financeiro |
| RecebimentosDebitos | itemID | integer NOT NULL | nao | nao | financeiro |
| RecebimentosDebitos | itemIDValorDebito | numeric(19,4) | sim | nao | financeiro |
| RecebimentosDebitos | recebID | integer NOT NULL | nao | nao | financeiro |
| RecebimentosDebitos | recebID_Debito | integer NOT NULL | nao | sim | financeiro |
| RecebimentosDebitos | reciboID | integer NOT NULL | nao | nao | financeiro |
| Recibos | CieloChamada | double precision | sim | nao | financeiro |
| Recibos | CieloRetorno | character varying(150) | sim | nao | financeiro |
| Recibos | formaID | integer | sim | nao | financeiro |
| Recibos | funcionarioID | integer | sim | nao | financeiro |
| Recibos | pagamentoID | integer | sim | nao | financeiro |
| Recibos | pagoRecorrente | character varying(1) | sim | nao | financeiro |
| Recibos | reciboCancelado | boolean NOT NULL | nao | nao | financeiro |
| Recibos | reciboData | timestamp without time zone | sim | nao | financeiro |
| Recibos | reciboDesconto | numeric(19,4) | sim | nao | financeiro |
| Recibos | reciboHistorico | character varying(255) | sim | nao | financeiro |
| Recibos | reciboHora | timestamp without time zone | sim | nao | financeiro |
| Recibos | reciboID | integer NOT NULL | nao | sim | financeiro |
| Recibos | reciboObs | character varying(255) | sim | nao | financeiro |
| Recibos | reciboValorPagar | numeric(19,4) | sim | nao | financeiro |
| Recibos | reciboValorPago | numeric(19,4) | sim | nao | financeiro |
| RecibosRecebimentos | recebID | integer NOT NULL | nao | sim | financeiro |
| RecibosRecebimentos | reciboID | integer | sim | nao | financeiro |
| Telefones | telefoneDescricao | character varying(255) | sim | nao | pendente |
| Telefones | telefoneID | integer NOT NULL | nao | nao | pendente |
| Telefones | telefoneNumero | character varying(100) | sim | nao | pendente |
| TerminalAcessos | alunoID | integer | sim | nao | acesso |
| TerminalAcessos | Data | timestamp without time zone | sim | nao | acesso |
| TerminalAcessos | ID | integer NOT NULL | nao | sim | acesso |
| TerminalConfig | CodigoSCAFit | character varying(50) | sim | nao | acesso |
| TerminalConfig | config1TreinoaoDia | double precision | sim | nao | acesso |
| TerminalConfig | configAviso | double precision | sim | nao | acesso |
| TerminalConfig | configAvisoSenha | double precision | sim | nao | acesso |
| TerminalConfig | configBotaoMSG | double precision | sim | nao | acesso |
| TerminalConfig | configBotaoMSG2 | double precision | sim | nao | acesso |
| TerminalConfig | configBotaoPgtos | double precision | sim | nao | acesso |
| TerminalConfig | configBotaTreino | double precision | sim | nao | acesso |
| TerminalConfig | configBotaTreino2 | double precision | sim | nao | acesso |
| TerminalConfig | configConsulta | character varying(1) | sim | nao | acesso |
| TerminalConfig | configConsultaMatricula | double precision | sim | nao | acesso |
| TerminalConfig | configDigitalFaz | double precision | sim | nao | acesso |
| TerminalConfig | configEnquete | integer | sim | nao | acesso |
| TerminalConfig | configFormaImpressao | double precision | sim | nao | acesso |
| TerminalConfig | configFundo | double precision | sim | nao | acesso |
| TerminalConfig | configFundoImagem | character varying(100) | sim | nao | acesso |
| TerminalConfig | configID | integer NOT NULL | nao | sim | acesso |
| TerminalConfig | configImpressora | double precision | sim | nao | acesso |
| TerminalConfig | configSenha | character varying(50) | sim | nao | acesso |
| TerminalConfig | configTrava | character varying(1) | sim | nao | acesso |
| TerminalConfig | contarSessoesApp | boolean NOT NULL | nao | nao | acesso |
| TerminalConfig | DataAtualizacaoTerminal | timestamp without time zone | sim | nao | acesso |
| TerminalConfig | EnvioAutomatico | double precision | sim | nao | acesso |
| TerminalConfig | EnvioAutomaticoData | timestamp without time zone | sim | nao | acesso |
| TerminalConfig | EnvioAutomaticoHora | timestamp without time zone | sim | nao | acesso |
| TerminalConfig | facialData | timestamp without time zone | sim | nao | acesso |
| TerminalConfig | Hora1 | timestamp without time zone | sim | nao | acesso |
| TerminalConfig | Hora2 | timestamp without time zone | sim | nao | acesso |
| TerminalConfig | HoraAtualizacaoTerminal | timestamp without time zone | sim | nao | acesso |
| TerminalConfig | qrCodeData | timestamp without time zone | sim | nao | acesso |
| TerminalEnquete | enqueteID | integer NOT NULL | nao | sim | acesso |
| TerminalEnquete | enqueteOpcao1 | character varying(70) | sim | nao | acesso |
| TerminalEnquete | enqueteOpcao2 | character varying(70) | sim | nao | acesso |
| TerminalEnquete | enqueteOpcao3 | character varying(70) | sim | nao | acesso |
| TerminalEnquete | enqueteOpcao4 | character varying(70) | sim | nao | acesso |
| TerminalEnquete | enquetePergunta | character varying(70) | sim | nao | acesso |
| TerminalEnqueteVotos | alunoID | integer | sim | nao | acesso |
| TerminalEnqueteVotos | enqueteID | integer | sim | nao | acesso |
| TerminalEnqueteVotos | ID | integer NOT NULL | nao | sim | acesso |
| TerminalEnqueteVotos | Opcao | integer | sim | nao | acesso |
| TerminalNoticias | noticiaID | integer NOT NULL | nao | sim | acesso |
| TerminalNoticias | noticiaMsg | character varying(250) | sim | nao | acesso |
| tmpAnalise | Data | character varying(50) | sim | nao | tecnica/temporaria |
| tmpAnalise | Despesas | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpAnalise | Receitas | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpAnalise | SaldoAcumulado | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpAnalise | SaldoDia | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpAnalise | SaldoInicial | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpAvisos | avisoID | integer NOT NULL | nao | nao | tecnica/temporaria |
| tmpAvisos | DataFim | timestamp without time zone | sim | nao | tecnica/temporaria |
| tmpAvisos | dataInicio | timestamp without time zone | sim | nao | tecnica/temporaria |
| tmpAvisos | destaque | boolean NOT NULL | nao | nao | tecnica/temporaria |
| tmpAvisos | HoraFim | timestamp without time zone | sim | nao | tecnica/temporaria |
| tmpAvisos | HoraInicio | timestamp without time zone | sim | nao | tecnica/temporaria |
| tmpAvisos | imagem | character varying(250) | sim | nao | tecnica/temporaria |
| tmpAvisos | importante | boolean NOT NULL | nao | nao | tecnica/temporaria |
| tmpAvisos | link | character varying(250) | sim | nao | tecnica/temporaria |
| tmpAvisos | mensagem | character varying(250) NOT NULL | nao | nao | tecnica/temporaria |
| tmpAvisos | microID | character varying(8) NOT NULL | nao | nao | tecnica/temporaria |
| tmpAvisos | temp | integer NOT NULL | nao | nao | tecnica/temporaria |
| tmpAvisos | titulo | character varying(250) NOT NULL | nao | nao | tecnica/temporaria |
| tmpBina | telefone | character varying(20) | sim | nao | tecnica/temporaria |
| tmpBina | tipo | character varying(10) | sim | nao | tecnica/temporaria |
| tmpBoletos | DataOcorrencia | timestamp without time zone | sim | nao | tecnica/temporaria |
| tmpBoletos | NossoNumero | character varying(20) | sim | nao | tecnica/temporaria |
| tmpBoletos | ValorDesconto | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpBoletos | ValorJurosPago | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpBoletos | ValorMultaPaga | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpBoletos | ValorOutrosAcrescimos | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpBoletos | ValorPago | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpBoletosGerar | microID | character varying(20) | sim | nao | tecnica/temporaria |
| tmpBoletosGerar | recebID | double precision | sim | nao | tecnica/temporaria |
| tmpCartaoParcelas | cartaoID | double precision | sim | nao | tecnica/temporaria |
| tmpCartaoParcelas | Id | integer NOT NULL | nao | nao | tecnica/temporaria |
| tmpCartaoParcelas | microID | character varying(10) | sim | nao | tecnica/temporaria |
| tmpCartaoParcelas | parcelaData | timestamp without time zone | sim | nao | tecnica/temporaria |
| tmpCartaoParcelas | parcelaNumero | double precision | sim | nao | tecnica/temporaria |
| tmpCartaoParcelas | parcelaValor | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpCatracaComando | catracaComando | character varying(1) | sim | nao | tecnica/temporaria |
| tmpCheques | chequeAgencia | character varying(10) | sim | nao | tecnica/temporaria |
| tmpCheques | chequeBanco | integer | sim | nao | tecnica/temporaria |
| tmpCheques | chequeBomPara | timestamp without time zone | sim | nao | tecnica/temporaria |
| tmpCheques | chequeConta | character varying(10) | sim | nao | tecnica/temporaria |
| tmpCheques | chequeID | integer NOT NULL | nao | sim | tecnica/temporaria |
| tmpCheques | chequeNumero | character varying(10) | sim | nao | tecnica/temporaria |
| tmpCheques | chequeValor | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpCheques | microID | character varying(15) | sim | nao | tecnica/temporaria |
| tmpCheques2 | chequeBomPara | timestamp without time zone | sim | nao | tecnica/temporaria |
| tmpCheques2 | chequeID | integer NOT NULL | nao | sim | tecnica/temporaria |
| tmpCheques2 | chequeNumero | character varying(10) | sim | nao | tecnica/temporaria |
| tmpCheques2 | chequeValor | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpCheques2 | contaID | integer | sim | nao | tecnica/temporaria |
| tmpCheques2 | microID | character varying(15) | sim | nao | tecnica/temporaria |
| tmpHorarios | horarioDia | integer | sim | nao | tecnica/temporaria |
| tmpHorarios | horarioE | timestamp without time zone | sim | nao | tecnica/temporaria |
| tmpHorarios | horarioID | integer NOT NULL | nao | sim | tecnica/temporaria |
| tmpHorarios | horarioLocal | integer | sim | nao | tecnica/temporaria |
| tmpHorarios | horarioS | timestamp without time zone | sim | nao | tecnica/temporaria |
| tmpHorarios | horarioTipo | integer | sim | nao | tecnica/temporaria |
| tmpHorarios | microID | character varying(15) | sim | nao | tecnica/temporaria |
| tmpPermissoes | Acessar | boolean NOT NULL | nao | nao | tecnica/temporaria |
| tmpPermissoes | Alterar | boolean NOT NULL | nao | nao | tecnica/temporaria |
| tmpPermissoes | Cadastrar | boolean NOT NULL | nao | nao | tecnica/temporaria |
| tmpPermissoes | Excluir | boolean NOT NULL | nao | nao | tecnica/temporaria |
| tmpPermissoes | MicroID | character varying(14) | sim | nao | tecnica/temporaria |
| tmpPermissoes | moduloID | integer | sim | nao | tecnica/temporaria |
| tmpPermissoes | permissaoID | integer NOT NULL | nao | sim | tecnica/temporaria |
| tmpPermissoes | Receber | boolean NOT NULL | nao | nao | tecnica/temporaria |
| tmpPlanodeContas | DebitoRecibo | double precision | sim | nao | tecnica/temporaria |
| tmpPlanodeContas | MatriculaID | double precision | sim | nao | tecnica/temporaria |
| tmpPlanodeContas | PlanoID | double precision | sim | nao | tecnica/temporaria |
| tmpPlanodeContas | Valor | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpPlanodeContas2 | microID | character varying(50) | sim | nao | tecnica/temporaria |
| tmpPlanodeContas2 | PlanodeConta | character varying(255) | sim | nao | tecnica/temporaria |
| tmpPlanodeContas2 | PlanoID | double precision | sim | nao | tecnica/temporaria |
| tmpPlanodeContas2 | PlanoTipo | character varying(2) | sim | nao | tecnica/temporaria |
| tmpPlanodeContas2 | Qtde | double precision | sim | nao | tecnica/temporaria |
| tmpPlanodeContas2 | Total | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpSelecionados | Codigo | double precision | sim | nao | tecnica/temporaria |
| tmpSelecionados | microID | character varying(8) | sim | nao | tecnica/temporaria |
| tmpSelecionados | Tipo | double precision | sim | nao | tecnica/temporaria |
| tmpTurmasModalidades | microID | character varying(15) | sim | nao | tecnica/temporaria |
| tmpTurmasModalidades | modalidadeID | double precision | sim | nao | tecnica/temporaria |
| tmpTurmasProfessores | funcionarioID | integer | sim | nao | tecnica/temporaria |
| tmpTurmasProfessores | microID | character varying(15) | sim | nao | tecnica/temporaria |
| tmpTurmasProfessores | turmaID | integer | sim | nao | tecnica/temporaria |
| tmpVendasItens | microID | character varying(50) | sim | nao | tecnica/temporaria |
| tmpVendasItens | produtoID | integer | sim | nao | tecnica/temporaria |
| tmpVendasItens | produtoItem | integer | sim | nao | tecnica/temporaria |
| tmpVendasItens | produtoPreco | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpVendasItens | produtoPrecoCusto | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpVendasItens | produtoQtde | integer | sim | nao | tecnica/temporaria |
| tmpVendasItens | produtoTotal | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpVendasParcelas | microID | character varying(50) | sim | nao | tecnica/temporaria |
| tmpVendasParcelas | parcela | double precision | sim | nao | tecnica/temporaria |
| tmpVendasParcelas | valor | numeric(19,4) | sim | nao | tecnica/temporaria |
| tmpVendasParcelas | vencimento | timestamp without time zone | sim | nao | tecnica/temporaria |
| Turmas | localID | integer | sim | nao | academico |
| Turmas | modalidadeID | integer | sim | nao | academico |
| Turmas | turmaAtiva | boolean NOT NULL | nao | nao | academico |
| Turmas | turmaExcluida | boolean NOT NULL | nao | nao | academico |
| Turmas | turmaID | integer NOT NULL | nao | sim | academico |
| Turmas | turmaMaxAlunos | integer | sim | nao | academico |
| Turmas | turmaMensalidade | numeric(19,4) | sim | nao | academico |
| Turmas | turmaNome | character varying(50) | sim | nao | academico |
| Turmas | turmaObs | text | sim | nao | academico |
| Turmas | turmaSexo | character varying(10) | sim | nao | academico |
| TurmasModalidades | modalidadeID | double precision | sim | nao | academico |
| TurmasModalidades | turmaID | double precision | sim | nao | academico |
| TurmasProfessores | funcionarioID | integer | sim | sim | academico |
| TurmasProfessores | turmaID | integer | sim | sim | academico |
| Vendas | funcID | double precision | sim | nao | comercial/estoque |
| Vendas | funcVendedor | double precision | sim | nao | comercial/estoque |
| Vendas | vendaData | timestamp without time zone | sim | nao | comercial/estoque |
| Vendas | vendaHora | timestamp without time zone | sim | nao | comercial/estoque |
| Vendas | vendaID | integer NOT NULL | nao | sim | comercial/estoque |
| Vendas | vendaIDRelaciona | integer | sim | nao | comercial/estoque |
| Vendas | vendaValor | numeric(19,4) | sim | nao | comercial/estoque |
| VendasItens | itemID | integer NOT NULL | nao | sim | comercial/estoque |
| VendasItens | produtoDesconto | numeric(19,4) | sim | nao | comercial/estoque |
| VendasItens | produtoID | integer | sim | nao | comercial/estoque |
| VendasItens | produtoItem | integer | sim | nao | comercial/estoque |
| VendasItens | produtoPreco | numeric(19,4) | sim | nao | comercial/estoque |
| VendasItens | produtoPrecoCusto | numeric(19,4) | sim | nao | comercial/estoque |
| VendasItens | produtoQtde | integer | sim | nao | comercial/estoque |
| VendasItens | produtoTotal | numeric(19,4) | sim | nao | comercial/estoque |
| VendasItens | vendaID | integer | sim | nao | comercial/estoque |
| VisaoGeralConfig | Item | character varying(30) | sim | nao | inteligencia/configuracao |
| VisaoGeralConfig | itemId | integer NOT NULL | nao | nao | inteligencia/configuracao |
| VisaoGeralConfig | ItemPosicao | double precision | sim | nao | inteligencia/configuracao |
| VisaoGeralConfig | Mostrar | character varying(1) | sim | nao | inteligencia/configuracao |
| Visitantes | funcId | double precision | sim | nao | pendente |
| Visitantes | visitanteAluno | double precision | sim | nao | pendente |
| Visitantes | visitanteBairro | character varying(30) | sim | nao | pendente |
| Visitantes | visitanteCelular | character varying(15) | sim | nao | pendente |
| Visitantes | visitanteCEP | character varying(10) | sim | nao | pendente |
| Visitantes | visitanteCidade | character varying(50) | sim | nao | pendente |
| Visitantes | visitanteDigitosCelular | double precision | sim | nao | pendente |
| Visitantes | visitanteDtMatricula | timestamp without time zone | sim | nao | pendente |
| Visitantes | visitanteDtVisita | timestamp without time zone | sim | nao | pendente |
| Visitantes | visitanteEmail | character varying(250) | sim | nao | pendente |
| Visitantes | visitanteEndereco | character varying(70) | sim | nao | pendente |
| Visitantes | visitanteEstado | character varying(2) | sim | nao | pendente |
| Visitantes | visitanteID | integer NOT NULL | nao | sim | pendente |
| Visitantes | visitanteNascimento | timestamp without time zone | sim | nao | pendente |
| Visitantes | visitanteNome | character varying(50) | sim | nao | pendente |
| Visitantes | visitanteObs | text | sim | nao | pendente |
| Visitantes | visitanteSexo | integer | sim | nao | pendente |
| Visitantes | visitanteTelefone | character varying(15) | sim | nao | pendente |

