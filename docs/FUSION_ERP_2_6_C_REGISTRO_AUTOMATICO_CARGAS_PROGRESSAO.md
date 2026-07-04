# Fusion ERP 2.6-C — Registro Automático de Cargas e Progressão

Entrega modular integrada aos módulos existentes de treinos.

## Alterações principais

- Histórico automático de cargas por aluno e exercício.
- Comparação com execução anterior.
- Melhor carga por exercício.
- Melhor volume por exercício.
- Tendência automática: evolução, regressão, estabilidade ou primeiro registro.
- Sugestão de progressão com base em carga, repetições e volume.
- Endpoint operacional para consulta da progressão por aluno.
- Exibição da progressão dentro da execução assistida do treino.

## Endpoint novo

GET /api/treinos-operacional/progressao/alunos/:alunoId

## Testes no CMD

```cmd
cd C:\Users\academia01\Desktop\site erp
npm run check
npm start
```

Teste direto da API:

```cmd
curl http://localhost:3000/api/treinos-operacional/progressao/alunos/ID_DO_ALUNO
```

Fluxo recomendado:

1. Abrir /pages/treinos/
2. Executar um treino ativo.
3. Registrar carga e repetições.
4. Concluir exercício.
5. Repetir o treino em nova execução.
6. Verificar o card de progressão automática.
