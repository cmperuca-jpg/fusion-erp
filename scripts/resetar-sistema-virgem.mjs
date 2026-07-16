import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");
const IMPORTACAO = path.join(DATA, "importacao");
const CONFIRMACAO = "RESETAR-MODELO";
const DRY_RUN = process.argv.includes("--dry-run");
const confirmacao = process.argv.find(arg => arg.startsWith("--confirmar="))?.split("=").slice(1).join("=") || "";
const agora = new Date();
const agoraIso = agora.toISOString();
const hoje = agoraIso.slice(0, 10);
const validade = new Date(agora.getTime() + 90 * 86400000).toISOString().slice(0, 10);

const IDS = Object.freeze({
  admin: "usr_modelo_admin", recepcao: "usr_modelo_recepcao",
  tecnicoUsuario: "usr_modelo_responsavel_tecnico", alunoUsuario: "usr_modelo_aluno",
  tecnico: "prof_modelo_responsavel_tecnico", aluno: "aluno_modelo_001",
  matricula: "mat_modelo_001", contrato: "ctr_modelo_001", servico: "svc_modelo_001",
  avaliacao: "ava_modelo_001"
});

const SENHAS = Object.freeze({ admin: "Admin@123", recepcao: "Recepcao@123", tecnico: "Tecnico@123", aluno: "Aluno@123" });

const PRESERVAR = new Set([
  "backup_config", "planos", "modalidades", "modelos-treino", "exercicios",
  "exercicios_biblioteca", "treinos_exercicios", "taxas_cartao", "henry7x",
  "access_regras", "access_integracoes_sdk"
]);

function sha256(valor) { return crypto.createHash("sha256").update(String(valor || "")).digest("hex"); }
function hashProfessor(senha, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(senha), salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}
function tenantId() {
  return String(process.env.FUSION_TENANT_ID || process.env.FUSION_ACADEMIA_ID || "academia-piloto")
    .trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "academia-piloto";
}
function usuario({ id, nome, email, senha, perfil, permissoes }) {
  return { id, nome, email, senhaHash: sha256(senha), perfil, status: "ativo", permissoes,
    trocarSenhaNoPrimeiroAcesso: true, criadoEm: agoraIso, atualizadoEm: agoraIso };
}
function exercicio(id, ordem, nome, grupo, series, repeticoes, descanso = "75s", observacao = "") {
  return { id, exercicioId: "", bibliotecaId: "", ordem, nome, grupoMuscular: grupo, grupo,
    equipamento: "", series, repeticoes, carga: "Definir após teste de carga", descanso,
    cadencia: "2-1-2", intensidade: "RIR 2", observacao, observacoes: observacao,
    midia: "", tipoMidia: "", imagemUrl: "", videoUrl: "", origem: "modelo_entrega" };
}
function treino(id, letra, nome, grupos, exercicios) {
  return { id, alunoId: IDS.aluno, aluno: "Aluno Modelo", contratoId: IDS.contrato,
    matriculaId: IDS.matricula, numeroMatricula: "MODELO-001", servicoContratadoId: IDS.servico,
    turmaId: "", turma: "Musculação", modalidade: "Musculação", professorId: IDS.tecnico,
    professor: "Responsável Técnico Modelo", objetivo: "Hipertrofia muscular",
    nome: `Treino ${letra} — ${nome}`, tipoDivisao: "ABC", gruposMusculares: grupos,
    dataInicio: hoje, dataValidade: validade, status: "Ativo", exercicios,
    observacao: "Modelo para orientação dos funcionários. Ajustar cargas e exercícios após avaliação individual.",
    origem: "reset_modelo_entrega", modoCompatibilidadeV3: true, criadoEm: agoraIso,
    atualizadoEm: agoraIso, versao: 1,
    historico: [{ acao: "criar_treino_modelo", usuario: "Sistema", criadoEm: agoraIso, detalhes: { divisao: "ABC" } }] };
}

function montarModelo() {
  const usuarios = [
    usuario({ id: IDS.admin, nome: "Administrador Fusion", email: "admin@fusionerp.local", senha: SENHAS.admin, perfil: "Administrador", permissoes: ["*"] }),
    usuario({ id: IDS.recepcao, nome: "Recepção Modelo", email: "recepcao@fusionerp.local", senha: SENHAS.recepcao, perfil: "Recepcao", permissoes: ["dashboard","alunos","matriculas","matriculas-pendentes","financeiro","mensalidades","caixa","comercial","comercial-painel","site-chat","checkin"] }),
    usuario({ id: IDS.tecnicoUsuario, nome: "Responsável Técnico Modelo", email: "tecnico@fusionerp.local", senha: SENHAS.tecnico, perfil: "Professor", permissoes: ["professor-area","avaliacoes","treinos","aluno-treinos"] }),
    usuario({ id: IDS.alunoUsuario, nome: "Aluno Modelo", email: "aluno@fusionerp.local", senha: SENHAS.aluno, perfil: "Aluno", permissoes: ["aluno-treinos","aluno-avaliacao"] })
  ];
  const professor = {
    id: IDS.tecnico, nome: "Responsável Técnico Modelo", cpf: "00000000000", rg: "MODELO",
    cref: "CREF-MODELO", email: "tecnico@fusionerp.local", login: "tecnico@fusionerp.local",
    telefone: "82999990001", whatsapp: "82999990001", especialidade: "Musculação e Hipertrofia",
    especialidades: ["Musculação", "Hipertrofia", "Avaliação física"], modalidades: ["Musculação"],
    perfil: "responsavel_tecnico", acessoTodosAlunos: true, status: "Ativo", bloqueado: false,
    senhaHash: hashProfessor(SENHAS.tecnico), criadoEm: agoraIso, atualizadoEm: agoraIso,
    observacoes: "Conta modelo. Substituir pelos dados e CREF do responsável técnico da academia."
  };
  const aluno = {
    id: IDS.aluno, nome: "Aluno Modelo", cpf: "12345678909", rg: "MODELO-001",
    email: "aluno@fusionerp.local", telefone: "82999990000", whatsapp: "82999990000",
    dataNascimento: "1990-01-01", data_nascimento: "1990-01-01", sexo: "Masculino",
    senhaPortal: SENHAS.aluno, status: "ativo", situacao: "Ativo", ativo: true, bloqueado: false,
    motivoBloqueio: "", inadimplente: false, emAtraso: false, numeroMatricula: "MODELO-001",
    matriculaId: IDS.matricula, matriculaStatus: "Ativa", statusMatricula: "Ativa",
    plano: "Plano Demonstração", planoId: "plano_modelo_demonstracao", valorPlano: 0,
    valorMensal: 0, valorMensalTotal: 0, professorId: IDS.tecnico,
    professorResponsavelId: IDS.tecnico, professorNome: professor.nome,
    professor_responsavel: professor.nome, possuiBiometria: false, biometriaStatus: "Não cadastrada",
    foto_base64: "", criado_em: agoraIso, atualizado_em: agoraIso, atualizadoEm: agoraIso,
    observacoes: "Cadastro fictício para treinamento dos funcionários. Não representa pessoa real."
  };
  const matricula = {
    id: IDS.matricula, numero: "MODELO-001", numeroMatricula: "MODELO-001",
    alunoId: IDS.aluno, aluno: aluno.nome, alunoNome: aluno.nome, planoId: aluno.planoId,
    plano: aluno.plano, planoNome: aluno.plano, status: "Ativa", bloqueada: false,
    dataInicio: hoje, dataMatricula: hoje, dataAtivacao: hoje, ativadaEm: agoraIso,
    valorPlano: 0, valorMensal: 0, valorMensalTotal: 0, valorServicos: 0,
    statusPagamento: "Isento — conta modelo", formaPagamento: "Cortesia",
    gerarMensalidadeAutomatica: false, renovacaoAutomatica: false, origem: "reset_modelo_entrega",
    criadoEm: agoraIso, atualizadoEm: agoraIso,
    historico: [{ id: "hist_modelo_001", acao: "matricula_modelo", descricao: "Matrícula de demonstração sem cobrança.", usuario: "Sistema", criadoEm: agoraIso }]
  };
  const perguntasParq = ["Problema cardíaco diagnosticado?","Dor no peito durante atividade física?","Dor no peito no último mês?","Tontura, desmaio ou perda de consciência?","Problema ósseo ou muscular limitante?","Uso de medicamento cardiovascular?","Outra razão para orientação médica?"];
  const avaliacao = {
    id: IDS.avaliacao, aluno_id: IDS.aluno, alunoId: IDS.aluno, alunoNome: aluno.nome,
    professor_id: IDS.tecnico, professorId: IDS.tecnico, professorNome: professor.nome,
    avaliadorId: IDS.tecnico, avaliador: professor.nome, data: hoje, hora: "09:00",
    status: "Concluída", objetivo: "Hipertrofia muscular", pratica_atividade: "Musculação 3 vezes por semana",
    medicamentos: "Não utiliza", cirurgias: "Nenhuma relatada", doencas_familia: "Nenhuma condição relevante relatada",
    observacoes: "Modelo de avaliação completa. Personalizar todos os dados antes de utilizar com aluno real.",
    condicao_fisica: "Aparentemente saudável", risco_idade: "1", risco_sexo: "Masculino",
    risco_peso: "1", risco_exercicio: "0", risco_historico: "0", risco_tabagismo: "0", risco_colesterol: "0", risco_pas: "0",
    peso: "75", altura: "1.75", imc: "24.49", classificacao_imc: "Peso adequado",
    percentual_gordura: "15", percentual_ideal: "14", agua_corporal: "60", massa_magra: "63.75",
    massa_gorda: "11.25", tmb: "1650", protocolo_dobras: "Pollock 7 dobras", subescapular: "12",
    bicipital: "6", tricipital: "10", axilar_media: "11", supra_iliaca: "12", peitoral: "8",
    dobra_abdominal: "15", dobra_coxa: "14", dobra_panturrilha: "10", gordura_visceral: "5", idade_metabolica: "30",
    ombro: "112", braco_relaxado_direito: "34", braco_relaxado_esquerdo: "33.5",
    braco_contraido_direito: "36", braco_contraido_esquerdo: "35.5", antebraco_direito: "29",
    antebraco_esquerdo: "28.5", torax_relaxado: "98", torax_inspirado: "103", cintura: "82",
    abdomen: "86", quadril: "98", rcq: "0.84", coxa_proximal_direita: "58",
    coxa_proximal_esquerda: "57.5", coxa_medial_direita: "54", coxa_medial_esquerda: "53.5",
    panturrilha_direita: "38", panturrilha_esquerda: "37.5", pescoco: "38", punho: "17",
    vo2_obtido: "42", vo2_previsto: "40", deficit_aerobico: "0", protocolo_cardio: "Teste de Cooper",
    flexao_bracos: "30", abdominal_repeticoes: "35", banco_wells: "28",
    parq: perguntasParq.map(pergunta => ({ pergunta, resposta: "nao" })), fotos: {},
    diagnostico_ia: "Condição geral adequada para programa progressivo de hipertrofia.",
    diagnostico_pontos: ["Composição corporal adequada","Boa aptidão cardiorrespiratória","PAR-Q sem respostas positivas"],
    diagnostico_atencao: ["Acompanhar evolução de carga e técnica"],
    diagnostico_conduta: ["Treino ABC três vezes por semana","Progressão gradual com RIR 2","Reavaliação em 90 dias"],
    criadoEm: agoraIso, criado_em: agoraIso, atualizadoEm: agoraIso, atualizado_em: agoraIso
  };
  const treinos = [
    treino("trn_modelo_a", "A", "Peito, ombros e tríceps", ["Peito","Ombros","Tríceps"], [
      exercicio("ex_a_01",1,"Supino reto com barra","Peito",4,"8-10","90s","Manter escápulas estabilizadas."),
      exercicio("ex_a_02",2,"Supino inclinado com halteres","Peito",3,"10-12"),
      exercicio("ex_a_03",3,"Crucifixo na máquina","Peito",3,"12-15","60s"),
      exercicio("ex_a_04",4,"Desenvolvimento com halteres","Ombros",4,"8-10","90s"),
      exercicio("ex_a_05",5,"Elevação lateral","Ombros",3,"12-15","60s"),
      exercicio("ex_a_06",6,"Tríceps na polia com corda","Tríceps",3,"10-12","60s")
    ]),
    treino("trn_modelo_b", "B", "Costas e bíceps", ["Costas","Bíceps"], [
      exercicio("ex_b_01",1,"Puxada frontal pegada aberta","Costas",4,"8-10","90s"),
      exercicio("ex_b_02",2,"Remada baixa","Costas",4,"8-10","90s"),
      exercicio("ex_b_03",3,"Remada unilateral com halter","Costas",3,"10-12"),
      exercicio("ex_b_04",4,"Pulldown com corda","Costas",3,"12-15","60s"),
      exercicio("ex_b_05",5,"Rosca direta com barra","Bíceps",3,"8-10"),
      exercicio("ex_b_06",6,"Rosca martelo","Bíceps",3,"10-12","60s")
    ]),
    treino("trn_modelo_c", "C", "Pernas e glúteos", ["Quadríceps","Posteriores","Glúteos","Panturrilhas"], [
      exercicio("ex_c_01",1,"Agachamento livre","Quadríceps e glúteos",4,"8-10","120s","Priorizar amplitude segura e técnica."),
      exercicio("ex_c_02",2,"Leg press 45°","Quadríceps",4,"10-12","90s"),
      exercicio("ex_c_03",3,"Cadeira extensora","Quadríceps",3,"12-15","60s"),
      exercicio("ex_c_04",4,"Mesa flexora","Posteriores",4,"10-12"),
      exercicio("ex_c_05",5,"Stiff com barra","Posteriores e glúteos",3,"8-10","90s"),
      exercicio("ex_c_06",6,"Elevação pélvica","Glúteos",4,"10-12","90s"),
      exercicio("ex_c_07",7,"Panturrilha em pé","Panturrilhas",4,"12-15","60s")
    ])
  ];
  const treinoPortalAluno = {
    id: "trn_modelo_abc_portal", alunoId: IDS.aluno, alunoNome: aluno.nome,
    professorId: IDS.tecnico, professorNome: professor.nome, objetivo: "Hipertrofia muscular",
    nome: "Treino ABC — Hipertrofia", validade, dataInicio: hoje, dataValidade: validade,
    status: "Ativo", ativo: true, criadoEm: agoraIso, atualizadoEm: agoraIso,
    observacoes: "Modelo para treinamento dos funcionários. O responsável técnico deve adaptar cargas e exercícios ao aluno real.",
    divisoes: treinos.map((item, indice) => ({
      nome: String.fromCharCode(65 + indice),
      itens: item.exercicios.map(ex => ({
        ...ex,
        descricao: ex.observacoes || ex.observacao || "",
        foto: ex.foto || ex.gif || ex.midia || ex.imagemUrl || "",
        gif: ex.gif || ex.foto || ex.midia || ex.imagemUrl || "",
        metodo: ex.metodo || ex.intensidade || "Convencional",
        obs: ex.obs || ex.observacao || ex.observacoes || ""
      }))
    }))
  };
  const contrato = { id: IDS.contrato, alunoId: IDS.aluno, aluno: aluno.nome, matriculaId: IDS.matricula,
    numeroMatricula: "MODELO-001", status: "Ativo", tipoPlano: "Demonstração", tipoCobranca: "Cortesia",
    dataInicio: hoje, dataFim: validade, totalMensal: 0, valorMatricula: 0, valorServicos: 0, valorTotal: 0,
    quantidadeServicos: 1, renovacaoAutomatica: false, origem: "reset_modelo_entrega", criadoEm: agoraIso, atualizadoEm: agoraIso, historico: [] };
  const servico = { id: IDS.servico, contratoId: IDS.contrato, matriculaId: IDS.matricula, alunoId: IDS.aluno,
    nome: "Musculação — Modelo ABC", modalidade: "Musculação", professor: professor.nome, status: "Ativo",
    tipoCobranca: "Cortesia", valor: 0, dataInicio: hoje, dataFim: validade,
    diasSemana: ["Segunda","Quarta","Sexta"], horario: "Livre", origem: "reset_modelo_entrega", criadoEm: agoraIso, atualizadoEm: agoraIso };
  return {
    usuarios, professores: [professor], alunos: [aluno], matriculas: [matricula], mensalidades: [],
    financeiro: [], pagamentos: [], recebimentos: [], creditos: [], caixa: { caixas: [], movimentos: [] },
    cobranca_log: [], avaliacoes: [avaliacao], treinos, treinos_integrados: treinos, treinos_prescritos: [treinoPortalAluno],
    treinos_ciclos: [{ id: "ciclo_modelo_001", alunoId: IDS.aluno, nome: "Ciclo ABC Hipertrofia — Modelo", objetivo: "Hipertrofia", treinoIds: treinos.map(t => t.id), dataInicio: hoje, dataFim: validade, status: "Ativo", criadoEm: agoraIso }],
    treinos_execucoes: [], checkin: [], checkins: [], frequencia: [], presencas: [], biometrias: [],
    access_logs: [], access_eventos: [], access_pessoas_presentes: [], access_bridge_commands: [], access_bridge_agents: [],
    agenda: [], agenda_operacional: [], site_chat: [], crm: [], leads: [], matriculas_online: [],
    alunos_historico_planos: [], contratos: [contrato], servicos_contratados: [servico]
  };
}

async function lerJsonLocal(arquivo, padrao = []) {
  try { const bruto = await fs.readFile(arquivo, "utf8"); return bruto.trim() ? JSON.parse(bruto) : padrao; }
  catch { return padrao; }
}
async function salvarJsonAtomico(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  const temporario = `${arquivo}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporario, JSON.stringify(dados, null, 2), "utf8");
  await fs.rename(temporario, arquivo);
}
async function colecoesAtuaisSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const tabela = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";
  const nomes = new Set();
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await sb.from(tabela).select("collection").eq("tenant_id", tenantId()).range(inicio, inicio + 999);
    if (error) throw new Error(`Falha ao inventariar coleções do Supabase: ${error.message}`);
    for (const linha of data || []) nomes.add(String(linha.collection || ""));
    if (!data || data.length < 1000) break;
  }
  return [...nomes].filter(nome => /^[a-z0-9_-]+$/.test(nome));
}
async function montarColecoesReset(modelo, lerColecao) {
  const colecoes = {};
  let itens = [];
  try { itens = await fs.readdir(DATA, { withFileTypes: true }); } catch {}
  for (const item of itens.filter(item => item.isFile() && item.name.endsWith(".json"))) {
    const nome = item.name.replace(/\.json$/i, "").replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    const local = await lerJsonLocal(path.join(DATA, item.name), []);
    colecoes[nome] = PRESERVAR.has(nome) ? await lerColecao(nome, local) : (Array.isArray(local) ? [] : {});
  }
  for (const nome of await colecoesAtuaisSupabase()) {
    if (!Object.hasOwn(colecoes, nome)) colecoes[nome] = PRESERVAR.has(nome) ? await lerColecao(nome, []) : [];
  }
  const resultado = { ...colecoes, ...modelo };
  const planosAtuais = Array.isArray(resultado.planos) ? resultado.planos : [];
  const planoDemonstracao = {
    id: "plano_modelo_demonstracao", nome: "Plano Demonstração", tipo: "Cortesia",
    status: "Ativo", valor: 0, valorMensal: 0, taxaMatricula: 0,
    gerarMensalidadeAutomatica: false, descricao: "Plano sem cobrança usado somente pelo aluno fictício de treinamento.",
    criadoEm: agoraIso, atualizadoEm: agoraIso
  };
  resultado.planos = [
    ...planosAtuais.filter(plano => String(plano?.id || "") !== planoDemonstracao.id),
    planoDemonstracao
  ];
  return resultado;
}
async function limparPastaConteudo(pasta) {
  let itens = [];
  try { itens = await fs.readdir(pasta); } catch { return; }
  for (const item of itens) await fs.rm(path.join(pasta, item), { recursive: true, force: true });
}
async function limparStorageTenant() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { configurado: false, removidos: 0 };
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const bucket = process.env.SUPABASE_DATA_BUCKET || "fusion-data";
  const prefixo = `tenants/${tenantId()}`;
  const arquivos = [];
  async function percorrer(pasta) {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await sb.storage.from(bucket).list(pasta, { limit: 100, offset });
      if (error) { if (/not found|does not exist/i.test(error.message || "")) return; throw new Error(`Falha ao listar Storage durante reset: ${error.message}`); }
      for (const item of data || []) {
        const caminho = `${pasta}/${item.name}`;
        if (item.id || item.metadata) arquivos.push(caminho); else await percorrer(caminho);
      }
      if (!data || data.length < 100) break;
    }
  }
  await percorrer(prefixo);
  for (let i = 0; i < arquivos.length; i += 100) {
    const { error } = await sb.storage.from(bucket).remove(arquivos.slice(i, i + 100));
    if (error) throw new Error(`Falha ao limpar arquivos antigos do tenant: ${error.message}`);
  }
  return { configurado: true, bucket, prefixo, removidos: arquivos.length };
}
async function salvarCredenciais() {
  const conteudo = `FUSION ERP — CREDENCIAIS INICIAIS DO MODELO\n\nAdministrador\nE-mail: admin@fusionerp.local\nSenha: ${SENHAS.admin}\n\nRecepção\nE-mail: recepcao@fusionerp.local\nSenha: ${SENHAS.recepcao}\n\nResponsável técnico\nLogin: tecnico@fusionerp.local\nSenha: ${SENHAS.tecnico}\n\nAluno modelo\nLogin: aluno@fusionerp.local ou CPF 12345678909\nSenha: ${SENHAS.aluno}\n\nIMPORTANTE: altere todas as senhas e substitua os dados fictícios antes de iniciar a operação real.\n`;
  await fs.writeFile(path.join(ROOT, "CREDENCIAIS-INICIAIS-FUSION-ERP.txt"), conteudo, "utf8");
}

async function main() {
  const modelo = montarModelo();
  if (DRY_RUN) {
    console.log(JSON.stringify({ ok: true, modo: "simulacao", tenantId: tenantId(), usuarios: modelo.usuarios.length,
      alunos: modelo.alunos.length, avaliacoes: modelo.avaliacoes.length, treinos: modelo.treinos_integrados.length,
      financeiro: modelo.financeiro.length }, null, 2));
    return;
  }
  if (confirmacao !== CONFIRMACAO) throw new Error(`Confirmação ausente. Execute com --confirmar=${CONFIRMACAO}.`);
  const { lerColecao, salvarColecoesAtomicas } = await import("../modules/core/persistence/collection-store.mjs");
  const { criarBackupLocal, enviarBackupSupabase } = await import("../modules/backup/backup.service.mjs");
  const { restaurarArquivosNoSupabase } = await import("../modules/backup/supabase-data.service.mjs");
  console.log(`Tenant selecionado: ${tenantId()}`);
  console.log("Criando backup obrigatório antes do reset...");
  const backup = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? await enviarBackupSupabase({ sufixo: "antes-reset-modelo" }) : await criarBackupLocal();
  const colecoes = await montarColecoesReset(modelo, lerColecao);
  await salvarColecoesAtomicas(colecoes, { operacaoId: `reset-modelo-${crypto.randomUUID()}` });
  const colecoesAninhadas = new Set(["contratos", "servicos_contratados"]);
  for (const [nome, dados] of Object.entries(colecoes)) {
    if (!colecoesAninhadas.has(nome)) await salvarJsonAtomico(path.join(DATA, `${nome}.json`), dados);
  }
  await salvarJsonAtomico(path.join(DATA, "comercial", "contratos.json"), modelo.contratos);
  await salvarJsonAtomico(path.join(DATA, "comercial", "servicos_contratados.json"), modelo.servicos_contratados);
  await limparPastaConteudo(UPLOADS);
  await limparPastaConteudo(IMPORTACAO);
  await fs.mkdir(UPLOADS, { recursive: true });
  await fs.mkdir(IMPORTACAO, { recursive: true });
  await salvarCredenciais();
  const storageLimpo = await limparStorageTenant();
  const storage = await restaurarArquivosNoSupabase();
  console.log(JSON.stringify({ ok: true, operacao: "reset_sistema_modelo_entrega", tenantId: tenantId(), backup,
    colecoesAtualizadas: Object.keys(colecoes).length, contasCriadas: modelo.usuarios.length,
    alunoModelo: modelo.alunos[0].nome, avaliacaoModelo: modelo.avaliacoes.length,
    treinosModelo: modelo.treinos_integrados.map(item => item.nome), financeiroZerado: true,
    storageLimpo, storage, credenciais: "CREDENCIAIS-INICIAIS-FUSION-ERP.txt" }, null, 2));
}

main().catch(erro => { console.error(`Falha no reset: ${erro.message}`); process.exitCode = 1; });
