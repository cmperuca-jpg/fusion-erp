import "dotenv/config";
import crypto from "node:crypto";
import { migrarTodosJsonParaSupabase, verificarPersistenciaTransacional } from "../modules/core/persistence/collection-store.mjs";

await verificarPersistenciaTransacional();
const forcar = process.argv.includes("--force");
const resultado = await migrarTodosJsonParaSupabase({
  operacaoId: forcar ? `bootstrap-json-v4-${crypto.randomUUID()}` : "bootstrap-json-v4"
});
console.log(JSON.stringify(resultado, null, 2));
