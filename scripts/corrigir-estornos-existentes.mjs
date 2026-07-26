import "dotenv/config";
import { lerJsonDuravel, salvarJsonMultiplosAtomico } from "../modules/core/persistence/durable-json.mjs";

const numero = (valor) => Number((Number(valor || 0) || 0).toFixed(2));
const centavos = (valor) => Math.round(numero(valor) * 100);
const texto = (valor) => String(valor ?? "").trim();
const norm = (valor) => texto(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const financeiro = await lerJsonDuravel("financeiro.json", []);
const recebimentos = await lerJsonDuravel("recebimentos.json", []);
const caixa = await lerJsonDuravel("caixa.json", { caixas: [], movimentos: [] });
const mensalidades = await lerJsonDuravel("mensalidades.json", []);

const estornados = (Array.isArray(recebimentos) ? recebimentos : [])
  .filter((r) => ["estornado", "estornada"].includes(norm(r.status)));

let titulosCorrigidos = 0;
let mensalidadesCorrigidas = 0;
let movimentosCorrigidos = 0;

for (const recebimento of estornados) {
  const tituloId = texto(recebimento.lancamentoFinanceiroId || recebimento.financeiroId);
  const mensalidadeId = texto(recebimento.mensalidadeId);
  const reciboId = texto(recebimento.reciboId || recebimento.ultimoReciboId);

  const titulo = financeiro.find((item) => String(item.id) === tituloId);
  if (titulo) {
    const totalC = Number.isInteger(titulo.valorCentavos)
      ? titulo.valorCentavos
      : centavos(titulo.valorOriginal ?? titulo.valorBruto ?? titulo.valor ?? titulo.total);

    titulo.status = "Aberto";
    titulo.valorPagoCentavos = 0;
    titulo.valorPago = 0;
    titulo.valorRecebido = 0;
    titulo.valorBrutoRecebido = 0;
    titulo.saldoCentavos = totalC;
    titulo.valorRestante = numero(totalC / 100);
    titulo.taxaOperadoraValorCentavos = 0;
    titulo.taxaOperadoraValor = 0;
    titulo.ultimaTaxaOperadoraValor = 0;
    titulo.valorLiquido = 0;
    titulo.valorRecebidoLiquido = 0;
    titulo.ultimoReciboId = "";
    titulo.caixaId = "";
    titulo.movimentoCaixaId = "";
    titulo.estornadoEm = recebimento.estornadoEm || new Date().toISOString();
    titulo.atualizadoEm = new Date().toISOString();
    titulosCorrigidos += 1;
  }

  for (const mensalidade of mensalidades) {
    const relacionada = String(mensalidade.id || "") === mensalidadeId ||
      String(mensalidade.lancamentoFinanceiroId || mensalidade.financeiroId || "") === tituloId;
    if (!relacionada) continue;

    const total = numero(mensalidade.valorOriginal ?? mensalidade.total ?? mensalidade.valor ?? titulo?.valor ?? 0);
    mensalidade.status = "aberto";
    mensalidade.valorPago = 0;
    mensalidade.valorRecebido = 0;
    mensalidade.valorBrutoRecebido = 0;
    mensalidade.valorRestante = total;
    mensalidade.taxaOperadoraValor = 0;
    mensalidade.ultimaTaxaOperadoraValor = 0;
    mensalidade.valorLiquido = 0;
    mensalidade.estornadoEm = recebimento.estornadoEm || new Date().toISOString();
    mensalidade.atualizadoEm = new Date().toISOString();
    mensalidadesCorrigidas += 1;
  }

  for (const movimento of caixa.movimentos || []) {
    const entradaDoRecibo = String(movimento.reciboId || "") === reciboId && norm(movimento.tipo).includes("entrada");
    if (!entradaDoRecibo || norm(movimento.origem) === "estorno_recibo") continue;
    movimento.status = "estornado";
    movimento.motivoEstorno = recebimento.motivoEstorno || "Estorno já registrado";
    movimento.estornadoEm = recebimento.estornadoEm || new Date().toISOString();
    movimento.atualizadoEm = new Date().toISOString();
    movimentosCorrigidos += 1;
  }
}

await salvarJsonMultiplosAtomico({
  "financeiro.json": financeiro,
  "mensalidades.json": mensalidades,
  "caixa.json": caixa
});

console.log(JSON.stringify({
  ok: true,
  recebimentosEstornados: estornados.length,
  titulosCorrigidos,
  mensalidadesCorrigidas,
  movimentosCorrigidos
}, null, 2));
