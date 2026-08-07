-- AUDITORIA SOMENTE LEITURA — consolidação financeira SaaS
-- Verifica se ainda existem as duas divergências corrigidas.

WITH mats AS (
  SELECT tenant_id,
         record_id AS matricula_id,
         COALESCE(payload->>'dataMatricula', payload->>'data_matricula') AS data_matricula
  FROM public.fusion_v3_records
  WHERE collection='matriculas'
),
ini AS (
  SELECT r.tenant_id,
         r.collection,
         r.record_id,
         COALESCE(r.payload->>'matriculaId', r.payload->>'matricula_id') AS matricula_id,
         r.payload->>'vencimento' AS vencimento
  FROM public.fusion_v3_records r
  WHERE r.collection IN ('financeiro','mensalidades','recebimentos')
    AND COALESCE(r.payload->>'origem','')='matricula_inicial_unificada'
),
rec AS (
  SELECT tenant_id,
         payload,
         LOWER(COALESCE(payload->>'status','')) AS st,
         COALESCE((payload->>'valorPago')::numeric,0) AS vp,
         COALESCE((payload->>'valorRecebido')::numeric,0) AS vr,
         COALESCE((payload->>'valorBrutoRecebido')::numeric,0) AS vb
  FROM public.fusion_v3_records
  WHERE collection='recebimentos'
)
SELECT 'datas_iniciais_divergentes' AS item, COUNT(*)::text AS valor
FROM ini i
JOIN mats m ON m.tenant_id=i.tenant_id AND m.matricula_id=i.matricula_id
WHERE LEFT(COALESCE(i.vencimento,''),10)<>LEFT(COALESCE(m.data_matricula,''),10)

UNION ALL

SELECT 'recebimentos_quitados_alias_divergentes', COUNT(*)::text
FROM rec
WHERE st IN ('recebido','pago','quitado','baixado')
  AND vr>0
  AND (vp<>vr OR vb<>vr)

UNION ALL

SELECT 'backup_registros', COUNT(*)::text
FROM public.fusion_v3_records
WHERE collection='_backup_financeiro_20260807_1441';
