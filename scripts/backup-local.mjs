import dotenv from "dotenv";
dotenv.config();
import { criarBackupLocal } from "../modules/backup/backup.service.mjs";

try {
  const resultado = await criarBackupLocal();
  console.log(JSON.stringify(resultado, null, 2));
} catch (error) {
  console.error("Erro no backup local:", error.message);
  process.exit(1);
}
