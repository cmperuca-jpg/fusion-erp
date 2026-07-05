# Fusion ERP 2.7.4 — ZIP 5 — Treinos V3

Pacote de ajuste focado no módulo Treinos V3.

## Arquivos incluídos

- `public/pages/treinos-v3/`
- `public/pages/treinos-v3-aluno/`
- `public/pages/biblioteca-inteligente/`
- `public/pages/portal-treinos/`
- `modules/treinos/`

## O que foi ajustado

- Responsividade do Montador de Treino V3 do professor.
- Botões de atalho mobile: Biblioteca / Treino.
- Tabelas com rolagem horizontal controlada no celular.
- Cards de exercícios adaptados para toque.
- Execução do Treino V3 Aluno com layout mobile first.
- Modal de exercício em tela cheia no celular.
- Biblioteca Inteligente com grade mobile, KPIs em coluna e editor responsivo.
- Portal de Treinos com filtros e exercícios em uma coluna no celular.

## Aplicação

Extraia este ZIP na raiz do projeto e substitua os arquivos.

Depois execute:

```bash
npm start
```

Teste principalmente:

- `/pages/treinos-v3/`
- `/pages/treinos-v3-aluno/`
- `/pages/biblioteca-inteligente/`
- `/pages/portal-treinos/`

## Observação

Este pacote não altera `server.mjs`, banco, `.env` nem regras financeiras. O foco é interface e usabilidade do Treinos V3.
