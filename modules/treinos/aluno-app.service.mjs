const COOKIE_ACCESS = "fusion_aluno_access";
const COOKIE_REFRESH = "fusion_aluno_refresh";

class AlunoAppError extends Error {
  constructor(message, statusCode = 500, code = "") {
    super(message);
    this.name = "AlunoAppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function configSupabase() {
  const url = String(process.env.FUSION_APP_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceKey = String(
    process.env.FUSION_APP_SUPABASE_SECRET_KEY ||
    process.env.FUSION_APP_SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
  if (!url || !serviceKey) {
    throw new AlunoAppError(
      "Integração do Fusion Aluno não configurada no servidor.",
      503,
      "FUSION_APP_SUPABASE_NOT_CONFIGURED"
    );
  }
  return { url, serviceKey };
}

function mensagemErro(data, fallback) {
  if (!data) return fallback;
  if (typeof data === "string") return data || fallback;
  return data.message || data.mensagem || data.error_description || data.error || fallback;
}

async function chamarSupabase(pathname, { method = "GET", body, accessToken } = {}) {
  const { url, serviceKey } = configSupabase();
  const headers = {
    apikey: serviceKey,
    Accept: "application/json"
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (serviceKey.split(".").length === 3) {
    // Compatibilidade com a chave service_role JWT legada. Chaves sb_secret_*
    // autenticam pelo header apikey e não devem ser usadas como Bearer JWT.
    headers.Authorization = `Bearer ${serviceKey}`;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${url}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new AlunoAppError("Não foi possível conectar ao serviço de autenticação.", 503, "UPSTREAM_UNAVAILABLE");
  }

  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = raw; }
  }

  if (!response.ok) {
    const code = typeof data === "object" && data ? String(data.code || data.error_code || "") : "";
    throw new AlunoAppError(mensagemErro(data, "Falha na operação do aplicativo do aluno."), response.status, code);
  }
  return data;
}

function apenasDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function normalizarDeviceToken(valor) {
  const token = String(valor || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new AlunoAppError("Dispositivo não ativado.", 401, "INVALID_DEVICE_TOKEN");
  }
  return token;
}

function normalizarCodigo(valor) {
  const codigo = String(valor || "").trim().toUpperCase();
  if (!/^[0-9A-F]{8}$/.test(codigo)) {
    throw new AlunoAppError("Informe o código de ativação com 8 caracteres.", 400, "INVALID_ACTIVATION_CODE");
  }
  return codigo;
}

function normalizarTenant(valor) {
  const tenant = String(valor || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(tenant)) {
    throw new AlunoAppError("Academia do Fusion ERP não identificada.", 400, "INVALID_ERP_TENANT");
  }
  return tenant;
}

function academiaNome(data) {
  if (typeof data?.academia === "string") return data.academia;
  return String(data?.academia?.nome || data?.academia_nome || data?.nome_academia || "").trim();
}

function primeiraLinha(data) {
  return Array.isArray(data) ? (data[0] || null) : (data || null);
}

export async function gerarAtivacaoAlunoERP({ tenantId, cpf, validadeMinutos = 30 } = {}) {
  const tenant = normalizarTenant(tenantId);
  const cpfNormalizado = apenasDigitos(cpf);
  if (cpfNormalizado.length !== 11) {
    throw new AlunoAppError("CPF válido é obrigatório para gerar o acesso ao aplicativo.", 400, "INVALID_CPF");
  }

  const validade = Number(validadeMinutos || 30);
  if (!Number.isInteger(validade) || validade < 5 || validade > 120) {
    throw new AlunoAppError("A validade do código deve ficar entre 5 e 120 minutos.", 400, "INVALID_EXPIRATION");
  }

  const data = await chamarSupabase("/rest/v1/rpc/fusion_gerar_ativacao_aluno_backend", {
    method: "POST",
    body: {
      p_erp_tenant_id: tenant,
      p_cpf: cpfNormalizado,
      p_validade_minutos: validade
    }
  });

  const row = primeiraLinha(data);
  const codigo = String(row?.codigo || "").trim().toUpperCase();
  if (!/^[0-9A-F]{8}$/.test(codigo)) {
    throw new AlunoAppError("O servidor não retornou um código de ativação válido.", 502, "ACTIVATION_CODE_NOT_RETURNED");
  }

  return {
    codigo,
    expira_em: row?.expira_em || null,
    telefone_destino: apenasDigitos(row?.telefone_destino || ""),
    academia_id: String(row?.academia_id || ""),
    academia_nome: String(row?.academia_nome || "").trim(),
    aluno_id: String(row?.aluno_id || ""),
    aluno_nome: String(row?.aluno_nome || "").trim()
  };
}

export async function ativarAlunoApp(payload = {}) {
  const codigo = normalizarCodigo(payload.codigo);
  const instalacaoId = String(payload.instalacao_id || payload.instalacaoId || "").trim();
  if (instalacaoId.length < 8 || instalacaoId.length > 200) {
    throw new AlunoAppError("Identificação deste aparelho inválida.", 400, "INVALID_INSTALLATION_ID");
  }

  const data = await chamarSupabase("/rest/v1/rpc/fusion_ativar_app", {
    method: "POST",
    body: {
      p_tipo_app: "aluno",
      p_codigo: codigo,
      p_instalacao_id: instalacaoId,
      p_plataforma: "web",
      p_nome_dispositivo: String(payload.nome_dispositivo || payload.nomeDispositivo || "Navegador web").slice(0, 120)
    }
  });

  return {
    device_token: String(data?.device_token || ""),
    academia_nome: academiaNome(data)
  };
}

export async function statusAlunoApp(deviceToken) {
  const token = normalizarDeviceToken(deviceToken);
  const data = await chamarSupabase("/functions/v1/fusion-app-auth", {
    method: "POST",
    body: { action: "status", tipo_app: "aluno", device_token: token }
  });
  return {
    ativado: data?.ativado !== false,
    primeiro_acesso: Boolean(data?.primeiro_acesso),
    autenticacao: String(data?.autenticacao || ""),
    academia_nome: academiaNome(data)
  };
}

function validarCpfSenha(payload = {}, confirmar = false) {
  const cpf = apenasDigitos(payload.cpf);
  const senha = String(payload.senha || "");
  if (cpf.length !== 11) throw new AlunoAppError("Informe um CPF válido.", 400, "INVALID_CPF");
  if (!senha) throw new AlunoAppError("Informe sua senha.", 400, "INVALID_PASSWORD");
  const resultado = { cpf, senha };
  if (confirmar) resultado.confirmar_senha = String(payload.confirmar_senha ?? payload.confirmarSenha ?? "");
  return resultado;
}

export async function loginAlunoApp(payload = {}) {
  const deviceToken = normalizarDeviceToken(payload.device_token || payload.deviceToken);
  const { cpf, senha } = validarCpfSenha(payload);
  return chamarSupabase("/functions/v1/fusion-app-auth", {
    method: "POST",
    body: { action: "login", tipo_app: "aluno", device_token: deviceToken, cpf, senha }
  });
}

export async function primeiroAcessoAlunoApp(payload = {}) {
  const deviceToken = normalizarDeviceToken(payload.device_token || payload.deviceToken);
  const dados = validarCpfSenha(payload, true);
  return chamarSupabase("/functions/v1/fusion-app-first-access", {
    method: "POST",
    body: { tipo_app: "aluno", device_token: deviceToken, ...dados }
  });
}

function tokenSessao(data, nome) {
  return String(data?.session?.[nome] || data?.[nome] || "").trim();
}

export function gravarSessaoAluno(res, data = {}) {
  const accessToken = tokenSessao(data, "access_token");
  const refreshToken = tokenSessao(data, "refresh_token");
  if (!accessToken || !refreshToken) {
    throw new AlunoAppError("Sessão de acesso não foi criada.", 502, "SESSION_NOT_RETURNED");
  }
  const secure = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const base = { httpOnly: true, secure, sameSite: "lax", path: "/" };
  res.cookie(COOKIE_ACCESS, accessToken, { ...base, maxAge: 60 * 60 * 1000 });
  res.cookie(COOKIE_REFRESH, refreshToken, { ...base, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

export function limparSessaoAluno(res) {
  const secure = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const base = { httpOnly: true, secure, sameSite: "lax", path: "/" };
  res.clearCookie(COOKIE_ACCESS, base);
  res.clearCookie(COOKIE_REFRESH, base);
}

function cookies(req) {
  const out = {};
  for (const parte of String(req.headers.cookie || "").split(";")) {
    const idx = parte.indexOf("=");
    if (idx < 0) continue;
    const nome = parte.slice(0, idx).trim();
    if (!nome) continue;
    try { out[nome] = decodeURIComponent(parte.slice(idx + 1).trim()); } catch { out[nome] = parte.slice(idx + 1).trim(); }
  }
  return out;
}

async function usuarioPorAccessToken(accessToken) {
  if (!accessToken) return null;
  try {
    return await chamarSupabase("/auth/v1/user", { accessToken });
  } catch (erro) {
    if (erro.statusCode === 401 || erro.statusCode === 403) return null;
    throw erro;
  }
}

async function renovarSessao(refreshToken) {
  if (!refreshToken) return null;
  try {
    return await chamarSupabase("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: refreshToken }
    });
  } catch (erro) {
    if (erro.statusCode === 400 || erro.statusCode === 401 || erro.statusCode === 403) return null;
    throw erro;
  }
}

async function sessaoValida(req, res) {
  const jar = cookies(req);
  let accessToken = jar[COOKIE_ACCESS] || "";
  let usuario = await usuarioPorAccessToken(accessToken);
  if (usuario?.id) return { accessToken, usuario };

  const renovada = await renovarSessao(jar[COOKIE_REFRESH] || "");
  if (!renovada) {
    limparSessaoAluno(res);
    throw new AlunoAppError("Sessão expirada. Entre novamente.", 401, "SESSION_EXPIRED");
  }
  gravarSessaoAluno(res, renovada);
  accessToken = tokenSessao(renovada, "access_token");
  usuario = renovada.user || await usuarioPorAccessToken(accessToken);
  if (!usuario?.id) throw new AlunoAppError("Sessão inválida.", 401, "INVALID_SESSION");
  return { accessToken, usuario };
}

export async function obterHomeAlunoApp(req, res, deviceToken) {
  const status = await statusAlunoApp(deviceToken);
  const { accessToken, usuario } = await sessaoValida(req, res);
  const filtro = encodeURIComponent(`eq.${usuario.id}`);
  const alunos = await chamarSupabase(`/rest/v1/alunos?select=id,nome,status,matricula&usuario_id=${filtro}&limit=1`, {
    accessToken
  });
  const aluno = Array.isArray(alunos) ? alunos[0] : null;
  if (!aluno) throw new AlunoAppError("Cadastro do aluno não encontrado para esta sessão.", 404, "STUDENT_NOT_FOUND");
  return { aluno, academia_nome: status.academia_nome };
}

export { AlunoAppError };
