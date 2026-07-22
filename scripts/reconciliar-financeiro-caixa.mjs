import "dotenv/config";

const args = new Set(process.argv.slice(2));
const permitirJsonLocal = args.has("--allow-json-local") || args.has("--json-local");
const exigirSupabase = !permitirJsonLocal;

if (exigirSupabase) {
  process.env.FUSION_DATABASE_PROVIDER = "supabase";
  process.env.FUSION_JSON_FALLBACK = "false";
  process.env.FUSION_PERSISTENCE_WRITE_MODE = process.env.FUSION_PERSISTENCE_WRITE_MODE || "primary";
}

const { reconciliarFinanceiroCaixa } = await import("../modules/financeiro/financeiro-reconciliacao.service.mjs");

const aplicar = args.has("--apply");
const usuarioArg = process.argv.find((arg) => arg.startsWith("--usuario="));
const usuario = usuarioArg ? usuarioArg.split("=").slice(1).join("=") : "script-reconciliacao";

const resultado = await reconciliarFinanceiroCaixa({ aplicar, usuario, exigirSupabase });
console.log(JSON.stringify(resultado, null, 2));

if (!aplicar) {
  console.log("Simulacao concluida. Execute com --apply para gravar os movimentos ausentes.");
}
