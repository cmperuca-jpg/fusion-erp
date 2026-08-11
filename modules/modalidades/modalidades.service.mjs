import crypto from "crypto";
import {
  listarModalidades,
  salvarModalidades,
  buscarModalidadePorId
} from "./modalidades.repository.mjs";
import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

const ARQUIVO_CATEGORIAS = "categorias_modalidades.json";

function normalizarTexto(valor) {
  return String(valor || "").trim();
}
function chaveTexto(valor) {
  return normalizarTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function categoriasSalvas() {
  const lista = await lerJsonDuravel(ARQUIVO_CATEGORIAS, []);
  return Array.isArray(lista) ? lista : [];
}

export async function obterCategoriasModalidades() {
  const [salvas, modalidades] = await Promise.all([
    categoriasSalvas(),
    listarModalidades()
  ]);

  const mapa = new Map();
  for (const item of salvas) {
    const nome = normalizarTexto(item?.nome || item);
    if (!nome) continue;
    mapa.set(chaveTexto(nome), {
      id: item?.id || crypto.randomUUID(),
      nome,
      status: normalizarTexto(item?.status) || "Ativa",
      criadoEm: item?.criadoEm || ""
    });
  }
  for (const modalidade of modalidades) {
    const nome = normalizarTexto(modalidade?.categoria);
    const chave = chaveTexto(nome);
    if (!nome || mapa.has(chave)) continue;
    mapa.set(chave, { id: `legado-${chave}`, nome, status: "Ativa", criadoEm: "" });
  }
  return [...mapa.values()].sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function criarCategoriaModalidade(payload = {}) {
  const nome = normalizarTexto(payload.nome || payload.categoria);
  if (nome.length < 2) throw new Error("Informe o nome da categoria.");

  const lista = await categoriasSalvas();
  const chave = chaveTexto(nome);
  const existente = lista.find(item => chaveTexto(item?.nome || item) === chave);
  if (existente) return existente;

  const nova = {
    id: crypto.randomUUID(),
    nome,
    status: "Ativa",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };
  lista.push(nova);
  await salvarJsonDuravel(ARQUIVO_CATEGORIAS, lista);
  return nova;
}

function validarPayload(payload) {
  const nome = normalizarTexto(payload.nome);
  const categoria = normalizarTexto(payload.categoria);

  if (!nome) throw new Error("O nome da modalidade é obrigatório.");
  if (!categoria) throw new Error("A categoria é obrigatória.");

  return {
    nome,
    categoria,
    descricao: normalizarTexto(payload.descricao),
    professorResponsavel: normalizarTexto(payload.professorResponsavel),
    duracaoMinutos: Number(payload.duracaoMinutos || 60),
    capacidadeMaxima: Number(payload.capacidadeMaxima || 20),
    valorSugerido: Number(payload.valorSugerido || 0),
    cor: normalizarTexto(payload.cor) || "#ff6b00",
    icone: normalizarTexto(payload.icone) || "🏋️",
    status: normalizarTexto(payload.status) || "Ativa"
  };
}

export async function obterModalidades(filtros = {}) {
  let modalidades = await listarModalidades();
  const termo = normalizarTexto(filtros.q).toLowerCase();
  const status = normalizarTexto(filtros.status);

  if (termo) {
    modalidades = modalidades.filter((item) =>
      [item.nome, item.categoria, item.professorResponsavel, item.descricao]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }

  if (status && status !== "Todos") {
    modalidades = modalidades.filter((item) => item.status === status);
  }

  return modalidades;
}

export async function criarModalidade(payload) {
  const modalidades = await listarModalidades();
  const dados = validarPayload(payload);

  // Mantém a categoria disponível também para os próximos cadastros.
  await criarCategoriaModalidade({ nome: dados.categoria });

  const nova = {
    id: crypto.randomUUID(),
    ...dados,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };

  modalidades.push(nova);
  await salvarModalidades(modalidades);
  return nova;
}

export async function atualizarModalidade(id, payload) {
  const modalidades = await listarModalidades();
  const indice = modalidades.findIndex((item) => item.id === id);

  if (indice === -1) throw new Error("Modalidade não encontrada.");

  const dados = validarPayload(payload);
  await criarCategoriaModalidade({ nome: dados.categoria });

  modalidades[indice] = {
    ...modalidades[indice],
    ...dados,
    atualizadoEm: new Date().toISOString()
  };

  await salvarModalidades(modalidades);
  return modalidades[indice];
}

export async function removerModalidade(id) {
  const modalidades = await listarModalidades();
  const existe = await buscarModalidadePorId(id);

  if (!existe) throw new Error("Modalidade não encontrada.");

  await salvarModalidades(modalidades.filter((item) => item.id !== id));
  return { removida: true };
}

export async function obterResumoModalidades() {
  const [modalidades, categorias] = await Promise.all([
    listarModalidades(),
    obterCategoriasModalidades()
  ]);
  return {
    total: modalidades.length,
    ativas: modalidades.filter((item) => item.status === "Ativa").length,
    inativas: modalidades.filter((item) => item.status === "Inativa").length,
    categorias: categorias.length
  };
}
