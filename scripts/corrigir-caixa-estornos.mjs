import "dotenv/config";
import { lerJsonDuravel, salvarJsonMultiplosAtomico } from "../modules/core/persistence/durable-json.mjs";

const texto = (valor) => String(valor ?? "").trim();
const norm = (valor) => texto(valor)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const recebimentos = await lerJsonDuravel("recebimentos.json", []);
const caixa = await lerJsonDuravel("caixa.json", { caixas: [], movimentos: [] });

const estornados = (Array.isArray(recebimentos) ? recebimentos : [])
  .filter((item) => ["estornado", "estornada"].includes(norm(item.status)));

let entradasReativadas = 0;
let saidasEstornoAtivadas = 0;

for (const recebimento of estornados) {
  const reciboId = texto(recebimento.reciboId || recebimento.ultimoReciboId);
  if (!reciboId) continue;

  for (const movimento of caixa.movimentos || []) {
    const mesmoRecibo =
      texto(movimento.reciboId || movimento.reciboEstornadoId) === reciboId;

    if (!mesmoRecibo) continue;

    const tipo = norm(movimento.tipo);
    const origem = norm(movimento.origem);

    // A entrada original precisa continuar ativa para preservar o histórico.
    if (tipo.includes("entrada") && origem !== "estorno_recibo") {
      if (norm(movimento.status) !== "ativo") {
        movimento.status = "ativo";
        delete movimento.motivoEstorno;
        delete movimento.estornadoEm;
        movimento.atualizadoEm = new Date().toISOString();
        entradasReativadas += 1;
      }
    }

    // A saída do estorno também precisa estar ativa para neutralizar a entrada.
    if (tipo.includes("saida") && origem === "estorno_recibo") {
      if (norm(movimento.status) !== "ativo") {
        movimento.status = "ativo";
        movimento.atualizadoEm = new Date().toISOString();
        saidasEstornoAtivadas += 1;
      }
    }
  }
}

await salvarJsonMultiplosAtomico({
  "caixa.json": caixa
});

console.log(JSON.stringify({
  ok: true,
  recebimentosEstornados: estornados.length,
  entradasReativadas,
  saidasEstornoAtivadas
}, null, 2));
