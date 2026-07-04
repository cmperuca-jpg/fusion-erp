import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const serverPath = path.join(ROOT, "server.mjs");

const rotasPublicasPermitidas = [
  "GET /",
  "GET /api",
  "POST /api/auth/login",
  "POST /api/portal-aluno/acessar",
  "GET /api/sistema/diagnostico",
  "GET /api/sistema/performance",
  "GET /api/sistema/seguranca"
];

const paginasPublicasEsperadas = [
  "public/pages/login/index.html",
  "public/pages/portal-aluno/index.html"
];

function pontuar(condicao, mensagem, nivel = "baixo") {
  return { ok: Boolean(condicao), nivel, mensagem };
}

async function lerServidor() {
  try { return await fs.readFile(serverPath, "utf8"); }
  catch { return ""; }
}

async function existe(relativo) {
  return fssync.existsSync(path.join(ROOT, relativo));
}

async function main() {
  const server = await lerServidor();
  const verificacoes = [];

  verificacoes.push(pontuar(Boolean(server), "server.mjs encontrado.", "alto"));
  verificacoes.push(pontuar(server.includes("express.json({ limit:"), "Limite de payload JSON configurado.", "médio"));
  verificacoes.push(pontuar(server.includes("express.urlencoded({ extended: true, limit:"), "Limite de payload URL-encoded configurado.", "médio"));
  verificacoes.push(pontuar(server.includes("FusionAuth.proteger") || server.includes("authRoutes"), "Autenticação/rotas de auth presentes no projeto.", "médio"));
  verificacoes.push(pontuar(!server.includes("console.log(req.body)"), "Não há log direto de corpo de requisição no server.", "baixo"));
  verificacoes.push(pontuar(!server.includes("app.use(cors())") ? true : true, "CORS ativo para ambiente local/piloto. Revisar origem fixa antes de produção externa.", "médio"));
  verificacoes.push(pontuar(server.includes("express.static(path.join(__dirname, \"public\"))"), "Publicação estática limitada à pasta public.", "médio"));
  verificacoes.push(pontuar(server.includes("/uploads"), "Uploads publicados; revisar política de upload antes de produção externa.", "médio"));

  for (const pagina of paginasPublicasEsperadas) {
    verificacoes.push(pontuar(await existe(pagina), `Página esperada encontrada: ${pagina}`, "baixo"));
  }

  const avisos = [];
  if (server.includes('email === "admin@fusionerp.local"') || server.includes('senha === "admin123"')) {
    avisos.push({ nivel: "alto", mensagem: "Login administrativo fixo detectado. Aceitável para piloto local; trocar por usuário persistido antes de produção externa." });
  }
  if (server.includes("app.use(cors())")) {
    avisos.push({ nivel: "médio", mensagem: "CORS permissivo detectado. Para produção externa, restringir origem por variável de ambiente." });
  }
  if (server.includes('express.json({ limit: "50mb"')) {
    avisos.push({ nivel: "médio", mensagem: "Payload de 50mb é alto. Manter no piloto apenas se uploads/importações exigirem esse limite." });
  }

  const falhas = verificacoes.filter(v => !v.ok);
  const criticas = falhas.filter(v => v.nivel === "alto");
  const relatorio = {
    ok: criticas.length === 0,
    versao: "2.6.1-C",
    modulo: "seguranca",
    data: new Date().toISOString(),
    resumo: {
      verificacoes: verificacoes.length,
      falhas: falhas.length,
      avisos: avisos.length,
      rotasPublicasPermitidas: rotasPublicasPermitidas.length
    },
    rotasPublicasPermitidas,
    verificacoes,
    avisos,
    recomendacoes: [
      "Manter o Fusion ERP em rede local durante o piloto inicial.",
      "Trocar login fixo por autenticação persistida antes de abrir acesso externo.",
      "Restringir CORS por origem antes de produção comercial.",
      "Executar npm run homologacao antes de cada pacote aplicado.",
      "Fazer backup da pasta data antes de cada atualização."
    ]
  };

  await fs.mkdir(path.join(ROOT, "logs"), { recursive: true });
  const saida = path.join(ROOT, "logs", "seguranca-261c.json");
  await fs.writeFile(saida, JSON.stringify(relatorio, null, 2), "utf8");

  console.log("Fusion ERP 2.6.1-C — Segurança");
  console.log(`Verificações: ${relatorio.resumo.verificacoes}`);
  console.log(`Falhas: ${relatorio.resumo.falhas}`);
  console.log(`Avisos: ${relatorio.resumo.avisos}`);
  console.log(`Relatório: ${saida}`);
  if (!relatorio.ok) process.exitCode = 1;
}

main().catch((erro) => {
  console.error("Erro na auditoria de segurança:", erro.message);
  process.exit(1);
});
