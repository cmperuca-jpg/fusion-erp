import { obterSupabaseAdmin } from "../../config/supabase.mjs";

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

function dataIsoOuNula(valor) {
  const texto = String(valor || "").trim();
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function statusAlunoERP(payload = {}) {
  const valor = String(
    payload.status ||
    payload.situacao ||
    payload.statusMatricula ||
    payload.matriculaStatus ||
    (payload.ativo === true ? "ativo" : "")
  ).trim();
  return valor || "ativo";
}

async function alunoERPPorCpf(tenant, cpfNormalizado) {
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const tabela = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";

  const { data, error } = await supabase
    .from(tabela)
    .select("record_id,payload")
    .eq("tenant_id", tenant)
    .eq("collection", "alunos")
    .eq("payload->>cpf", cpfNormalizado)
    .limit(2);

  if (error) {
    throw new AlunoAppError(
      `Falha ao localizar o aluno no Fusion ERP: ${error.message}`,
      502,
      "ERP_STUDENT_LOOKUP_FAILED"
    );
  }

  const registros = Array.isArray(data) ? data : [];
  if (!registros.length) {
    throw new AlunoAppError(
      "Aluno com este CPF não encontrado no banco principal do Fusion ERP.",
      404,
      "ERP_STUDENT_NOT_FOUND"
    );
  }
  if (registros.length > 1) {
    throw new AlunoAppError(
      "Mais de um aluno foi encontrado com este CPF no Fusion ERP. Corrija o cadastro antes de gerar o acesso.",
      409,
      "ERP_DUPLICATE_CPF"
    );
  }

  const registro = registros[0] || {};
  const payload = registro.payload && typeof registro.payload === "object" ? registro.payload : {};
  const legacyId = String(registro.record_id || payload.id || "").trim();
  const nome = String(payload.nome || payload.nomeCompleto || payload.aluno || "").trim();
  const telefone = apenasDigitos(payload.whatsapp || payload.telefone || payload.celular || "");
  const matricula = String(
    payload.numeroMatricula ||
    payload.matricula ||
    payload.numero_matricula ||
    ""
  ).trim();

  if (!legacyId) {
    throw new AlunoAppError(
      "O cadastro do aluno no Fusion ERP está sem identificador interno.",
      422,
      "ERP_STUDENT_LEGACY_ID_MISSING"
    );
  }
  if (nome.length < 3) {
    throw new AlunoAppError(
      "O cadastro do aluno no Fusion ERP está sem nome válido.",
      422,
      "ERP_STUDENT_NAME_INVALID"
    );
  }
  return {
    legacyId,
    nome,
    cpf: cpfNormalizado,
    telefone,
    dataNascimento: dataIsoOuNula(payload.data_nascimento || payload.dataNascimento),
    matricula: matricula || null,
    status: statusAlunoERP(payload)
  };
}

async function sincronizarAlunoNoApp({ tenant, cpfNormalizado }) {
  const alunoERP = await alunoERPPorCpf(tenant, cpfNormalizado);

  const data = await chamarSupabase("/rest/v1/rpc/fusion_sincronizar_aluno_backend", {
    method: "POST",
    body: {
      p_erp_tenant_id: tenant,
      p_legacy_id: alunoERP.legacyId,
      p_nome: alunoERP.nome,
      p_cpf: alunoERP.cpf,
      p_telefone: alunoERP.telefone,
      p_data_nascimento: alunoERP.dataNascimento,
      p_matricula: alunoERP.matricula,
      p_status: alunoERP.status
    }
  });

  const row = primeiraLinha(data);
  if (!row?.aluno_id) {
    throw new AlunoAppError(
      "O aluno não pôde ser sincronizado com o banco do aplicativo.",
      502,
      "APP_STUDENT_SYNC_FAILED"
    );
  }

  return row;
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

  // O ERP é a fonte operacional do cadastro. Antes de emitir o código,
  // sincroniza os dados essenciais no banco dedicado do Fusion Aluno.
  await sincronizarAlunoNoApp({ tenant, cpfNormalizado });

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

function textoSeguro(valor) {
  return String(valor ?? "").trim();
}

function numeroSeguro(valor, fallback = 0) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
}

function normalizarTexto(valor) {
  return textoSeguro(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function dataValida(valor) {
  const data = new Date(valor || "");
  return Number.isNaN(data.getTime()) ? null : data;
}

function payloadRegistro(row) {
  return row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? row.payload
    : {};
}

function fotoAlunoSegura(payload = {}) {
  const foto = textoSeguro(
    payload.foto_base64 ||
    payload.fotoBase64 ||
    payload.foto ||
    payload.avatar ||
    ""
  );
  if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(foto) && foto.length <= 4_000_000) return foto;
  if (foto.startsWith("/")) return foto;
  return "";
}

async function registrosAlunoERP(supabase, tabela, tenant, colecao, alunoId, limite = 80) {
  let query = supabase
    .from(tabela)
    .select("record_id,payload,updated_at")
    .eq("tenant_id", tenant)
    .eq("collection", colecao)
    .order("updated_at", { ascending: false })
    .limit(limite);

  if (alunoId) query = query.eq("payload->>alunoId", alunoId);

  const { data, error } = await query;
  if (error) {
    throw new AlunoAppError(
      `Não foi possível carregar ${colecao} do aluno no Fusion ERP.`,
      502,
      "ERP_HOME_DATA_FAILED"
    );
  }
  return Array.isArray(data) ? data : [];
}

async function cadastroAlunoERP(supabase, tabela, tenant, legacyId) {
  const { data, error } = await supabase
    .from(tabela)
    .select("record_id,payload,updated_at")
    .eq("tenant_id", tenant)
    .eq("collection", "alunos")
    .eq("record_id", legacyId)
    .limit(1);

  if (error) {
    throw new AlunoAppError(
      "Não foi possível carregar o cadastro do aluno no Fusion ERP.",
      502,
      "ERP_STUDENT_HOME_FAILED"
    );
  }
  return payloadRegistro(Array.isArray(data) ? data[0] : null);
}

function escolherMatricula(rows = []) {
  const itens = rows.map(payloadRegistro).filter(item => Object.keys(item).length);
  return itens.find(item => ["ativa", "ativo", "active"].includes(normalizarTexto(item.status))) || itens[0] || null;
}

function resumoPlano(matricula = null, alunoERP = {}) {
  if (!matricula) {
    const nome = textoSeguro(alunoERP.plano);
    return nome ? {
      nome,
      status: textoSeguro(alunoERP.matriculaStatus || alunoERP.statusMatricula || ""),
      modalidade: textoSeguro(alunoERP.modalidade),
      tipo: textoSeguro(alunoERP.tipoPlano),
      valor_mensal: numeroSeguro(alunoERP.valorMensalTotal || alunoERP.valorMensal || alunoERP.valorPlano),
      proximo_vencimento: textoSeguro(alunoERP.proximoVencimento),
      horario: textoSeguro(alunoERP.horario),
      professor: textoSeguro(alunoERP.professorNome || alunoERP.professor)
    } : null;
  }

  return {
    id: textoSeguro(matricula.id),
    nome: textoSeguro(matricula.plano),
    status: textoSeguro(matricula.status),
    modalidade: textoSeguro(matricula.modalidade),
    tipo: textoSeguro(matricula.tipoPlano || matricula.tipoCobranca),
    valor_mensal: numeroSeguro(matricula.valorMensalTotal || matricula.valorMensal || matricula.valorPlano),
    data_inicio: textoSeguro(matricula.dataInicio || matricula.dataMatricula),
    data_fim: textoSeguro(matricula.dataFim),
    proximo_vencimento: textoSeguro(matricula.proximoVencimento),
    dia_vencimento: numeroSeguro(matricula.diaVencimento, 0),
    horario: textoSeguro(matricula.horario),
    turma: textoSeguro(matricula.turma),
    professor: textoSeguro(matricula.professorNome || matricula.professor),
    numero_matricula: textoSeguro(matricula.numeroMatricula || matricula.numero)
  };
}

function resumoTreinos(rows = []) {
  const treinos = rows.map(payloadRegistro).filter(item => Object.keys(item).length);
  const treino = treinos.find(item => item.ativo !== false) || treinos[0] || null;
  if (!treino) return { total: 0, ativo: false, divisoes: [] };

  const divisoes = (Array.isArray(treino.divisoes) ? treino.divisoes : [])
    .slice(0, 8)
    .map(divisao => ({
      nome: textoSeguro(divisao?.nome) || "Treino",
      itens: (Array.isArray(divisao?.itens) ? divisao.itens : [])
        .slice(0, 40)
        .map(item => ({
          nome: textoSeguro(item?.nome),
          codigo: textoSeguro(item?.codigo),
          grupo: textoSeguro(item?.grupo),
          metodo: textoSeguro(item?.metodo),
          series: textoSeguro(item?.series),
          repeticoes: textoSeguro(item?.repeticoes),
          carga: textoSeguro(item?.carga),
          descanso: textoSeguro(item?.descanso),
          observacao: textoSeguro(item?.obs || item?.observacao),
          descricao: textoSeguro(item?.descricao),
          musculos: textoSeguro(item?.musculos),
          foto: textoSeguro(item?.foto).startsWith("/") ? textoSeguro(item?.foto) : "",
          gif: textoSeguro(item?.gif).startsWith("/") ? textoSeguro(item?.gif) : "",
          imagem: textoSeguro(item?.gif).startsWith("/")
            ? textoSeguro(item?.gif)
            : (textoSeguro(item?.foto).startsWith("/") ? textoSeguro(item?.foto) : "")
        }))
        .filter(item => item.nome)
    }));

  return {
    id: textoSeguro(treino.id),
    total: treinos.length,
    ativo: treino.ativo !== false,
    objetivo: textoSeguro(treino.objetivo),
    validade: textoSeguro(treino.validade),
    data_prescricao: textoSeguro(treino.dataPrescricao || treino.criadoEm),
    professor: textoSeguro(treino.professorNome),
    observacoes: textoSeguro(treino.observacoes),
    divisoes
  };
}


const CAMPOS_AVALIACAO_ALUNO = [
  "data", "hora", "objetivo", "observacoes",
  "professorNome", "professor_nome", "professor",
  "peso", "altura", "imc", "classificacao_imc",
  "percentual_gordura", "percentual_ideal", "massa_magra", "massa_gorda",
  "agua_corporal", "gordura_visceral", "idade_metabolica", "tmb",
  "composicao_resultado",
  "pescoco", "punho", "ombro",
  "braco_relaxado_direito", "braco_relaxado_esquerdo",
  "braco_contraido_direito", "braco_contraido_esquerdo",
  "antebraco_direito", "antebraco_esquerdo",
  "torax_relaxado", "torax_inspirado",
  "cintura", "abdomen", "quadril",
  "coxa_proximal_direita", "coxa_proximal_esquerda",
  "coxa_medial_direita", "coxa_medial_esquerda",
  "panturrilha_direita", "panturrilha_esquerda",
  "rcq", "rcq_classificacao", "soma_perimetros",
  "protocolo_dobras", "subescapular", "bicipital", "tricipital",
  "axilar_media", "supra_iliaca", "peitoral", "dobra_abdominal",
  "dobra_coxa", "dobra_panturrilha",
  "condicao_fisica", "protocolo_cardio", "vo2_obtido", "vo2_previsto",
  "deficit_aerobico", "cardio_info",
  "flexao_bracos", "flexao_resultado", "abdominal_repeticoes",
  "abdominal_resultado", "banco_wells", "wells_resultado",
  "pratica_atividade", "medicamentos", "cirurgias", "doencas_familia",
  "alergias", "restricoes_medicas", "lesoes", "anamnese_observacoes",
  "status", "statusAvaliacao", "status_avaliacao",
  "validade", "data_validade", "validadeAte",
  "proxima_avaliacao", "proximaAvaliacao", "reavaliacao_em", "reavaliacaoEm"
];

const FOTOS_AVALIACAO_ALUNO = [
  "foto_frente_base64",
  "foto_costas_base64",
  "foto_lateral_direita_base64",
  "foto_lateral_esquerda_base64"
];

function imagemAvaliacaoSegura(valor) {
  const imagem = textoSeguro(valor);
  if (!imagem) return "";
  if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imagem) && imagem.length <= 4_000_000) return imagem;
  if (imagem.startsWith("/")) return imagem;
  return "";
}

function dataAvaliacaoERP(item = {}) {
  return dataValida(
    item.data ||
    item.data_avaliacao ||
    item.dataAvaliacao ||
    item.criado_em ||
    item.criadoEm ||
    item.createdAt ||
    item.atualizado_em ||
    item.atualizadoEm
  );
}

function dataExpiracaoAvaliacao(item = {}) {
  return dataValida(
    item.validade ||
    item.data_validade ||
    item.validadeAte
  );
}

function dataProximaAvaliacao(item = {}) {
  return dataValida(
    item.proxima_avaliacao ||
    item.proximaAvaliacao ||
    item.reavaliacao_em ||
    item.reavaliacaoEm
  );
}

function avaliacaoSeguraParaAluno(row = {}) {
  const item = payloadRegistro(row);
  const avaliacao = {
    id: textoSeguro(item.id || row.record_id),
    data: textoSeguro(item.data || item.data_avaliacao || item.dataAvaliacao),
    criado_em: textoSeguro(item.criado_em || item.criadoEm),
    atualizado_em: textoSeguro(item.atualizado_em || item.atualizadoEm)
  };

  for (const campo of CAMPOS_AVALIACAO_ALUNO) {
    const valor = item[campo];
    if (valor === undefined || valor === null) continue;
    if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") {
      avaliacao[campo] = valor;
    }
  }

  for (const campo of FOTOS_AVALIACAO_ALUNO) {
    const imagem = imagemAvaliacaoSegura(item[campo]);
    if (imagem) avaliacao[campo] = imagem;
  }

  return avaliacao;
}

async function registrosAvaliacoesERP(supabase, tabela, tenant, alunoId, limite = 40) {
  async function consultar(campo) {
    const { data, error } = await supabase
      .from(tabela)
      .select("record_id,payload,updated_at")
      .eq("tenant_id", tenant)
      .eq("collection", "avaliacoes")
      .eq(`payload->>${campo}`, alunoId)
      .order("updated_at", { ascending: false })
      .limit(limite);

    if (error) {
      throw new AlunoAppError(
        "Não foi possível carregar as avaliações físicas do aluno no Fusion ERP.",
        502,
        "ERP_EVALUATION_DATA_FAILED"
      );
    }
    return Array.isArray(data) ? data : [];
  }

  const [camel, snake] = await Promise.all([
    consultar("alunoId"),
    consultar("aluno_id")
  ]);

  const unicos = new Map();
  for (const row of [...camel, ...snake]) {
    const chave = textoSeguro(row.record_id) || JSON.stringify(row.payload || {});
    if (!unicos.has(chave)) unicos.set(chave, row);
  }

  return [...unicos.values()]
    .sort((a, b) => {
      const da = dataAvaliacaoERP(payloadRegistro(a))?.getTime() || 0;
      const db = dataAvaliacaoERP(payloadRegistro(b))?.getTime() || 0;
      return db - da;
    })
    .slice(0, limite);
}

function resumoAvaliacoes(rows = []) {
  const avaliacoes = rows
    .map(avaliacaoSeguraParaAluno)
    .filter(item => item.id || item.data || item.criado_em);

  const ultima = avaliacoes[0] || null;

  if (!ultima) {
    return {
      total: 0,
      status: "Pendente",
      codigo_status: "pendente",
      ultima_data: "",
      validade: "",
      proxima_data: "",
      professor: "",
      objetivo: "",
      mensagem: "Nenhuma avaliação física foi registrada para você até o momento.",
      itens: []
    };
  }

  const ultimaData = dataAvaliacaoERP(ultima);
  const validade = dataExpiracaoAvaliacao(ultima);
  const proxima = dataProximaAvaliacao(ultima);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let status = "Realizada";
  let codigo = "realizada";
  let mensagem = ultimaData
    ? `Sua última avaliação foi realizada em ${dataCurtaBR(ultimaData.toISOString())}.`
    : "Sua avaliação física está registrada.";

  const statusInformado = normalizarTexto(
    ultima.statusAvaliacao ||
    ultima.status_avaliacao ||
    ultima.status
  );

  if (statusInformado.includes("vencid")) {
    status = "Vencida";
    codigo = "vencida";
    mensagem = "Sua avaliação física está marcada como vencida. Procure a academia para uma reavaliação.";
  } else if (statusInformado.includes("pendent")) {
    status = "Pendente";
    codigo = "pendente";
    mensagem = "Sua avaliação física está pendente.";
  } else if (statusInformado.includes("agend")) {
    status = "Agendada";
    codigo = "agendada";
    mensagem = proxima
      ? `Sua avaliação está agendada para ${dataCurtaBR(proxima.toISOString())}.`
      : "Sua avaliação física está agendada.";
  } else if (validade) {
    const validadeDia = new Date(validade);
    validadeDia.setHours(0, 0, 0, 0);
    const dias = Math.ceil((validadeDia.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));

    if (dias < 0) {
      status = "Vencida";
      codigo = "vencida";
      mensagem = `Sua avaliação venceu em ${dataCurtaBR(validade.toISOString())}. Procure a academia para uma reavaliação.`;
    } else if (dias <= 15) {
      status = "Próxima do vencimento";
      codigo = "proxima";
      mensagem = `Sua avaliação vence em ${dataCurtaBR(validade.toISOString())}.`;
    } else {
      status = "Em dia";
      codigo = "em_dia";
      mensagem = `Avaliação válida até ${dataCurtaBR(validade.toISOString())}.`;
    }
  } else if (proxima && proxima.getTime() >= hoje.getTime()) {
    status = "Reavaliação agendada";
    codigo = "agendada";
    mensagem = `Sua próxima avaliação está prevista para ${dataCurtaBR(proxima.toISOString())}.`;
  }

  return {
    total: avaliacoes.length,
    status,
    codigo_status: codigo,
    ultima_data: ultimaData?.toISOString() || "",
    validade: validade?.toISOString() || "",
    proxima_data: proxima?.toISOString() || "",
    professor: textoSeguro(ultima.professorNome || ultima.professor_nome || ultima.professor),
    objetivo: textoSeguro(ultima.objetivo),
    mensagem,
    itens: avaliacoes
  };
}

function dataDoAcesso(item = {}) {
  return dataValida(
    item.entradaEm || item.dataHora || item.data_hora || item.criadoEm ||
    item.criado_em || item.data || item.timestamp || item.atualizadoEm
  );
}

function resumoFrequencia(rows = []) {
  const agora = Date.now();
  const inicio30 = agora - (30 * 24 * 60 * 60 * 1000);
  const acessos = rows
    .map(payloadRegistro)
    .filter(item => normalizarTexto(item.tipo) !== "vinculo_matricula")
    .map(item => ({ item, data: dataDoAcesso(item) }))
    .filter(registro => registro.data)
    .sort((a, b) => b.data.getTime() - a.data.getTime());

  return {
    total: acessos.length,
    ultimos_30_dias: acessos.filter(registro => registro.data.getTime() >= inicio30).length,
    ultimo_acesso: acessos[0]?.data?.toISOString() || "",
    acessos: acessos.slice(0, 8).map(registro => ({
      data: registro.data.toISOString(),
      status: textoSeguro(registro.item.status || registro.item.resultado || "Registrado"),
      local: textoSeguro(registro.item.local || registro.item.sala || registro.item.dispositivo || "")
    }))
  };
}

function statusPago(valor) {
  return ["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada"].includes(normalizarTexto(valor));
}

function statusCancelado(valor) {
  return ["cancelado", "cancelada", "estornado", "estornada", "encerrado", "encerrada"].includes(normalizarTexto(valor));
}

function statusProgramado(valor) {
  return ["programada", "programado", "previsto", "prevista"].includes(normalizarTexto(valor));
}

function resumoFinanceiro(rowsMensalidades = [], rowsFinanceiro = []) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const mensalidades = rowsMensalidades
    .map(payloadRegistro)
    .filter(item => Object.keys(item).length)
    .map(item => {
      const vencimento = dataValida(item.vencimento || item.emitirEm);
      const valor = numeroSeguro(item.valorOriginal || item.valor || item.total);
      const restante = numeroSeguro(item.valorRestante ?? item.saldoRestante ?? (statusPago(item.status) ? 0 : valor));
      return {
        id: textoSeguro(item.id),
        competencia: textoSeguro(item.competencia),
        status: textoSeguro(item.status),
        vencimento: vencimento?.toISOString() || "",
        valor,
        valor_restante: Math.max(0, restante),
        data_pagamento: textoSeguro(item.dataPagamento),
        forma_pagamento: textoSeguro(item.formaPagamento || item.forma),
        programada: item.programada === true || statusProgramado(item.status)
      };
    });

  const emAberto = mensalidades.filter(item =>
    !statusPago(item.status) && !statusCancelado(item.status) && !item.programada && item.valor_restante > 0
  );
  const atrasadas = emAberto.filter(item => {
    const vencimento = dataValida(item.vencimento);
    return vencimento && vencimento.getTime() < hoje.getTime();
  });

  const futuras = mensalidades
    .filter(item => {
      const vencimento = dataValida(item.vencimento);
      return vencimento && vencimento.getTime() >= hoje.getTime() && !statusCancelado(item.status);
    })
    .sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));

  const pagamentos = rowsFinanceiro
    .map(payloadRegistro)
    .filter(item => statusPago(item.status))
    .map(item => ({
      data: dataValida(item.dataPagamento || item.pagamento || item.atualizadoEm),
      valor: numeroSeguro(item.valorPago || item.valorRecebido || item.valorLiquido || item.valor)
    }))
    .filter(item => item.data)
    .sort((a, b) => b.data - a.data);

  const proxima = futuras[0] || null;
  return {
    situacao: atrasadas.length ? "Em atraso" : (emAberto.length ? "Pendente" : "Em dia"),
    valor_em_aberto: emAberto.reduce((soma, item) => soma + item.valor_restante, 0),
    proximo_vencimento: proxima?.vencimento || "",
    proximo_valor: proxima?.valor || 0,
    ultimo_pagamento: pagamentos[0]?.data?.toISOString() || "",
    ultimo_pagamento_valor: pagamentos[0]?.valor || 0,
    mensalidades: mensalidades
      .sort((a, b) => (new Date(b.vencimento || 0)) - (new Date(a.vencimento || 0)))
      .slice(0, 6)
  };
}

function dataCurtaBR(valor) {
  const texto = textoSeguro(valor);
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : texto;
}

function montarAvisos({ alunoERP = {}, plano = null, treinos = {}, financeiro = {}, avaliacao = {} } = {}) {
  const avisos = [];
  if (alunoERP.bloqueado === true || alunoERP.bloqueioCheckin === true) {
    avisos.push({
      tipo: "alerta",
      titulo: "Acesso bloqueado",
      mensagem: textoSeguro(alunoERP.motivoBloqueioCheckin || alunoERP.motivoBloqueio || "Procure a recepção da academia.")
    });
  }
  if (financeiro.situacao === "Em atraso") {
    avisos.push({
      tipo: "financeiro",
      titulo: "Financeiro em atraso",
      mensagem: financeiro.valor_em_aberto > 0
        ? `Há R$ ${financeiro.valor_em_aberto.toFixed(2).replace(".", ",")} em aberto.`
        : "Há uma cobrança vencida."
    });
  }
  if (plano?.proximo_vencimento) {
    avisos.push({
      tipo: "info",
      titulo: "Próximo vencimento",
      mensagem: `Sua próxima cobrança está prevista para ${dataCurtaBR(plano.proximo_vencimento)}.`
    });
  }
  if (!treinos?.divisoes?.some(divisao => divisao.itens?.length)) {
    avisos.push({
      tipo: "treino",
      titulo: "Treino",
      mensagem: "Nenhum treino foi prescrito para você no momento."
    });
  }
  if (avaliacao?.codigo_status === "pendente") {
    avisos.push({
      tipo: "avaliacao",
      titulo: "Avaliação física pendente",
      mensagem: avaliacao.mensagem || "Nenhuma avaliação física foi registrada."
    });
  } else if (avaliacao?.codigo_status === "vencida") {
    avisos.push({
      tipo: "avaliacao",
      titulo: "Avaliação física vencida",
      mensagem: avaliacao.mensagem || "Procure a academia para realizar uma reavaliação."
    });
  } else if (avaliacao?.codigo_status === "proxima") {
    avisos.push({
      tipo: "avaliacao",
      titulo: "Avaliação física",
      mensagem: avaliacao.mensagem || "Sua avaliação está próxima do vencimento."
    });
  } else if (avaliacao?.codigo_status === "agendada") {
    avisos.push({
      tipo: "avaliacao",
      titulo: "Avaliação física agendada",
      mensagem: avaliacao.mensagem || "Há uma avaliação programada."
    });
  }
  if (!avisos.length) {
    avisos.push({ tipo: "ok", titulo: "Tudo certo", mensagem: "Não há avisos pendentes para o seu acesso." });
  }
  return avisos.slice(0, 5);
}

async function carregarHomeERP(alunoApp = {}) {
  const tenant = normalizarTenant(alunoApp?.dados?.erp_tenant_id || "");
  const legacyId = textoSeguro(alunoApp?.legacy_id);
  if (!legacyId) {
    throw new AlunoAppError("Aluno ainda não está vinculado ao cadastro principal do Fusion ERP.", 409, "ERP_STUDENT_NOT_LINKED");
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const tabela = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";

  const [alunoERP, matriculasRows, treinosRows, checkinRows, checkinsRows, mensalidadesRows, financeiroRows, avaliacoesRows] = await Promise.all([
    cadastroAlunoERP(supabase, tabela, tenant, legacyId),
    registrosAlunoERP(supabase, tabela, tenant, "matriculas", legacyId, 12),
    registrosAlunoERP(supabase, tabela, tenant, "treinos_prescritos", legacyId, 12),
    registrosAlunoERP(supabase, tabela, tenant, "checkin", legacyId, 80),
    registrosAlunoERP(supabase, tabela, tenant, "checkins", legacyId, 80),
    registrosAlunoERP(supabase, tabela, tenant, "mensalidades", legacyId, 40),
    registrosAlunoERP(supabase, tabela, tenant, "financeiro", legacyId, 40),
    registrosAvaliacoesERP(supabase, tabela, tenant, legacyId, 40)
  ]);

  const matricula = escolherMatricula(matriculasRows);
  const plano = resumoPlano(matricula, alunoERP);
  const treinos = resumoTreinos(treinosRows);
  const frequencia = resumoFrequencia([...checkinRows, ...checkinsRows]);
  const financeiro = resumoFinanceiro(mensalidadesRows, financeiroRows);
  const avaliacao = resumoAvaliacoes(avaliacoesRows);

  const aluno = {
    id: textoSeguro(alunoApp.id),
    legacy_id: legacyId,
    nome: textoSeguro(alunoERP.nome || alunoApp.nome),
    status: textoSeguro(alunoERP.status || alunoERP.situacao || alunoApp.status),
    matricula: textoSeguro(plano?.numero_matricula || alunoERP.numeroMatricula || alunoApp.matricula),
    modalidade: textoSeguro(plano?.modalidade || alunoERP.modalidade),
    objetivo: textoSeguro(alunoERP.objetivo),
    foto: fotoAlunoSegura(alunoERP)
  };

  return {
    aluno,
    plano,
    treinos,
    frequencia,
    financeiro,
    avaliacao,
    avisos: montarAvisos({ alunoERP, plano, treinos, financeiro, avaliacao })
  };
}

export async function obterHomeAlunoApp(req, res, deviceToken) {
  const status = await statusAlunoApp(deviceToken);
  const { accessToken, usuario } = await sessaoValida(req, res);
  const filtro = encodeURIComponent(`eq.${usuario.id}`);
  const alunos = await chamarSupabase(
    `/rest/v1/alunos?select=id,nome,status,matricula,legacy_id,dados&usuario_id=${filtro}&limit=1`,
    { accessToken }
  );
  const alunoApp = Array.isArray(alunos) ? alunos[0] : null;
  if (!alunoApp) {
    throw new AlunoAppError("Cadastro do aluno não encontrado para esta sessão.", 404, "STUDENT_NOT_FOUND");
  }

  const home = await carregarHomeERP(alunoApp);
  return { ...home, academia_nome: status.academia_nome };
}

export { AlunoAppError };
