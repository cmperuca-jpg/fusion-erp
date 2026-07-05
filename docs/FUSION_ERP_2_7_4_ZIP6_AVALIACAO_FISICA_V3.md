# Fusion ERP 2.7.4 — ZIP 6 — Avaliação Física V3

## Objetivo
Aplicar ajustes responsivos e mobile first na Avaliação Física V3, mantendo a identidade visual atual e sem alterar regras de negócio.

## Arquivos incluídos
- public/pages/avaliacoes/index.html
- public/pages/avaliacoes/index.js
- public/pages/avaliacoes/style.css
- public/pages/portal-aluno/style.css

## Ajustes principais
- Modal da avaliação em tela cheia no celular.
- Campos de matrícula, aluno, avaliação, data e hora adaptados para telas pequenas.
- Botões maiores para toque.
- Abas com rolagem horizontal no mobile.
- Perímetros e RCQ reorganizados em uma coluna no celular.
- Formulários compactados.
- Tabelas com rolagem horizontal.
- Fotos posturais adaptadas para celular.
- Relatório no Portal do Aluno com melhor leitura em telas pequenas.

## Como aplicar
Extraia este ZIP na raiz do projeto e substitua os arquivos existentes.

## Testes sugeridos
1. Abrir /pages/avaliacoes/ no desktop.
2. Abrir /pages/avaliacoes/?embed=1 dentro do Portal do Professor.
3. Criar nova avaliação em tela de celular.
4. Preencher peso, altura, cintura e quadril para validar IMC e RCQ.
5. Abrir o Portal do Aluno e validar o relatório da avaliação.
