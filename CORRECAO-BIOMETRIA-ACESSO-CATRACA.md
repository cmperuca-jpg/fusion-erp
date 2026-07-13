# Correcao da biometria e catraca

Data: 12/07/2026

## O que foi corrigido

- O servidor agora tenta iniciar/religar automaticamente o SDK local Futronic na porta `3041`.
- O motor de acesso biometrico nao desiste mais quando a porta `3041` demora a responder; ele fica ativo e continua tentando.
- Depois de cadastrar a digital de um aluno, o motor continuo volta a iniciar automaticamente para testar a catraca.
- A tela `Controle de Catracas` deixou de usar rotas antigas de monitor local e passou a usar `/api/biometria/motor`.
- O executavel `FusionBiometriaSdk.exe` foi recompilado para abrir a porta HTTP antes de inicializar o leitor, evitando a falha "porta 3041 nao respondeu" quando o leitor/driver demora.

## Como testar

1. Inicie o sistema com `npm start`.
2. Abra `http://localhost:3000/pages/biometria/index.html`.
3. Cadastre a biometria do aluno.
4. Confira se a tela mostra o motor ativo ou tentando religar o leitor.
5. Encoste o dedo cadastrado para validar se o acesso foi liberado.

Se aparecer "SDK biometrico local indisponivel", confira se o leitor Futronic esta conectado, se o driver esta instalado e se nenhum outro processo esta usando a porta `3041`.
