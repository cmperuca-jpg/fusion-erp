# Manual de Uso — Fusion ERP Local

Base: Fusion ERP 2.6.1-e congelada para piloto.

Endereço padrão do sistema local:
http://localhost:3000

Caso seu servidor use outra porta, mantenha o mesmo caminho da página e troque apenas a porta.

## 1. Inicialização

Abra o terminal na raiz do ERP e execute:

```bash
npm start
```

ou, em modo desenvolvimento:

```bash
npm run dev
```

Depois acesse:

http://localhost:3000

## 2. Links principais

Login:
http://localhost:3000/pages/login/index.html

Dashboard:
http://localhost:3000/pages/dashboard/index.html

Alunos:
http://localhost:3000/pages/alunos/index.html

Matrículas:
http://localhost:3000/pages/matriculas/index.html

Financeiro:
http://localhost:3000/pages/financeiro/index.html

Check-in:
http://localhost:3000/pages/checkin/index.html

Treinos:
http://localhost:3000/pages/treinos/index.html

Painel do Professor:
http://localhost:3000/pages/professor-painel/index.html

Portal do Aluno:
http://localhost:3000/pages/portal-aluno/index.html

## 3. Fluxo recomendado de teste em sistema virgem

Use esta ordem para testar a usabilidade do ERP do zero:

1. Login
2. Cadastro de planos
3. Cadastro de turmas, caso a página esteja ativa na sua base
4. Cadastro de professores
5. Cadastro de alunos
6. Matrícula do aluno
7. Geração financeira da matrícula
8. Consulta no financeiro
9. Baixa ou recebimento
10. Check-in do aluno
11. Montagem de treino
12. Execução ou acompanhamento do treino
13. Consulta dos dashboards
14. Revisão de relatórios

## 4. Alunos

Objetivo:
Cadastrar, consultar, editar e validar dados dos alunos.

Teste mínimo:
- criar um aluno novo;
- salvar;
- consultar na listagem;
- abrir novamente o cadastro;
- verificar se os dados persistiram.

## 5. Professores

Objetivo:
Cadastrar professores que serão usados nos módulos operacionais.

Teste mínimo:
- criar professor;
- validar se ele aparece nas telas que dependem de professor;
- editar e salvar novamente.

## 6. Planos

Objetivo:
Criar os planos comerciais usados nas matrículas.

Teste mínimo:
- criar plano mensal;
- criar plano com taxa de matrícula;
- validar valor mensal;
- validar status ativo.

## 7. Matrículas

Objetivo:
Vincular aluno, plano, modalidade, turma e financeiro inicial.

Teste mínimo:
- selecionar aluno;
- selecionar plano;
- concluir matrícula;
- verificar se a matrícula aparece como ativa;
- confirmar se o financeiro foi criado.

## 8. Financeiro

Objetivo:
Validar contas a receber, mensalidades, recebimentos, pagamentos e caixa.

Teste mínimo:
- abrir financeiro após matrícula;
- verificar lançamento criado;
- executar baixa;
- confirmar mudança de status;
- validar caixa/recebimento, se disponível.

## 9. Check-in

Objetivo:
Registrar entrada do aluno e validar frequência.

Teste mínimo:
- localizar aluno ativo;
- registrar check-in;
- verificar se a frequência foi salva;
- testar aluno sem matrícula ativa, se aplicável.

## 10. Treinos

Objetivo:
Montar e acompanhar treino do aluno.

Teste mínimo:
- selecionar aluno;
- criar ficha de treino;
- adicionar exercícios;
- salvar;
- consultar ficha;
- executar treino, se o módulo operacional estiver ativo.

## 11. Painel do Professor

Objetivo:
Acompanhar alunos, treinos, check-ins e execução operacional.

Teste mínimo:
- abrir painel;
- verificar alunos vinculados;
- consultar treinos;
- validar se dados criados nos módulos anteriores aparecem corretamente.

## 12. Portal do Aluno

Objetivo:
Validar visão do aluno.

Teste mínimo:
- acessar portal;
- localizar dados do aluno;
- consultar treino, matrícula ou status, conforme disponível;
- validar se a página carrega sem erro.

## 13. Relatórios e dashboards

Objetivo:
Conferir visão geral da operação.

Teste mínimo:
- acessar dashboard;
- verificar indicadores;
- confirmar se números mudam após cadastros, matrículas e recebimentos.

## 14. Reset para sistema virgem

O pacote inclui o script:

```bash
npm run reset:virgem
```

Ele faz backup automático antes de apagar os dados.

Backup gerado em:

```txt
backups/reset-sistema-virgem-<data>
```

Relatório do reset:

```txt
logs/reset-sistema-virgem.json
```

## 15. Observação operacional

Depois do reset, os arquivos JSON operacionais ficam vazios. Isso é esperado.

A primeira usabilidade deve começar criando novamente:
- planos;
- professores;
- alunos;
- matrículas;
- financeiro;
- treinos.
