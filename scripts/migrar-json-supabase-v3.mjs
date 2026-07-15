import "dotenv/config";
import { migrarColecaoJsonParaSupabase } from "../modules/core/persistence/collection-store.mjs";
const colecoes = process.argv.slice(2).length ? process.argv.slice(2) : ["alunos", "matriculas", "mensalidades", "financeiro"];
const resultados = [];
for (const colecao of colecoes) resultados.push(await migrarColecaoJsonParaSupabase(colecao));
console.log(JSON.stringify({ ok: true, resultados }, null, 2));
