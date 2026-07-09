# Correção — Professores unificado e prontuário integrado

Arquivos alterados:

- public/pages/professores/index.html
- public/pages/professores/index.js
- public/pages/professores/style.css
- public/pages/professores/cadastro.html
- public/pages/professores/ficha.html
- modules/professores/professores.service.mjs

O que foi ajustado:

1. Cadastro Professor e Ficha Professor permanecem apenas como redirecionamento para public/pages/professores/index.html.
2. A página oficial passa a ser somente Professores.
3. O botão de ação na lista agora abre o Prontuário do Professor dentro do mesmo modal.
4. O prontuário do professor passa a cruzar dados reais de:
   - professores.json
   - alunos.json
   - turmas.json
   - agenda.json
   - avaliacoes.json
   - treinos_prescritos.json
   - documentos do professor
5. O backend deixou de depender apenas de treinos.json e agora usa treinos_prescritos.json como fonte principal dos treinos prescritos.

Observação: para remover os botões Cadastro Professor e Ficha Professor do Menu Geral, aplique também a remoção desses dois links no arquivo public/pages/menu-geral/index.html, caso ele exista no seu projeto atual.
