import crypto from "node:crypto";
import {
  listarAprendizado,
  registrarGeracaoAtomica,
  registrarRevisaoRegistro,
  registrarExemploAprovadoRegistro
} from "./assistente-aprendizado.repository.mjs";

import {
  listarTreinos
} from "./treinos.repository.mjs";

/* assistente-aprovacao-validacao-servidor-v1 */

function texto(valor, max = 500) {
  return String(valor ?? "").trim().slice(0, max);
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function booleano(valor) {
  return valor === true;
}

function cloneSeguro(valor, maxBytes = 200000) {
  if (valor === undefined || valor === null) return null;

  const json = JSON.stringify(valor);

  if (Buffer.byteLength(json, "utf8") > maxBytes) {
    const erro = new Error(
      "Payload do aprendizado excede o limite permitido."
    );
    erro.statusCode = 413;
    throw erro;
  }

  return JSON.parse(json);
}

function sanitizarPlano(plano = {}) {
  const bruto = cloneSeguro(plano) || {};
  const divisoes = Array.isArray(bruto.divisoes)
    ? bruto.divisoes
    : Array.isArray(bruto)
      ? bruto
      : [];

  return {
    divisoes: divisoes.slice(0, 7).map(divisao => ({
      nome: texto(divisao?.nome, 30),
      itens: (Array.isArray(divisao?.itens) ? divisao.itens : [])
        .slice(0, 30)
        .map(item => ({
          id: texto(item?.id, 120),
          codigo: texto(item?.codigo, 120),
          nome: texto(item?.nome, 220),
          grupoId: texto(item?.grupoId, 80),
          grupo: texto(item?.grupo, 120),
          series: texto(item?.series, 50),
          repeticoes: texto(item?.repeticoes, 50),
          carga: texto(item?.carga, 50),
          descanso: texto(item?.descanso, 50),
          metodo: texto(item?.metodo, 100),
          cadencia: texto(item?.cadencia, 50),
          obs: texto(item?.obs, 500)
        }))
    }))
  };
}

/* assistente-preferencias-aprendidas-v1 */

function normalizarAprendizado(valor) {
  return texto(valor, 500)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sanitizarBriefingProfessor(briefing = {}) {
  const bruto =
    cloneSeguro(
      briefing,
      30000
    ) || {};

  const modelos =
    (
      Array.isArray(bruto.modelos)
        ? bruto.modelos
        : []
    )
      .slice(0, 7)
      .map(modelo => ({
        nome:
          texto(
            modelo?.nome,
            30
          ),

        categorias:
          (
            Array.isArray(modelo?.categorias)
              ? modelo.categorias
              : []
          )
            .slice(0, 12)
            .map(
              categoria =>
                texto(
                  categoria,
                  60
                )
            )
            .filter(Boolean)
      }));

  return {
    modo:
      texto(
        bruto.modo,
        40
      ),

    textoLivre:
      texto(
        bruto.textoLivre,
        2000
      ),

    foco:
      texto(
        bruto.foco,
        80
      ) || null,

    focoVezes:
      numero(
        bruto.focoVezes
      ),

    core:
      texto(
        bruto.core,
        40
      ),

    cardio:
      texto(
        bruto.cardio,
        40
      ),

    aquecimento:
      texto(
        bruto.aquecimento,
        40
      ),

    resumo:
      texto(
        bruto.resumo,
        2500
      ),

    opcaoGerada:
      numero(
        bruto.opcaoGerada
      ),

    modelos
  };
}

function categoriasBriefingAprendizado(
  briefing = {}
) {
  const categorias = [];

  for (
    const modelo
    of (
      Array.isArray(briefing?.modelos)
        ? briefing.modelos
        : []
    )
  ) {
    for (
      const categoria
      of (
        Array.isArray(modelo?.categorias)
          ? modelo.categorias
          : []
      )
    ) {
      const chave =
        normalizarAprendizado(
          categoria
        );

      if (
        chave &&
        !categorias.includes(chave)
      ) {
        categorias.push(chave);
      }
    }
  }

  return categorias;
}

function sanitizarContexto(contexto = {}) {
  const c = cloneSeguro(contexto) || {};
  const prescricao = c.prescricao || {};
  const seguranca = c.seguranca || {};
  const funcional = c.funcional || {};
  const capacidade = c.capacidadeFisica || {};
  const composicao = c.composicao || {};
  const avaliacao = c.avaliacao || {};

  const equipamentosBrutos =
    Array.isArray(c.equipamentos)
      ? c.equipamentos
      : Array.isArray(c.equipamentos?.selecionados)
        ? c.equipamentos.selecionados
        : [];

  return {
    schemaVersion: 1,

    avaliacao: {
      id: texto(avaliacao.id, 120),
      data: texto(avaliacao.data, 20)
    },

    idade: numero(c.idade),
    sexo: texto(c.sexo, 40),

    prescricao: {
      objetivoPrincipal:
        texto(
          prescricao.objetivoPrincipal ||
          c.objetivo,
          160
        ),

      objetivoSecundario:
        texto(prescricao.objetivoSecundario, 160),

      experiencia:
        texto(
          prescricao.experiencia ||
          c.nivel,
          80
        ),

      frequenciaSemanal:
        numero(
          prescricao.frequenciaSemanal ??
          c.frequencia
        ),

      duracaoSessaoMin:
        numero(
          prescricao.duracaoSessaoMin ??
          c.duracao
        ),

      praticaAtual:
        texto(prescricao.praticaAtual, 160),

      briefingProfessor:
        sanitizarBriefingProfessor(
          prescricao.briefingProfessor ||
          c.briefingProfessor ||
          {}
        )
    },

    seguranca: {
      parqCompleto:
        booleano(seguranca.parqCompleto),

      parqPositivo:
        booleano(seguranca.parqPositivo),

      possuiRestricao:
        Boolean(
          texto(seguranca.restricoesMedicas)
        ),

      possuiLesao:
        Boolean(
          texto(seguranca.lesoes)
        ),

      possuiDorAtual:
        String(seguranca.dorAtual || "")
          .toLowerCase() === "sim",

      possuiLimitacaoMovimento:
        Boolean(
          texto(seguranca.limitacaoMovimento)
        ),

      possuiDorMovimento:
        String(seguranca.dorMovimento || "")
          .toLowerCase() === "sim"
    },

    funcional: {
      agachamento:
        texto(funcional.agachamento, 80),

      mobilidadeOmbro:
        texto(funcional.mobilidadeOmbro, 80),

      mobilidadeQuadril:
        texto(funcional.mobilidadeQuadril, 80),

      equilibrio:
        texto(funcional.equilibrio, 80)
    },

    capacidadeFisica: {
      condicaoFisica:
        texto(capacidade.condicaoFisica, 100),

      protocoloCardio:
        texto(capacidade.protocoloCardio, 100),

      vo2Obtido:
        numero(capacidade.vo2Obtido),

      flexaoBracos:
        numero(capacidade.flexaoBracos),

      abdominalRepeticoes:
        numero(capacidade.abdominalRepeticoes),

      bancoWells:
        numero(capacidade.bancoWells)
    },

    composicao: {
      peso:
        numero(composicao.peso),

      altura:
        numero(composicao.altura),

      imc:
        numero(composicao.imc),

      percentualGordura:
        numero(composicao.percentualGordura),

      massaMagra:
        numero(composicao.massaMagra),

      massaGorda:
        numero(composicao.massaGorda),

      cintura:
        numero(composicao.cintura),

      quadril:
        numero(composicao.quadril),

      rcq:
        numero(composicao.rcq)
    },

    equipamentos:
      equipamentosBrutos
        .map(item =>
          texto(
            typeof item === "object"
              ? item.id
              : item,
            120
          )
        )
        .filter(Boolean)
        .slice(0, 300)
  };
}

function hashObjeto(valor) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(valor))
    .digest("hex");
}

function usuarioAuditoria(usuario = {}) {
  return {
    professorId:
      texto(
        usuario.id ||
        usuario.professorId,
        120
      ),

    professorNome:
      texto(
        usuario.nome ||
        usuario.professorNome,
        200
      )
  };
}

function validarAlunoId(payload = {}) {
  const alunoId =
    texto(
      payload.alunoId ||
      payload.aluno_id,
      120
    );

  if (!alunoId) {
    const erro = new Error("Aluno não informado.");
    erro.statusCode = 400;
    throw erro;
  }

  return alunoId;
}

export async function registrarGeracaoAprendizado(
  payload = {},
  usuario = {}
) {
  const alunoId = validarAlunoId(payload);
  const agora = new Date().toISOString();

  const contexto =
    sanitizarContexto(payload.contexto || {});

  const plano =
    sanitizarPlano(
      payload.sugestao ||
      payload.plano ||
      {}
    );

  if (!plano.divisoes.length) {
    const erro = new Error(
      "Sugestão sem divisões não pode entrar no banco de aprendizagem."
    );
    erro.statusCode = 400;
    throw erro;
  }

  const execucaoId = crypto.randomUUID();
  const sugestaoId = crypto.randomUUID();
  const auditoria = usuarioAuditoria(usuario);

  const execucao = {
    id: execucaoId,
    tipo: "geracao",
    alunoId,

    avaliacaoId:
      texto(
        payload.avaliacaoId ||
        contexto.avaliacao.id,
        120
      ),

    provedor:
      texto(
        payload.provedor ||
        "regras_local",
        80
      ),

    modelo:
      texto(
        payload.modelo ||
        "fusion-regras-v1",
        120
      ),

    versaoMotor:
      texto(
        payload.versaoMotor ||
        "1",
        80
      ),

    contexto,
    contextoHash: hashObjeto(contexto),

    solicitadoPor: auditoria,
    criadoEm: agora
  };

  const sugestao = {
    id: sugestaoId,
    execucaoId,
    alunoId,
    avaliacaoId: execucao.avaliacaoId,
    plano,
    planoHash: hashObjeto(plano),
    status: "rascunho_gerado",
    criadoEm: agora
  };

  await registrarGeracaoAtomica(
    execucao,
    sugestao
  );

  return {
    execucaoId,
    sugestaoId,
    contextoHash: execucao.contextoHash,
    planoHash: sugestao.planoHash
  };
}

export async function registrarRevisaoAprendizado(
  payload = {},
  usuario = {}
) {
  const alunoId = validarAlunoId(payload);

  const execucaoId =
    texto(payload.execucaoId, 120);

  const sugestaoId =
    texto(payload.sugestaoId, 120);

  if (!execucaoId || !sugestaoId) {
    const erro = new Error(
      "Execução e sugestão são obrigatórias para registrar revisão."
    );
    erro.statusCode = 400;
    throw erro;
  }

  const antes =
    sanitizarPlano(payload.antes || {});

  const depois =
    sanitizarPlano(payload.depois || {});

  const alteracoes =
    (Array.isArray(payload.alteracoes)
      ? payload.alteracoes
      : [])
      .slice(0, 300)
      .map(item => ({
        tipo: texto(item?.tipo, 80),
        divisao: texto(item?.divisao, 30),
        exercicioId:
          texto(item?.exercicioId, 120),
        campo:
          texto(item?.campo, 100),
        antes:
          texto(item?.antes, 500),
        depois:
          texto(item?.depois, 500)
      }));

  const registro = {
    id: crypto.randomUUID(),
    execucaoId,
    sugestaoId,
    alunoId,
    antesHash: hashObjeto(antes),
    depoisHash: hashObjeto(depois),
    alteracoes,
    totalAlteracoes: alteracoes.length,
    revisadoPor: usuarioAuditoria(usuario),
    criadoEm: new Date().toISOString()
  };

  await registrarRevisaoRegistro(registro);

  return registro;
}

export async function registrarAprovacaoAprendizado(
  payload = {},
  usuario = {}
) {
  const alunoId =
    validarAlunoId(payload);

  const execucaoId =
    texto(
      payload.execucaoId,
      120
    );

  const sugestaoId =
    texto(
      payload.sugestaoId,
      120
    );

  const treinoVersaoId =
    texto(
      payload.treinoVersaoId,
      160
    );

  if (
    !execucaoId ||
    !sugestaoId ||
    !treinoVersaoId
  ) {
    const erro = new Error(
      "Execução, sugestão e versão do treino são obrigatórias."
    );

    erro.statusCode = 400;
    erro.code =
      "RASTREABILIDADE_APROVACAO_OBRIGATORIA";

    throw erro;
  }

  /*
   * A aprovação não confia mais em:
   * - payload.treinoVersionado
   * - payload.planoFinal
   *
   * Toda a validação e o plano final vêm das coleções
   * persistidas no servidor.
   */
  const [
    aprendizado,
    treinosBrutos
  ] = await Promise.all([
    listarAprendizado(),
    listarTreinos()
  ]);

  const execucoes =
    Array.isArray(aprendizado.execucoes)
      ? aprendizado.execucoes
      : [];

  const sugestoes =
    Array.isArray(aprendizado.sugestoes)
      ? aprendizado.sugestoes
      : [];

  const revisoes =
    Array.isArray(aprendizado.revisoes)
      ? aprendizado.revisoes
      : [];

  const treinos =
    Array.isArray(treinosBrutos)
      ? treinosBrutos
      : [];

  const execucao =
    execucoes.find(
      item =>
        String(item?.id || "") ===
        execucaoId
    );

  if (!execucao) {
    const erro = new Error(
      "Execução do assistente não encontrada."
    );

    erro.statusCode = 404;
    erro.code =
      "EXECUCAO_APRENDIZADO_NAO_ENCONTRADA";

    throw erro;
  }

  const sugestao =
    sugestoes.find(
      item =>
        String(item?.id || "") ===
        sugestaoId
    );

  if (!sugestao) {
    const erro = new Error(
      "Sugestão do assistente não encontrada."
    );

    erro.statusCode = 404;
    erro.code =
      "SUGESTAO_APRENDIZADO_NAO_ENCONTRADA";

    throw erro;
  }

  if (
    String(execucao.alunoId || "") !== alunoId ||
    String(sugestao.alunoId || "") !== alunoId ||
    String(sugestao.execucaoId || "") !== execucaoId
  ) {
    const erro = new Error(
      "Execução, sugestão e aluno não pertencem ao mesmo fluxo de aprendizagem."
    );

    erro.statusCode = 409;
    erro.code =
      "VINCULO_APRENDIZADO_INVALIDO";

    throw erro;
  }

  const treino =
    treinos.find(
      item =>
        String(item?.id || "") ===
        treinoVersaoId
    );

  if (!treino) {
    const erro = new Error(
      "Versão do treino não encontrada no servidor."
    );

    erro.statusCode = 404;
    erro.code =
      "TREINO_VERSAO_NAO_ENCONTRADO";

    throw erro;
  }

  const treinoAlunoId =
    String(
      treino.alunoId ||
      treino.aluno_id ||
      ""
    );

  if (treinoAlunoId !== alunoId) {
    const erro = new Error(
      "A versão informada não pertence ao aluno da sugestão."
    );

    erro.statusCode = 409;
    erro.code =
      "TREINO_VERSAO_ALUNO_DIVERGENTE";

    throw erro;
  }

  const statusTreino =
    String(
      treino.status ||
      "ativo"
    )
      .trim()
      .toLowerCase();

  const treinoAtivo =
    treino.ativo !== false &&
    ![
      "arquivado",
      "inativo",
      "cancelado"
    ].includes(statusTreino);

  if (!treinoAtivo) {
    const erro = new Error(
      "Somente a versão ativa do treino pode ser aprovada para aprendizagem."
    );

    erro.statusCode = 409;
    erro.code =
      "TREINO_VERSAO_NAO_ATIVA";

    throw erro;
  }

  const versao =
    Number(
      treino.versao ??
      treino.versaoNumero
    );

  if (
    !Number.isInteger(versao) ||
    versao < 1
  ) {
    const erro = new Error(
      "O treino salvo não possui versionamento válido."
    );

    erro.statusCode = 409;
    erro.code =
      "TREINO_VERSIONADO_OBRIGATORIO";

    throw erro;
  }

  const ativosAluno =
    treinos.filter(item => {
      const mesmoAluno =
        String(
          item?.alunoId ||
          item?.aluno_id ||
          ""
        ) === alunoId;

      if (!mesmoAluno) {
        return false;
      }

      const status =
        String(
          item?.status ||
          "ativo"
        )
          .trim()
          .toLowerCase();

      return (
        item?.ativo !== false &&
        ![
          "arquivado",
          "inativo",
          "cancelado"
        ].includes(status)
      );
    });

  if (
    ativosAluno.length !== 1 ||
    String(
      ativosAluno[0]?.id ||
      ""
    ) !== treinoVersaoId
  ) {
    const erro = new Error(
      "A cadeia de versões possui mais de um treino ativo ou a versão aprovada não é a versão corrente."
    );

    erro.statusCode = 409;
    erro.code =
      "TREINO_VERSAO_ATIVA_AMBIGUA";

    throw erro;
  }

  if (
    String(
      treino.assistenteExecucaoId ||
      ""
    ) !== execucaoId ||
    String(
      treino.assistenteSugestaoId ||
      ""
    ) !== sugestaoId
  ) {
    const erro = new Error(
      "A versão salva não está vinculada à execução e sugestão informadas."
    );

    erro.statusCode = 409;
    erro.code =
      "TREINO_RASTREABILIDADE_ASSISTENTE_INVALIDA";

    throw erro;
  }

  if (
    treino.revisaoProfessorConfirmada !== true
  ) {
    const erro = new Error(
      "A versão ainda não possui confirmação de revisão profissional."
    );

    erro.statusCode = 409;
    erro.code =
      "REVISAO_PROFESSOR_OBRIGATORIA";

    throw erro;
  }

  const origemTreino =
    texto(
      treino.origem,
      80
    );

  if (
    !origemTreino.startsWith(
      "assistente"
    )
  ) {
    const erro = new Error(
      "A versão informada não foi criada pelo fluxo assistido."
    );

    erro.statusCode = 409;
    erro.code =
      "ORIGEM_ASSISTENTE_OBRIGATORIA";

    throw erro;
  }

  /*
   * Para V2+ validamos também a ligação física com
   * a versão anterior arquivada.
   */
  if (versao > 1) {
    const versaoAnteriorId =
      texto(
        treino.versaoAnteriorId,
        160
      );

    const anterior =
      treinos.find(
        item =>
          String(item?.id || "") ===
          versaoAnteriorId
      );

    const anteriorStatus =
      String(
        anterior?.status ||
        ""
      )
        .trim()
        .toLowerCase();

    const anteriorMesmoAluno =
      String(
        anterior?.alunoId ||
        anterior?.aluno_id ||
        ""
      ) === alunoId;

    const anteriorArquivado =
      Boolean(
        anterior &&
        anteriorMesmoAluno &&
        anterior.ativo === false &&
        anteriorStatus === "arquivado" &&
        String(
          anterior.substituidoPor ||
          ""
        ) === treinoVersaoId
      );

    if (!anteriorArquivado) {
      const erro = new Error(
        "A cadeia entre a versão atual e a versão anterior não está consistente."
      );

      erro.statusCode = 409;
      erro.code =
        "CADEIA_VERSIONAMENTO_INVALIDA";

      throw erro;
    }
  }

  /*
   * Fonte única do exemplo aprovado:
   * o plano realmente persistido no treino versionado.
   */
  const planoFinal =
    sanitizarPlano({
      divisoes:
        Array.isArray(treino.divisoes)
          ? treino.divisoes
          : []
    });

  if (!planoFinal.divisoes.length) {
    const erro = new Error(
      "A versão salva do treino não possui divisões válidas."
    );

    erro.statusCode = 409;
    erro.code =
      "TREINO_VERSIONADO_SEM_PLANO";

    throw erro;
  }

  const planoFinalHash =
    hashObjeto(planoFinal);

  /*
   * Quando houve revisão registrada, o último estado
   * revisado deve ser exatamente o plano salvo.
   */
  const revisoesFluxo =
    revisoes
      .filter(
        item =>
          String(
            item?.execucaoId ||
            ""
          ) === execucaoId &&
          String(
            item?.sugestaoId ||
            ""
          ) === sugestaoId &&
          String(
            item?.alunoId ||
            ""
          ) === alunoId
      )
      .sort(
        (a, b) =>
          String(
            b?.criadoEm ||
            ""
          ).localeCompare(
            String(
              a?.criadoEm ||
              ""
            )
          )
      );

  const ultimaRevisao =
    revisoesFluxo[0] ||
    null;

  if (
    ultimaRevisao?.depoisHash &&
    String(
      ultimaRevisao.depoisHash
    ) !== planoFinalHash
  ) {
    const erro = new Error(
      "O treino salvo diverge do último estado revisado pelo professor."
    );

    erro.statusCode = 409;
    erro.code =
      "PLANO_FINAL_DIVERGE_REVISAO";

    throw erro;
  }

  const exemplo = {
    id:
      crypto.randomUUID(),

    execucaoId,
    sugestaoId,
    alunoId,

    treinoVersaoId,
    treinoVersao:
      versao,

    versaoAnteriorId:
      texto(
        treino.versaoAnteriorId,
        160
      ) || null,

    origemTreino,

    planoFinal,
    planoFinalHash,

    fontePlanoFinal:
      "treino_versionado_servidor",

    aprovadoPor:
      usuarioAuditoria(usuario),

    aprovadoEm:
      new Date().toISOString(),

    status:
      "aprovado"
  };

  /*
   * A deduplicação definitiva ocorre dentro da fila
   * serializada do repository.
   */
  return await registrarExemploAprovadoRegistro(
    exemplo
  );
}

export async function obterPreferenciasAprendizado(
  payload = {}
) {
  const dados =
    await listarAprendizado();

  const execucoes =
    Array.isArray(dados.execucoes)
      ? dados.execucoes
      : [];

  const exemplos =
    (
      Array.isArray(dados.exemplos)
        ? dados.exemplos
        : []
    )
      .filter(
        exemplo =>
          String(
            exemplo?.status ||
            ""
          ).toLowerCase() ===
            "aprovado" &&
          exemplo?.planoFinal
      );

  const execucaoPorId =
    new Map(
      execucoes.map(
        item => [
          String(
            item?.id ||
            ""
          ),
          item
        ]
      )
    );

  const alunoId =
    texto(
      payload.alunoId ||
      payload.aluno_id,
      120
    );

  const objetivo =
    normalizarAprendizado(
      payload.objetivo
    );

  const experiencia =
    normalizarAprendizado(
      payload.nivel ||
      payload.experiencia
    );

  const frequencia =
    numero(
      payload.frequencia
    );

  const duracao =
    numero(
      payload.duracao
    );

  const briefingAtual =
    sanitizarBriefingProfessor(
      payload.briefingProfessor ||
      payload.briefing ||
      {}
    );

  const categoriasAtuais =
    categoriasBriefingAprendizado(
      briefingAtual
    );

  const pesos =
    new Map();

  let exemplosConsiderados = 0;

  for (const exemplo of exemplos) {
    const execucao =
      execucaoPorId.get(
        String(
          exemplo?.execucaoId ||
          ""
        )
      );

    if (!execucao) {
      continue;
    }

    const contexto =
      execucao.contexto ||
      {};

    const prescricao =
      contexto.prescricao ||
      {};

    const exemploAlunoId =
      String(
        exemplo?.alunoId ||
        execucao?.alunoId ||
        ""
      );

    const objetivoExemplo =
      normalizarAprendizado(
        prescricao.objetivoPrincipal
      );

    const experienciaExemplo =
      normalizarAprendizado(
        prescricao.experiencia
      );

    const frequenciaExemplo =
      numero(
        prescricao.frequenciaSemanal
      );

    const duracaoExemplo =
      numero(
        prescricao.duracaoSessaoMin
      );

    const briefingExemplo =
      sanitizarBriefingProfessor(
        prescricao.briefingProfessor ||
        {}
      );

    const categoriasExemplo =
      categoriasBriefingAprendizado(
        briefingExemplo
      );

    const mesmoAluno =
      Boolean(
        alunoId &&
        exemploAlunoId === alunoId
      );

    const mesmoObjetivo =
      Boolean(
        objetivo &&
        objetivoExemplo &&
        objetivo === objetivoExemplo
      );

    const mesmaExperiencia =
      Boolean(
        experiencia &&
        experienciaExemplo &&
        experiencia === experienciaExemplo
      );

    const intersecao =
      categoriasAtuais.filter(
        categoria =>
          categoriasExemplo.includes(
            categoria
          )
      ).length;

    const uniao =
      new Set([
        ...categoriasAtuais,
        ...categoriasExemplo
      ]).size;

    const similaridadeBriefing =
      uniao
        ? intersecao / uniao
        : 0;

    if (
      !mesmoAluno &&
      !mesmoObjetivo &&
      similaridadeBriefing <= 0
    ) {
      continue;
    }

    let pesoExemplo = 1;

    if (mesmoAluno) {
      pesoExemplo += 6;
    }

    if (mesmoObjetivo) {
      pesoExemplo += 4;
    }

    if (mesmaExperiencia) {
      pesoExemplo += 1.5;
    }

    if (
      frequencia &&
      frequenciaExemplo &&
      frequencia === frequenciaExemplo
    ) {
      pesoExemplo += 1;
    }

    if (
      duracao &&
      duracaoExemplo &&
      Math.abs(
        duracao -
        duracaoExemplo
      ) <= 15
    ) {
      pesoExemplo += 1;
    }

    if (similaridadeBriefing > 0) {
      pesoExemplo +=
        similaridadeBriefing * 5;
    }

    exemplosConsiderados += 1;

    const divisoes =
      Array.isArray(
        exemplo?.planoFinal?.divisoes
      )
        ? exemplo.planoFinal.divisoes
        : [];

    for (const divisao of divisoes) {
      const itens =
        Array.isArray(divisao?.itens)
          ? divisao.itens
          : [];

      for (const item of itens) {
        const chave =
          texto(
            item?.id ||
            item?.codigo ||
            item?.nome,
            220
          );

        if (!chave) {
          continue;
        }

        const atual =
          pesos.get(chave) || {
            chave,
            peso: 0,
            aprovacoes: 0
          };

        atual.peso +=
          pesoExemplo;

        atual.aprovacoes +=
          1;

        pesos.set(
          chave,
          atual
        );
      }
    }
  }

  const exercicios =
    Array.from(
      pesos.values()
    )
      .sort(
        (a, b) =>
          b.peso -
            a.peso ||
          b.aprovacoes -
            a.aprovacoes ||
          String(
            a.chave
          ).localeCompare(
            String(
              b.chave
            ),
            "pt-BR"
          )
      )
      .slice(0, 600)
      .map(
        item => ({
          chave:
            item.chave,

          peso:
            Number(
              item.peso.toFixed(3)
            ),

          aprovacoes:
            item.aprovacoes
        })
      );

  return {
    schemaVersion: 1,
    modo:
      "preferencias_aprovadas",

    exemplosAprovadosTotal:
      exemplos.length,

    exemplosConsiderados,

    exercicios
  };
}

export async function obterResumoAprendizado(
  alunoId = ""
) {
  const dados = await listarAprendizado();

  const id = texto(alunoId, 120);

  const filtrar = lista =>
    !id
      ? lista
      : lista.filter(
          item =>
            String(item.alunoId || "") === id
        );

  return {
    execucoes: filtrar(dados.execucoes).length,
    sugestoes: filtrar(dados.sugestoes).length,
    revisoes: filtrar(dados.revisoes).length,
    exemplosAprovados:
      filtrar(dados.exemplos).length
  };
}
