import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { obterPostgresPool, tabelaRegistrosSql } from "../../config/postgres.mjs";

const BCRYPT_ROUNDS = 12;
const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_SECONDS = 600;
const LOGIN_MAX_FAILURES = 10;

function db() {
  return obterPostgresPool({ obrigatorio: true });
}

function texto(valor = "") {
  return String(valor ?? "").trim();
}

function digitos(valor = "") {
  return texto(valor).replace(/\D/g, "");
}

function hashToken(valor = "") {
  return crypto.createHash("sha256").update(String(valor || ""), "utf8").digest("hex");
}

function tokenHex() {
  return crypto.randomBytes(32).toString("hex");
}

function uuid() {
  return crypto.randomUUID();
}

function appError(message, statusCode = 500, code = "") {
  const erro = new Error(message);
  erro.name = "AlunoAppPostgresError";
  erro.statusCode = statusCode;
  erro.code = code;
  return erro;
}

function validarSenhaNova(cpf, senha, confirmar) {
  const valor = String(senha || "");
  if (valor.length < 8 || valor.length > 72) {
    throw appError("A senha deve ter entre 8 e 72 caracteres.", 400, "INVALID_PASSWORD");
  }
  if (!/[A-Za-zÀ-ÿ]/.test(valor) || !/\d/.test(valor)) {
    throw appError("A senha precisa ter pelo menos uma letra e um número.", 400, "INVALID_PASSWORD");
  }
  if (valor === digitos(cpf)) {
    throw appError("A senha não pode ser o próprio CPF.", 400, "INVALID_PASSWORD");
  }
  if (valor !== String(confirmar || "")) {
    throw appError("As senhas não conferem.", 400, "PASSWORD_CONFIRMATION_MISMATCH");
  }
}

async function academiaPorTenant(tenantId) {
  const { rows } = await db().query(
    `SELECT tenant_id, slug, name, status
       FROM public.fusion_tenants
      WHERE tenant_id = $1 OR slug = $1
      ORDER BY tenant_id
      LIMIT 2`,
    [tenantId]
  );
  const ativos = rows.filter(row => ["active", "trial"].includes(texto(row.status).toLowerCase()));
  if (ativos.length !== 1) {
    throw appError("Academia não localizada ou inativa.", 404, "APP_ACADEMY_NOT_FOUND");
  }
  return ativos[0];
}

export async function buscarAlunoErpPorCpfPostgres(tenantId, cpf) {
  const tenant = texto(tenantId).toLowerCase();
  const normalizado = digitos(cpf);
  const tabela = tabelaRegistrosSql();
  const { rows } = await db().query(
    `SELECT record_id, payload, updated_at
       FROM ${tabela}
      WHERE tenant_id = $1
        AND collection = 'alunos'
        AND regexp_replace(coalesce(payload->>'cpf',''), '\\D', '', 'g') = $2
      ORDER BY updated_at DESC
      LIMIT 2`,
    [tenant, normalizado]
  );
  return rows;
}

export async function buscarAlunoErpGlobalPorLegacyPostgres(legacyId, limite = 3) {
  const tabela = tabelaRegistrosSql();
  const { rows } = await db().query(
    `SELECT tenant_id, record_id, payload, updated_at
       FROM ${tabela}
      WHERE collection = 'alunos'
        AND record_id = $1
      ORDER BY updated_at DESC
      LIMIT $2`,
    [texto(legacyId), Math.max(1, Math.min(10, Number(limite) || 3))]
  );
  return rows;
}

export async function listarRegistrosAlunoErpPostgres(tenantId, colecao, alunoId, limite = 80) {
  const tabela = tabelaRegistrosSql();
  const params = [texto(tenantId), texto(colecao), Math.max(1, Math.min(1000, Number(limite) || 80))];
  let filtroAluno = "";
  if (texto(alunoId)) {
    params.push(texto(alunoId));
    filtroAluno = ` AND payload->>'alunoId' = $4`;
  }
  const { rows } = await db().query(
    `SELECT record_id, payload, updated_at
       FROM ${tabela}
      WHERE tenant_id = $1
        AND collection = $2
        ${filtroAluno}
      ORDER BY updated_at DESC
      LIMIT $3`,
    params
  );
  return rows;
}

export async function buscarCadastroAlunoErpPostgres(tenantId, legacyId) {
  const tabela = tabelaRegistrosSql();
  const { rows } = await db().query(
    `SELECT record_id, payload, updated_at
       FROM ${tabela}
      WHERE tenant_id = $1
        AND collection = 'alunos'
        AND record_id = $2
      ORDER BY updated_at DESC
      LIMIT 1`,
    [texto(tenantId), texto(legacyId)]
  );
  return rows[0] || null;
}

export async function listarAvaliacoesAlunoErpPostgres(tenantId, alunoId, limite = 40) {
  const tabela = tabelaRegistrosSql();
  const { rows } = await db().query(
    `SELECT record_id, payload, updated_at
       FROM ${tabela}
      WHERE tenant_id = $1
        AND collection = 'avaliacoes'
        AND (payload->>'alunoId' = $2 OR payload->>'aluno_id' = $2)
      ORDER BY updated_at DESC
      LIMIT $3`,
    [texto(tenantId), texto(alunoId), Math.max(1, Math.min(200, Number(limite) || 40))]
  );
  return rows;
}

export async function listarEventosBiometriaAlunoPostgres(tenantId, alunoId, limite = 400) {
  const { rows } = await db().query(
    `SELECT event_id, equipment_id, occurred_at, source, payload
       FROM public.fusion_edge_access_events
      WHERE tenant_id = $1
        AND student_id = $2
        AND authorized = true
        AND physical_confirmed = true
        AND direction = 'entrada'
      ORDER BY occurred_at DESC
      LIMIT $3`,
    [texto(tenantId), texto(alunoId), Math.max(1, Math.min(1000, Number(limite) || 400))]
  );
  return rows;
}

async function upsertUsuario({ tenantId, legacyId, cpf, nome, telefone, dataNascimento, matricula, status }) {
  const tenant = texto(tenantId).toLowerCase();
  const cpfNormalizado = digitos(cpf);
  if (!tenant || cpfNormalizado.length !== 11 || !texto(legacyId)) {
    throw appError("Cadastro ERP inválido para o Fusion Aluno.", 422, "APP_STUDENT_SYNC_INVALID");
  }
  await academiaPorTenant(tenant);

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const existente = await client.query(
      `SELECT user_id
         FROM public.fusion_app_local_users
        WHERE tenant_id = $1 AND (legacy_id = $2 OR cpf = $3)
        FOR UPDATE`,
      [tenant, texto(legacyId), cpfNormalizado]
    );
    const userId = texto(existente.rows[0]?.user_id) || uuid();
    const dados = {
      erp_tenant_id: tenant,
      fonte: "fusion-erp-local"
    };
    const { rows } = await client.query(
      `INSERT INTO public.fusion_app_local_users(
         user_id,tenant_id,legacy_id,cpf,nome,telefone,data_nascimento,matricula,status,dados,updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,now())
       ON CONFLICT (tenant_id, legacy_id) DO UPDATE SET
         cpf = EXCLUDED.cpf,
         nome = EXCLUDED.nome,
         telefone = EXCLUDED.telefone,
         data_nascimento = EXCLUDED.data_nascimento,
         matricula = EXCLUDED.matricula,
         status = EXCLUDED.status,
         dados = public.fusion_app_local_users.dados || EXCLUDED.dados,
         updated_at = now()
       RETURNING *`,
      [
        userId, tenant, texto(legacyId), cpfNormalizado, texto(nome), digitos(telefone) || null,
        texto(dataNascimento) || null, texto(matricula) || null, texto(status) || "ativo", JSON.stringify(dados)
      ]
    );
    await client.query("COMMIT");
    return rows[0];
  } catch (erro) {
    await client.query("ROLLBACK");
    if (erro?.code === "23505") {
      throw appError("CPF já vinculado a outro cadastro nesta academia.", 409, "APP_DUPLICATE_CPF");
    }
    throw erro;
  } finally {
    client.release();
  }
}

async function garantirUsuarioErp(tenantId, cpf) {
  const linhas = await buscarAlunoErpPorCpfPostgres(tenantId, cpf);
  if (!linhas.length) throw appError("Aluno com este CPF não encontrado no Fusion ERP.", 404, "ERP_STUDENT_NOT_FOUND");
  if (linhas.length > 1) throw appError("Mais de um aluno foi encontrado com este CPF no Fusion ERP.", 409, "ERP_DUPLICATE_CPF");
  const row = linhas[0];
  const p = row.payload && typeof row.payload === "object" ? row.payload : {};
  return upsertUsuario({
    tenantId,
    legacyId: row.record_id || p.id,
    cpf,
    nome: p.nome || p.nomeCompleto || p.aluno,
    telefone: p.whatsapp || p.telefone || p.celular,
    dataNascimento: p.data_nascimento || p.dataNascimento,
    matricula: p.numeroMatricula || p.matricula || p.numero_matricula,
    status: p.status || p.situacao || p.statusMatricula || p.matriculaStatus || (p.ativo === true ? "ativo" : "")
  });
}

async function usuarioPorId(userId) {
  const { rows } = await db().query(
    `SELECT * FROM public.fusion_app_local_users WHERE user_id = $1 LIMIT 1`,
    [texto(userId)]
  );
  return rows[0] || null;
}

async function usuarioPorTenantCpf(tenantId, cpf) {
  const tenant = texto(tenantId).toLowerCase();
  const normalizado = digitos(cpf);
  let { rows } = await db().query(
    `SELECT * FROM public.fusion_app_local_users WHERE tenant_id = $1 AND cpf = $2 LIMIT 1`,
    [tenant, normalizado]
  );
  if (rows[0]) return rows[0];
  return garantirUsuarioErp(tenant, normalizado);
}

async function criarSessao(userId) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE public.fusion_app_local_sessions
          SET active = false, revoked_at = now()
        WHERE user_id = $1 AND active = true`,
      [userId]
    );
    const accessToken = tokenHex();
    const refreshToken = tokenHex();
    const sessionId = tokenHex();
    const accessExpires = new Date(Date.now() + ACCESS_TTL_MS);
    const refreshExpires = new Date(Date.now() + REFRESH_TTL_MS);
    await client.query(
      `INSERT INTO public.fusion_app_local_sessions(
         session_id,user_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at,active,created_at,updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,true,now(),now())`,
      [sessionId, userId, hashToken(accessToken), hashToken(refreshToken), accessExpires, refreshExpires]
    );
    await client.query("COMMIT");
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      fusion_session_id: sessionId,
      expires_in: Math.floor(ACCESS_TTL_MS / 1000)
    };
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    client.release();
  }
}

async function usuarioPorAccessTokenLocal(accessToken) {
  const token = texto(accessToken);
  if (!/^[0-9a-f]{64}$/i.test(token)) return null;
  const { rows } = await db().query(
    `SELECT u.user_id, u.tenant_id, u.legacy_id, u.cpf, u.nome
       FROM public.fusion_app_local_sessions s
       JOIN public.fusion_app_local_users u ON u.user_id = s.user_id
      WHERE s.access_hash = $1
        AND s.active = true
        AND s.access_expires_at > now()
        AND s.refresh_expires_at > now()
      LIMIT 1`,
    [hashToken(token)]
  );
  const u = rows[0];
  return u ? { id: u.user_id, user_metadata: { tenant_id: u.tenant_id, legacy_id: u.legacy_id, nome: u.nome } } : null;
}

async function renovarSessaoLocal(refreshToken) {
  const token = texto(refreshToken);
  if (!/^[0-9a-f]{64}$/i.test(token)) return null;
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const atual = await client.query(
      `SELECT session_id,user_id
         FROM public.fusion_app_local_sessions
        WHERE refresh_hash = $1
          AND active = true
          AND refresh_expires_at > now()
        LIMIT 1
        FOR UPDATE`,
      [hashToken(token)]
    );
    const sessao = atual.rows[0];
    if (!sessao) {
      await client.query("ROLLBACK");
      return null;
    }
    const accessToken = tokenHex();
    const newRefreshToken = tokenHex();
    const accessExpires = new Date(Date.now() + ACCESS_TTL_MS);
    const refreshExpires = new Date(Date.now() + REFRESH_TTL_MS);
    await client.query(
      `UPDATE public.fusion_app_local_sessions
          SET access_hash=$1, refresh_hash=$2, access_expires_at=$3,
              refresh_expires_at=$4, updated_at=now()
        WHERE session_id=$5`,
      [hashToken(accessToken), hashToken(newRefreshToken), accessExpires, refreshExpires, sessao.session_id]
    );
    const user = await client.query(
      `SELECT user_id,tenant_id,legacy_id,nome FROM public.fusion_app_local_users WHERE user_id=$1 LIMIT 1`,
      [sessao.user_id]
    );
    await client.query("COMMIT");
    const u = user.rows[0];
    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      fusion_session_id: sessao.session_id,
      user: u ? { id: u.user_id, user_metadata: { tenant_id: u.tenant_id, legacy_id: u.legacy_id, nome: u.nome } } : null
    };
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    client.release();
  }
}

async function validarSessaoUnicaLocal(userId, sessionId) {
  if (!texto(userId) || !/^[0-9a-f]{64}$/i.test(texto(sessionId))) return false;
  const { rows } = await db().query(
    `SELECT 1
       FROM public.fusion_app_local_sessions
      WHERE user_id=$1 AND session_id=$2 AND active=true AND refresh_expires_at > now()
      LIMIT 1`,
    [texto(userId), texto(sessionId).toLowerCase()]
  );
  return Boolean(rows.length);
}

async function registrarTentativa(kind, identifier, success) {
  await db().query(
    `INSERT INTO public.fusion_app_local_auth_attempts(kind,identifier_hash,success,attempted_at)
     VALUES ($1,$2,$3,now())`,
    [kind, hashToken(identifier), success === true]
  );
}

async function verificarLoginRateLimit(tenant, cpf) {
  const identifier = `${texto(tenant).toLowerCase()}:${digitos(cpf)}`;
  const { rows } = await db().query(
    `SELECT count(*)::int AS failures
       FROM public.fusion_app_local_auth_attempts
      WHERE kind='login'
        AND identifier_hash=$1
        AND success=false
        AND attempted_at >= now() - ($2::int * interval '1 second')`,
    [hashToken(identifier), LOGIN_WINDOW_SECONDS]
  );
  if (Number(rows[0]?.failures || 0) >= LOGIN_MAX_FAILURES) {
    const erro = appError("Muitas tentativas. Aguarde alguns minutos e tente novamente.", 429, "RATE_LIMIT");
    erro.retryAfter = LOGIN_WINDOW_SECONDS;
    throw erro;
  }
  return identifier;
}

async function loginLocal({ tenantId, cpf, senha, deviceToken }) {
  let user;
  let tenant = texto(tenantId).toLowerCase();
  if (tenant) {
    user = await usuarioPorTenantCpf(tenant, cpf);
  } else {
    const tokenHash = hashToken(texto(deviceToken).toLowerCase());
    const { rows } = await db().query(
      `SELECT u.*
         FROM public.fusion_app_local_devices d
         JOIN public.fusion_app_local_users u ON u.user_id=d.user_id
        WHERE d.token_hash=$1 AND d.status='active'
        LIMIT 1`,
      [tokenHash]
    );
    user = rows[0] || null;
    tenant = texto(user?.tenant_id).toLowerCase();
    if (!user) throw appError("Dispositivo não ativado.", 401, "INVALID_DEVICE_TOKEN");
    if (digitos(user.cpf) !== digitos(cpf)) throw appError("CPF ou senha inválidos.", 401, "INVALID_LOGIN");
  }

  const identifier = await verificarLoginRateLimit(tenant, cpf);
  if (!user?.password_hash) {
    await registrarTentativa("login", identifier, false);
    throw appError(
      "Sua senha precisa ser criada novamente após a migração. Solicite um novo link de primeiro acesso à academia.",
      409,
      "FIRST_ACCESS_REQUIRED"
    );
  }

  const ok = await bcrypt.compare(String(senha || ""), user.password_hash);
  await registrarTentativa("login", identifier, ok);
  if (!ok) throw appError("CPF ou senha inválidos.", 401, "INVALID_LOGIN");

  const session = await criarSessao(user.user_id);
  const academia = await academiaPorTenant(user.tenant_id);
  return {
    ok: true,
    autenticacao: "senha",
    academia_nome: texto(academia.name),
    session,
    user: { id: user.user_id }
  };
}

async function gerarCodigoAtivacao(user, validadeMinutos = 30) {
  const validade = Math.max(5, Math.min(1440, Number(validadeMinutos) || 30));
  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const codigo = crypto.randomBytes(4).toString("hex").toUpperCase();
    try {
      await db().query(
        `INSERT INTO public.fusion_app_local_activation_codes(
          code_hash,user_id,tenant_id,expires_at,created_at
        ) VALUES ($1,$2,$3,now()+($4::int * interval '1 minute'),now())`,
        [hashToken(codigo), user.user_id, user.tenant_id, validade]
      );
      return codigo;
    } catch (erro) {
      if (erro?.code !== "23505") throw erro;
    }
  }
  throw appError("Não foi possível gerar um código de ativação único.", 500, "ACTIVATION_CODE_GENERATION_FAILED");
}

async function codigoAtivacaoValido(codigo, { tenantId = "", cpf = "", consumir = false } = {}) {
  const hash = hashToken(texto(codigo).toUpperCase());
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT c.code_hash,c.user_id,c.tenant_id,u.cpf,u.password_hash,u.legacy_id,u.nome
         FROM public.fusion_app_local_activation_codes c
         JOIN public.fusion_app_local_users u ON u.user_id=c.user_id
        WHERE c.code_hash=$1
          AND c.consumed_at IS NULL
          AND c.expires_at > now()
        LIMIT 1
        FOR UPDATE OF c`,
      [hash]
    );
    const row = rows[0];
    if (!row || (tenantId && row.tenant_id !== tenantId) || (cpf && digitos(row.cpf) !== digitos(cpf))) {
      await client.query("ROLLBACK");
      return null;
    }
    if (consumir) {
      await client.query(
        `UPDATE public.fusion_app_local_activation_codes SET consumed_at=now() WHERE code_hash=$1`,
        [hash]
      );
    }
    await client.query("COMMIT");
    return row;
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    client.release();
  }
}

async function ativarDispositivoLocal({ codigo, instalacaoId, plataforma, nomeDispositivo }) {
  const installation = texto(instalacaoId);
  const idHash = hashToken(installation);
  const alvo = await codigoAtivacaoValido(codigo, { consumir: true });
  await registrarTentativa("activation", installation, Boolean(alvo));
  if (!alvo) throw appError("Código inválido ou expirado.", 401, "INVALID_ACTIVATION_CODE");

  const rawToken = tokenHex();
  await db().query(
    `INSERT INTO public.fusion_app_local_devices(
       device_id,user_id,token_hash,installation_hash,platform,name,status,created_at,last_seen_at,updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,'active',now(),now(),now())
     ON CONFLICT (user_id, installation_hash) DO UPDATE SET
       token_hash=EXCLUDED.token_hash,
       platform=EXCLUDED.platform,
       name=EXCLUDED.name,
       status='active',
       last_seen_at=now(),
       updated_at=now()`,
    [uuid(), alvo.user_id, hashToken(rawToken), idHash, texto(plataforma) || "web", texto(nomeDispositivo).slice(0,120)]
  );
  const academia = await academiaPorTenant(alvo.tenant_id);
  return { device_token: rawToken, academia_nome: texto(academia.name) };
}

async function statusDispositivoLocal(deviceToken) {
  const { rows } = await db().query(
    `SELECT u.user_id,u.password_hash,u.tenant_id,a.name AS academia_nome
       FROM public.fusion_app_local_devices d
       JOIN public.fusion_app_local_users u ON u.user_id=d.user_id
       JOIN public.fusion_tenants a ON a.tenant_id=u.tenant_id
      WHERE d.token_hash=$1 AND d.status='active'
      LIMIT 1`,
    [hashToken(texto(deviceToken).toLowerCase())]
  );
  const row = rows[0];
  if (!row) throw appError("Dispositivo não ativado.", 401, "INVALID_DEVICE_TOKEN");
  await db().query(
    `UPDATE public.fusion_app_local_devices SET last_seen_at=now(),updated_at=now() WHERE token_hash=$1`,
    [hashToken(texto(deviceToken).toLowerCase())]
  );
  return {
    ativado: true,
    primeiro_acesso: !row.password_hash,
    autenticacao: row.password_hash ? "senha" : "criar_senha",
    academia_nome: texto(row.academia_nome)
  };
}

async function primeiroAcessoLocal({ tenantId, codigo, cpf, senha, confirmarSenha, deviceToken }) {
  validarSenhaNova(cpf, senha, confirmarSenha);
  let alvo;
  if (tenantId) {
    const user = await usuarioPorTenantCpf(tenantId, cpf);
    alvo = await codigoAtivacaoValido(codigo, { tenantId: user.tenant_id, cpf: user.cpf, consumir: false });
    if (!alvo || alvo.user_id !== user.user_id) {
      throw appError("Este link expirou ou já foi usado.", 401, "INVALID_FIRST_ACCESS_LINK");
    }
  } else {
    const { rows } = await db().query(
      `SELECT u.*
         FROM public.fusion_app_local_devices d
         JOIN public.fusion_app_local_users u ON u.user_id=d.user_id
        WHERE d.token_hash=$1 AND d.status='active'
        LIMIT 1`,
      [hashToken(texto(deviceToken).toLowerCase())]
    );
    const user = rows[0];
    if (!user || digitos(user.cpf) !== digitos(cpf)) {
      throw appError("Dispositivo ou CPF inválido.", 401, "INVALID_FIRST_ACCESS_LINK");
    }
    alvo = user;
  }

  const atual = await usuarioPorId(alvo.user_id);
  if (atual?.password_hash) {
    throw appError("Sua senha já foi criada. Entre com CPF e senha.", 409, "PASSWORD_ALREADY_CREATED");
  }

  const hash = await bcrypt.hash(String(senha), BCRYPT_ROUNDS);
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE public.fusion_app_local_users
          SET password_hash=$1,password_set_at=now(),updated_at=now()
        WHERE user_id=$2 AND password_hash IS NULL
        RETURNING user_id,tenant_id`,
      [hash, alvo.user_id]
    );
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      throw appError("Sua senha já foi criada. Entre com CPF e senha.", 409, "PASSWORD_ALREADY_CREATED");
    }
    if (tenantId) {
      await client.query(
        `UPDATE public.fusion_app_local_activation_codes SET consumed_at=now()
          WHERE code_hash=$1 AND user_id=$2 AND consumed_at IS NULL`,
        [hashToken(texto(codigo).toUpperCase()), alvo.user_id]
      );
    }
    await client.query("COMMIT");
  } catch (erro) {
    try { await client.query("ROLLBACK"); } catch {}
    throw erro;
  } finally {
    client.release();
  }

  const session = await criarSessao(alvo.user_id);
  const academia = await academiaPorTenant(alvo.tenant_id);
  return {
    ok: true,
    primeiro_acesso: false,
    autenticacao: "senha",
    academia_nome: texto(academia.name),
    session,
    user: { id: alvo.user_id }
  };
}

function filtroEq(url, nome) {
  const valor = url.searchParams.get(nome);
  if (!valor) return "";
  return decodeURIComponent(valor).replace(/^eq\./, "");
}

async function alunosRestLocal(url) {
  const tenantPorDados = filtroEq(url, "dados->>erp_tenant_id");
  if (tenantPorDados) {
    await academiaPorTenant(tenantPorDados);
    return [{ academia_id: tenantPorDados }];
  }
  const academiaId = filtroEq(url, "academia_id");
  if (academiaId) {
    const { rows } = await db().query(
      `SELECT legacy_id, CASE WHEN password_hash IS NULL THEN NULL ELSE user_id END AS usuario_id
         FROM public.fusion_app_local_users
        WHERE tenant_id=$1
        ORDER BY legacy_id`,
      [academiaId]
    );
    return rows;
  }
  const usuarioId = filtroEq(url, "usuario_id");
  if (usuarioId) {
    const { rows } = await db().query(
      `SELECT user_id AS id,nome,status,matricula,legacy_id,dados,tenant_id AS academia_id
         FROM public.fusion_app_local_users
        WHERE user_id=$1
        LIMIT 1`,
      [usuarioId]
    );
    return rows;
  }
  return [];
}

async function academiasRestLocal(url) {
  const id = filtroEq(url, "id");
  if (!id) return [];
  const academia = await academiaPorTenant(id);
  return [{ id: academia.tenant_id, nome: academia.name, slug: academia.slug }];
}

export async function requestAlunoAppPostgres(pathname, { body, accessToken } = {}) {
  const url = new URL(pathname, "http://fusion.local");
  const path = url.pathname;
  const payload = body && typeof body === "object" ? body : {};

  if (path === "/rest/v1/rpc/fusion_sincronizar_aluno_backend") {
    const user = await upsertUsuario({
      tenantId: payload.p_erp_tenant_id,
      legacyId: payload.p_legacy_id,
      cpf: payload.p_cpf,
      nome: payload.p_nome,
      telefone: payload.p_telefone,
      dataNascimento: payload.p_data_nascimento,
      matricula: payload.p_matricula,
      status: payload.p_status
    });
    return [{ aluno_id: user.user_id, academia_id: user.tenant_id, legacy_id: user.legacy_id }];
  }

  if (path === "/rest/v1/rpc/fusion_gerar_ativacao_aluno_backend") {
    const user = await usuarioPorTenantCpf(payload.p_erp_tenant_id, payload.p_cpf);
    const codigo = await gerarCodigoAtivacao(user, payload.p_validade_minutos);
    const academia = await academiaPorTenant(user.tenant_id);
    return [{
      codigo,
      expira_em: new Date(Date.now() + Math.max(5, Math.min(1440, Number(payload.p_validade_minutos) || 30)) * 60000).toISOString(),
      telefone_destino: user.telefone || "",
      academia_id: user.tenant_id,
      academia_nome: academia.name,
      aluno_id: user.user_id,
      aluno_nome: user.nome
    }];
  }

  if (path === "/rest/v1/rpc/fusion_app_verificar_limite_ativacao_backend") {
    const installation = texto(payload.p_instalacao_id);
    const janela = Math.max(60, Math.min(3600, Number(payload.p_janela_segundos) || 600));
    const limite = Math.max(1, Math.min(50, Number(payload.p_limite) || 8));
    const { rows } = await db().query(
      `SELECT count(*)::int AS tentativas
         FROM public.fusion_app_local_auth_attempts
        WHERE kind='activation' AND identifier_hash=$1 AND success=false
          AND attempted_at >= now() - ($2::int * interval '1 second')`,
      [hashToken(installation), janela]
    );
    const tentativas = Number(rows[0]?.tentativas || 0);
    return { permitido: tentativas < limite, retry_after: tentativas < limite ? 0 : janela };
  }

  if (path === "/rest/v1/rpc/fusion_ativar_app") {
    return ativarDispositivoLocal({
      codigo: payload.p_codigo,
      instalacaoId: payload.p_instalacao_id,
      plataforma: payload.p_plataforma,
      nomeDispositivo: payload.p_nome_dispositivo
    });
  }

  if (path === "/functions/v1/fusion-app-auth") {
    if (payload.action === "status") return statusDispositivoLocal(payload.device_token);
    if (payload.action === "login") {
      return loginLocal({
        tenantId: payload.erp_tenant_id,
        cpf: payload.cpf,
        senha: payload.senha,
        deviceToken: payload.device_token
      });
    }
    throw appError("Ação de autenticação inválida.", 400, "INVALID_AUTH_ACTION");
  }

  if (path === "/functions/v1/fusion-app-first-access") {
    return primeiroAcessoLocal({
      tenantId: texto(payload.erp_tenant_id).toLowerCase(),
      codigo: payload.access_code,
      cpf: payload.cpf,
      senha: payload.senha,
      confirmarSenha: payload.confirmar_senha,
      deviceToken: payload.device_token
    });
  }

  if (path === "/rest/v1/rpc/fusion_app_validar_sessao_unica") {
    return validarSessaoUnicaLocal(payload.p_usuario_id, payload.p_session_id);
  }

  if (path === "/auth/v1/user") {
    const user = await usuarioPorAccessTokenLocal(accessToken);
    if (!user) throw appError("Sessão inválida.", 401, "INVALID_SESSION");
    return user;
  }

  if (path === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
    const renovada = await renovarSessaoLocal(payload.refresh_token);
    if (!renovada) throw appError("Sessão expirada.", 401, "SESSION_EXPIRED");
    return renovada;
  }

  if (path === "/rest/v1/alunos") return alunosRestLocal(url);
  if (path === "/rest/v1/academias") return academiasRestLocal(url);

  throw appError(`Operação local do Fusion Aluno ainda não mapeada: ${path}`, 501, "LOCAL_APP_OPERATION_NOT_IMPLEMENTED");
}
