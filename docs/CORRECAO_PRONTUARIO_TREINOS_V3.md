# Correção Prontuário x Treinos V3

Arquivo alterado:

- `public/pages/alunos/prontuario.js`

Correção:

A aba Treinos do prontuário contava somente `treino.exercicios`.
O treino exibido no Portal do Aluno usa a estrutura `treino.divisoes[].itens`.

Agora o prontuário reconhece:

- `treino.exercicios`
- `treino.divisoes[].itens`
- `treino.divisoes[].exercicios`
- `treino.grupos[].exercicios`
- `treino.grupos[].itens`

Resultado esperado:

O treino do Marcos André deve aparecer com a quantidade correta de exercícios, incluindo os 3 exercícios visíveis no Portal do Aluno.
