# Fusion ERP V3 — Pacote limpo

O comando `npm run v3:package` cria `dist/FusionERP_V3_DISTRIBUICAO_LIMPA.zip`.

O ZIP exclui `.git`, `node_modules`, `.env`, backups, uploads, logs, temporários, arquivos ZIP e dados de IDE. O código-fonte e os arquivos necessários para execução permanecem.

Depois de extrair o pacote limpo em outro computador, execute:

```bat
npm install
npm start
```

Este patch não apaga arquivos do projeto de desenvolvimento. Ele apenas controla o conteúdo do pacote de distribuição.
