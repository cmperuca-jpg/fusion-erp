import dotenv from "dotenv";
dotenv.config();
import { enviarBackupSupabase } from "../modules/backup/backup.service.mjs";

try {
  const resultado = await enviarBackupSupabase();
  console.log(JSON.stringify(resultado, null, 2));
} catch (error) {
  console.error("Erro no backup Supabase:", error.message);
  process.exit(1);
}
