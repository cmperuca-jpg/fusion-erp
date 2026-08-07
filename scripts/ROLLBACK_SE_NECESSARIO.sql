-- ROLLBACK opcional da reconciliação feita em 07/08/2026.
-- NÃO execute a menos que seja necessário desfazer a correção do banco.

BEGIN;

UPDATE public.fusion_v3_records dst
SET payload = b.payload->'payload',
    updated_at = COALESCE((b.payload->>'sourceUpdatedAt')::timestamptz, now())
FROM public.fusion_v3_records b
WHERE b.collection='_backup_financeiro_20260807_1441'
  AND dst.tenant_id=b.tenant_id
  AND dst.collection=b.payload->>'sourceCollection'
  AND dst.record_id=b.payload->>'sourceRecordId';

COMMIT;
