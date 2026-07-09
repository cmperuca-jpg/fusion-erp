# Fusion ERP 2.7.5 — ZIP B2 Consolidação do Menu Global

## Objetivo
Padronizar o menu global do sistema e estabilizar a navegação em desktop, tablet e celular.

## Arquivos alterados
- `public/assets/js/fusion-layout.js`
- `public/assets/css/fusion-menu-global.css`

## Menu consolidado

CADASTROS
- Alunos
- Professores

ACADEMIA
- Modalidades
- Planos
- Matrículas
- Agenda
- Turmas
- Presenças
- Check-in
- Avaliações

FINANCEIRO
- Caixa
- Financeiro
- Mensalidades
- Recebimentos
- Pagamentos
- Relatório Caixa

PORTAIS
- Portal do Professor
- Portal do Aluno

BUSINESS INTELLIGENCE
- BI Financeiro
- BI Comercial
- BI Operacional
- BI e Rankings

SISTEMA
- Configurações
- Biblioteca Inteligente

## Ajustes incluídos
- Remoção definitiva do menu global de Treinos, Modelos de treino e Exercícios.
- Inclusão de Portal do Professor e Portal do Aluno.
- Inclusão da Biblioteca Inteligente em Sistema.
- Destaque automático da página ativa.
- Botão mobile de menu integrado à topbar.
- Backdrop e fechamento por ESC no menu mobile.
- Rolagem preservada do menu.
- Envelopamento preventivo de tabelas para evitar corte horizontal.

## Aplicação
Extrair este ZIP na raiz do projeto e substituir os arquivos.
Depois reiniciar o servidor:

```bash
CTRL + C
npm start
```

Para limpar cache no navegador:

```text
CTRL + F5
```
