import "dotenv/config";
import crypto from "node:crypto";
import { verificarPersistenciaTransacional, migrarTodosJsonParaSupabase } from "../modules/core/persistence/collection-store.mjs";
import { enviarBackupSupabase } from "../modules/backup/backup.service.mjs";
import { sincronizarTudoAgora } from "../modules/backup/supabase-data.service.mjs";

if (process.env.FUSION_CONFIRMAR_PUBLICACAO_SUPABASE !== "SIM") {
  throw new Error(
    "Operação bloqueada. Execute com FUSION_CONFIRMAR_PUBLICACAO_SUPABASE=SIM para publicar os dados locais no Supabase."
  );
}

console.log("[Publicação] Validando conexão com o Supabase...");
await verificarPersistenciaTransacional();

console.log("[Publicação] Criando backup de segurança no Supabase...");
const backup = await enviarBackupSupabase({ sufixo: "antes-publicacao-local" });

console.log("[Publicação] Atualizando as coleções do banco com a pasta data local...");
const banco = await migrarTodosJsonParaSupabase({
  operacaoId: `publicacao-json-local-${crypto.randomUUID()}`
});

console.log("[Publicação] Atualizando os arquivos persistidos no Supabase...");
const arquivos = await sincronizarTudoAgora({ forcar: true });

console.log(JSON.stringify({ ok: true, backup, banco, arquivos }, null, 2));
