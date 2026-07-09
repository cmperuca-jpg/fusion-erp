# Auditoria visual/funcional 01

Correções aplicadas:

1. `carregarLayout()` agora tem compatibilidade global para páginas antigas que chamavam essa função antes do novo menu carregar. Isso corrige o botão **Nova Aula** da Agenda e evita quebra de JS.
2. O menu antigo foi neutralizado de forma mais agressiva: CSS antigo de menu é desativado após o Fusion UI 3.1 carregar.
3. `fusion-mobile-final.js` não cria mais barra/menu paralelo quando o Fusion UI 3.x já está ativo.
4. Modais e pop-ups agora ficam acima do menu lateral e usam tamanho padrão maior em tela paisagem.
5. Caixa e Relatórios do Caixa foram encaixados no layout novo, removendo o modelo antigo de sidebar/margem interna.

Observações da auditoria:

- A página de Mensalidades continua funcionalmente questionável se a mensalidade já nasce do cadastro/matrícula. Recomendo manter fora da correção visual e decidir na etapa de fluxo financeiro se ela será painel de consulta, rotina automática ou removida do menu.
- Recebimentos e Contas a Pagar ainda precisam de padronização visual fina, mas o problema de pop-up menor/atrás do menu foi tratado globalmente.
