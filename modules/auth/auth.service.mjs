import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const DATA_DIR = path.resolve(process.cwd(), "data");
const USUARIOS_FILE = path.join(DATA_DIR, "usuarios.json");
const JWT_SECRET = process.env.JWT_SECRET || process.env.FUSION_JWT_SECRET || "fusion-erp-dev-secret-trocar-em-producao";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

const PERFIS_PADRAO = {
  Administrador: ["*"],
  Gerente: [
    "dashboard", "alunos", "professores", "matriculas", "matriculas-pendentes",
    "financeiro", "mensalidades", "caixa", "comercial", "comercial-painel", "site-chat",
    "avaliacoes", "treinos", "planos", "turmas", "relatorios"
  ],
  Recepcao: [
    "dashboard", "alunos", "matriculas", "matriculas-pendentes", "financeiro",
    "mensalidades", "caixa", "comercial", "comercial-painel", "site-chat", "checkin"
  ],
  Comercial: ["dashboard", "comercial", "comercial-painel", "site-chat", "matriculas-pendentes", "leads", "matricula-online"],
  Professor: ["professor-area", "avaliacoes", "treinos", "aluno-treinos"],
  Aluno: ["aluno-treinos", "aluno-avaliacao"]
};

function agoraISO() {
  return new Date().toISOString();
}

function gerarId(prefixo = "usr") {
  return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function texto(valor) {
  return String(valor ?? "").trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase();
}

function senhaHash(senha) {
  return crypto.createHash("sha256").update(String(senha || "")).digest("hex");
}

function semSenha(usuario = {}) {
  const { senha, senhaHash: _, ...limpo } = usuario;
  return limpo;
}

function permissoesPorPerfil(perfil = "Recepcao") {
  return PERFIS_PADRAO[perfil] || PERFIS_PADRAO.Recepcao;
}

function erro(mensagem, status = 500) {
  return Object.assign(new Error(mensagem), { status });
}

async function garantirArquivoUsuarios() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(USUARIOS_FILE);
  } catch {
    const admin = {
      id: "usr_admin",
      nome: "Administrador Fusion",
      email: "admin@fusionerp.local",
      senhaHash: senhaHash("admin123"),
      perfil: "Administrador",
      status: "ativo",
      permissoes: ["*"],
      criadoEm: agoraISO(),
      atualizadoEm: agoraISO()
    };
    await fs.writeFile(USUARIOS_FILE, JSON.stringify([admin], null, 2), "utf8");
  }
}

async function lerUsuarios() {
  await garantirArquivoUsuarios();
  const bruto = await fs.readFile(USUARIOS_FILE, "utf8");
  const lista = bruto.trim() ? JSON.parse(bruto) : [];
  return Array.isArray(lista) ? lista : [];
}

async function salvarUsuarios(lista) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(USUARIOS_FILE, JSON.stringify(lista, null, 2), "utf8");
}

function validarPayloadUsuario(payload = {}, editando = false) {
  const nome = texto(payload.nome);
  const email = normalizar(payload.email);
  const perfil = texto(payload.perfil || "Recepcao");
  const status = normalizar(payload.status || "ativo") === "inativo" ? "inativo" : "ativo";
  const senha = texto(payload.senha);

  if (!nome) throw erro("Nome é obrigatório.", 400);
  if (!email || !email.includes("@")) throw erro("E-mail inválido.", 400);
  if (!editando && !senha) throw erro("Senha é obrigatória.", 400);

  const permissoes = Array.isArray(payload.permissoes) && payload.permissoes.length
    ? payload.permissoes.map(texto).filter(Boolean)
    : permissoesPorPerfil(perfil);

  return { nome, email, perfil, status, senha, permissoes };
}

function gerarToken(usuario) {
  return jwt.sign(
    {
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
      permissoes: usuario.permissoes || permissoesPorPerfil(usuario.perfil)
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function extrairToken(authorization = "") {
  const valor = texto(authorization);
  if (!valor) return "";
  if (valor.toLowerCase().startsWith("bearer ")) return valor.slice(7).trim();
  return valor;
}

export async function listarUsuarios() {
  const usuarios = await lerUsuarios();
  return usuarios.map(semSenha).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

export async function obterUsuario(id) {
  const usuarios = await lerUsuarios();
  const usuario = usuarios.find(u => String(u.id) === String(id));
  if (!usuario) throw erro("Usuário não encontrado.", 404);
  return semSenha(usuario);
}

export async function criarUsuario(payload = {}) {
  const usuarios = await lerUsuarios();
  const dados = validarPayloadUsuario(payload, false);

  if (usuarios.some(u => normalizar(u.email) === dados.email)) {
    throw erro("Já existe um usuário com este e-mail.", 409);
  }

  const novo = {
    id: gerarId(),
    nome: dados.nome,
    email: dados.email,
    senhaHash: senhaHash(dados.senha),
    perfil: dados.perfil,
    status: dados.status,
    permissoes: dados.permissoes,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  usuarios.push(novo);
  await salvarUsuarios(usuarios);
  return semSenha(novo);
}

export async function atualizarUsuario(id, payload = {}) {
  const usuarios = await lerUsuarios();
  const idx = usuarios.findIndex(u => String(u.id) === String(id));
  if (idx < 0) throw erro("Usuário não encontrado.", 404);

  const dados = validarPayloadUsuario(payload, true);
  const emailDuplicado = usuarios.some((u, i) => i !== idx && normalizar(u.email) === dados.email);
  if (emailDuplicado) throw erro("Já existe outro usuário com este e-mail.", 409);

  usuarios[idx] = {
    ...usuarios[idx],
    nome: dados.nome,
    email: dados.email,
    perfil: dados.perfil,
    status: dados.status,
    permissoes: dados.permissoes,
    atualizadoEm: agoraISO()
  };

  if (dados.senha) usuarios[idx].senhaHash = senhaHash(dados.senha);

  await salvarUsuarios(usuarios);
  return semSenha(usuarios[idx]);
}

export async function alternarStatusUsuario(id) {
  const usuarios = await lerUsuarios();
  const idx = usuarios.findIndex(u => String(u.id) === String(id));
  if (idx < 0) throw erro("Usuário não encontrado.", 404);

  usuarios[idx].status = normalizar(usuarios[idx].status) === "ativo" ? "inativo" : "ativo";
  usuarios[idx].atualizadoEm = agoraISO();

  await salvarUsuarios(usuarios);
  return semSenha(usuarios[idx]);
}

export async function removerUsuario(id) {
  const usuarios = await lerUsuarios();
  const usuario = usuarios.find(u => String(u.id) === String(id));
  if (!usuario) throw erro("Usuário não encontrado.", 404);
  if (usuario.id === "usr_admin") throw erro("O administrador padrão não pode ser removido.", 400);

  await salvarUsuarios(usuarios.filter(u => String(u.id) !== String(id)));
  return { removido: true };
}

export async function autenticar(email, senha) {
  const usuarios = await lerUsuarios();
  const usuario = usuarios.find(u => normalizar(u.email) === normalizar(email));

  if (!usuario || usuario.senhaHash !== senhaHash(senha)) {
    throw erro("E-mail ou senha inválidos.", 401);
  }

  if (normalizar(usuario.status) !== "ativo") {
    throw erro("Usuário inativo. Procure o administrador.", 403);
  }

  const usuarioSessao = semSenha(usuario);

  return {
    ok: true,
    token: gerarToken(usuario),
    usuario: usuarioSessao
  };
}

export async function validarToken(tokenOuAuthorization) {
  const token = extrairToken(tokenOuAuthorization);
  if (!token) throw erro("Token de autenticação ausente.", 401);

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw erro("Sessão expirada ou inválida. Faça login novamente.", 401);
  }

  const usuarios = await lerUsuarios();
  const usuario = usuarios.find(u => String(u.id) === String(payload.sub));
  if (!usuario) throw erro("Usuário não encontrado.", 401);
  if (normalizar(usuario.status) !== "ativo") throw erro("Usuário inativo. Procure o administrador.", 403);

  return semSenha(usuario);
}

export async function obterPerfis() {
  return Object.entries(PERFIS_PADRAO).map(([perfil, permissoes]) => ({ perfil, permissoes }));
}

export async function usuarioPadrao() {
  await garantirArquivoUsuarios();
  const usuarios = await lerUsuarios();
  return semSenha(usuarios[0]);
}
