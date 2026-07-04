import fs from "fs/promises";
import path from "path";

const DATA = path.join(process.cwd(), "data");
const COMERCIAL = path.join(DATA, "comercial");

async function lerArquivo(caminho, padrao = []) {
  try {
    const raw = await fs.readFile(caminho, "utf8");
    return raw.trim() ? JSON.parse(raw) : padrao;
  } catch (e) {
    if (e.code === "ENOENT") return padrao;
    throw e;
  }
}

async function ler(nome, padrao = []) {
  return lerArquivo(path.join(DATA, nome), padrao);
}

async function lerComercial(nome, padrao = []) {
  return lerArquivo(path.join(COMERCIAL, nome), padrao);
}

async function salvarComercial(nome, dados) {
  await fs.mkdir(COMERCIAL, { recursive: true });
  await fs.writeFile(path.join(COMERCIAL, nome), JSON.stringify(dados, null, 2), "utf8");
}

async function salvarBackupLegado(nome, dados) {
  const pasta = path.join(process.cwd(), "backup_legado", "comercial_pre_211");
  await fs.mkdir(pasta, { recursive: true });
  await fs.writeFile(path.join(pasta, nome), JSON.stringify(dados, null, 2), "utf8");
}

function moeda(v) {
  const n = Number(String(v ?? 0).replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function normalizar(v) {
  return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function id(prefixo) {
  return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function tipoPlano(m) {
  const t = String(m.tipoPlano || m.tipoCobranca || m.periodicidade || "Mensal").trim();
  return t || "Mensal";
}

function valorServico(turma, tipo) {
  const n = normalizar(tipo);
  if (n.includes("diar")) return moeda(turma.valorDiarista ?? turma.valorAvulso ?? turma.valorMensal ?? 0);
  if (n.includes("pre")) return moeda(turma.valorPrePago ?? turma.valorMensal ?? 0);
  return moeda(turma.valorMensal ?? turma.valor ?? 0);
}

function chaveModalidade(item = {}) {
  return normalizar(item.modalidade || item.nome || item.servico || item.turma || "");
}

async function carregarLegados() {
  return {
    servicos: await ler("comercial_servicos.json", []),
    contratos: await ler("comercial_contratos.json", []),
    servicosContratados: await ler("comercial_servicos_contratados.json", [])
  };
}

async function migrarServicos(turmas, legados) {
  const atuais = await lerComercial("servicos.json", []);
  const mapa = new Map([...legados.servicos, ...atuais].map(s => [chaveModalidade(s), s]).filter(([k]) => k));

  for (const t of turmas) {
    const chave = chaveModalidade(t);
    if (!chave) continue;
    const atual = mapa.get(chave) || {};
    mapa.set(chave, {
      id: atual.id || `srv_${chave.replace(/[^a-z0-9]+/g, "_")}`,
      nome: atual.nome || t.modalidade || t.nome,
      modalidade: atual.modalidade || t.modalidade || t.nome,
      descricao: atual.descricao || `Serviço migrado a partir de turmas de ${t.modalidade || t.nome}.`,
      valorMensal: moeda(atual.valorMensal ?? t.valorMensal ?? t.valor ?? 0),
      valorPrePago: moeda(atual.valorPrePago ?? t.valorPrePago ?? t.valorMensal ?? t.valor ?? 0),
      valorDiarista: moeda(atual.valorDiarista ?? t.valorDiarista ?? t.valorAvulso ?? 0),
      status: atual.status || "Ativo",
      criadoEm: atual.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });
  }

  const lista = [...mapa.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  await salvarComercial("servicos.json", lista);
  return lista;
}

async function migrarContratosEServicos(matriculas, turmas, legados) {
  const contratosAtuais = await lerComercial("contratos.json", []);
  const servicosAtuais = await lerComercial("servicos_contratados.json", []);

  const contratos = [...contratosAtuais];
  const servicos = [...servicosAtuais];

  const contratosPorMatricula = new Map([...legados.contratos, ...contratos].map(c => [String(c.matriculaId || ""), c]).filter(([k]) => k));
  const contratosPorId = new Map(contratos.map(c => [String(c.id), c]));

  for (const legado of legados.contratos) {
    if (!legado?.id || contratosPorId.has(String(legado.id))) continue;
    contratos.push(legado);
    contratosPorId.set(String(legado.id), legado);
    if (legado.matriculaId) contratosPorMatricula.set(String(legado.matriculaId), legado);
  }

  const chaveServico = new Set(servicos.map(s => `${s.contratoId}|${s.turmaId}|${s.nome || s.servico || s.modalidade}`));
  for (const legado of legados.servicosContratados) {
    const chave = `${legado.contratoId}|${legado.turmaId}|${legado.nome || legado.servico || legado.modalidade}`;
    if (chaveServico.has(chave)) continue;
    servicos.push(legado);
    chaveServico.add(chave);
  }

  for (const m of matriculas) {
    if (!m?.id) continue;
    let contrato = contratosPorMatricula.get(String(m.id));
    if (!contrato) {
      contrato = {
        id: id("ctr"),
        alunoId: m.alunoId || "",
        aluno: m.aluno || "",
        matriculaId: m.id,
        numeroMatricula: m.numero || "",
        tipoPlano: tipoPlano(m),
        tipoCobranca: m.tipoCobranca || tipoPlano(m),
        status: m.status || "Ativa",
        dataInicio: m.dataInicio || m.dataMatricula || "",
        dataFim: m.dataFim || "",
        periodicidadeMeses: Number(m.periodicidadeMeses || 1),
        cobraMatricula: m.cobraMatricula ?? m.cobrouTaxaMatricula ?? true,
        valorMatricula: moeda(m.valorMatricula ?? m.valorBaseMatricula ?? m.taxaMatricula ?? 0),
        renovacaoAutomatica: m.renovacaoAutomatica ?? true,
        bloquearAoVencer: m.bloquearAoVencer ?? false,
        origem: "migracao_matricula",
        criadoEm: m.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };
      contratos.push(contrato);
      contratosPorMatricula.set(String(m.id), contrato);
    }

    const listaServicos = Array.isArray(m.servicosContratados) && m.servicosContratados.length
      ? m.servicosContratados
      : (Array.isArray(m.turmas) ? m.turmas : []);

    for (const item of listaServicos) {
      const tid = item.turmaId ?? item.id;
      const turma = tid ? (turmas.find(t => String(t.id) === String(tid)) || item) : item;
      const nome = item.nome || item.servico || turma.nome || "";
      const chave = `${contrato.id}|${tid || ""}|${nome}`;
      if (chaveServico.has(chave)) continue;
      chaveServico.add(chave);
      servicos.push({
        id: id("svc_ctr"),
        contratoId: contrato.id,
        alunoId: m.alunoId || "",
        aluno: m.aluno || "",
        matriculaId: m.id,
        turmaId: String(tid || ""),
        servicoId: item.servicoId || "",
        nome,
        servico: item.servico || item.modalidade || turma.modalidade || nome,
        modalidade: item.modalidade || turma.modalidade || "",
        professor: item.professor || turma.professor || "",
        diasSemana: item.diasSemana || turma.diasSemana || "",
        horario: item.horario || turma.horario || "",
        sala: item.sala || turma.sala || "",
        tipoCobranca: item.tipoCobranca || contrato.tipoCobranca || "Mensal",
        valor: moeda(item.valor ?? valorServico(turma, item.tipoCobranca || contrato.tipoCobranca)),
        status: item.status || "Ativo",
        dataInicio: m.dataInicio || m.dataMatricula || "",
        dataFim: "",
        origem: "migracao_matricula",
        criadoEm: item.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      });
    }
  }

  for (const contrato of contratos) {
    const ativos = servicos.filter(s => String(s.contratoId) === String(contrato.id) && !["removido", "removida", "cancelado", "cancelada", "inativo", "inativa", "encerrado", "encerrada"].includes(normalizar(s.status)));
    const valorServicos = moeda(ativos.reduce((total, s) => total + moeda(s.valor), 0));
    const valorMatricula = moeda(contrato.valorMatricula ?? 0);
    contrato.valorServicos = valorServicos;
    contrato.valorTotal = moeda(valorMatricula + valorServicos);
    contrato.totalMensal = contrato.valorTotal;
    contrato.quantidadeServicos = ativos.length;
    contrato.atualizadoEm = new Date().toISOString();
  }

  await salvarComercial("contratos.json", contratos);
  await salvarComercial("servicos_contratados.json", servicos);
  return { contratos: contratos.length, servicosContratados: servicos.length };
}

async function removerArquivosLegados(legados) {
  await salvarBackupLegado("comercial_servicos.json", legados.servicos);
  await salvarBackupLegado("comercial_contratos.json", legados.contratos);
  await salvarBackupLegado("comercial_servicos_contratados.json", legados.servicosContratados);

  for (const nome of ["comercial_servicos.json", "comercial_contratos.json", "comercial_servicos_contratados.json"]) {
    try { await fs.rm(path.join(DATA, nome)); } catch (e) { if (e.code !== "ENOENT") throw e; }
  }
}

async function main() {
  const turmas = await ler("turmas.json", []);
  const matriculas = await ler("matriculas.json", []);
  const legados = await carregarLegados();
  const servicos = await migrarServicos(turmas, legados);
  const resumo = await migrarContratosEServicos(matriculas, turmas, legados);
  await removerArquivosLegados(legados);

  console.log("Fusion ERP 2.1.1 - Núcleo Comercial consolidado.");
  console.log("Fonte oficial: data/comercial/");
  console.log(`Serviços cadastrados: ${servicos.length}`);
  console.log(`Contratos comerciais: ${resumo.contratos}`);
  console.log(`Serviços contratados: ${resumo.servicosContratados}`);
}

main().catch(e => { console.error(e); process.exit(1); });
