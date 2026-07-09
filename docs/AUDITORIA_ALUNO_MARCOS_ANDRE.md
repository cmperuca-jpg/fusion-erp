# Auditoria funcional — aluno Marcos Andre

Aluno auditado: **marcos andre**  
CPF: **10020030000**  
Telefone/WhatsApp: **82988450407**

## Situação encontrada

- O aluno existe e está ativo em `data/alunos.json`.
- O plano está vinculado ao aluno: **MUSCULAÇÃO**, valor mensal **R$ 65,00**.
- A avaliação física existe e está vinculada ao aluno e ao professor **MARCOS ANDRE DE SOUZA**.
- O treino prescrito existe e está vinculado ao aluno e ao mesmo professor.
- O financeiro tinha cobrança ativa correta, mas também havia registros duplicados de uma matrícula encerrada.
- O check-in apontava para a matrícula encerrada, não para a matrícula ativa oficial.

## Correções aplicadas

1. Padronizado o cadastro do aluno com modalidade **MUSCULAÇÃO**.
2. Padronizado o professor responsável no aluno usando `professorId`, `professorNome`, `professor`, `professor_id` e `professor_nome`.
3. Mantida como matrícula oficial ativa: **MAT-202607-000001**.
4. Matrícula duplicada **MAT-202607-000002** mantida como histórico encerrado.
5. Mensalidades da matrícula duplicada marcadas como canceladas.
6. Lançamentos financeiros da matrícula duplicada marcados como cancelados.
7. Check-in corrigido para usar a matrícula ativa oficial.

## Fluxo esperado após o patch

Aluno → Plano → Modalidade → Professor → Matrícula → Mensalidade → Check-in → Avaliação → Treino.

## Páginas para testar

- `/pages/alunos/index.html`
- `/pages/alunos/ficha.html`
- `/pages/matriculas/index.html`
- `/pages/mensalidades/index.html`
- `/pages/financeiro/index.html`
- `/pages/checkin/index.html`
- `/pages/avaliacoes/index.html`
- `/pages/treinos/index.html`
- `/pages/aluno-avaliacao/index.html`
- `/pages/aluno-treinos/index.html`

## Observação

Esta correção não remove histórico. Ela apenas desativa registros duplicados para impedir cobrança e vínculo operacional incorretos.
