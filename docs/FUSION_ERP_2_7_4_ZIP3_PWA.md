# Fusion ERP 2.7.4 — ZIP 3 PWA

## Objetivo
Transformar o site em PWA instalável em Android, iPhone, iPad, tablets e computadores, sem alterar APIs ou regras de negócio.

## O que este pacote altera
- Adiciona manifestos PWA na raiz pública (`/manifest-*.webmanifest`).
- Mantém cópia em `public/manifests/` para compatibilidade.
- Corrige o `start_url`, que antes apontava para `/mobile/`.
- Adiciona `public/fusion-sw.js` com cache seguro para páginas e assets.
- Adiciona banner de instalação para Android/Desktop.
- Adiciona orientação para instalação em iPhone/iPad.
- Injeta manifesto, tema, ícone Apple e script PWA nas páginas HTML.

## Como aplicar
Extraia este ZIP na raiz do projeto e substitua os arquivos.

Depois rode:

```bash
npm start
```

Teste no navegador:
- `http://localhost:3000/pages/login/`
- `http://localhost:3000/pages/professor-painel/`
- `http://localhost:3000/pages/portal-aluno/`
- `http://localhost:3000/pages/biblioteca-inteligente/`

## Observação importante
No iPhone, o botão automático de instalar não aparece por limitação do Safari. O sistema mostra instrução para o usuário tocar em Compartilhar e depois em “Adicionar à Tela de Início”.
