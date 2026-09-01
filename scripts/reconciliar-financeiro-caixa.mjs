import "dotenv/config";

const args = new Set(process.argv.slice(2));
const permitirJsonLocal = args.has("--allow-json-local") || args.has("--json-local");

// Nunca troca o provider por conta própria. A reconciliação deve operar sobre a
// mesma autoridade configurada para o processo (PostgreSQL em produção).
const { reconciliarFinanceiroCaixa } = await import("../modules/financeiro/financeiro-reconciliacao.service.mjs");

const aplicar = args.has("--apply");
const usuarioArg = process.argv.find((arg) => arg.startsWith("--usuario="));
const usuario = usuarioArg ? usuarioArg.split("=").slice(1).join("=") : "script-reconciliacao";

const resultado = await reconciliarFinanceiroCaixa({ aplicar, usuario, permitirJson: permitirJsonLocal });
console.log(JSON.stringify(resultado, null, 2));

if (!aplicar) {
  console.log("Simulacao concluida. Execute com --apply para gravar os movimentos ausentes.");
}
