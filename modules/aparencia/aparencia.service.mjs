import fs from "node:fs/promises";
import path from "node:path";

const DATA_FILE = path.resolve(process.cwd(), "data", "aparencia.json");
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "aparencia");

const PAGINAS = {
  comercial: {
    rota: "/pages/comercial/index.html",
    elementos: {
      titulo: { seletor: ".hero-copy h1", texto: "Escolha o ambiente que deseja acessar.", visivel: true },
      descricao: { seletor: ".hero-description", texto: "Acesso exclusivo para funcionários, alunos e professores.", visivel: true },
      botaoSistema: { seletor: ".home-actions .primary-action:nth-child(1) strong", texto: "Login do Sistema", visivel: true },
      botaoAluno: { seletor: ".home-actions .primary-action:nth-child(2) strong", texto: "Portal do Cliente / Aluno", visivel: true },
      botaoProfessor: { seletor: ".home-actions .primary-action:nth-child(3) strong", texto: "Login do Professor", visivel: true }
    }
  },
  login: {
    rota: "/pages/login/index.html",
    elementos: {
      titulo: { seletor: ".login-card h1", texto: "Fusion ERP", visivel: true },
      subtitulo: { seletor: ".login-card .sub", texto: "Entrar no sistema", visivel: true },
      botaoEntrar: { seletor: "#btnEntrar", texto: "Entrar", visivel: true }
    }
  },
  alunos: {
    rota: "/pages/alunos/index.html",
    elementos: {
      titulo: { seletor: ".alunos-header-card h2", texto: "Gestão de Alunos", visivel: true },
      descricao: { seletor: ".alunos-header-card p", texto: "Cadastro, ficha completa, histórico e atalhos operacionais.", visivel: true },
      botaoNovo: { seletor: "#btnNovoAluno", texto: "Novo aluno", visivel: true },
      botaoAtualizar: { seletor: "#btnAtualizar", texto: "Atualizar", visivel: true }
    }
  },
  configuracoes: {
    rota: "/pages/configuracoes/index.html",
    elementos: {
      titulo: { seletor: ".fusion-content > .fusion-card:first-child h2", texto: "Configurações", visivel: true },
      descricao: { seletor: ".fusion-content > .fusion-card:first-child p", texto: "Área reservada para usuários, permissões, parâmetros do sistema e dados da academia.", visivel: true }
    }
  }
};

export const PADRAO_APARENCIA = {
  versao: 3,
  tema: {
    corPrimaria: "#ff6600",
    corPrimariaHover: "#d95600",
    corFundo: "#f4f6f9",
    corPainel: "#ffffff",
    corTexto: "#111827",
    corMenu: "#101826",
    raioBotao: 12,
    raioCard: 18,
    sombra: true
  },
  marca: {
    nome: "Fusion ERP",
    subtitulo: "Gestão para academias",
    logoUrl: "",
    bannerUrl: ""
  },
  paginas: PAGINAS,
  atualizadoEm: null
};

function texto(valor, fallback = "", limite = 180) {
  const saida = String(valor ?? "").replace(/[<>]/g, "").trim();
  return (saida || fallback).slice(0, limite);
}
function cor(valor, fallback) {
  const v = String(valor || "").trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}
function numero(valor, fallback, min, max) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}
function urlSegura(valor = "") {
  const v = String(valor || "").trim();
  if (!v) return "";
  if (v.startsWith("/uploads/aparencia/")) return v;
  if (/^https:\/\//i.test(v)) return v.slice(0, 500);
  return "";
}

function normalizarPaginas(paginas = {}) {
  const saida = {};
  for (const [paginaId, padraoPagina] of Object.entries(PAGINAS)) {
    const recebida = paginas[paginaId] || {};
    const elementos = {};
    for (const [elementoId, padraoElemento] of Object.entries(padraoPagina.elementos)) {
      const atual = recebida.elementos?.[elementoId] || {};
      elementos[elementoId] = {
        seletor: padraoElemento.seletor,
        texto: texto(atual.texto, padraoElemento.texto, 180),
        visivel: atual.visivel !== false
      };
    }
    saida[paginaId] = { rota: padraoPagina.rota, elementos };
  }
  return saida;
}

export function normalizarAparencia(payload = {}) {
  const t = payload.tema || {};
  const m = payload.marca || {};
  return {
    versao: 3,
    tema: {
      corPrimaria: cor(t.corPrimaria, PADRAO_APARENCIA.tema.corPrimaria),
      corPrimariaHover: cor(t.corPrimariaHover, PADRAO_APARENCIA.tema.corPrimariaHover),
      corFundo: cor(t.corFundo, PADRAO_APARENCIA.tema.corFundo),
      corPainel: cor(t.corPainel, PADRAO_APARENCIA.tema.corPainel),
      corTexto: cor(t.corTexto, PADRAO_APARENCIA.tema.corTexto),
      corMenu: cor(t.corMenu, PADRAO_APARENCIA.tema.corMenu),
      raioBotao: numero(t.raioBotao, 12, 0, 30),
      raioCard: numero(t.raioCard, 18, 0, 40),
      sombra: t.sombra !== false
    },
    marca: {
      nome: texto(m.nome, PADRAO_APARENCIA.marca.nome, 60),
      subtitulo: texto(m.subtitulo, PADRAO_APARENCIA.marca.subtitulo, 100),
      logoUrl: urlSegura(m.logoUrl),
      bannerUrl: urlSegura(m.bannerUrl)
    },
    paginas: normalizarPaginas(payload.paginas),
    atualizadoEm: new Date().toISOString()
  };
}

async function gravar(dados) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const temp = `${DATA_FILE}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temp, JSON.stringify(dados, null, 2), "utf8");
  await fs.rename(temp, DATA_FILE);
}

export async function obterAparencia() {
  try {
    const bruto = await fs.readFile(DATA_FILE, "utf8");
    return normalizarAparencia(JSON.parse(bruto));
  } catch {
    const padrao = normalizarAparencia(PADRAO_APARENCIA);
    await gravar(padrao);
    return padrao;
  }
}

export async function salvarAparencia(payload = {}) {
  const dados = normalizarAparencia(payload);
  await gravar(dados);
  return dados;
}

export async function restaurarAparencia() {
  return salvarAparencia(PADRAO_APARENCIA);
}

export async function salvarImagem({ dataUrl, tipo } = {}) {
  const match = String(dataUrl || "").match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw Object.assign(new Error("Imagem inválida. Use PNG, JPG ou WEBP."), { status: 400 });
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 5 * 1024 * 1024) throw Object.assign(new Error("A imagem deve ter no máximo 5 MB."), { status: 400 });
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const nomeTipo = tipo === "banner" ? "banner" : "logo";
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const nome = `${nomeTipo}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, nome), buffer);
  return { url: `/uploads/aparencia/${nome}` };
}
