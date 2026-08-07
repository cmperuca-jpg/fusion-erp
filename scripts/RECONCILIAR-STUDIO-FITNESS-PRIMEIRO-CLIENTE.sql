-- Fusion ERP - reconciliação do primeiro fluxo financeiro da Studio Fitness
-- NÃO apaga caixa, recibo, aluno ou matrícula.
-- Corrige apenas a cobrança inicial já gravada com vencimento no mês seguinte
-- e sincroniza os aliases de valor pago/recebido.
--
-- Matrícula alvo: mat_1786118980516_841461
-- Entrada correta: 07/08/2026
-- Próxima mensalidade permanece programada para 07/09/2026.

BEGIN;

UPDATE public.fusion_v3_records
SET
  payload = payload || jsonb_build_object(
    'vencimentoInicial', '2026-08-07'
  ),
  updated_at = now()
WHERE tenant_id = 'studio-fitness'
  AND collection = 'matriculas'
  AND record_id = 'mat_1786118980516_841461'
  AND payload->>'dataMatricula' = '2026-08-07';

UPDATE public.fusion_v3_records
SET
  payload = payload || jsonb_build_object(
    'vencimento', '2026-08-07',
    'pagamento', COALESCE(payload->>'dataPagamento', '2026-08-07')
  ),
  updated_at = now()
WHERE tenant_id = 'studio-fitness'
  AND collection = 'financeiro'
  AND record_id = 'fin_1786118980516_831140'
  AND payload->>'origem' = 'matricula_inicial_unificada';

UPDATE public.fusion_v3_records
SET
  payload = payload || jsonb_build_object(
    'vencimento', '2026-08-07',
    'competencia', '2026-08',
    'valorRecebido', COALESCE(payload->'valorBrutoRecebido', payload->'valorPago', '0'::jsonb),
    'valorRecebidoBruto', COALESCE(payload->'valorBrutoRecebido', payload->'valorPago', '0'::jsonb),
    'valorPagoCentavos', 12500,
    'valorRecebidoCentavos', 12500
  ),
  updated_at = now()
WHERE tenant_id = 'studio-fitness'
  AND collection = 'mensalidades'
  AND record_id = 'men_1786118980516_834420'
  AND payload->>'origem' = 'matricula_inicial_unificada';

UPDATE public.fusion_v3_records
SET
  payload = payload || jsonb_build_object(
    'vencimento', '2026-08-07',
    'valorPago', COALESCE(payload->'valorBrutoRecebido', payload->'valorRecebido', '0'::jsonb),
    'valorRecebidoBruto', COALESCE(payload->'valorBrutoRecebido', payload->'valorRecebido', '0'::jsonb),
    'valorPagoCentavos', 12500,
    'valorRecebidoCentavos', 12500,
    'saldo', COALESCE(payload->'valorRestante', '0'::jsonb),
    'dataPagamento', COALESCE(payload->>'dataRecebimento', '2026-08-07')
  ),
  updated_at = now()
WHERE tenant_id = 'studio-fitness'
  AND collection = 'recebimentos'
  AND record_id = 'rec_1786118980516_480241'
  AND payload->>'origem' = 'matricula_inicial_unificada';

COMMIT;

-- Conferência: a entrada inicial deve estar em agosto e a recorrência futura em setembro.
SELECT
  collection,
  record_id,
  payload->>'origem' AS origem,
  payload->>'competencia' AS competencia,
  payload->>'vencimento' AS vencimento,
  payload->>'dataPagamento' AS data_pagamento,
  payload->>'valor' AS valor,
  payload->>'total' AS total,
  payload->>'valorPago' AS valor_pago,
  payload->>'valorRecebido' AS valor_recebido,
  payload->>'valorBrutoRecebido' AS bruto_recebido,
  payload->>'taxaOperadoraValor' AS taxa,
  payload->>'valorLiquido' AS liquido,
  payload->>'valorRestante' AS restante,
  payload->>'status' AS status
FROM public.fusion_v3_records
WHERE tenant_id = 'studio-fitness'
  AND (
    record_id IN (
      'fin_1786118980516_831140',
      'men_1786118980516_834420',
      'rec_1786118980516_480241'
    )
    OR (
      collection IN ('financeiro','mensalidades')
      AND payload->>'matriculaId' = 'mat_1786118980516_841461'
    )
  )
ORDER BY collection, record_id;
