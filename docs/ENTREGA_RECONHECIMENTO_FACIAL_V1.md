# Entrega — reconhecimento facial v1

## Arquivos do Fusion ERP alterados

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
- `docs/RECONHECIMENTO-FACIAL.md`
- `docs/ENTREGA_RECONHECIMENTO_FACIAL_V1.md`

## Funções entregues

- Terminal responsivo para celular Android com câmera frontal.
- Token exclusivo do terminal e limite de requisições.
- Desafio aleatório de movimento com expiração.
- Cadastro com três capturas e confirmação de consentimento.
- Processamento local pelo CompreFace através do Access Agent.
- Identificação com limiar de similaridade e pose da cabeça.
- Reaproveitamento das regras existentes de matrícula, financeiro e catraca.
- Histórico persistido no Supabase sem gravar as capturas no banco do Fusion.
- Modo de homologação que reconhece sem liberar a catraca.
- Tela administrativa integrada ao menu Academia.

## Validações executadas

- Verificação de sintaxe do servidor, rotas, serviço e JavaScript das telas.
- `npm run check` completo do projeto.
- Teste da fila em memória: criação, coleta pelo agente, conclusão e descarte da captura.
- Teste HTTP das duas páginas, autenticação do terminal, desafio e rejeição de token inválido.

## Limite conhecido

A v1 usa movimento de cabeça e o plugin de pose do CompreFace. Isso dificulta uma foto estática, mas não substitui uma solução certificada de prova de vida contra vídeo, tela ou máscara. A liberação vem desativada por padrão e exige homologação local antes de ser ligada.
