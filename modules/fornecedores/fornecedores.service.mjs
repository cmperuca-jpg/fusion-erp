import crypto from "node:crypto";
import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

const ARQUIVO = "fornecedores.json";

function normalizar(valor) {
  return String(valor || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function texto(valor) {
  return String(valor ?? "").trim();
}

function lista(valor) {
  return Array.isArray(valor) ? valor : [];
}

async function lerFornecedores() {
  const dados = await lerJsonDuravel(ARQUIVO, []);
  return lista(dados);
}

async function salvarFornecedores(fornecedores) {
  await salvarJsonDuravel(ARQUIVO, lista(fornecedores));
}

function exporFornecedor(item = {}) {
  return {
    id: texto(item.id),
    nome: texto(item.nome || item.razaoSocial || item.fantasia),
    documento: texto(item.documento || item.cnpj || item.cpf),
    telefone: texto(item.telefone || item.whatsapp),
    email: texto(item.email),
    categoria: texto(item.categoria),
    status: texto(item.status || "Ativo"),
    observacoes: texto(item.observacoes || item.observacao),
    criadoEm: item.criadoEm || "",
    atualizadoEm: item.atualizadoEm || ""
  };
}

export async function listar(filtros = {}) {
  const busca = normalizar(filtros.busca || filtros.q || "");
  let fornecedores = (await lerFornecedores()).map(exporFornecedor);

  if (busca) {
    fornecedores = fornecedores.filter((fornecedor) =>
      normalizar([
        fornecedor.nome,
        fornecedor.documento,
        fornecedor.telefone,
        fornecedor.email,
        fornecedor.categoria
      ].join(" ")).includes(busca)
    );
  }

  return fornecedores.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function criar(dados = {}) {
  const nome = texto(dados.nome || dados.razaoSocial || dados.fornecedor);
  if (nome.length < 2) {
    const erro = new Error("Informe o nome do fornecedor.");
    erro.status = 400;
    throw erro;
  }

  const fornecedores = await lerFornecedores();
  const documento = texto(dados.documento || dados.cnpj || dados.cpf);
  const existente = fornecedores.find((fornecedor) => {
    const mesmoDocumento = documento && normalizar(fornecedor.documento || fornecedor.cnpj || fornecedor.cpf) === normalizar(documento);
    const mesmoNome = normalizar(fornecedor.nome || fornecedor.razaoSocial || fornecedor.fantasia) === normalizar(nome);
    return mesmoDocumento || mesmoNome;
  });

  if (existente) return { ...exporFornecedor(existente), existente: true };

  const agora = new Date().toISOString();
  const fornecedor = {
    id: dados.id || crypto.randomUUID(),
    nome,
    documento,
    telefone: texto(dados.telefone || dados.whatsapp),
    email: texto(dados.email),
    categoria: texto(dados.categoria),
    status: texto(dados.status || "Ativo"),
    observacoes: texto(dados.observacoes || dados.observacao),
    criadoEm: agora,
    atualizadoEm: agora
  };

  fornecedores.push(fornecedor);
  await salvarFornecedores(fornecedores);
  return exporFornecedor(fornecedor);
}

export async function atualizar(id, dados = {}) {
  const fornecedores = await lerFornecedores();
  const idx = fornecedores.findIndex((fornecedor) => String(fornecedor.id) === String(id));
  if (idx < 0) return null;

  fornecedores[idx] = {
    ...fornecedores[idx],
    ...dados,
    nome: texto(dados.nome || fornecedores[idx].nome),
    documento: texto(dados.documento ?? fornecedores[idx].documento),
    atualizadoEm: new Date().toISOString()
  };

  await salvarFornecedores(fornecedores);
  return exporFornecedor(fornecedores[idx]);
}
