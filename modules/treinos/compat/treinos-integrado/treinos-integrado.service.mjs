import { carregarBaseTreinos, salvarTreinos } from "./treinos-integrado.repository.mjs";

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function agoraISO() { return new Date().toISOString(); }
function gerarId(prefixo = "trn") { return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`; }
function texto(v) { return String(v ?? "").trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function ativo(item) { return !["cancelado","cancelada","encerrado","encerrada","inativo","inativa","arquivado","removido","removida"].includes(normalizar(item?.status || "Ativo")); }

function mesmoAlunoTreino(treino = {}, alunoId = "") {
  return String(treino.alunoId || treino.aluno_id || "") === String(alunoId || "");
}

function escolherTreinoAtivoMaisRecente(treinos = [], alunoId = "") {
  return [...treinos]
    .filter((t) => mesmoAlunoTreino(t, alunoId) && ativo(t))
    .sort((a, b) => String(b.atualizadoEm || b.criadoEm || b.dataInicio || "").localeCompare(String(a.atualizadoEm || a.criadoEm || a.dataInicio || "")))[0] || null;
}

function arquivarTreinosAtivosDoAluno(treinos = [], alunoId = "", excetoId = "", motivo = "substituido_por_novo_treino") {
  const agora = agoraISO();
  let alterou = false;
  const lista = treinos.map((t) => {
    if (!mesmoAlunoTreino(t, alunoId) || !ativo(t) || String(t.id || "") === String(excetoId || "")) return t;
    alterou = true;
    return {
      ...t,
      status: "Arquivado",
      arquivadoEm: agora,
      arquivadoPorRegra: "treino_unico_ativo_por_aluno",
      historico: [
        ...(Array.isArray(t.historico) ? t.historico : []),
        {
          acao: "arquivar_treino_ativo_anterior",
          usuario: "Motor Treinos Integrado",
          criadoEm: agora,
          detalhes: { motivo, treinoSubstitutoId: excetoId || "" }
        }
      ]
    };
  });
  return { lista, alterou };
}
function alunoNome(a = {}) { return texto(a.nome || a.aluno || a.name || a.nomeCompleto || "Aluno"); }


function arquivoMidia(item = {}) {
  return texto(item.midia || item.media || item.imagem || item.image || item.imagemUrl || item.videoUrl || "");
}

function nomeBiblioteca(item = {}) {
  return texto(item.nome || item.name || item.exercicio || "");
}

function grupoBiblioteca(item = {}) {
  return texto(item.grupoMuscular || item.grupo || item.group || item.folder || "");
}

function bibliotecaKey(item = {}) {
  const midia = arquivoMidia(item);
  const baseArquivo = texto(midia.split("/").pop() || "").replace(/\.[^.]+$/, "");
  const nome = normalizar(item.bibliotecaKey || baseArquivo || nomeBiblioteca(item));
  const grupo = normalizar(grupoBiblioteca(item));
  return [grupo, nome].filter(Boolean).join("::");
}

function normalizarItemBiblioteca(item = {}) {
  const midia = arquivoMidia(item);
  const video = /\.(mp4|webm|mov)$/i.test(midia);
  return {
    id: texto(item.id || item.exercicioId || item.bibliotecaId || ""),
    bibliotecaId: texto(item.bibliotecaId || item.id || item.exercicioId || ""),
    bibliotecaKey: texto(item.bibliotecaKey || bibliotecaKey(item)),
    nome: nomeBiblioteca(item),
    grupoMuscular: grupoBiblioteca(item),
    grupo: grupoBiblioteca(item),
    equipamento: texto(item.equipamento || ""),
    midia,
    tipoMidia: texto(item.tipoMidia || item.tipo || (video ? "video" : (midia ? "imagem" : ""))),
    imagemUrl: texto(item.imagemUrl || (!video ? midia : "")),
    videoUrl: texto(item.videoUrl || (video ? midia : ""))
  };
}

function localizarBiblioteca(biblioteca = [], ex = {}) {
  if (!Array.isArray(biblioteca) || !biblioteca.length) return null;
  const itens = biblioteca.map(normalizarItemBiblioteca);
  const ids = [ex.bibliotecaId, ex.exercicioId, ex.exercicio_id, ex.idBiblioteca]
    .map(texto).filter(Boolean);
  if (ids.length) {
    const porId = itens.find((b) => ids.includes(texto(b.id)) || ids.includes(texto(b.bibliotecaId)));
    if (porId) return porId;
  }
  const key = texto(ex.bibliotecaKey || bibliotecaKey(ex));
  if (key) {
    const porKey = itens.find((b) => texto(b.bibliotecaKey) === key);
    if (porKey) return porKey;
  }
  const nome = normalizar(ex.nome || ex.nomeOriginal || ex.exercicio);
  const grupo = normalizar(ex.grupoMuscular || ex.grupo || ex.musculo);
  if (nome) {
    return itens.find((b) => normalizar(b.nome) === nome && (!grupo || normalizar(b.grupoMuscular) === grupo)) || null;
  }
  return null;
}

function aplicarBibliotecaAoExercicio(ex = {}, biblioteca = []) {
  const ref = localizarBiblioteca(biblioteca, ex);
  if (!ref) return ex;
  return {
    ...ex,
    bibliotecaId: ref.bibliotecaId || ref.id || ex.bibliotecaId || ex.exercicioId || "",
    exercicioId: ex.exercicioId || ref.id || ref.bibliotecaId || "",
    bibliotecaKey: ref.bibliotecaKey || ex.bibliotecaKey || "",
    nome: ref.nome || ex.nome,
    grupoMuscular: ref.grupoMuscular || ex.grupoMuscular,
    grupo: ref.grupo || ref.grupoMuscular || ex.grupo,
    equipamento: ref.equipamento || ex.equipamento || "",
    midia: ref.midia || ex.midia || "",
    tipoMidia: ref.tipoMidia || ex.tipoMidia || "",
    imagemUrl: ref.imagemUrl || ex.imagemUrl || "",
    videoUrl: ref.videoUrl || ex.videoUrl || "",
    bibliotecaAtualizadaEm: agoraISO()
  };
}

function hidratarTreinoComBiblioteca(treino = {}, biblioteca = []) {
  return {
    ...treino,
    exercicios: Array.isArray(treino.exercicios)
      ? treino.exercicios.map((ex) => aplicarBibliotecaAoExercicio(ex, biblioteca))
      : []
  };
}

function localizarAluno(alunos, alunoId) {
  return alunos.find((a) => String(a.id || a._id || a.alunoId) === String(alunoId)) || null;
}

function localizarProfessor(professores, chave = "") {
  const alvo = normalizar(chave);
  if (!alvo) return null;
  return professores.find((p) => String(p.id) === String(chave) || normalizar(p.nome).includes(alvo) || alvo.includes(normalizar(p.nome))) || null;
}

function contratoAtivoAluno(contratos, alunoId) {
  const lista = contratos.filter((c) => String(c.alunoId) === String(alunoId));
  return lista.find(ativo) || lista[0] || null;
}

function servicosAtivosDoContrato(servicos, contratoId) {
  return servicos.filter((s) => String(s.contratoId) === String(contratoId) && ativo(s));
}

function servicoMusculacao(servicos = []) {
  return servicos.find((s) => {
    const txt = normalizar([s.nome, s.servico, s.modalidade, s.turma].join(" "));
    return txt.includes("musculacao") || txt.includes("funcional") || txt.includes("personal") || txt.includes("treino");
  }) || servicos[0] || null;
}

function avaliacoesAluno(avaliacoes, alunoId) {
  return avaliacoes
    .filter((a) => String(a.alunoId || a.aluno_id) === String(alunoId))
    .sort((a,b) => String(b.data || b.criadoEm || "").localeCompare(String(a.data || a.criadoEm || "")));
}

function frequenciasAluno(frequencia, alunoId) {
  return frequencia
    .filter((f) => String(f.alunoId) === String(alunoId))
    .sort((a,b) => String(b.data || b.criadoEm || "").localeCompare(String(a.data || a.criadoEm || "")));
}

function normalizarExercicios(exercicios = [], biblioteca = []) {
  const lista = Array.isArray(exercicios) ? exercicios : [];
  return lista.map((ex, idx) => {
    const ref = localizarBiblioteca(biblioteca, ex) || {};
    const midia = texto(ref.midia || ex.midia || ex.media || ex.imagem || ex.image || ex.imagemUrl || ex.videoUrl || "");
    const tipoMidia = texto(ex.tipoMidia || ex.tipo || (/\.(mp4|webm|mov)$/i.test(midia) ? "video" : (midia ? "imagem" : "")));

    return {
      id: ex.id || gerarId("ex"),
      exercicioId: texto(ex.exercicioId || ex.exercicio_id || ex.bibliotecaId || ex.biblioteca_id || ref.id || ref.bibliotecaId || ex.idBiblioteca || ""),
      bibliotecaId: texto(ex.bibliotecaId || ex.biblioteca_id || ex.exercicioId || ex.exercicio_id || ref.bibliotecaId || ref.id || ""),
      bibliotecaKey: texto(ex.bibliotecaKey || ref.bibliotecaKey || bibliotecaKey(ex)),
      ordem: Number(ex.ordem || idx + 1),
      nome: texto(ref.nome || ex.nome || ex.exercicio || "Exercício"),
      nomeOriginal: texto(ex.nomeOriginal || ex.nome || ex.exercicio || ref.nome || "Exercício"),
      grupoMuscular: texto(ref.grupoMuscular || ex.grupoMuscular || ex.grupo || ex.musculo || ""),
      grupo: texto(ref.grupo || ref.grupoMuscular || ex.grupo || ex.grupoMuscular || ex.musculo || ""),
      equipamento: texto(ref.equipamento || ex.equipamento || ""),
      series: Number(ex.series || ex.serie || 3),
      repeticoes: texto(ex.repeticoes || ex.reps || "10"),
      carga: texto(ex.carga || ""),
      descanso: texto(ex.descanso || "60s"),
      cadencia: texto(ex.cadencia || ""),
      tempo: texto(ex.tempo || ex.tempoExecucao || ""),
      intensidade: texto(ex.intensidade || ""),
      observacao: texto(ex.observacao || ex.observacoes || ex.obs || ""),
      observacoes: texto(ex.observacoes || ex.observacao || ex.obs || ""),
      midia,
      tipoMidia,
      imagemUrl: texto(ref.imagemUrl || ex.imagemUrl || (!/\.(mp4|webm|mov)$/i.test(midia) ? midia : "")),
      videoUrl: texto(ref.videoUrl || ex.videoUrl || (/\.(mp4|webm|mov)$/i.test(midia) ? midia : "")),
      origem: texto(ex.origem || "treinos_v3")
    };
  });
}

function statusTreino(t = {}) {
  if (!ativo(t)) return "Inativo";
  const validade = texto(t.dataValidade || t.validade || "");
  if (validade && validade < hojeISO()) return "Vencido";
  return "Ativo";
}

function treinoPertenceAluno(t, alunoId) {
  return String(t.alunoId || t.aluno_id) === String(alunoId);
}

function mapearTreinoLegado(t = {}) {
  return {
    id: t.id || gerarId("trn_leg"),
    alunoId: t.alunoId || t.aluno_id || "",
    aluno: t.aluno || t.alunoNome || "",
    professorId: t.professorId || t.professor_id || "",
    professor: t.professor || t.professorNome || "",
    contratoId: t.contratoId || "",
    servicoContratadoId: t.servicoContratadoId || "",
    modalidade: t.modalidade || "Musculação",
    objetivo: t.objetivo || t.nome || "Treino",
    nome: t.nome || t.objetivo || "Treino",
    tipoDivisao: t.tipoDivisao || t.divisao || "Personalizado",
    dataInicio: t.dataInicio || t.data_inicio || t.criadoEm || hojeISO(),
    dataValidade: t.dataValidade || t.data_validade || "",
    status: statusTreino(t),
    exercicios: normalizarExercicios(t.exercicios || []),
    origem: t.origem || "treino_legado",
    criadoEm: t.criadoEm || agoraISO(),
    atualizadoEm: t.atualizadoEm || agoraISO()
  };
}

function baseExerciciosPorObjetivo(objetivo = "") {
  const obj = normalizar(objetivo);
  if (obj.includes("emagrec")) {
    return [
      { nome:"Esteira ou bike", grupoMuscular:"Cardio", series:1, repeticoes:"20 min", descanso:"-" },
      { nome:"Agachamento livre", grupoMuscular:"Pernas", series:3, repeticoes:"15", descanso:"45s" },
      { nome:"Remada baixa", grupoMuscular:"Costas", series:3, repeticoes:"12", descanso:"45s" },
      { nome:"Supino máquina", grupoMuscular:"Peito", series:3, repeticoes:"12", descanso:"45s" },
      { nome:"Abdominal prancha", grupoMuscular:"Core", series:3, repeticoes:"30s", descanso:"30s" }
    ];
  }
  if (obj.includes("hipertrof")) {
    return [
      { nome:"Supino reto", grupoMuscular:"Peito", series:4, repeticoes:"8-10", descanso:"90s" },
      { nome:"Puxada frontal", grupoMuscular:"Costas", series:4, repeticoes:"8-10", descanso:"90s" },
      { nome:"Agachamento", grupoMuscular:"Pernas", series:4, repeticoes:"8-10", descanso:"90s" },
      { nome:"Desenvolvimento", grupoMuscular:"Ombros", series:3, repeticoes:"10", descanso:"75s" },
      { nome:"Rosca direta", grupoMuscular:"Bíceps", series:3, repeticoes:"10", descanso:"60s" }
    ];
  }
  return [
    { nome:"Aquecimento", grupoMuscular:"Geral", series:1, repeticoes:"10 min", descanso:"-" },
    { nome:"Leg press", grupoMuscular:"Pernas", series:3, repeticoes:"12", descanso:"60s" },
    { nome:"Supino máquina", grupoMuscular:"Peito", series:3, repeticoes:"12", descanso:"60s" },
    { nome:"Puxada frontal", grupoMuscular:"Costas", series:3, repeticoes:"12", descanso:"60s" },
    { nome:"Abdominal", grupoMuscular:"Core", series:3, repeticoes:"15", descanso:"45s" }
  ];
}

export async function statusMotorTreinos() {
  return {
    ok: true,
    modulo: "treinos-integrado",
    versao: "Fusion ERP 2.6.2-A",
    status: "Online",
    conceito: "Motor de treinos integrado com Biblioteca Inteligente, mídia unificada e atualização por bibliotecaId"
  };
}

export async function listarTreinosIntegrados(filtros = {}) {
  const base = await carregarBaseTreinos();
  let lista = [...base.treinos, ...base.treinosLegado.map(mapearTreinoLegado)].map((t) => hidratarTreinoComBiblioteca(t, base.biblioteca));

  if (filtros.alunoId || filtros.aluno_id) {
    const alunoId = filtros.alunoId || filtros.aluno_id;
    lista = lista.filter((t) => treinoPertenceAluno(t, alunoId));
  }
  if (filtros.professorId || filtros.professor_id) {
    const professorId = filtros.professorId || filtros.professor_id;
    lista = lista.filter((t) => String(t.professorId || t.professor_id) === String(professorId));
  }
  if (filtros.status) lista = lista.filter((t) => normalizar(statusTreino(t)) === normalizar(filtros.status));

  lista = lista.sort((a,b) => String(b.atualizadoEm || b.criadoEm || b.dataInicio || "").localeCompare(String(a.atualizadoEm || a.criadoEm || a.dataInicio || "")));
  return {
    ok: true,
    total: lista.length,
    regra: "um_treino_ativo_por_aluno",
    dados: lista
  };
}

export async function obterContextoTreinoAluno(alunoId) {
  const base = await carregarBaseTreinos();
  const aluno = localizarAluno(base.alunos, alunoId);
  const contrato = contratoAtivoAluno(base.contratos, alunoId);
  const servicosAtivos = contrato ? servicosAtivosDoContrato(base.servicosContratados, contrato.id) : [];
  const servicoTreino = servicoMusculacao(servicosAtivos);
  const avaliacoes = avaliacoesAluno(base.avaliacoes, alunoId);
  const frequencias = frequenciasAluno(base.frequencia, alunoId);
  const treinos = (await listarTreinosIntegrados({ alunoId })).dados;

  return {
    ok: true,
    aluno: aluno || { id: alunoId },
    contrato,
    servicosAtivos,
    servicoTreino,
    ultimaAvaliacao: avaliacoes[0] || null,
    frequenciasRecentes: frequencias.slice(0, 10),
    treinosAtivos: treinos.filter((t) => statusTreino(t) === "Ativo"),
    historicoTreinos: treinos
  };
}

export async function criarTreinoIntegrado(dados = {}) {
  const alunoId = texto(dados.alunoId || dados.aluno_id);
  if (!alunoId) throw Object.assign(new Error("Informe alunoId."), { status: 400 });

  const base = await carregarBaseTreinos();
  const aluno = localizarAluno(base.alunos, alunoId);
  const contrato = contratoAtivoAluno(base.contratos, alunoId);
  const modoCompatibilidadeV3 = !contrato || dados.modoCompatibilidadeV3 === true || dados.origem === "treinos_v3";

  const servicosAtivos = contrato ? servicosAtivosDoContrato(base.servicosContratados, contrato.id) : [];
  const servicoTreino = dados.servicoContratadoId
    ? servicosAtivos.find((s) => String(s.id || s.servicoContratadoId) === String(dados.servicoContratadoId))
    : servicoMusculacao(servicosAtivos);

  if (!contrato && !modoCompatibilidadeV3) {
    throw Object.assign(new Error("Aluno sem contrato comercial ativo."), { status: 403 });
  }

  if (contrato && !servicoTreino && !modoCompatibilidadeV3) {
    throw Object.assign(new Error("Aluno sem serviço ativo para treino."), { status: 403 });
  }

  const professor = localizarProfessor(base.professores, dados.professorId || dados.professor || servicoTreino?.professor);
  const exercicios = normalizarExercicios(dados.exercicios?.length ? dados.exercicios : baseExerciciosPorObjetivo(dados.objetivo || "Condicionamento"), base.biblioteca);

  const treino = {
    id: gerarId("trn"),
    alunoId,
    aluno: alunoNome(aluno || { nome: dados.aluno }),
    contratoId: contrato?.id || dados.contratoId || "",
    matriculaId: contrato?.matriculaId || dados.matriculaId || "",
    numeroMatricula: contrato?.numeroMatricula || dados.numeroMatricula || "",
    servicoContratadoId: servicoTreino?.id || servicoTreino?.servicoContratadoId || dados.servicoContratadoId || "",
    turmaId: servicoTreino?.turmaId || dados.turmaId || "",
    turma: servicoTreino?.turma || servicoTreino?.nome || dados.turma || "",
    modalidade: servicoTreino?.modalidade || dados.modalidade || "Musculação",
    professorId: professor?.id || dados.professorId || "",
    professor: professor?.nome || dados.professor || servicoTreino?.professor || "",
    objetivo: dados.objetivo || "Condicionamento físico",
    nome: dados.nome || dados.objetivo || "Treino integrado",
    tipoDivisao: dados.tipoDivisao || dados.divisao || "Personalizado",
    dataInicio: dados.dataInicio || hojeISO(),
    dataValidade: dados.dataValidade || dados.validade || "",
    status: dados.status || "Ativo",
    exercicios,
    observacao: dados.observacao || dados.observacoes || "",
    origem: dados.origem || (modoCompatibilidadeV3 ? "treinos_v3_compatibilidade" : "motor_treinos_integrado"),
    modoCompatibilidadeV3,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    versao: 1,
    historico: [{
      acao:"criar_treino",
      usuario:dados.usuario || "Administrador",
      criadoEm:agoraISO(),
      detalhes: modoCompatibilidadeV3 ? { aviso:"Criado sem contrato/serviço ativo durante integração Treinos V3." } : {}
    }]
  };

  const arquivamento = arquivarTreinosAtivosDoAluno(base.treinos, treino.alunoId, treino.id, "novo_treino_substitui_ativo_anterior");
  const lista = arquivamento.lista;
  treino.politicaSalvar = "substituir_ativo_anterior";
  treino.historico = [
    ...(Array.isArray(treino.historico) ? treino.historico : []),
    {
      acao: "regra_treino_unico_ativo",
      usuario: dados.usuario || "Motor Treinos Integrado",
      criadoEm: agoraISO(),
      detalhes: {
        regra: "Ao criar novo treino, qualquer treino ativo anterior do aluno é arquivado.",
        arquivouAnterior: arquivamento.alterou
      }
    }
  ];
  lista.push(treino);
  await salvarTreinos(lista);
  return { ok: true, regra: "um_treino_ativo_por_aluno", dados: hidratarTreinoComBiblioteca(treino, base.biblioteca) };
}

export async function atualizarTreinoIntegrado(id, dados = {}) {
  const base = await carregarBaseTreinos();
  const lista = base.treinos;
  const idx = lista.findIndex((t) => String(t.id) === String(id));
  if (idx < 0) throw Object.assign(new Error("Treino não encontrado no motor integrado."), { status: 404 });

  const atual = lista[idx];
  const novo = {
    ...atual,
    nome: dados.nome ?? atual.nome,
    objetivo: dados.objetivo ?? atual.objetivo,
    tipoDivisao: dados.tipoDivisao ?? dados.divisao ?? atual.tipoDivisao,
    dataValidade: dados.dataValidade ?? dados.validade ?? atual.dataValidade,
    status: dados.status ?? atual.status,
    observacao: dados.observacao ?? dados.observacoes ?? atual.observacao,
    exercicios: dados.exercicios ? normalizarExercicios(dados.exercicios, base.biblioteca) : atual.exercicios,
    atualizadoEm: agoraISO(),
    versao: Number(atual.versao || 1) + 1,
    historico: [...(Array.isArray(atual.historico) ? atual.historico : []), { acao:"atualizar_treino", usuario:dados.usuario || "Administrador", criadoEm:agoraISO() }]
  };

  lista[idx] = novo;
  let listaFinal = lista;
  if (ativo(novo) && novo.alunoId) {
    const arquivamento = arquivarTreinosAtivosDoAluno(lista, novo.alunoId, novo.id, "edicao_mantem_apenas_um_ativo");
    listaFinal = arquivamento.lista;
  }
  await salvarTreinos(listaFinal);
  return { ok: true, regra: "um_treino_ativo_por_aluno", dados: hidratarTreinoComBiblioteca(novo, base.biblioteca) };
}

export async function arquivarTreinoIntegrado(id, dados = {}) {
  return atualizarTreinoIntegrado(id, { status: "Arquivado", usuario: dados.usuario || "Administrador", observacao: dados.motivo || dados.observacao || "" });
}

export async function gerarTreinoAutomatico(alunoId, dados = {}) {
  const contexto = await obterContextoTreinoAluno(alunoId);
  const avaliacao = contexto.ultimaAvaliacao || {};
  const objetivo = dados.objetivo || avaliacao.objetivo || avaliacao.observacoes || "Condicionamento físico";
  return criarTreinoIntegrado({
    alunoId,
    objetivo,
    nome: dados.nome || `Treino ${objetivo}`,
    tipoDivisao: dados.tipoDivisao || "Full Body",
    professorId: dados.professorId || "",
    professor: dados.professor || contexto.servicoTreino?.professor || "",
    servicoContratadoId: contexto.servicoTreino?.id || contexto.servicoTreino?.servicoContratadoId || "",
    usuario: dados.usuario || "Motor automático",
    exercicios: dados.exercicios && dados.exercicios.length ? dados.exercicios : baseExerciciosPorObjetivo(objetivo)
  });
}
