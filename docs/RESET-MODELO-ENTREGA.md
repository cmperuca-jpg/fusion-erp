# Reset modelo para entrega

O arquivo `Resetar Fusion ERP.bat` prepara uma instalação nova sem alunos reais e sem movimentações financeiras.

## Proteções

- Exige a confirmação textual `RESETAR-MODELO`.
- Cria obrigatoriamente um backup antes de alterar qualquer dado.
- Atualiza o tenant configurado no Supabase por uma operação transacional.
- Limpa fotos, documentos e importações antigas do tenant.
- Mantém planos, modalidades, biblioteca de exercícios, taxas e configurações técnicas.
- Não apaga os backups existentes.

## Dados que permanecem após o reset

- Um administrador.
- Uma conta de recepção.
- Um responsável técnico fictício.
- Um aluno fictício com matrícula cortesia, sem lançamento financeiro.
- Uma avaliação física completa de exemplo.
- Treinos A, B e C de hipertrofia.

As credenciais estão em `CREDENCIAIS-INICIAIS-FUSION-ERP.txt` e devem ser alteradas antes do início da operação real.

## Como executar

1. Confira no `.env` o `FUSION_TENANT_ID` da instalação que será preparada.
2. Feche o servidor local.
3. Execute `Resetar Fusion ERP.bat`.
4. Digite `RESETAR-MODELO` quando solicitado.
5. Aguarde a confirmação de backup e reset concluído.
6. Inicie o servidor e teste as quatro contas.

Para validar o pacote sem apagar dados:

```text
npm run reset:simular
```

Não execute o reset na academia piloto se os dados reais ainda forem necessários. Use o backup criado para qualquer recuperação.
