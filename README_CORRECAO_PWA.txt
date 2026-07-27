Correção PWA dos portais Fusion ERP

Problema:
- Login do aluno apontava para manifest-aluno, mas a área interna aluno-treinos apontava para manifest-sistema.
- Login e área interna do professor apontavam para manifest-sistema.
- Assim, instalar antes do login criava Fusion Aluno, mas instalar dentro do portal criava Fusion ERP.

Correção:
- aluno-login: já estava correto e não foi alterado.
- aluno-treinos: manifest-aluno.webmanifest + tema verde + instalador PWA.
- professor-login: manifest-professor.webmanifest + tema azul + instalador PWA.
- professor-area: manifest-professor.webmanifest + tema azul + instalador PWA.

Após deploy:
1. Remover do celular os PWAs instalados incorretamente.
2. No Chrome, limpar dados do site fusionsistema.com.br ou pelo menos o cache.
3. Reabrir cada portal e instalar novamente.
