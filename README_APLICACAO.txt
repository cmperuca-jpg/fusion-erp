FUSION ERP — SESSÃO ÚNICA DO ALUNO E FOTOS DE PERFIL

Incluído:
1. Sessão única do aluno entre página normal e PWA instalado.
   Ao entrar novamente, a sessão anterior é encerrada.
2. Foto do aluno no Portal do Aluno.
   O aluno pode usar câmera ou galeria.
3. Foto do professor no Portal do Professor.
4. Foto do professor no cadastro administrativo.
5. Redução automática das imagens antes de salvar.
6. Persistência da foto nos campos foto e foto_base64.

APLICAÇÃO
1. Extraia este ZIP na raiz do projeto, substituindo os arquivos.
2. Execute uma vez:
   node aplicar-foto-cadastro-professor.mjs
3. Faça o commit/deploy.
4. Depois do deploy, limpe o cache ou use Ctrl+F5.

IMPORTANTE
A sessão única funciona entre o navegador e o aplicativo PWA instalados a partir
do mesmo navegador/origem. O navegador e o PWA normalmente compartilham o
localStorage da mesma origem.

TESTE
- Abra o mesmo aluno no navegador.
- Entre no mesmo aluno no PWA.
- A página anterior deve voltar ao login em até 4 segundos.
- No Portal do Aluno, toque na foto ou em "Alterar foto".
- No Portal do Professor, use "Alterar foto".
- No cadastro administrativo, edite o professor, escolha a foto e clique em "Salvar foto".
