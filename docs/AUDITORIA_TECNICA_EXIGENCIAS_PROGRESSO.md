# Auditoria Tecnica Fusion - Exigencias e Progresso

Fonte: `Auditoria_Tecnica_Fusion_Sistema.pdf`, revisao de 11/08/2026.

## P0 - Hardening de Acesso

Status: iniciado e corrigido no codigo local.

Exigencias tratadas:

- `x-agent-id` passou a ser obrigatorio; removido fallback permissivo para `academia-01`.
- `x-agent-token` passou a ser validado por comparacao segura.
- Credencial pode ser vinculada a `agentId`, `tenantId` e `equipmentIds`.
- Catraca fisica consolidada como recurso isolado da `academia-piloto`: `academia-piloto-agent-01` + `catraca-piloto-01`.
- Suporte a token em texto claro, hash SHA-256, token de rotacao e expiracao.
- Requisicoes do agente exigem timestamp e nonce, com bloqueio de replay dentro da janela configurada.
- Comandos de liberacao exigem `ACCESS_AGENT_ID`, tenant (`ACCESS_AGENT_TENANT_ID` ou `FUSION_TENANT_ID`) e `ACCESS_EQUIPMENT_ID` ou valores explicitos no payload.
- Agente Node e agente PowerShell legado passaram a enviar timestamp, nonce, tenant e equipamento.
- SQL auxiliar do Access Bridge recebeu tenant obrigatorio nos comandos e credenciais por agente no Supabase, mantendo RLS e acesso por service role.
- Supabase SaaS novo (`fusion-sistema-novo`, ref `kruujujuxeqexxuugwci`) recebeu a migracao `consolidar_catraca_piloto_isolada` com academia, dispositivo e agente isolados.
- Criado teste local `npm run test:access-agent-auth`.

## P0 - Isolamento Multiempresa

Status: iniciado com teste automatizado local.

Exigencias tratadas nesta etapa:

- Criado teste `npm run test:multiempresa-isolamento`.
- Coberto bloqueio de rota publica que exige tenant quando a academia nao e informada.
- Coberto uso de `x-fusion-tenant` em rota publica com normalizacao do tenant.
- Coberto conflito entre token autenticado de um tenant e header de outro tenant.
- Coberto acesso permitido quando token e tenant informado pertencem a mesma academia.
- Coberto bloqueio de portal de aluno tentando acessar dados de outro aluno.
- Coberta verificacao estatica da protecao de `/uploads`: whitelist de extensoes, `dotfiles: "deny"`, `index: false` e `Cache-Control: private, no-store`.
- JSON local passou a isolar tenants secundarios em `data/tenants/<tenant>/`, preservando a academia padrao nos arquivos atuais.
- Criado smoke HTTP real `npm run test:p0-http-multiempresa` com servidor temporario, dados de duas academias e rotas de alunos, matriculas, financeiro, caixa, access-engine, planos publicos e uploads.

Proxima acao recomendada: ampliar para um smoke Supabase/RLS em staging com duas academias reais antes de liberar venda externa.

## P0 - Regressao Financeira e Acesso

Status: iniciado com suite automatizada local.

Exigencias tratadas nesta etapa:

- Reativado e corrigido `npm run test:financeiro`.
- Corrigida a rotina de cobranca programada para nao criar `lancamentoFinanceiroId` nem titulo em `financeiro.json` antes da emissao.
- Faturas futuras permanecem em `mensalidades.json` com `status: "programada"` e saldo zero.
- O motor de cobranca emite a mensalidade e cria o titulo financeiro somente quando a data programada chega.
- Atualizado `npm run test:cobranca-automatica` para usar JWT administrativo e validar o fluxo HTTP completo: baixa -> programacao -> emissao no vencimento.
- Criada regressao `npm run test:access-liberacao-integrada` cobrindo avaliacao de acesso, comando enfileirado para a catraca, heartbeat do agente, claim, conclusao e bloqueio cross-tenant/equipamento.
- Criada suite agregada `npm run test:p0-auditoria`.

Proxima acao recomendada: ampliar smoke Supabase/RLS em staging e iniciar observabilidade centralizada de falhas de cobranca/acesso.

## P1 - Billing do Proprio Fusion

Status: iniciado com fluxo manual auditavel.

Exigencias tratadas nesta etapa:

- Criado modulo `saas-billing` com assinatura Fusion por tenant, historico de eventos e pagamentos.
- Criados endpoints administrativos `GET/POST /api/saas/billing/fusion/*` para formalizar contratacao, registrar pagamento, renovar, marcar inadimplencia, suspender e reativar.
- Fluxo manual exige usuario administrador da academia, mesmo fora do prefixo administrativo global.
- Criado teste HTTP `npm run test:saas-billing` cobrindo 401, 403 e o ciclo completo contratacao -> pagamento -> renovacao -> inadimplencia -> suspensao -> reativacao.

Proxima acao recomendada: automatizar cobranca recorrente, grace period e enforcement do status do tenant apos validar o fluxo manual com cliente real.

## P1 - Implantacao Repetivel

Status: pendente.

Proxima acao recomendada: criar roteiro/teste de segunda academia do zero sem patch especifico.

## P1 - Observabilidade

Status: iniciado com endpoint operacional, notificacao administrativa e agendador automatico.

Exigencias tratadas nesta etapa:

- Criado endpoint autenticado `GET /api/sistema/observabilidade`.
- Consolidado heartbeat dos agentes de catraca, comandos pendentes/processando/concluidos/falhos/expirados e comandos antigos.
- Consolidado resumo de acessos do dia, bloqueios e falhas de enfileiramento/liberacao da catraca.
- Consolidado resumo de cobranca: falhas no `cobranca_log`, financeiro vencido, mensalidades vencidas e mensalidades programadas.
- Criados alertas operacionais por severidade para agente offline, comando falho/expirado, comando antigo, falha de catraca, falha de cobranca e vencidos.
- Criado `POST /api/sistema/observabilidade/notificar` para persistir eventos operacionais em `observabilidade_eventos` e gerar notificacoes administrativas sem duplicar a mesma ocorrencia do dia.
- Criado agendador automatico de notificacoes de observabilidade, ativo por padrao no Render ou via `FUSION_OBSERVABILITY_NOTIFY_AUTO=true`, com intervalo ajustavel por `FUSION_OBSERVABILITY_NOTIFY_INTERVAL_MS`.
- Criado endpoint autenticado `GET /api/sistema/observabilidade/notificador` para auditar se o job esta ativo, em execucao e qual foi o ultimo resultado.
- Criado teste HTTP `npm run test:observabilidade`.

Proxima acao recomendada: integrar canal externo para falhas criticas, como WhatsApp, e-mail ou webhook operacional.

## P2 - Experiencia e Refinamentos

Status: pendente.

Proxima acao recomendada: ajustar UX com base em usuarios reais, sem ampliar escopo antes da venda.
