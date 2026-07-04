# Fusion ERP 2.6-G4 — Build Final da Musculação

Pacote final consolidado da linha 2.6 da musculação.

## Módulos incluídos

- Check-in inteligente
- Treinos / Prescrição
- Treinos Operacional / Execução Assistida
- Progressão automática de cargas
- IA de Progressão Física
- Dashboard do Professor
- Portal do Aluno
- Server raiz atualizado

## Fluxo homologado

1. Check-in do aluno
2. Validação de matrícula/plano/financeiro
3. Abertura ou reaproveitamento da execução de treino
4. Execução assistida com carga, repetição, descanso e progresso
5. Registro de histórico, volume e PR
6. Análise de IA de progressão
7. Atualização do Dashboard do Professor
8. Atualização do Portal do Aluno

## Instalação

Extraia este ZIP na raiz do projeto, substituindo os arquivos correspondentes.

## Teste

```cmd
cd C:\Users\academia01\Desktop\site erp
npm run check
npm start
```

## Páginas principais

- http://localhost:3000/pages/checkin/
- http://localhost:3000/pages/treinos/
- http://localhost:3000/pages/professor-painel/
- http://localhost:3000/pages/portal-aluno/

## APIs principais

- GET /api/checkin/resumo
- GET /api/treinos
- GET /api/treinos-operacional/status
- GET /api/treinos-operacional/progressao/alunos/:alunoId
- GET /api/treinos-operacional/ia/alunos/:alunoId
- GET /api/professor-painel/professores
- GET /api/professor-painel/:professor/dashboard
- POST /api/portal-aluno/acessar

## Status

Linha 2.6 encerrada. Novas funcionalidades devem entrar na linha 2.7. Correções devem ser tratadas como hotfix 2.6.x.
