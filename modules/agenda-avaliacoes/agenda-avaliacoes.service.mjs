import crypto from "node:crypto";
import {
  listarAgendaAvaliacoes,
  alterarAgendaAvaliacoes
} from "./agenda-avaliacoes.repository.mjs";
import { listarAlunos } from "../alunos/alunos.repository.mjs";

function texto(v) {
  return String(v ?? "").trim();
}

function agoraISO() {
  return new Date().toISOString();
}

function dataISO(v) {
  return texto(v).slice(0, 10);
}

function horaHM(v) {
  return texto(v).slice(0, 5);
}

function status(v) {
  const s = texto(v).toLowerCase();
  if (["realizada", "realizado", "concluida", "concluído", "concluido"].includes(s)) {
    return "realizada";
  }
  if (["cancelada", "cancelado"].includes(s)) return "cancelada";
  return "pendente";
}

function ordenar(lista = []) {
  return [...lista].sort((a, b) =>
    `${dataISO(a.data)}T${horaHM(a.hora)}`.localeCompare(
      `${dataISO(b.data)}T${horaHM(b.hora)}`
    )
  );
}

export async function listar(filtros = {}) {
  let lista = await listarAgendaAvaliacoes();
  // FONTE MESTRA NOME ALUNO - AGENDA 20260826
  // alunoId e a referencia estavel. alunoNome salvo no agendamento
  // fica como snapshot/fallback; a exibicao usa o cadastro atual.
  try {
    const alunosAtuais = await listarAlunos();
    const nomeAtualPorId = new Map(
      (Array.isArray(alunosAtuais) ? alunosAtuais : [])
        .map((aluno = {}) => {
          const id = String(aluno.id || aluno._id || aluno.codigo || "").trim();
          const nome = String(aluno.nome || aluno.nomeCompleto || aluno.alunoNome || aluno.aluno || "").trim();
          return [id, nome];
        })
        .filter(([id, nome]) => id && nome)
    );

    lista = (Array.isArray(lista) ? lista : []).map((item = {}) => {
      const alunoId = String(item.alunoId || item.aluno_id || "").trim();
      const nomeAtual = nomeAtualPorId.get(alunoId);
      return nomeAtual ? { ...item, alunoNome: nomeAtual } : item;
    });
  } catch (error) {
    console.warn("[AGENDA AVALIACOES] Falha ao resolver nome atual do aluno:", error?.message || error);
  }


  if (filtros.alunoId) {
    lista = lista.filter(x => texto(x.alunoId) === texto(filtros.alunoId));
  }

  if (filtros.professorId) {
    lista = lista.filter(x => texto(x.professorId) === texto(filtros.professorId));
  }

  if (filtros.status) {
    lista = lista.filter(x => status(x.status) === status(filtros.status));
  }

  if (filtros.data) {
    lista = lista.filter(x => dataISO(x.data) === dataISO(filtros.data));
  }

  return ordenar(lista);
}

export async function criar(dados = {}) {
  const alunoId = texto(dados.alunoId || dados.aluno_id);
  const alunoNome = texto(dados.alunoNome || dados.aluno_nome);
  const professorId = texto(dados.professorId || dados.professor_id);
  const professorNome = texto(dados.professorNome || dados.professor_nome);
  const data = dataISO(dados.data);
  const hora = horaHM(dados.hora || dados.horario);

  if (!alunoId) {
    throw Object.assign(new Error("Selecione o aluno."), { status: 400 });
  }

  if (!professorId) {
    throw Object.assign(new Error("Selecione o professor."), { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw Object.assign(new Error("Informe uma data válida."), { status: 400 });
  }

  if (!/^\d{2}:\d{2}$/.test(hora)) {
    throw Object.assign(new Error("Informe um horário válido."), { status: 400 });
  }

  return alterarAgendaAvaliacoes(async lista => {
    const conflitoProfessor = lista.find(item =>
      status(item.status) === "pendente" &&
      texto(item.professorId) === professorId &&
      dataISO(item.data) === data &&
      horaHM(item.hora) === hora
    );

    if (conflitoProfessor) {
      throw Object.assign(
        new Error("O professor já possui uma avaliação agendada neste horário."),
        { status: 409 }
      );
    }

    const conflitoAluno = lista.find(item =>
      status(item.status) === "pendente" &&
      texto(item.alunoId) === alunoId &&
      dataISO(item.data) === data &&
      horaHM(item.hora) === hora
    );

    if (conflitoAluno) {
      throw Object.assign(
        new Error("O aluno já possui uma avaliação agendada neste horário."),
        { status: 409 }
      );
    }

    const momento = agoraISO();

    const registro = {
      id: `agav_${crypto.randomUUID()}`,
      alunoId,
      alunoNome,
      professorId,
      professorNome,
      data,
      hora,
      observacao: texto(dados.observacao || dados.observacoes),
      status: "pendente",
      criadoEm: momento,
      atualizadoEm: momento,
      realizadaEm: "",
      avaliacaoId: "",
      historico: [
        {
          acao: "agendada",
          descricao: "Avaliação agendada.",
          criadoEm: momento
        }
      ]
    };

    lista.push(registro);
    return registro;
  });
}

export async function marcarRealizadaPorAvaliacao(avaliacao = {}) {
  const alunoId = texto(
    avaliacao.alunoId ||
    avaliacao.aluno_id ||
    avaliacao.idAluno
  );

  if (!alunoId) return null;

  const professorId = texto(
    avaliacao.professorId ||
    avaliacao.professor_id ||
    avaliacao.avaliadorId ||
    avaliacao.avaliador_id
  );

  const avaliacaoId = texto(avaliacao.id);
  const dataAvaliacao = dataISO(
    avaliacao.data ||
    avaliacao.dataAvaliacao ||
    avaliacao.data_avaliacao ||
    agoraISO()
  );

  return alterarAgendaAvaliacoes(async lista => {
    // AGENDA AVALIACAO ID EXPLICITO 20260826
    const agendamentoId = texto(
      avaliacao.agendamentoId ||
      avaliacao.agendamento_id
    );

    let candidatos = lista
      .map((item, indice) => ({ item, indice }))
      .filter(({ item }) =>
        status(item.status) === "pendente" &&
        texto(item.alunoId) === alunoId
      );

    if (agendamentoId) {
      const exato = candidatos.filter(({ item }) => texto(item.id) === agendamentoId);
      if (exato.length) candidatos = exato;
    }

    if (!candidatos.length) return null;

    if (professorId && !agendamentoId) {
      const mesmos = candidatos.filter(({ item }) =>
        texto(item.professorId) === professorId
      );
      if (mesmos.length) candidatos = mesmos;
    }

    if (!agendamentoId) {
      const mesmoDia = candidatos.filter(({ item }) =>
        dataISO(item.data) === dataAvaliacao
      );

      if (mesmoDia.length) {
        candidatos = mesmoDia;
      } else {
        const anteriores = candidatos.filter(({ item }) =>
          dataISO(item.data) <= dataAvaliacao
        );
        if (anteriores.length) candidatos = anteriores;
      }
    }

    candidatos.sort((a, b) =>
      `${dataISO(b.item.data)}T${horaHM(b.item.hora)}`.localeCompare(
        `${dataISO(a.item.data)}T${horaHM(a.item.hora)}`
      )
    );

    const escolhido = candidatos[0];
    if (!escolhido) return null;

    const momento = agoraISO();
    const atual = escolhido.item;

    lista[escolhido.indice] = {
      ...atual,
      status: "realizada",
      avaliacaoId,
      realizadaEm: momento,
      atualizadoEm: momento,
      historico: [
        ...(Array.isArray(atual.historico) ? atual.historico : []),
        {
          acao: "realizada",
          descricao: "Avaliação realizada com sucesso.",
          avaliacaoId,
          criadoEm: momento
        }
      ]
    };

    return lista[escolhido.indice];
  });
}
