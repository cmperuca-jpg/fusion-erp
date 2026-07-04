# Fusion ERP v2 - Etapa 5.6

Correção do cadastro de matrícula.

## Alteração principal

Foi criado o arquivo:

- `public/js/matriculas/cadastro.js`

A página `public/pages/matriculas/cadastro.html` já apontava para esse caminho, mas o arquivo JavaScript não estava presente ou estava incompatível.

## Corrige

- erro `dataInicio is not defined`;
- carregamento de alunos, turmas, planos e matrículas;
- cálculo de valor mensal, taxa, desconto e valor inicial;
- fluxo sugestivo quando o aluno já possui matrícula ativa;
- envio correto para `/api/matriculas/integrar`;
- troca de plano via `/api/matriculas/trocar-plano` quando já existe matrícula ativa.
