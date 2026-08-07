import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";
import { executarComTenant, tenantAtual, normalizarTenantId } from "../core/persistence/tenant-context.mjs";
import { localizarTenantPorEmail, localizarAcessoPorEmpresaCodigo, sincronizarIndiceUsuario, removerIndiceUsuario, validarEmailDisponivel, obterCodigoAcessoUsuario, regenerarCodigoAcessoUsuario } from "./tenant-registry.service.mjs";

const SEGREDO_DESENVOLVIMENTO = "fusion-erp-dev-secret-trocar-em-producao";
const JWT_SECRET_CONFIGURADO = process.env.JWT_SECRET || process.env.FUSION_JWT_SECRET || "";
const JWT_SECRET = JWT_SECRET_CONFIGURADO || SEGREDO_DESENVOLVIMENTO;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";
const BCRYPT_ROUNDS = Math.min(Math.max(Number(process.env.FUSION_BCRYPT_ROUNDS || 12), 10), 14);

if (process.env.NODE_ENV === "production" && !JWT_SECRET_CONFIGURADO) {
  throw new Error("Producao exige JWT_SECRET ou FUSION_JWT_SECRET para proteger as sessoes.");
}

if (process.env.NODE_ENV === "production" && JWT_SECRET_CONFIGURADO.length < 32) {
  throw new Error("JWT_SECRET/FUSION_JWT_SECRET deve ter pelo menos 32 caracteres em producao.");
}

const PERFIS_PADRAO = {
  Administrador: ["*"],
  Gerente: [
    "dashboard", "alunos", "professores", "matriculas", "matriculas-pendentes",
    "financeiro", "mensalidades", "caixa", "comercial", "comercial-painel", "site-chat",
    "planos", "turmas", "relatorios"
  ],
  Recepcao: [
    "dashboard", "alunos", "matriculas", "matriculas-pendentes", "financeiro",
    "mensalidades", "caixa", "comercial", "comercial-painel", "site-chat", "checkin"
  ],
  Comercial: ["dashboard", "comercial", "comercial-painel", "site-chat", "matriculas-pendentes", "leads", "matricula-online"],
  Professor: ["professor-area"],
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

function senhaHashLegado(senha) {
  return crypto.createHash("sha256").update(String(senha || "")).digest("hex");
}

async function senhaBcrypt(senha) {
  return bcrypt.hash(String(senha || ""), BCRYPT_ROUNDS);
}

function pareceBcrypt(hash = "") {
  return /^\$2[aby]\$\d{2}\$/.test(String(hash || ""));
}

function textoSeguroIgual(a = "", b = "") {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

async function verificarSenhaUsuario(usuario = {}, senha = "") {
  const hashAtual = String(usuario.senhaHash || "");
  const hashBcrypt = String(usuario.senhaBcrypt || "");

  for (const hash of [hashAtual, hashBcrypt].filter(pareceBcrypt)) {
    if (await bcrypt.compare(String(senha || ""), hash)) {
      return { ok: true, migrar: hash !== hashAtual };
    }
  }

  const hashLegado = String(usuario.senhaHashLegado || (!pareceBcrypt(hashAtual) ? hashAtual : ""));
  if (hashLegado && textoSeguroIgual(hashLegado, senhaHashLegado(senha))) {
    return { ok: true, migrar: true };
  }

  const senhaTexto = String(usuario.senhaAcesso || usuario.senhaPortal || "");
  if (senhaTexto && textoSeguroIgual(senhaTexto, String(senha || ""))) {
    return { ok: true, migrar: Boolean(!hashAtual && !hashBcrypt && !hashLegado) };
  }

  return { ok: false, migrar: false };
}

function semSenha(usuario = {}, opcoes = {}) {
  const { senha, senhaHash: _, senhaBcrypt: __, senhaHashLegado: ___, ...limpo } = usuario;
  if (!opcoes.incluirSenhaAcesso) {
    delete limpo.senhaAcesso;
    delete limpo.senhaPortal;
  }
  return limpo;
}

function permissoesPorPerfil(perfil = "Recepcao") {
  return PERFIS_PADRAO[perfil] || PERFIS_PADRAO.Recepcao;
}

function erro(mensagem, status = 500) {
  return Object.assign(new Error(mensagem), { status });
}

function senhaInicialAdmin() {
  const configurada = texto(process.env.FUSION_BOOTSTRAP_ADMIN_PASSWORD || process.env.FUSION_ADMIN_PASSWORD);
  if (configurada) {
    if (configurada.length < 10) {
      throw erro("FUSION_BOOTSTRAP_ADMIN_PASSWORD/FUSION_ADMIN_PASSWORD precisa ter pelo menos 10 caracteres.", 500);
    }
    return { senha: configurada, gerada: false };
  }

  return { senha: crypto.randomBytes(18).toString("base64url"), gerada: true };
}

async function gravarCredenciaisIniciais(senha) {
  const dataDir = path.resolve(process.cwd(), "data");
  const arquivo = path.join(dataDir, "CREDENCIAIS-INICIAIS.txt");
  const conteudo = [
    "FUSION ERP - CREDENCIAIS INICIAIS",
    "",
    "Administrador",
    "E-mail: admin@fusionerp.local",
    `Senha: ${senha}`,
    "",
    "Troque esta senha no primeiro acesso e remova este arquivo depois."
  ].join("\n");

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(arquivo, `${conteudo}\n`, "utf8");
  console.warn("[Auth] Credenciais iniciais geradas em data/CREDENCIAIS-INICIAIS.txt. Troque a senha no primeiro acesso.");
}

async function garantirArquivoUsuarios() {
  const existentes = await lerJsonDuravel("usuarios.json", []);
  if (Array.isArray(existentes) && existentes.length) return;
  if (process.env.NODE_ENV === "production") throw erro("Nenhum usuário foi migrado para o Supabase. Implantação bloqueada por segurança.", 503);
  const senhaInicial = senhaInicialAdmin();
  const admin = {
    id: "usr_admin", nome: "Administrador Fusion", email: "admin@fusionerp.local",
    senhaHash: await senhaBcrypt(senhaInicial.senha), perfil: "Administrador", status: "ativo",
    senhaAcesso: senhaInicial.senha, senhaPortal: senhaInicial.senha,
    permissoes: ["*"], trocarSenhaNoPrimeiroAcesso: true, criadoEm: agoraISO(), atualizadoEm: agoraISO()
  };
  await salvarJsonDuravel("usuarios.json", [admin]);
  if (senhaInicial.gerada) await gravarCredenciaisIniciais(senhaInicial.senha);
}

async function lerUsuarios() {
  await garantirArquivoUsuarios();
  const lista = await lerJsonDuravel("usuarios.json", []);
  return Array.isArray(lista) ? lista : [];
}

async function salvarUsuarios(lista) {
  await salvarJsonDuravel("usuarios.json", lista);
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

function gerarToken(usuario, tenantId = tenantAtual()) {
  return jwt.sign(
    {
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
      permissoes: usuario.permissoes || permissoesPorPerfil(usuario.perfil),
      tenantId
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

export function gerarTokenSuporte(usuario = {}, {
  sessionId,
  homeTenantId,
  targetTenantId,
  targetTenantName = "",
  reason = "",
  supportRole = "support_agent",
  expiresInMinutes = 30
} = {}) {
  if (!usuario?.id || !usuario?.email || !sessionId || !homeTenantId || !targetTenantId) {
    throw erro("Não foi possível criar a sessão de suporte.", 500);
  }

  const ttl = Math.min(Math.max(Number(expiresInMinutes || 30), 10), 120);
  return jwt.sign(
    {
      sub: usuario.id,
      email: usuario.email,
      perfil: "Administrador",
      permissoes: ["*"],
      tenantId: normalizarTenantId(targetTenantId),
      supportAccess: true,
      supportSessionId: String(sessionId),
      supportHomeTenantId: normalizarTenantId(homeTenantId),
      supportReason: texto(reason),
      supportRole: texto(supportRole || "support_agent"),
      supportTargetName: texto(targetTenantName)
    },
    JWT_SECRET,
    { expiresIn: `${ttl}m` }
  );
}

export function gerarTokenPortal({ sub, tipo, perfil = "", permissoes = [], nome = "", tenantId = tenantAtual() } = {}) {
  if (!sub || !tipo) throw erro("Não foi possível criar a sessão do portal.", 500);
  return jwt.sign(
    { sub: String(sub), tipo: String(tipo), perfil, permissoes, nome, tenantId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function validarTokenPortal(tokenOuAuthorization, tipoEsperado = "") {
  const token = extrairToken(tokenOuAuthorization);
  if (!token) throw erro("Sessão do portal ausente. Faça login novamente.", 401);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw erro("Sessão do portal expirada ou inválida. Faça login novamente.", 401);
  }
  if (!payload?.sub || !payload?.tipo || (tipoEsperado && String(payload.tipo) !== String(tipoEsperado))) {
    throw erro("Sessão incompatível com este portal.", 401);
  }
  return payload;
}

export async function listarUsuarios() {
  const usuarios = await lerUsuarios();
  return usuarios.map(u => semSenha(u, { incluirSenhaAcesso: true })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

export async function obterUsuario(id) {
  const usuarios = await lerUsuarios();
  const usuario = usuarios.find(u => String(u.id) === String(id));
  if (!usuario) throw erro("Usuário não encontrado.", 404);
  return semSenha(usuario, { incluirSenhaAcesso: true });
}

export async function criarUsuario(payload = {}) {
  const usuarios = await lerUsuarios();
  const dados = validarPayloadUsuario(payload, false);

  if (usuarios.some(u => normalizar(u.email) === dados.email)) {
    throw erro("Já existe um usuário com este e-mail.", 409);
  }
  await validarEmailDisponivel(dados.email, { tenantId: tenantAtual() });

  const novo = {
    id: gerarId(),
    nome: dados.nome,
    email: dados.email,
    senhaHash: await senhaBcrypt(dados.senha),
    senhaAcesso: dados.senha,
    senhaPortal: dados.senha,
    perfil: dados.perfil,
    status: dados.status,
    permissoes: dados.permissoes,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  usuarios.push(novo);
  await salvarUsuarios(usuarios);
  const indiceLogin = await sincronizarIndiceUsuario(novo, tenantAtual());
  return {
    ...semSenha(novo, { incluirSenhaAcesso: true }),
    codigoAcesso: indiceLogin?.access_code || ""
  };
}

export async function atualizarUsuario(id, payload = {}) {
  const usuarios = await lerUsuarios();
  const idx = usuarios.findIndex(u => String(u.id) === String(id));
  if (idx < 0) throw erro("Usuário não encontrado.", 404);

  const emailAnterior = usuarios[idx].email;
  const dados = validarPayloadUsuario(payload, true);
  const emailDuplicado = usuarios.some((u, i) => i !== idx && normalizar(u.email) === dados.email);
  if (emailDuplicado) throw erro("Já existe outro usuário com este e-mail.", 409);
  await validarEmailDisponivel(dados.email, { tenantId: tenantAtual(), userId: usuarios[idx].id });

  usuarios[idx] = {
    ...usuarios[idx],
    nome: dados.nome,
    email: dados.email,
    perfil: dados.perfil,
    status: dados.status,
    permissoes: dados.permissoes,
    atualizadoEm: agoraISO()
  };

  if (dados.senha) {
    usuarios[idx].senhaHash = await senhaBcrypt(dados.senha);
    usuarios[idx].senhaAcesso = dados.senha;
    usuarios[idx].senhaPortal = dados.senha;
    delete usuarios[idx].senhaBcrypt;
    delete usuarios[idx].senhaHashLegado;
  }

  await salvarUsuarios(usuarios);
  if (normalizar(emailAnterior) !== normalizar(usuarios[idx].email)) {
    await removerIndiceUsuario({ email: emailAnterior });
  }
  await sincronizarIndiceUsuario(usuarios[idx], tenantAtual());
  return semSenha(usuarios[idx], { incluirSenhaAcesso: true });
}

export async function alternarStatusUsuario(id) {
  const usuarios = await lerUsuarios();
  const idx = usuarios.findIndex(u => String(u.id) === String(id));
  if (idx < 0) throw erro("Usuário não encontrado.", 404);

  usuarios[idx].status = normalizar(usuarios[idx].status) === "ativo" ? "inativo" : "ativo";
  usuarios[idx].atualizadoEm = agoraISO();

  await salvarUsuarios(usuarios);
  await sincronizarIndiceUsuario(usuarios[idx], tenantAtual());
  return semSenha(usuarios[idx]);
}

export async function removerUsuario(id) {
  const usuarios = await lerUsuarios();
  const usuario = usuarios.find(u => String(u.id) === String(id));
  if (!usuario) throw erro("Usuário não encontrado.", 404);
  if (usuario.id === "usr_admin") throw erro("O administrador padrão não pode ser removido.", 400);

  await salvarUsuarios(usuarios.filter(u => String(u.id) !== String(id)));
  await removerIndiceUsuario(usuario);
  return { removido: true };
}

export async function autenticar(email, senha, tenantEsperado = "") {
  const indice = await localizarTenantPorEmail(email);
  if (!indice?.tenant_id) throw erro("E-mail ou senha inválidos.", 401);

  const esperado = normalizarTenantId(tenantEsperado);
  const tenantIndice = normalizarTenantId(indice.tenant_id);
  if (esperado && tenantIndice !== esperado) {
    throw erro("Este usuário não pertence a esta empresa.", 401);
  }

  return executarComTenant(tenantIndice, async () => {
    const usuarios = await lerUsuarios();
    const usuario = usuarios.find(u => normalizar(u.email) === normalizar(email));
    const verificacao = usuario ? await verificarSenhaUsuario(usuario, senha) : { ok: false };

    if (!usuario || !verificacao.ok) throw erro("E-mail ou senha inválidos.", 401);
    if (normalizar(usuario.status) !== "ativo") throw erro("Usuário inativo. Procure o administrador.", 403);

    if (verificacao.migrar) {
      usuario.senhaHash = await senhaBcrypt(senha);
      usuario.senhaAcesso = String(senha || "");
      usuario.senhaPortal = String(senha || "");
      delete usuario.senhaBcrypt;
      delete usuario.senhaHashLegado;
      usuario.atualizadoEm = agoraISO();
      await salvarUsuarios(usuarios);
    }

    await sincronizarIndiceUsuario(usuario, tenantIndice);
    const usuarioSessao = { ...semSenha(usuario), tenantId: tenantIndice };

    return {
      ok: true,
      token: gerarToken(usuario, tenantIndice),
      usuario: usuarioSessao,
      tenantId: tenantIndice
    };
  });
}

export async function autenticarPorEmpresaCodigo(empresa, codigo, senha) {
  const acesso = await localizarAcessoPorEmpresaCodigo(empresa, codigo);
  if (!acesso?.tenant_id || !acesso?.user_id) throw erro("Academia, código ou senha inválidos.", 401);

  return executarComTenant(acesso.tenant_id, async () => {
    const usuarios = await lerUsuarios();
    const usuario = usuarios.find(u => String(u.id) === String(acesso.user_id));
    const verificacao = usuario ? await verificarSenhaUsuario(usuario, senha) : { ok: false };

    if (!usuario || !verificacao.ok) throw erro("Academia, código ou senha inválidos.", 401);
    if (normalizar(usuario.status) !== "ativo") throw erro("Usuário inativo. Procure o administrador.", 403);
    if (verificacao.migrar) {
      usuario.senhaHash = await senhaBcrypt(senha);
      usuario.senhaAcesso = String(senha || "");
      usuario.senhaPortal = String(senha || "");
      delete usuario.senhaBcrypt;
      delete usuario.senhaHashLegado;
      usuario.atualizadoEm = agoraISO();
      await salvarUsuarios(usuarios);
    }

    const usuarioSessao = { ...semSenha(usuario), tenantId: acesso.tenant_id, academiaNome: acesso.tenant_name };
    return {
      ok: true,
      token: gerarToken(usuario, acesso.tenant_id),
      usuario: usuarioSessao,
      tenantId: acesso.tenant_id,
      academia: { nome: acesso.tenant_name, slug: acesso.tenant_slug }
    };
  });
}


export async function obterMeuCodigoAcesso(usuario = {}) {
  const tenantId = normalizarTenantId(usuario.tenantId || tenantAtual());
  const dados = await obterCodigoAcessoUsuario(usuario, tenantId);
  if (!dados) throw erro("Código de acesso não encontrado para este usuário.", 404);
  return dados;
}

export async function regenerarMeuCodigoAcesso(usuario = {}) {
  const tenantId = normalizarTenantId(usuario.tenantId || tenantAtual());
  return regenerarCodigoAcessoUsuario(usuario, tenantId);
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

  if (!payload?.tenantId) throw erro("Sessão antiga sem empresa. Faça login novamente.", 401);

  if (payload.supportAccess === true) {
    if (!payload.supportHomeTenantId || !payload.supportSessionId) {
      throw erro("Sessão de suporte inválida.", 401);
    }

    return executarComTenant(payload.supportHomeTenantId, async () => {
      const usuarios = await lerUsuarios();
      const usuario = usuarios.find(u => String(u.id) === String(payload.sub));
      if (!usuario) throw erro("Operador de suporte não encontrado.", 401);
      if (normalizar(usuario.status) !== "ativo") throw erro("Operador de suporte inativo.", 403);

      return {
        ...semSenha(usuario),
        perfil: "Administrador",
        perfilOriginal: "Administrador",
        permissoes: ["*"],
        tenantId: normalizarTenantId(payload.tenantId),
        academiaNome: texto(payload.supportTargetName),
        supportAccess: true,
        supportSessionId: texto(payload.supportSessionId),
        supportHomeTenantId: normalizarTenantId(payload.supportHomeTenantId),
        supportReason: texto(payload.supportReason),
        supportRole: texto(payload.supportRole || "support_agent")
      };
    });
  }

  return executarComTenant(payload.tenantId, async () => {
    const usuarios = await lerUsuarios();
    const usuario = usuarios.find(u => String(u.id) === String(payload.sub));
    if (!usuario) throw erro("Usuário não encontrado.", 401);
    if (normalizar(usuario.status) !== "ativo") throw erro("Usuário inativo. Procure o administrador.", 403);
    return { ...semSenha(usuario), tenantId: payload.tenantId };
  });
}

export async function obterPerfis() {
  return Object.entries(PERFIS_PADRAO).map(([perfil, permissoes]) => ({ perfil, permissoes }));
}

export async function usuarioPadrao() {
  await garantirArquivoUsuarios();
  const usuarios = await lerUsuarios();
  return semSenha(usuarios[0]);
}
