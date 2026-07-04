import crypto from "crypto";
import {
  listarModalidades,
  salvarModalidades,
  buscarModalidadePorId
} from "./modalidades.repository.mjs";

function normalizarTexto(valor) {
  return String(valor || "").trim();
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
  const modalidades = await listarModalidades();
  return {
    total: modalidades.length,
    ativas: modalidades.filter((item) => item.status === "Ativa").length,
    inativas: modalidades.filter((item) => item.status === "Inativa").length,
    categorias: [...new Set(modalidades.map((item) => item.categoria).filter(Boolean))].length
  };
}
