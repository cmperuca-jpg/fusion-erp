import fs from "node:fs/promises";
import path from "node:path";

const arquivo = path.resolve(process.cwd(), "data", "recebimentos.json");
const backup = path.resolve(
  process.cwd(),
  "data",
  `recebimentos.backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
);

function normalizar(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function numero(v) {
  const n = Number(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

try {
  const texto = await fs.readFile(arquivo, "utf8");
  const dados = texto.trim() ? JSON.parse(texto) : [];

  if (!Array.isArray(dados)) {
    throw new Error("recebimentos.json não contém uma lista.");
  }

  await fs.writeFile(backup, JSON.stringify(dados, null, 2), "utf8");

  const removidos = [];
  const mantidos = dados.filter((item) => {
    const origem = normalizar([
      item.origem,
      item.categoria,
      item.descricao,
      item.recorrencia
    ].join(" "));

    const matriculaInicial =
      origem.includes("matricula_inicial_unificada") ||
      origem.includes("entrada matricula") ||
      origem.includes("matricula e mensalidade") ||
      origem.includes("matricula + mensalidade");

    const semPagamento =
      numero(item.valorPago) <= 0 &&
      numero(item.valorRecebido) <= 0 &&
      numero(item.valorLiquido) <= 0;

    const aberto = ["", "aberto", "pendente", "programado"].includes(
      normalizar(item.status)
    );

    if (matriculaInicial && semPagamento && aberto) {
      removidos.push(item);
      return false;
    }

    return true;
  });

  await fs.writeFile(arquivo, JSON.stringify(mantidos, null, 2), "utf8");

  console.log(JSON.stringify({
    ok: true,
    backup,
    totalAntes: dados.length,
    removidos: removidos.length,
    totalDepois: mantidos.length
  }, null, 2));
} catch (erro) {
  console.error(JSON.stringify({
    ok: false,
    erro: erro.message
  }, null, 2));
  process.exitCode = 1;
}
