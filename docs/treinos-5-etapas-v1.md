# Fusion ERP — Treinos 5 Etapas v1

## 1. Modelagem
Treino pertence a um aluno e a um professor responsável. O vínculo é por `alunoId` e `professorId`. Campos legados `aluno_id` e `professor_id` são mantidos para compatibilidade.

Campos obrigatórios: aluno, professor, objetivo, início, validade e ao menos um exercício com nome, séries e repetições.

## 2. Backend
Arquivos consolidados: repository, service, schema e routes. O backend valida o treino antes de gravar e mantém histórico/auditoria.

## 3. Frontend
Tela única com layout global, modal de cadastro/edição, filtros, KPIs, validação e mensagens claras.

## 4. Integração
O professor é definido automaticamente pelo aluno. Treino não salva se o aluno não tiver professor responsável.

## 5. Homologação
Executar o script `verificar-treinos-5-etapas-v1.mjs`, iniciar o servidor e testar criação, edição, exclusão e filtro por aluno/professor.
