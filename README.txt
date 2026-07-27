Correção do status no Portal do Aluno

Problema corrigido:
- o portal usava statusMatricula do cadastro do aluno para decidir se o próprio aluno estava inativo;
- isso fazia aluno ativo aparecer como inativo, ocultava a mensalidade e deixava a tela divergente da catraca.

Nova regra:
- status do aluno é avaliado somente pelos campos do cadastro do aluno;
- status da matrícula é avaliado somente pelos campos da matrícula;
- cobrança futura aparece apenas quando ambos estão ativos;
- matrícula inativa não é usada como fallback.

Aplicação:
Substitua public/assets/js/aluno-portal-status-fix.js, faça deploy e use Ctrl+F5.
