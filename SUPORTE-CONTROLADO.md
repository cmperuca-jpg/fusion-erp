# Fusion Sistema — Acesso de Suporte Controlado

A equipe Fusion não usa a senha do cliente e não entra como se fosse o administrador da academia.

Fluxo:

1. Operador entra com sua própria conta Fusion.
2. Abre `/pages/suporte/index.html`.
3. Escolhe a academia.
4. Informa o motivo do atendimento.
5. O backend cria uma sessão de suporte temporária (padrão: 30 minutos).
6. O JWT temporário aponta para o tenant do cliente.
7. Todas as chamadas de API durante a sessão são registradas em `fusion_support_audit`.
8. Um banner laranja permanece visível durante todo o acesso.
9. Ao encerrar, o sistema restaura automaticamente a conta original do operador.

Tabelas:
- `fusion_support_operators`
- `fusion_support_sessions`
- `fusion_support_audit`

Nenhum operador é criado automaticamente. A primeira autorização deve ser feita
deliberadamente no Supabase, informando apenas o e-mail da conta Fusion da equipe.
