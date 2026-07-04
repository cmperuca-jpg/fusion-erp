import {
  listarAulas,
  salvarAulas,
  buscarAulaPorId
} from "./agenda.repository.mjs";

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function listarAgenda(filtros = {}) {
  let aulas = await listarAulas();

  if (filtros.status) {
    aulas = aulas.filter((aula) => aula.status === filtros.status);
  }

  if (filtros.professor) {
    aulas = aulas.filter((aula) =>
      aula.professor.toLowerCase().includes(filtros.professor.toLowerCase())
    );
  }

  if (filtros.modalidade) {
    aulas = aulas.filter((aula) =>
      aula.modalidade.toLowerCase().includes(filtros.modalidade.toLowerCase())
    );
  }

  if (filtros.data) {
    aulas = aulas.filter((aula) => aula.data === filtros.data);
  }

  return aulas.sort((a, b) => {
    const dataA = `${a.data}T${a.horaInicio}`;
    const dataB = `${b.data}T${b.horaInicio}`;
    return dataA.localeCompare(dataB);
  });
}

export async function obterResumoAgenda() {
  const aulas = await listarAulas();
  const hoje = new Date().toISOString().slice(0, 10);

  return {
    total: aulas.length,
    hoje: aulas.filter((aula) => aula.data === hoje).length,
    ativas: aulas.filter((aula) => aula.status === "Ativa").length,
    canceladas: aulas.filter((aula) => aula.status === "Cancelada").length
  };
}

export async function criarAula(dados) {
  const aulas = await listarAulas();

  const novaAula = {
    id: gerarId(),
    titulo: dados.titulo || dados.modalidade || "Aula",
    modalidade: dados.modalidade || "",
    turma: dados.turma || "",
    professor: dados.professor || "",
    sala: dados.sala || "",
    data: dados.data || "",
    horaInicio: dados.horaInicio || "",
    horaFim: dados.horaFim || "",
    capacidade: Number(dados.capacidade || 0),
    inscritos: Number(dados.inscritos || 0),
    status: dados.status || "Ativa",
    observacoes: dados.observacoes || "",
    criadoEm: new Date().toISOString()
  };

  aulas.push(novaAula);
  await salvarAulas(aulas);

  return novaAula;
}

export async function atualizarAula(id, dados) {
  const aulas = await listarAulas();
  const index = aulas.findIndex((aula) => String(aula.id) === String(id));

  if (index === -1) {
    return null;
  }

  aulas[index] = {
    ...aulas[index],
    ...dados,
    capacidade: Number(dados.capacidade ?? aulas[index].capacidade),
    inscritos: Number(dados.inscritos ?? aulas[index].inscritos),
    atualizadoEm: new Date().toISOString()
  };

  await salvarAulas(aulas);
  return aulas[index];
}

export async function excluirAula(id) {
  const aulas = await listarAulas();
  const aula = await buscarAulaPorId(id);

  if (!aula) {
    return null;
  }

  const filtradas = aulas.filter((item) => String(item.id) !== String(id));
  await salvarAulas(filtradas);

  return aula;
}
