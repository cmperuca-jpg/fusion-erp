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

Status: pendente.

Proxima acao recomendada: formalizar primeiro fluxo manual e depois automatizar contratacao, pagamento, renovacao, inadimplencia, suspensao e reativacao.

## P1 - Implantacao Repetivel

Status: pendente.

Proxima acao recomendada: criar roteiro/teste de segunda academia do zero sem patch especifico.

## P1 - Observabilidade

Status: pendente.

Proxima acao recomendada: centralizar logs, alertas de erro, heartbeat dos agentes e falhas de cobranca/acesso.

## P2 - Experiencia e Refinamentos

Status: pendente.

Proxima acao recomendada: ajustar UX com base em usuarios reais, sem ampliar escopo antes da venda.
