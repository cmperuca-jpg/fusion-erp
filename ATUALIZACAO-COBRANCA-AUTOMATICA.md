# Fusion ERP 2.8.1 — cobrança automática

## Aplicação no Windows

1. Feche o terminal onde `npm start` está executando.
2. Faça uma cópia de segurança da pasta atual do Fusion.
3. Extraia este ZIP diretamente na raiz do Fusion ERP e confirme a substituição dos arquivos.
4. Na raiz do sistema, execute:

```bat
npm install
npm run test:cobranca-automatica
npm start
```

Não copie nem substitua o seu arquivo `.env` e não altere os arquivos JSON da pasta `data`.

## Nova regra

- O recebimento e a cobrança automática agora são coordenados pelo servidor.
- O título é vinculado automaticamente quando existe uma única matrícula ativa ou pendente compatível.
- A quitação da entrada ativa automaticamente a matrícula e o aluno.
- A próxima mensalidade é criada automaticamente e de forma idempotente.
- Recebimentos avulsos não tentam gerar mensalidade e não mostram o aviso “Aluno sem matrícula ativa”.
- Falha posterior do motor nunca desfaz nem duplica o recibo já emitido.

Teste homologado: recibo `00000001`, matrícula `Pendente → Ativa` e próxima mensalidade criada para o ciclo seguinte.
