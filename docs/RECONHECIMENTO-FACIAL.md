# Reconhecimento facial do Fusion ERP

## Arquitetura atual

Esta versao nao depende de Linux, Docker ou CompreFace.

O reconhecimento facial do piloto usa um agente nativo para Windows:

- O computador da academia instala o Fusion Access.
- O Fusion Access executa o `FusionFacialWorker.exe`.
- O motor nativo usa OpenCV e os modelos ONNX locais.
- O celular pode funcionar de duas formas:
  - terminal web/PWA pelo site do Fusion;
  - app Android local falando direto com o computador na porta `8765`.
- A liberacao da catraca continua passando pelo Fusion Access Agent e pelas regras atuais de aluno, matricula e financeiro.

As capturas faciais nao devem ser gravadas no Supabase como foto bruta. O Supabase guarda vinculo, consentimento, eventos e regras de acesso. O processamento fica no computador da academia.

## Codigos usados

Existem codigos diferentes para etapas diferentes:

1. Codigo de 8 numeros

Usado para ativar o Fusion Access no computador Windows.

Onde gerar:

`https://www.fusionsistema.com.br/pages/access-engine/index.html`

Esse codigo e digitado no instalador `FusionAccessSetup.exe`. Ele liga o computador da academia ao site.

2. Codigo local de 6 numeros

Usado pelo app Android local que conecta no IP do computador, por exemplo:

`http://10.0.0.130:8765`

Onde ver:

Atalho `Status do Fusion Access` na area de trabalho do Windows.

Esse status deve mostrar:

- porta local `8765`;
- IP local do computador;
- codigo de pareamento.

3. Codigo web de 6 numeros

Usado pelo terminal web/PWA do celular.

Onde gerar:

`https://www.fusionsistema.com.br/pages/reconhecimento-facial/admin.html`

No celular, abrir:

`https://www.fusionsistema.com.br/pages/reconhecimento-facial/index.html`

## Como testar o app Android local

1. No computador da academia, abra `Status do Fusion Access`.
2. Confirme se aparece que o terminal local respondeu.
3. Anote o IP local, por exemplo `10.0.0.130`.
4. Anote o codigo de pareamento de 6 numeros.
5. No app Android, informe o IP do computador e o codigo.
6. O app vai conectar em `http://IP_DO_COMPUTADOR:8765`.

Se aparecer `failed to connect to /10.0.0.130:8765`, a porta local nao esta aberta no computador. As causas mais comuns sao:

- `FusionFacialWorker.exe` antigo, sem servidor local;
- servico do Fusion Access parado;
- firewall sem regra para a porta `8765`;
- celular e computador em redes Wi-Fi diferentes.

## Como testar pelo site

1. Entre no Fusion ERP como administrador ou recepcao autorizada.
2. Abra `https://www.fusionsistema.com.br/pages/reconhecimento-facial/admin.html`.
3. Cadastre o rosto da pessoa com consentimento.
4. Clique em configurar celular para gerar o codigo web de 6 numeros.
5. No celular, abra `https://www.fusionsistema.com.br/pages/reconhecimento-facial/index.html`.
6. Digite o codigo e mantenha a tela aberta como terminal.

## Homologacao

Para o piloto, comece com liberacao facial em homologacao quando necessario. Nesse modo o sistema identifica e registra o teste sem liberar a catraca automaticamente.

Depois que a academia validar iluminacao, posicao do celular, taxa de reconhecimento e procedimento alternativo de acesso, a liberacao facial pode ser ativada.

Biometria facial exige consentimento/base legal, controle de acesso aos dados e alternativa de entrada para o aluno.
