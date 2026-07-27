Fusion ERP — correção de cobrança exibida para aluno/matrícula inativa

Causa:
O portal do aluno buscava mensalidades futuras sem validar primeiro se o aluno e a matrícula estavam ativos.
Além disso, carregarMatriculaAluno usava a primeira matrícula encontrada como fallback, mesmo quando estava inativa.

Correção:
- considera somente matrícula ativa;
- não exibe próxima mensalidade quando aluno ou matrícula estiver inativo;
- mostra "Sem cobrança ativa";
- mantém o bloqueio da catraca;
- preserva mensalidades históricas no financeiro, apenas deixa de apresentá-las como próxima cobrança ativa.

Arquivos:
- public/assets/js/aluno-portal-status-fix.js
- public/pages/aluno-treinos/index.html
