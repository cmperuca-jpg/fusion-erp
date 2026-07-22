import { reconciliarFinanceiroCaixa } from "../modules/financeiro/financeiro-reconciliacao.service.mjs";

const aplicar = process.argv.includes("--apply");
const usuarioArg = process.argv.find((arg) => arg.startsWith("--usuario="));
const usuario = usuarioArg ? usuarioArg.split("=").slice(1).join("=") : "script-reconciliacao";

const resultado = await reconciliarFinanceiroCaixa({ aplicar, usuario });
console.log(JSON.stringify(resultado, null, 2));

if (!aplicar) {
  console.log("Simulacao concluida. Execute com --apply para gravar os movimentos ausentes.");
}
