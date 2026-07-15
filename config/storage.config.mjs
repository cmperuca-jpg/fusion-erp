export const STORAGE_CONFIG = Object.freeze({
  provider: String(process.env.FUSION_STORAGE_PROVIDER || (process.env.SUPABASE_URL ? "supabase" : "local")).toLowerCase(),
  alunoFotosBucket: process.env.SUPABASE_FOTOS_BUCKET || "alunos-fotos",
  aparenciaBucket: process.env.SUPABASE_APARENCIA_BUCKET || "aparencia",
  backupBucket: process.env.SUPABASE_BACKUP_BUCKET || "fusion-backups",
  localUploadsAllowedInProduction: String(process.env.FUSION_ALLOW_LOCAL_UPLOADS || "false").toLowerCase() === "true"
});
