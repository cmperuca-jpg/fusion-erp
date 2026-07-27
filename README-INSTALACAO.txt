FUSION ERP - PATCH LIBERACAO EMERGENCIAL PIX

1. Faça backup do projeto e da pasta data.
2. Copie o conteúdo deste ZIP para a raiz do Fusion ERP, preservando as pastas.
3. Configure no Render uma das variáveis:
   FUSION_PIX_KEY=chave PIX da academia
   ou
   FUSION_PIX_COPY_PASTE=código PIX copia e cola

Variáveis opcionais:
   FUSION_PIX_RECEIVER=nome do recebedor
   FUSION_PIX_CITY=cidade

4. Reinicie o serviço.
5. O login do aluno passará a abrir:
   /pages/portal-aluno-emergencial/index.html
6. A recepção acompanha em:
   /pages/site-chat/index.html

REGRAS IMPLEMENTADAS
- Exige dívida vencida.
- Uma tentativa por aluno em cada competência mensal.
- A tentativa é consumida no envio do comprovante, independentemente de autenticidade.
- O comprovante é salvo em uploads/emergency-receipts.
- Uma mensagem é criada no chat interno.
- Um comando de abertura imediata é enviado ao Access Bridge.
- Uma autorização temporária de 24 horas é registrada em data/emergency-access.json.
- Endpoint para o motor de acesso consultar a autorização:
  GET /api/emergency-access/alunos/:alunoId/validar-acesso

ATENÇÃO
O registro de 24 horas está pronto, mas o módulo que decide cada leitura da catraca precisa consultar o endpoint acima. Como o módulo access-engine não foi incluído nos arquivos enviados, este patch garante a abertura imediata e grava a autorização, mas não altera sozinho as leituras seguintes durante as 24 horas.
