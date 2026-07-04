import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, "logs");

const relatoriosObrigatorios = [
  {
    etapa: "2.6.1-A",
    nome: "Auditoria Geral",
    arquivo: "auditoria-261a.json"
  },
  {
    etapa: "2.6.1-B",
    nome: "Performance",
    arquivo: "performance-261b.json"
  },
  {
    etapa: "2.6.1-C",
    nome: "Segurança",
    arquivo: "seguranca-261c.json"
  },
  {
    etapa: "2.6.1-D",
    nome: "Interface",
    arquivo: "interface-261d.json"
  }
];

function caminhoLog(nome) {
  return path.join(LOG_DIR, nome);
}

async function lerJsonLog(item) {
  const absoluto = caminhoLog(item.arquivo);

  if (!fssync.existsSync(absoluto)) {
    return {
      ...item,
      existe: false,
      ok: false,
      erro: "Relatório não encontrado. Execute npm run homologacao antes de npm run piloto."
    };
  }

  try {
    const bruto = await fs.readFile(absoluto, "utf8");
    const dados = bruto.trim() ? JSON.parse(bruto) : null;

    return {
      ...item,
      existe: true,
      ok: Boolean(dados?.ok),
      versaoRelatorio: dados?.versao || null,
      modulo: dados?.modulo || null,
      resumo: dados?.resumo || {},
      geradoEm: dados?.data || dados?.geradoEm || null
    };
  } catch (erro) {
    return {
      ...item,
      existe: true,
      ok: false,
      erro: erro.message
    };
  }
}

async function verificarPackage() {
  const arquivo = path.join(ROOT, "package.json");

  if (!fssync.existsSync(arquivo)) {
    return {
      existe: false,
      ok: false,
      erro: "package.json não encontrado."
    };
  }

  try {
    const pkg = JSON.parse(await fs.readFile(arquivo, "utf8"));
    const scripts = pkg.scripts || {};

    return {
      existe: true,
      ok: true,
      nome: pkg.name || null,
      versaoPackage: pkg.version || null,
      scripts: {
        check: Boolean(scripts.check),
        homologacao: Boolean(scripts.homologacao),
        piloto: Boolean(scripts.piloto),
        release: Boolean(scripts.release)
      }
    };
  } catch (erro) {
    return {
      existe: true,
      ok: false,
      erro: erro.message
    };
  }
}

async function main() {
  const inicio = Date.now();

  await fs.mkdir(LOG_DIR, { recursive: true });

  const etapas = await Promise.all(relatoriosObrigatorios.map(lerJsonLog));
  const packageInfo = await verificarPackage();

  const faltantes = etapas.filter((e) => !e.existe);
  const reprovadas = etapas.filter((e) => e.existe && !e.ok);
  const scriptsAusentes = packageInfo.ok
    ? Object.entries(packageInfo.scripts).filter(([, ativo]) => !ativo).map(([nome]) => nome)
    : [];

  const ok = (
    packageInfo.ok &&
    faltantes.length === 0 &&
    reprovadas.length === 0 &&
    scriptsAusentes.length === 0
  );

  const relatorio = {
    ok,
    versao: "2.6.1-E",
    modulo: "homologacao-final",
    data: new Date().toISOString(),
    objetivo: "Consolidar a homologação final da linha Fusion ERP 2.6.1 para implantação piloto.",
    resumo: {
      etapasObrigatorias: etapas.length,
      etapasAprovadas: etapas.filter((e) => e.ok).length,
      etapasFaltantes: faltantes.length,
      etapasReprovadas: reprovadas.length,
      scriptsPackageAusentes: scriptsAusentes.length,
      tempoMs: Date.now() - inicio
    },
    package: packageInfo,
    etapas,
    resultado: ok
      ? "Fusion ERP 2.6.1 aprovado para projeto piloto."
      : "Fusion ERP 2.6.1 ainda não aprovado para piloto.",
    recomendacoes: ok
      ? [
          "Executar npm run release para congelar oficialmente a versão 2.6.1.",
          "Manter a linha 2.6.1 sem novas funcionalidades.",
          "Direcionar evoluções futuras para a versão 2.7."
        ]
      : [
          "Executar npm run homologacao antes de npm run piloto.",
          "Corrigir relatórios ausentes ou reprovados.",
          "Confirmar se package.json contém os scripts check, homologacao, piloto e release."
        ]
  };

  const saida = path.join(LOG_DIR, "homologacao-final-261e.json");
  await fs.writeFile(saida, JSON.stringify(relatorio, null, 2), "utf8");

  console.log("Fusion ERP 2.6.1-E — Homologação Final");
  console.log(`Etapas obrigatórias: ${relatorio.resumo.etapasObrigatorias}`);
  console.log(`Etapas aprovadas: ${relatorio.resumo.etapasAprovadas}`);
  console.log(`Etapas faltantes: ${relatorio.resumo.etapasFaltantes}`);
  console.log(`Etapas reprovadas: ${relatorio.resumo.etapasReprovadas}`);
  console.log(`Scripts ausentes no package.json: ${relatorio.resumo.scriptsPackageAusentes}`);
  console.log(`Relatório: ${saida}`);

  if (!ok) process.exitCode = 1;
}

main().catch((erro) => {
  console.error("Falha na homologação final 2.6.1-E:", erro.message);
  process.exit(1);
});
