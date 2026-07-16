# Reconhecimento facial do Fusion ERP

## Arquitetura

- O celular Android abre a página HTTPS do Fusion e faz duas capturas por tentativa.
- O Render mantém as capturas somente na memória enquanto aguarda o agente.
- O Fusion Access Agent envia as capturas ao CompreFace instalado no computador da academia.
- O Supabase recebe apenas o vínculo do aluno, consentimento e histórico do acesso. As capturas não são salvas pelo Fusion no Supabase.
- A catraca continua sendo liberada pelo mesmo Access Agent e pelas mesmas regras de matrícula e financeiro.

O CompreFace mantém localmente os modelos faciais e, conforme a configuração dele, pode manter também as imagens de cadastro. Proteja o computador, limite o acesso ao painel do CompreFace e defina uma política de retenção.

## 1. Instalar o CompreFace no computador da academia

1. Instale o Docker Desktop e confirme que ele está em execução.
2. Baixe a versão oficial em `https://github.com/exadel-inc/CompreFace/releases`.
3. Extraia o ZIP do CompreFace.
4. Abra o CMD na pasta extraída e execute `docker-compose up -d`.
5. Abra `http://localhost:8000/login`.
6. Crie o usuário, uma aplicação e um serviço do tipo **Face Recognition**.
7. Copie a API key desse serviço.

O processador precisa oferecer AVX. O CompreFace deve ficar acessível apenas na máquina/rede local; não publique a porta 8000 na internet.

## 2. Atualizar o Access Agent

1. Extraia o ZIP atualizado do agente.
2. Clique com o botão direito em `INSTALAR-AGORA.cmd` e execute como administrador.
3. Responda **S** para reconhecimento facial.
4. Use a URL `http://127.0.0.1:8000` e cole a API key do serviço Face Recognition.
5. Confirme no Agendador de Tarefas que **Fusion Access Agent** está em execução.

## 3. Variáveis no Render

Crie as variáveis abaixo e faça um novo deploy:

```env
FACIAL_ENABLED=true
FACIAL_RELEASE_ENABLED=false
FACIAL_TERMINAL_TOKEN=TOKEN_ALEATORIO_LONGO
FACIAL_SIMILARITY_THRESHOLD=0.86
FACIAL_LIVENESS_MIN_YAW=8
FACIAL_TASK_TIMEOUT_MS=35000
```

Comece com `FACIAL_RELEASE_ENABLED=false`. Nesse modo o sistema identifica o rosto e registra o teste, mas não libera a catraca.

## 4. Cadastrar e testar

1. Entre no Fusion como administrador ou recepção.
2. Acesse **Academia > Reconhecimento facial**.
3. Confirme que **Agente local** e **CompreFace** aparecem online.
4. Selecione um aluno, registre o consentimento e faça frente, esquerda e direita.
5. No celular abra `https://SEU-SERVICO.onrender.com/pages/reconhecimento-facial/index.html`.
6. Informe o mesmo `FACIAL_TERMINAL_TOKEN` e fixe o celular na altura do rosto.
7. Faça vários testes reais, com pessoas cadastradas e não cadastradas.

Somente depois da homologação altere `FACIAL_RELEASE_ENABLED=true` no Render. A prova de movimento por giro de cabeça reduz o uso de uma foto estática, mas não equivale a uma solução certificada de anti-spoofing. Mantenha cartão, QR Code ou atendimento manual como alternativa.
