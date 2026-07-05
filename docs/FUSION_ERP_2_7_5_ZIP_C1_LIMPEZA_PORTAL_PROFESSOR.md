# Fusion ERP 2.7.5 — ZIP C1: Limpeza do Portal do Professor

Objetivo:
Remover elementos redundantes do cabeçalho do Portal do Professor.

Alterações:
- Removidos os botões do topo:
  - Avaliação V3
  - Treinos V3
  - Biblioteca
  - Atualizar
- Mantida apenas a informação de última atualização.
- Removido botão Biblioteca do menu lateral interno do Portal do Professor.
- Removida a aba Biblioteca do Portal do Professor.
- Removido botão Recarregar da área Treinos V3.
- Removidos atalhos rápidos redundantes do dashboard.
- A Biblioteca Inteligente permanece somente no menu global do ERP, em Sistema.

Arquivos alterados:
- public/pages/professor-painel/index.html
- public/pages/professor-painel/index.js
- public/pages/professor-painel/style.css

Aplicação:
1. Extraia este ZIP na raiz do projeto.
2. Substitua os arquivos.
3. Reinicie com CTRL + C e npm start.
4. No navegador, use CTRL + F5.
