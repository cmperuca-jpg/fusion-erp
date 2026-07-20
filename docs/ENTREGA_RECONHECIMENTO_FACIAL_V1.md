# Entrega - reconhecimento facial v1

## Estrutura correta

A estrutura atual e Windows nativa. Nao usa CompreFace, Docker ou Linux.

Componentes:

- Fusion Access instalado no computador da academia.
- `FusionFacialWorker.exe` como motor facial nativo.
- OpenCV e modelos ONNX locais para deteccao e reconhecimento.
- App Android local conectado ao IP do computador na porta `8765`.
- Terminal web/PWA opcional pelo site do Fusion.
- Catraca liberada pelo Fusion Access Agent, respeitando aluno, matricula e financeiro.

## Arquivos do Fusion ERP envolvidos

- `.env.example`
- `server.mjs`
- `public/assets/js/fusion-layout.js`
- `modules/reconhecimento-facial/reconhecimento-facial.routes.mjs`
- `modules/reconhecimento-facial/reconhecimento-facial.service.mjs`
- `public/pages/reconhecimento-facial/admin.html`
- `public/pages/reconhecimento-facial/admin.js`
- `public/pages/reconhecimento-facial/index.html`
- `public/pages/reconhecimento-facial/terminal.js`
- `public/pages/reconhecimento-facial/style.css`
- `tools/fusion-access-native/src/main.cpp`
- `tools/fusion-access-native/src/offline_gateway.cpp`
- `tools/fusion-access-native/runtime/VER-STATUS.cmd`
- `tools/fusion-access-native/runtime/FusionAccessSupervisor.ps1`
- `docs/RECONHECIMENTO-FACIAL.md`

## Codigos

- 8 numeros: ativa o Fusion Access Windows pelo painel Access Engine.
- 6 numeros no Status do Fusion Access: pareia o app Android local com a porta `8765`.
- 6 numeros no painel de reconhecimento facial: pareia o terminal web/PWA do site.

## Funcoes entregues

- Cadastro facial com consentimento.
- Identificacao facial pelo motor local Windows.
- Terminal Android local para uso como camera fixa.
- Servidor local offline na porta `8765`.
- Pareamento local por codigo de 6 numeros.
- Sincronizacao de regras offline com o site.
- Registro de eventos de reconhecimento.
- Liberacao da catraca pelas regras atuais do Fusion.
- Terminal web/PWA pelo site como alternativa.

## Validacao obrigatoria do pacote Windows

Antes de entregar um novo `FusionAccessSetup.exe`, confirmar que o `FusionFacialWorker.exe` empacotado contem:

- `native-1.0.1`;
- rota local `/status`;
- rota local `/pair`;
- rota local `/identify`;
- porta `8765`.

No computador instalado, o atalho `Status do Fusion Access` deve informar que o terminal local respondeu. Se nao responder, o app Android local vai falhar com mensagem semelhante a `failed to connect to /IP:8765`.

## Limite conhecido

A verificacao facial do piloto reduz uso indevido por foto estatica, mas nao substitui uma solucao certificada de prova de vida contra todos os tipos de fraude. A academia deve manter alternativa de acesso manual, cartao ou outro metodo permitido.
