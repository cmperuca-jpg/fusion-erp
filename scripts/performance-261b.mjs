import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const ROOT = process.cwd();
const jsonsCriticos = [
  "data/alunos.json",
  "data/professores.json",
  "data/matriculas.json",
  "data/financeiro.json",
  "data/mensalidades.json",
  "data/frequencia.json",
  "data/checkins.json",
  "data/treinos.json",
  "data/treinos_integrados.json",
  "data/treinos_execucoes.json"
];

async function medirJson(relativo) {
  const absoluto = path.join(ROOT, relativo);
  const inicio = performance.now();
  if (!fssync.existsSync(absoluto)) {
    return { arquivo: relativo, existe: false, bytes: 0, registros: 0, tempoMs: 0, ok: true };
  }

  try {
    const bruto = await fs.readFile(absoluto, "utf8");
    const dados = bruto.trim() ? JSON.parse(bruto) : [];
    const fim = performance.now();
    return {
      arquivo: relativo,
      existe: true,
      bytes: Buffer.byteLength(bruto),
      registros: Array.isArray(dados) ? dados.length : Object.keys(dados || {}).length,
      tempoMs: Number((fim - inicio).toFixed(3)),
      ok: true
    };
  } catch (erro) {
    const fim = performance.now();
    return { arquivo: relativo, existe: true, bytes: 0, registros: 0, tempoMs: Number((fim - inicio).toFixed(3)), ok: false, erro: erro.message };
  }
}

function classificarTempo(ms) {
  if (ms <= 25) return "bom";
  if (ms <= 100) return "atenção";
  return "crítico";
}

async function main() {
  const inicio = performance.now();
  const arquivos = await Promise.all(jsonsCriticos.map(medirJson));
  const totalBytes = arquivos.reduce((t, a) => t + a.bytes, 0);
  const totalRegistros = arquivos.reduce((t, a) => t + a.registros, 0);
  const invalidos = arquivos.filter(a => !a.ok);
  const lentos = arquivos.filter(a => a.tempoMs > 100);
  const memoria = process.memoryUsage();
  const tempoTotalMs = Number((performance.now() - inicio).toFixed(3));

  const relatorio = {
    ok: invalidos.length === 0,
    versao: "2.6.1-B",
    modulo: "performance",
    data: new Date().toISOString(),
    resumo: {
      arquivosVerificados: arquivos.length,
      arquivosInvalidos: invalidos.length,
      arquivosLentos: lentos.length,
      totalRegistros,
      totalBytes,
      totalMB: Number((totalBytes / 1024 / 1024).toFixed(3)),
      tempoTotalMs,
      classificacaoTempo: classificarTempo(tempoTotalMs),
      heapUsadoMB: Number((memoria.heapUsed / 1024 / 1024).toFixed(3)),
      rssMB: Number((memoria.rss / 1024 / 1024).toFixed(3))
    },
    arquivos,
    recomendacoes: [
      "Manter leituras JSON agrupadas por requisição nos dashboards.",
      "Evitar recarregamento completo de páginas quando apenas KPIs mudarem.",
      "Usar /api/sistema/performance antes do piloto para acompanhar memória e arquivos críticos.",
      "Migrar dados com crescimento elevado para banco relacional quando o volume operacional aumentar."
    ]
  };

  const outDir = path.join(ROOT, "logs");
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, "performance-261b.json");
  await fs.writeFile(out, JSON.stringify(relatorio, null, 2), "utf8");

  console.log("Fusion ERP 2.6.1-B — Performance");
  console.log(`Arquivos verificados: ${arquivos.length}`);
  console.log(`JSONs inválidos: ${invalidos.length}`);
  console.log(`Tempo total: ${tempoTotalMs} ms`);
  console.log(`Heap usado: ${relatorio.resumo.heapUsadoMB} MB`);
  console.log(`Relatório: ${out}`);

  if (!relatorio.ok) process.exitCode = 1;
}

main().catch((erro) => {
  console.error("Falha na auditoria de performance:", erro);
  process.exit(1);
});
