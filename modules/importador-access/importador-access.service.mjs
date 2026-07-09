import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.resolve(process.cwd(), "data");
const IMPORT_DIR = path.join(DATA_DIR, "importacao");
const ALUNOS_JSON = path.join(DATA_DIR, "alunos.json");
const MATRICULAS_JSON = path.join(DATA_DIR, "matriculas.json");
const MENSALIDADES_JSON = path.join(DATA_DIR, "mensalidades.json");
const FINANCEIRO_JSON = path.join(DATA_DIR, "financeiro.json");
const RECEBIMENTOS_JSON = path.join(DATA_DIR, "recebimentos.json");
const PLANOS_JSON = path.join(DATA_DIR, "planos.json");
const RELATORIO_JSON = path.join(IMPORT_DIR, "relatorio_importacao_access.json");

const CONFIG = {
  nomePlano: "MUSCULAÇÃO",
  tipoPlano: "Mensal",
  valorMensal: 65,
  taxaMatriculaPlano: 0,
  diaVencimento: 10,
  competenciaInicialAtivos: "2026-08",
  vencimentoInicialAtivos: "2026-08-10",
  ativosLegado: 81,
  valorMatriculaPromocional: 0.01,
  statusExcluidoColuna: 29
};

function agoraISO() { return new Date().toISOString(); }
function hojeISO() { return new Date().toISOString().slice(0, 10); }

function limparTexto(valor) {
  return String(valor ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removerAcentos(valor = "") {
  return limparTexto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function somenteDigitos(valor) {
  return limparTexto(valor).replace(/\D/g, "");
}

function normalizarDinheiro(valor, padrao = 0) {
  const n = Number(String(valor ?? "").replace("R$", "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : padrao;
}

function normalizarTelefone(valor) {
  const digitos = somenteDigitos(valor);
  if (!digitos) return "";
  if (digitos.length === 10 || digitos.length === 11) return digitos;
  if (digitos.length > 11) return digitos.slice(-11);
  return digitos;
}

function normalizarCpf(valor) {
  const digitos = somenteDigitos(valor);
  return digitos.length === 11 ? digitos : "";
}


function normalizarSexoAccess(valor = "") {
  const s = limparTexto(valor).toLowerCase();
  if (!s) return "";
  if (["m", "masc", "masculino", "homem", "0", "0,00"].includes(s)) return "masculino";
  if (["f", "fem", "feminino", "mulher", "1", "1,00"].includes(s)) return "feminino";
  return "";
}

function normalizarDataAccess(valor) {
  const texto = limparTexto(valor);
  if (!texto || texto.startsWith("30/12/1899")) return "";
  const match = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return "";
  const dia = match[1].padStart(2, "0");
  const mes = match[2].padStart(2, "0");
  const ano = match[3];
  return `${ano}-${mes}-${dia}`;
}

function parseLinhaCsv(linha, delimitador = ";") {
  const campos = [];
  let atual = "";
  let dentroAspas = false;

  for (let i = 0; i < linha.length; i += 1) {
    const char = linha[i];
    const prox = linha[i + 1];

    if (char === '"') {
      if (dentroAspas && prox === '"') {
        atual += '"';
        i += 1;
      } else {
        dentroAspas = !dentroAspas;
      }
      continue;
    }

    if (char === delimitador && !dentroAspas) {
      campos.push(atual);
      atual = "";
      continue;
    }

    atual += char;
  }

  campos.push(atual);
  return campos;
}

function pareceInicioRegistro(linha = "") {
  return /^\s*\d+\s*;\s*\d+\s*;/.test(linha);
}

export function parseTextoDelimitado(conteudo = "") {
  const texto = String(conteudo || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const linhasFisicas = texto.split("\n");
  const registros = [];
  let atual = "";

  for (const linha of linhasFisicas) {
    if (!linha.trim()) continue;
    if (pareceInicioRegistro(linha)) {
      if (atual.trim()) registros.push(atual);
      atual = linha;
      continue;
    }
    if (atual) atual += `\n${linha}`;
  }

  if (atual.trim()) registros.push(atual);
  return registros.map((registro) => parseLinhaCsv(registro, ";"));
}

function escolherCpf(campos = []) {
  const candidatos = [campos[11], campos[12], campos[13], campos[14], campos[31], campos[32], campos[50], campos[51], campos[52]];
  for (const candidato of candidatos) {
    const cpf = normalizarCpf(candidato);
    if (cpf) return cpf;
  }

  const textoCompleto = campos.map(limparTexto).join(" ");
  const matchCpfRotulado = textoCompleto.match(/CPF\D*(\d{3}\D?\d{3}\D?\d{3}\D?\d{2})/i);
  if (matchCpfRotulado) return normalizarCpf(matchCpfRotulado[1]);
  return "";
}

function escolherTelefone(campos = []) {
  const candidatos = [campos[9], campos[24], campos[52], campos[53], campos[54]];
  for (const candidato of candidatos) {
    const telefone = normalizarTelefone(candidato);
    if (telefone && telefone.length >= 10) return telefone;
  }

  const textoCompleto = campos.map(limparTexto).join(" ");
  const matchTelefone = textoCompleto.match(/(?:\(?82\)?\s*)?9\d{4}\D?\d{4}/);
  if (matchTelefone) {
    const telefone = normalizarTelefone(matchTelefone[0]);
    if (telefone.length >= 10) return telefone.startsWith("82") ? telefone : `82${telefone}`.slice(-11);
  }
  return "";
}

function estaExcluidoAccess(campos = []) {
  return limparTexto(campos[CONFIG.statusExcluidoColuna]) === "1";
}

function chaveDuplicidade(aluno) {
  if (aluno.cpf) return `cpf:${aluno.cpf}`;
  return `nome_nascimento:${removerAcentos(aluno.nome).toLowerCase()}|${aluno.data_nascimento || ""}`;
}

function normalizarNomePlano(valor = "") {
  return removerAcentos(valor).toUpperCase();
}

async function lerJsonArray(arquivo) {
  try {
    const bruto = await fs.readFile(arquivo, "utf-8");
    const dados = bruto.trim() ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados : [];
  } catch {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    await fs.writeFile(arquivo, "[]", "utf-8");
    return [];
  }
}

async function salvarJson(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), "utf-8");
}

async function obterPlanoMusculacao() {
  const planos = await lerJsonArray(PLANOS_JSON);
  const alvo = normalizarNomePlano(CONFIG.nomePlano);
  const plano = planos.find((p) => normalizarNomePlano(p.nome || p.plano || p.descricao).includes(alvo));
  if (plano) {
    return {
      id: plano.id || "plano-musculacao-importacao",
      nome: plano.nome || CONFIG.nomePlano,
      tipo: plano.tipo || plano.tipoPlano || CONFIG.tipoPlano,
      valorMensal: normalizarDinheiro(plano.valorMensal ?? plano.valor ?? plano.mensalidade, CONFIG.valorMensal),
      taxaMatricula: normalizarDinheiro(plano.taxaMatricula ?? plano.valorMatricula, CONFIG.taxaMatriculaPlano)
    };
  }

  return {
    id: "plano-musculacao-importacao",
    nome: CONFIG.nomePlano,
    tipo: CONFIG.tipoPlano,
    valorMensal: CONFIG.valorMensal,
    taxaMatricula: CONFIG.taxaMatriculaPlano
  };
}

function numeroMatricula(importadosNoLote = 0) {
  const ym = CONFIG.competenciaInicialAtivos.replace("-", "");
  return `MAT-IMP-${ym}-${String(importadosNoLote + 1).padStart(6, "0")}`;
}

export function normalizarAlunoAccess(campos = [], origem = "Alunos.txt", contexto = {}) {
  const idLegado = limparTexto(campos[0] || campos[1]);
  const nome = limparTexto(campos[2]).toUpperCase();
  const cpf = escolherCpf(campos);
  const telefone = escolherTelefone(campos);
  const sexo = normalizarSexoAccess(campos[10]);
  const dataNascimento = normalizarDataAccess(campos[15]);
  const excluido = estaExcluidoAccess(campos);
  const ordemImportavel = Number(contexto.ordemImportavel || 0);
  const statusLegado = excluido ? "excluido" : ordemImportavel <= CONFIG.ativosLegado ? "ativo" : "inativo";
  const ativo = statusLegado === "ativo";
  const agora = agoraISO();

  return {
    id: crypto.randomUUID(),
    id_legado: idLegado,
    origem_importacao: "Access",
    arquivo_origem: origem,
    nome,
    cpf,
    telefone,
    celular: telefone,
    whatsapp: telefone,
    data_nascimento: dataNascimento,
    sexo,
    status: ativo ? "ativo" : "inativo",
    status_legado_access: statusLegado,
    ativo,
    importado_access: true,
    dia_vencimento: CONFIG.diaVencimento,
    criado_em: agora,
    criadoEm: agora,
    atualizado_em: agora,
    atualizadoEm: agora
  };
}

export function analisarAlunosTxt(conteudo, nomeArquivo = "Alunos.txt") {
  const linhas = parseTextoDelimitado(conteudo);
  const ignorados = [];
  const excluidos = [];
  const duplicadosArquivo = [];
  const alunos = [];
  const vistos = new Set();
  let ordemImportavel = 0;

  for (const campos of linhas) {
    const idLegado = limparTexto(campos[0] || campos[1]);
    const nome = limparTexto(campos[2]).toUpperCase();

    if (!nome) {
      ignorados.push({ id_legado: idLegado, motivo: "sem_nome" });
      continue;
    }

    if (estaExcluidoAccess(campos)) {
      excluidos.push({ id_legado: idLegado, nome, motivo: "marcado_como_excluido_no_access" });
      continue;
    }

    ordemImportavel += 1;
    const aluno = normalizarAlunoAccess(campos, nomeArquivo, { ordemImportavel });
    const chave = chaveDuplicidade(aluno);

    if (vistos.has(chave)) {
      duplicadosArquivo.push({ id_legado: aluno.id_legado, nome: aluno.nome, chave });
    }

    vistos.add(chave);
    alunos.push(aluno);
  }

  const ativos = alunos.filter((a) => a.status === "ativo");
  const inativos = alunos.filter((a) => a.status === "inativo");

  return {
    ok: true,
    arquivo: nomeArquivo,
    total_linhas: linhas.length,
    total_registros: linhas.length,
    total_normalizados: alunos.length,
    importaveis: alunos.length,
    ativos: ativos.length,
    inativos: inativos.length,
    excluidos: excluidos.length,
    ignorados: ignorados.length,
    duplicados_no_arquivo: duplicadosArquivo.length,
    campos_por_linha: linhas[0]?.length || 0,
    regra_importacao: {
      campos: ["nome", "data_nascimento", "celular", "cpf quando existir"],
      plano: `${CONFIG.nomePlano} - R$ ${CONFIG.valorMensal.toFixed(2).replace(".", ",")}`,
      vencimento: `dia ${CONFIG.diaVencimento}`,
      ativos: "geram mensalidade 08/2026 e recorrência",
      inativos: "não geram matrícula, financeiro, mensalidade nem recorrência",
      excluidos: "não importados",
      matricula: "R$ 0,01 paga somente para alunos ativos"
    },
    preview: alunos.slice(0, 10),
    alunos,
    detalhes: {
      ignorados: ignorados.slice(0, 50),
      excluidos: excluidos.slice(0, 50),
      duplicados_no_arquivo: duplicadosArquivo.slice(0, 100)
    }
  };
}

function indexarAlunosExistentes(alunos = []) {
  const indices = { cpf: new Set(), nomeNascimento: new Set() };
  for (const aluno of alunos) {
    const cpf = normalizarCpf(aluno.cpf);
    const nome = removerAcentos(aluno.nome || aluno.alunoNome || aluno.name).toLowerCase();
    const nascimento = String(aluno.data_nascimento || aluno.nascimento || aluno.dataNascimento || "").slice(0, 10);
    if (cpf) indices.cpf.add(cpf);
    if (nome) indices.nomeNascimento.add(`${nome}|${nascimento}`);
  }
  return indices;
}

function existeAluno(aluno, indices) {
  if (aluno.cpf && indices.cpf.has(aluno.cpf)) return "cpf";
  const chave = `${removerAcentos(aluno.nome).toLowerCase()}|${aluno.data_nascimento || ""}`;
  if (indices.nomeNascimento.has(chave)) return "nome_nascimento";
  return "";
}

function prepararAluno(aluno, plano, matricula = null) {
  const ativo = aluno.status === "ativo";
  const base = {
    ...aluno,
    planoId: plano.id,
    plano: plano.nome,
    tipoPlano: plano.tipo,
    valorMensal: ativo ? plano.valorMensal : 0,
    valorMensalTotal: ativo ? plano.valorMensal : 0,
    taxaMatricula: 0,
    statusMatricula: ativo ? "Ativa" : "Sem matrícula",
    renovacaoAutomatica: ativo,
    gerarMensalidadeAutomatica: ativo,
    origem: "Importação Access"
  };

  if (ativo && matricula) {
    base.matriculaId = matricula.id;
    base.numeroMatricula = matricula.numero;
  } else {
    base.matriculaId = "";
    base.numeroMatricula = "";
  }

  return base;
}

function criarMatricula(aluno, plano, indice) {
  const agora = agoraISO();
  const numero = numeroMatricula(indice);
  return {
    id: `mat_imp_${crypto.randomUUID()}`,
    numero,
    alunoId: aluno.id,
    aluno_id: aluno.id,
    aluno: aluno.nome,
    cpf: aluno.cpf || "",
    id_legado_aluno: aluno.id_legado,
    origem_importacao: "Access",
    planoId: plano.id,
    plano_id: plano.id,
    plano: plano.nome,
    tipoPlano: plano.tipo,
    tipoCobranca: plano.tipo,
    status: aluno.status === "ativo" ? "Ativa" : "Inativa",
    statusFinanceiroInicial: "Pago",
    dataMatricula: hojeISO(),
    data_matricula: hojeISO(),
    dataInicio: hojeISO(),
    data_inicio: hojeISO(),
    vencimentoInicial: aluno.status === "ativo" ? CONFIG.vencimentoInicialAtivos : "",
    vencimento_inicial: aluno.status === "ativo" ? CONFIG.vencimentoInicialAtivos : "",
    proximoVencimento: aluno.status === "ativo" ? CONFIG.vencimentoInicialAtivos : "",
    diaVencimento: CONFIG.diaVencimento,
    valorMatricula: CONFIG.valorMatriculaPromocional,
    taxaMatricula: 0,
    valorPlano: plano.valorMensal,
    valorMensal: plano.valorMensal,
    valorMensalTotal: plano.valorMensal,
    valorTotalInicial: CONFIG.valorMatriculaPromocional,
    formaPagamento: "Migração",
    renovacaoAutomatica: aluno.status === "ativo",
    gerarMensalidadeAutomatica: aluno.status === "ativo",
    importadoAccess: true,
    observacao: aluno.status === "ativo"
      ? "Importação Access: aluno ativo, gerar mensalidade 08/2026."
      : "Importação Access: aluno inativo, sem mensalidade e sem recorrência.",
    criadoEm: agora,
    criado_em: agora,
    atualizadoEm: agora,
    atualizado_em: agora,
    historico: [{
      id: `hist_imp_${crypto.randomUUID()}`,
      acao: "importacao_access",
      descricao: "Matrícula criada pelo Importador Access.",
      dados: { status_legado_access: aluno.status_legado_access, plano: plano.nome, vencimentoDia: CONFIG.diaVencimento },
      usuario: "importador-access",
      criadoEm: agora
    }],
    auditoria: []
  };
}

function criarFinanceiroPromocional(aluno, matricula) {
  const agora = agoraISO();
  return {
    id: `fin_imp_mat_${crypto.randomUUID()}`,
    tipo: "receber",
    descricao: "Importação Access - Matrícula Promocional",
    categoria: "Matrícula",
    alunoId: aluno.id,
    aluno_id: aluno.id,
    aluno: aluno.nome,
    pessoa: aluno.nome,
    alunoFornecedor: aluno.nome,
    matriculaId: matricula.id,
    matricula_id: matricula.id,
    planoId: matricula.planoId,
    plano: matricula.plano,
    valor: CONFIG.valorMatriculaPromocional,
    valorBruto: CONFIG.valorMatriculaPromocional,
    total: CONFIG.valorMatriculaPromocional,
    valorPago: CONFIG.valorMatriculaPromocional,
    valor_pago: CONFIG.valorMatriculaPromocional,
    valorRecebido: CONFIG.valorMatriculaPromocional,
    valorRestante: 0,
    vencimento: hojeISO(),
    data_vencimento: hojeISO(),
    dataPagamento: hojeISO(),
    data_pagamento: hojeISO(),
    formaPagamento: "Migração",
    forma_pagamento: "Migração",
    status: "Pago",
    origem: "importacao_access_matricula_promocional",
    criadoEm: agora,
    criado_em: agora,
    atualizadoEm: agora,
    atualizado_em: agora
  };
}

function criarRecebimentoPromocional(aluno, matricula, financeiro) {
  const agora = agoraISO();
  return {
    id: `rec_imp_${crypto.randomUUID()}`,
    alunoId: aluno.id,
    aluno_id: aluno.id,
    aluno: aluno.nome,
    matriculaId: matricula.id,
    matricula_id: matricula.id,
    financeiroId: financeiro.id,
    financeiro_id: financeiro.id,
    tipo: "recebimento",
    categoria: "Matrícula",
    descricao: "Importação Access - Matrícula Promocional",
    valor: CONFIG.valorMatriculaPromocional,
    valorPago: CONFIG.valorMatriculaPromocional,
    valor_pago: CONFIG.valorMatriculaPromocional,
    status: "pago",
    situacao: "Pago",
    formaPagamento: "Migração",
    forma_pagamento: "Migração",
    dataRecebimento: hojeISO(),
    data_pagamento: hojeISO(),
    origem: "importacao_access_matricula_promocional",
    criadoEm: agora,
    criado_em: agora
  };
}

function criarMensalidadeAgosto(aluno, matricula, plano) {
  const agora = agoraISO();
  return {
    id: `men_imp_${crypto.randomUUID()}`,
    alunoId: aluno.id,
    aluno_id: aluno.id,
    aluno: aluno.nome,
    matriculaId: matricula.id,
    matricula_id: matricula.id,
    planoId: plano.id,
    plano_id: plano.id,
    plano: plano.nome,
    tipoPlano: plano.tipo,
    competencia: CONFIG.competenciaInicialAtivos,
    vencimento: CONFIG.vencimentoInicialAtivos,
    data_vencimento: CONFIG.vencimentoInicialAtivos,
    diaVencimento: CONFIG.diaVencimento,
    valor: plano.valorMensal,
    total: plano.valorMensal,
    valorOriginal: plano.valorMensal,
    valorPago: 0,
    valor_pago: 0,
    valorRecebido: 0,
    valorRestante: plano.valorMensal,
    status: "Aberta",
    origem: "importacao_access_recorrencia_inicial",
    recorrencia: "mensal",
    renovacaoAutomatica: true,
    criadoEm: agora,
    criado_em: agora,
    atualizadoEm: agora,
    atualizado_em: agora
  };
}

function criarFinanceiroMensalidade(aluno, matricula, plano, mensalidade) {
  const agora = agoraISO();
  return {
    id: `fin_imp_men_${crypto.randomUUID()}`,
    tipo: "receber",
    descricao: `Mensalidade ${CONFIG.competenciaInicialAtivos} - ${aluno.nome}`,
    categoria: "Mensalidades",
    competencia: CONFIG.competenciaInicialAtivos,
    alunoId: aluno.id,
    aluno_id: aluno.id,
    aluno: aluno.nome,
    pessoa: aluno.nome,
    alunoFornecedor: aluno.nome,
    matriculaId: matricula.id,
    matricula_id: matricula.id,
    mensalidadeId: mensalidade.id,
    mensalidade_id: mensalidade.id,
    planoId: plano.id,
    plano: plano.nome,
    valor: plano.valorMensal,
    valorBruto: plano.valorMensal,
    total: plano.valorMensal,
    valorPago: 0,
    valor_pago: 0,
    valorRecebido: 0,
    valorRestante: plano.valorMensal,
    vencimento: CONFIG.vencimentoInicialAtivos,
    data_vencimento: CONFIG.vencimentoInicialAtivos,
    formaPagamento: "",
    forma_pagamento: "",
    status: "Aberto",
    origem: "importacao_access_recorrencia_inicial",
    criadoEm: agora,
    criado_em: agora,
    atualizadoEm: agora,
    atualizado_em: agora
  };
}

function montarPacoteImportacao(alunos, plano, existentes = []) {
  const indices = indexarAlunosExistentes(existentes);
  const novosAlunos = [];
  const matriculas = [];
  const mensalidades = [];
  const financeiro = [];
  const recebimentos = [];
  const duplicadosBase = [];

  for (const aluno of alunos) {
    const motivo = existeAluno(aluno, indices);
    if (motivo) {
      duplicadosBase.push({ id_legado: aluno.id_legado, nome: aluno.nome, motivo });
      continue;
    }

    if (aluno.status === "ativo") {
      const matricula = criarMatricula(aluno, plano, matriculas.length);
      const alunoPersistencia = prepararAluno(aluno, plano, matricula);
      const financeiroPromo = criarFinanceiroPromocional(alunoPersistencia, matricula);
      const recebimentoPromo = criarRecebimentoPromocional(alunoPersistencia, matricula, financeiroPromo);
      const mensalidade = criarMensalidadeAgosto(alunoPersistencia, matricula, plano);
      const finMensalidade = criarFinanceiroMensalidade(alunoPersistencia, matricula, plano, mensalidade);

      mensalidade.lancamentoFinanceiroId = finMensalidade.id;
      mensalidade.financeiroInicialId = finMensalidade.id;
      matricula.financeiroInicialId = financeiroPromo.id;
      matricula.recebimentoPromocionalId = recebimentoPromo.id;
      matricula.mensalidadeProximaId = mensalidade.id;
      matricula.financeiroProximoId = finMensalidade.id;

      novosAlunos.push(alunoPersistencia);
      matriculas.push(matricula);
      financeiro.push(financeiroPromo, finMensalidade);
      recebimentos.push(recebimentoPromo);
      mensalidades.push(mensalidade);
    } else {
      const alunoPersistencia = prepararAluno(aluno, plano, null);
      novosAlunos.push(alunoPersistencia);
    }

    // Não adiciona o aluno recém-importado ao índice de duplicidade.
    // Isso preserva alunos diferentes que compartilham telefone/CPF no legado;
    // a deduplicação bloqueia apenas registros já existentes na base antes da importação.
  }

  return { novosAlunos, matriculas, mensalidades, financeiro, recebimentos, duplicadosBase };
}

export async function importarAlunosLocal({ conteudo, nomeArquivo = "Alunos.txt", dryRun = false } = {}) {
  const analise = analisarAlunosTxt(conteudo, nomeArquivo);
  const plano = await obterPlanoMusculacao();
  const existentes = await lerJsonArray(ALUNOS_JSON);
  const pacote = montarPacoteImportacao(analise.alunos, plano, existentes);

  const relatorio = {
    ok: true,
    destino: dryRun ? "simulacao" : "ERP local",
    arquivo: nomeArquivo,
    plano,
    total_linhas: analise.total_linhas,
    total_registros: analise.total_registros,
    normalizados: analise.total_normalizados,
    importados: dryRun ? 0 : pacote.novosAlunos.length,
    importaveis: pacote.novosAlunos.length,
    ativos_importaveis: pacote.novosAlunos.filter((a) => a.status === "ativo").length,
    inativos_importaveis: pacote.novosAlunos.filter((a) => a.status === "inativo").length,
    excluidos: analise.excluidos,
    duplicados_base: pacote.duplicadosBase.length,
    duplicados_arquivo: analise.duplicados_no_arquivo,
    ignorados: analise.ignorados,
    matriculas_criadas: pacote.matriculas.length,
    mensalidades_agosto_2026: pacote.mensalidades.length,
    financeiro_lancamentos: pacote.financeiro.length,
    recebimentos_promocionais: pacote.recebimentos.length,
    regra_vencimento: `Ativos no dia ${CONFIG.diaVencimento}, com mensalidade ${CONFIG.competenciaInicialAtivos}; inativos apenas cadastrados, sem matrícula, financeiro, mensalidade ou recorrência.`,
    valor_matricula_promocional: CONFIG.valorMatriculaPromocional,
    valor_mensal_plano: plano.valorMensal,
    gerado_em: agoraISO(),
    preview: pacote.novosAlunos.slice(0, 10),
    detalhes: {
      duplicados_base: pacote.duplicadosBase.slice(0, 100),
      ...analise.detalhes
    }
  };

  if (!dryRun) {
    const matriculasExistentes = await lerJsonArray(MATRICULAS_JSON);
    const mensalidadesExistentes = await lerJsonArray(MENSALIDADES_JSON);
    const financeiroExistente = await lerJsonArray(FINANCEIRO_JSON);
    const recebimentosExistentes = await lerJsonArray(RECEBIMENTOS_JSON);

    await salvarJson(ALUNOS_JSON, [...existentes, ...pacote.novosAlunos]);
    await salvarJson(MATRICULAS_JSON, [...matriculasExistentes, ...pacote.matriculas]);
    await salvarJson(MENSALIDADES_JSON, [...mensalidadesExistentes, ...pacote.mensalidades]);
    await salvarJson(FINANCEIRO_JSON, [...financeiroExistente, ...pacote.financeiro]);
    await salvarJson(RECEBIMENTOS_JSON, [...recebimentosExistentes, ...pacote.recebimentos]);
    await salvarJson(RELATORIO_JSON, relatorio);
    await salvarJson(path.join(IMPORT_DIR, "alunos_access_ultima_importacao.json"), pacote.novosAlunos);
    await salvarJson(path.join(IMPORT_DIR, "matriculas_access_ultima_importacao.json"), pacote.matriculas);
    await salvarJson(path.join(IMPORT_DIR, "mensalidades_access_agosto_2026.json"), pacote.mensalidades);
    await salvarJson(path.join(IMPORT_DIR, "financeiro_access_ultima_importacao.json"), pacote.financeiro);
    await salvarJson(path.join(IMPORT_DIR, "recebimentos_access_ultima_importacao.json"), pacote.recebimentos);
  }

  return relatorio;
}

function limparAlunoParaSupabase(aluno) {
  return {
    id: aluno.id,
    nome: aluno.nome,
    cpf: aluno.cpf || null,
    telefone: aluno.telefone || null,
    celular: aluno.celular || null,
    whatsapp: aluno.whatsapp || null,
    data_nascimento: aluno.data_nascimento || null,
    status: aluno.status,
    ativo: aluno.ativo,
    plano: aluno.plano,
    planoId: aluno.planoId,
    valorMensal: aluno.valorMensal,
    matriculaId: aluno.matriculaId,
    numeroMatricula: aluno.numeroMatricula,
    statusMatricula: aluno.statusMatricula,
    origem_importacao: aluno.origem_importacao,
    id_legado: aluno.id_legado,
    importado_access: true,
    dia_vencimento: CONFIG.diaVencimento,
    criado_em: aluno.criado_em,
    atualizado_em: aluno.atualizado_em
  };
}

async function upsertLotes(supabase, tabela, dados, lote = 500, onConflict = "id") {
  let enviados = 0;
  for (let i = 0; i < dados.length; i += lote) {
    const parte = dados.slice(i, i + lote);
    if (!parte.length) continue;
    const { error } = await supabase.from(tabela).upsert(parte, { onConflict });
    if (error) throw error;
    enviados += parte.length;
  }
  return enviados;
}

export async function importarAlunosSupabase({ conteudo, nomeArquivo = "Alunos.txt", lote = 500, dryRun = false } = {}) {
  const analise = analisarAlunosTxt(conteudo, nomeArquivo);
  const plano = await obterPlanoMusculacao();
  const pacote = montarPacoteImportacao(analise.alunos, plano, []);

  if (dryRun) {
    return {
      ok: true,
      destino: "supabase_simulacao",
      plano,
      total: pacote.novosAlunos.length,
      ativos_importaveis: pacote.novosAlunos.filter((a) => a.status === "ativo").length,
      inativos_importaveis: pacote.novosAlunos.filter((a) => a.status === "inativo").length,
      matriculas_criadas: pacote.matriculas.length,
      mensalidades_agosto_2026: pacote.mensalidades.length,
      financeiro_lancamentos: pacote.financeiro.length,
      recebimentos_promocionais: pacote.recebimentos.length,
      preview: pacote.novosAlunos.slice(0, 10)
    };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const enviadosAlunos = await upsertLotes(supabase, "alunos", pacote.novosAlunos.map(limparAlunoParaSupabase), lote, "id");
  const enviadasMatriculas = await upsertLotes(supabase, "matriculas", pacote.matriculas, lote, "id");
  const enviadasMensalidades = pacote.mensalidades.length
    ? await upsertLotes(supabase, "mensalidades", pacote.mensalidades, lote, "id")
    : 0;
  const enviadosFinanceiro = await upsertLotes(supabase, "financeiro", pacote.financeiro, lote, "id");

  let enviadosRecebimentos = 0;
  try {
    enviadosRecebimentos = await upsertLotes(supabase, "recebimentos", pacote.recebimentos, lote, "id");
  } catch (error) {
    enviadosRecebimentos = 0;
  }

  const relatorio = {
    ok: true,
    destino: "supabase",
    plano,
    alunos: enviadosAlunos,
    matriculas: enviadasMatriculas,
    mensalidades_agosto_2026: enviadasMensalidades,
    financeiro: enviadosFinanceiro,
    recebimentos: enviadosRecebimentos,
    ativos_importados: pacote.novosAlunos.filter((a) => a.status === "ativo").length,
    inativos_importados: pacote.novosAlunos.filter((a) => a.status === "inativo").length,
    excluidos: analise.excluidos,
    duplicados_arquivo: analise.duplicados_no_arquivo,
    arquivo: nomeArquivo,
    gerado_em: agoraISO()
  };

  await salvarJson(RELATORIO_JSON, relatorio);
  return relatorio;
}

export async function lerRelatorio() {
  try {
    const bruto = await fs.readFile(RELATORIO_JSON, "utf-8");
    return JSON.parse(bruto);
  } catch {
    return { ok: true, mensagem: "Nenhuma importação executada ainda." };
  }
}
