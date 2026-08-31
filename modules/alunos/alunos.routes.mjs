import { consultarBloqueioFinanceiroAluno } from "../access-engine/access-engine.service.mjs";
import { listarAgendaAvaliacoes } from "../agenda-avaliacoes/agenda-avaliacoes.repository.mjs";
import { Router } from "express";
import * as alunosService from "./alunos.service.mjs";
import { gerarAtivacaoAlunoERP, statusAplicativoAlunosERP, sincronizarAlunoNoApp } from "../treinos/aluno-app.service.mjs";
import { getBiometricStudentStatesForTenant } from "../access-bridge/access-bridge.repository.mjs";

import * as limiteAcessosService from "./aluno-limite-acessos.service.mjs";

import * as alunoDatasFinanceirasService from "./aluno-datas-financeiras.service.mjs";

import * as alunoDuplicidadesService from "./aluno-duplicidades.service.mjs";

const router = Router();

function erro(res, error, status = 500) {
  return res.status(error.status || error.statusCode || status).json({
    ok: false,
    erro: error.message,
    mensagem: error.message,
    code: error.code || ""
  });
}

function texto(valor) {
  return String(valor || "").trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mesmo(a, b) {
  return texto(a) && texto(a) === texto(b);
}

function fotoAlunoValida(valor) {
  const foto = texto(valor);
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(foto) && foto.length > 300;
}

function usuarioPortalProfessor(req) {
  return req.usuario?.portal === true && req.usuario?.portalTipo === "professor";
}

function responsavelTecnico(req) {
  const usuario = req.usuario || {};
  const perfil = normalizar(usuario.perfil);
  const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
  return usuario.acessoTodosAlunos === true ||
    perfil === "responsavel_tecnico" ||
    perfil === "responsavel-tecnico" ||
    perfil === "responsavel tecnico" ||
    permissoes.includes("professores") ||
    permissoes.includes("*");
}

function podeGerarCodigoApp(req) {
  if (req.usuario?.portal) return false;
  const perfil = normalizar(req.usuario?.perfil);
  return ["administrador", "admin", "gerente", "recepcao"].includes(perfil);
}

function podeResolverDuplicidades(req) {
  if (req.usuario?.portal) return false;
  const perfil = normalizar(req.usuario?.perfil);
  const permissoes = Array.isArray(req.usuario?.permissoes) ? req.usuario.permissoes : [];
  return ["administrador", "admin", "gerente", "recepcao"].includes(perfil) || permissoes.includes("*");
}

async function estadosExternosDuplicidade(tenantId, ids = []) {
  const alunoIds = [...new Set(ids.map(texto).filter(Boolean))];
  if (!tenantId || !alunoIds.length) return { app: { ok: false, dados: {} }, biometria: { ok: false, dados: {} } };
  const [app, biometria] = await Promise.all([
    statusAplicativoAlunosERP({ tenantId, alunoIds }).then((dados) => ({ ok: true, dados: dados || {} })).catch((error) => ({ ok: false, dados: {}, error })),
    getBiometricStudentStatesForTenant(tenantId).then((dados) => ({ ok: true, dados: dados || {} })).catch((error) => ({ ok: false, dados: {}, error }))
  ]);
  return { app, biometria };
}

function pontuarPrincipalDuplicidade(cadastro = {}) {
  const status = normalizar(cadastro.status);
  return ((cadastro.ativo === true || ["ativo", "ativa", "regular"].includes(status)) ? 1000000 : 0) + (cadastro.aplicativo === true ? 500000 : 0) + (cadastro.biometria === true ? 500000 : 0) + Math.min(400000, Number(cadastro.vinculos?.total || 0) * 1000);
}

function cpfAluno(aluno = {}) {
  return texto(aluno.cpf || aluno.documento).replace(/\D/g, "");
}

function alunoPertenceAoProfessor(aluno = {}, usuario = {}) {
  const professorId = texto(usuario.id);
  const professorNome = normalizar(usuario.nome);
  const ids = [
    aluno.professorId,
    aluno.professor_id,
    aluno.idProfessor,
    aluno.professorResponsavelId,
    aluno.professor_responsavel_id,
    aluno.professor_responsavel
  ];
  if (ids.some(id => mesmo(id, professorId))) return true;

  const nomes = [
    aluno.professorNome,
    aluno.professor_nome,
    aluno.professor,
    aluno.professorResponsavel,
    aluno.professor_responsavel_nome,
    aluno.nomeProfessor
  ].map(normalizar).filter(Boolean);
  return Boolean(professorNome && nomes.some(nome => nome === professorNome || nome.includes(professorNome) || professorNome.includes(nome)));
}

// PROFESSOR AGENDA ACESSO ALUNO 20260826
async function idsAlunosDaAgendaProfessor(req) {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return new Set();
  try {
    const agenda = await listarAgendaAvaliacoes();
    const pid = texto(req.usuario?.id);
    return new Set(
      (Array.isArray(agenda) ? agenda : [])
        .filter((item = {}) => mesmo(item.professorId || item.professor_id, pid))
        .filter((item = {}) => !normalizar(item.status).includes("cancel"))
        .map((item = {}) => texto(item.alunoId || item.aluno_id))
        .filter(Boolean)
    );
  } catch (erro) {
    console.warn("[ALUNOS/PORTAL PROFESSOR] Falha ao consultar agenda de avaliações:", erro?.message || erro);
    return new Set();
  }
}

async function filtrarAlunosPorPortal(req, alunos = []) {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return alunos;
  const idsAgenda = await idsAlunosDaAgendaProfessor(req);
  return alunos.filter(aluno =>
    alunoPertenceAoProfessor(aluno, req.usuario) ||
    idsAgenda.has(texto(aluno.id || aluno._id || aluno.codigo))
  );
}

function semSenhaAdministrativaAluno(aluno = {}) {
  const { senha, senhaAluno, senhaAcesso, senhaPortal, portalSenha, password, ...limpo } = aluno;
  return limpo;
}

function ocultarSenhaParaPortal(req, aluno = {}) {
  return req.usuario?.portal ? semSenhaAdministrativaAluno(aluno) : aluno;
}

function exigirAcessoPortalProfessor(req, res, aluno) {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return true;
  if (aluno && alunoPertenceAoProfessor(aluno, req.usuario)) return true;
  res.status(403).json({ ok: false, mensagem: "Professor sem acesso a este aluno." });
  return false;
}

router.get("/", async (req, res) => {
  try {
    const alunos = await alunosService.listar();
    const filtrados = await filtrarAlunosPorPortal(req, alunos);
    res.json(filtrados.map(aluno => ocultarSenhaParaPortal(req, aluno)));
  } catch (error) {
    erro(res, error);
  }
});

router.get("/indicadores", async (req, res) => {
  try {
    const alunos = await filtrarAlunosPorPortal(req, await alunosService.listar());
    const tenantId = texto(req.usuario?.tenantId);
    const ids = alunos.map((a) => texto(a?.id || a?._id || a?.codigo)).filter(Boolean);

    const [base, app, bio] = await Promise.all([
      alunosService.indicadoresCadastro(alunos),
      tenantId
        ? statusAplicativoAlunosERP({ tenantId, alunoIds: ids })
            .then((dados) => ({ ok: true, dados }))
            .catch((error) => ({ ok: false, error }))
        : Promise.resolve({ ok: false }),
      tenantId
        ? getBiometricStudentStatesForTenant(tenantId)
            .then((dados) => ({ ok: true, dados }))
            .catch((error) => ({ ok: false, error }))
        : Promise.resolve({ ok: false })
    ]);

    if (!app.ok) console.warn("[ALUNOS INDICADORES] App indisponivel:", app.error?.message || "tenant ausente");
    if (!bio.ok) console.warn("[ALUNOS INDICADORES] Biometria indisponivel:", bio.error?.message || "tenant ausente");

    const indicadores = {};
    for (const id of ids) {
      indicadores[id] = {
        treino: base?.[id]?.treino === true,
        avaliacao: base?.[id]?.avaliacao === true,
        aplicativo: app.ok ? app.dados?.[id] === true : null,
        biometria: bio.ok ? bio.dados?.[id] === true : null
      };
    }

    res.json({
      ok: true,
      indicadores,
      fontes: { treino: true, avaliacao: true, aplicativo: app.ok, biometria: bio.ok }
    });
  } catch (error) {
    erro(res, error);
  }
});


// RESOLUCAO SEGURA DE DUPLICIDADES DE ALUNOS 20260828
router.get("/duplicidades", async (req, res) => {
  try {
    if (!podeResolverDuplicidades(req)) return res.status(403).json({ ok: false, mensagem: "Sem permissão para analisar duplicidades de alunos." });
    const analise = await alunoDuplicidadesService.listarDuplicidadesAlunos();
    const ids = analise.grupos.flatMap((grupo) => grupo.cadastros.map((cadastro) => cadastro.id)).filter(Boolean);
    const tenantId = texto(req.usuario?.tenantId).toLowerCase();
    const externos = await estadosExternosDuplicidade(tenantId, ids);
    const grupos = analise.grupos.map((grupo) => {
      const cadastros = grupo.cadastros.map((cadastro) => {
        const app = externos.app.ok ? externos.app.dados?.[cadastro.id] === true : null;
        const biometria = externos.biometria.ok ? externos.biometria.dados?.[cadastro.id] === true : null;
        const bloqueios = [...(cadastro.bloqueiosLocal || [])];
        if (!externos.app.ok) bloqueios.push("Não foi possível confirmar o App."); else if (app) bloqueios.push("O cadastro possui App vinculado.");
        if (!externos.biometria.ok) bloqueios.push("Não foi possível confirmar a biometria."); else if (biometria) bloqueios.push("O cadastro possui biometria vinculada.");
        return { ...cadastro, aplicativo: app, biometria, podeRemover: cadastro.podeRemoverLocal === true && externos.app.ok && externos.biometria.ok && app === false && biometria === false, bloqueios };
      });
      const principal = [...cadastros].sort((a, b) => pontuarPrincipalDuplicidade(b) - pontuarPrincipalDuplicidade(a) || String(a.criadoEm || a.id).localeCompare(String(b.criadoEm || b.id)))[0];
      return { ...grupo, principalRecomendadoId: principal?.id || grupo.principalRecomendadoId, cadastros };
    });
    res.json({ ...analise, grupos, fontes: { local: true, aplicativo: externos.app.ok, biometria: externos.biometria.ok } });
  } catch (error) { erro(res, error, 400); }
});

router.post("/duplicidades/resolver", async (req, res) => {
  try {
    if (!podeResolverDuplicidades(req)) return res.status(403).json({ ok: false, mensagem: "Sem permissão para resolver duplicidades de alunos." });
    const principalId = texto(req.body?.principalId);
    const duplicadoId = texto(req.body?.duplicadoId);
    if (!principalId || !duplicadoId) return res.status(400).json({ ok: false, mensagem: "Informe o cadastro principal e o duplicado." });
    const tenantId = texto(req.usuario?.tenantId).toLowerCase();
    if (!tenantId) return res.status(409).json({ ok: false, mensagem: "Sessão sem academia vinculada. Faça login novamente antes de resolver a duplicidade." });
    const externos = await estadosExternosDuplicidade(tenantId, [duplicadoId]);
    if (!externos.app.ok || !externos.biometria.ok) return res.status(503).json({ ok: false, mensagem: "Não foi possível confirmar App e biometria. Nenhum cadastro foi removido." });
    const aplicativo = externos.app.dados?.[duplicadoId] === true;
    const biometria = externos.biometria.dados?.[duplicadoId] === true;
    const usuario = texto(req.usuario?.nome || req.usuario?.email || req.usuario?.id || "operador");
    const resultado = await alunoDuplicidadesService.resolverDuplicidadeAluno({ principalId, duplicadoId, usuario, confirmacoesExternas: { fontesConfirmadas: true, aplicativo, biometria } });
    res.json(resultado);
  } catch (error) { erro(res, error, 400); }
});


// LIMITE ENTRADAS ALUNO ROTAS 20260826
router.get("/:id/limite-acessos", async (req, res) => {
  try {
    if (req.usuario?.portal === true) {
      return res.status(403).json({ ok: false, mensagem: "Apenas a administração pode consultar esta configuração." });
    }
    res.json(await limiteAcessosService.obterControleAcessosAluno(req.params.id));
  } catch (error) {
    erro(res, error, 400);
  }
});

router.put("/:id/limite-acessos", async (req, res) => {
  try {
    if (req.usuario?.portal === true) {
      return res.status(403).json({ ok: false, mensagem: "Apenas a administração pode alterar o limite de entradas." });
    }
    res.json(await limiteAcessosService.salvarLimiteAcessosAluno(req.params.id, req.body || {}));
  } catch (error) {
    erro(res, error, 400);
  }
});

// AJUSTE DATAS FINANCEIRAS ALUNO ROTAS 20260826
function podeAjustarDatasFinanceirasAluno20260826(req) {
  if (req.usuario?.portal === true) return false;
  const perfil = normalizar(req.usuario?.perfil || "");
  const permissoes = Array.isArray(req.usuario?.permissoes) ? req.usuario.permissoes : [];
  return [
    "admin", "administrador", "gerente", "recepcao",
    "responsavel_tecnico", "responsavel-tecnico", "responsavel tecnico"
  ].includes(perfil) || permissoes.includes("financeiro") || permissoes.includes("*");
}

router.get("/:id/datas-financeiras", async (req, res) => {
  try {
    if (!podeAjustarDatasFinanceirasAluno20260826(req)) {
      return res.status(403).json({ ok:false, mensagem:"Sem permissão para consultar ajustes financeiros do aluno." });
    }
    res.json(await alunoDatasFinanceirasService.listarDatasFinanceirasAluno(req.params.id));
  } catch (error) {
    erro(res, error, 400);
  }
});

router.put("/:id/datas-financeiras", async (req, res) => {
  try {
    if (!podeAjustarDatasFinanceirasAluno20260826(req)) {
      return res.status(403).json({ ok:false, mensagem:"Sem permissão para alterar datas financeiras do aluno." });
    }
    const usuario = texto(
      req.usuario?.nome || req.usuario?.email || req.usuario?.id || "Administrador"
    );
    res.json(await alunoDatasFinanceirasService.alterarDatasFinanceirasAluno(
      req.params.id,
      { ...(req.body || {}), usuario }
    ));
  } catch (error) {
    erro(res, error, 400);
  }
});

// DIA VENCIMENTO MENSAL ALUNO ROTAS 20260826
router.get("/:id/dia-vencimento-mensal", async (req, res) => {
  try {
    if (!podeAjustarDatasFinanceirasAluno20260826(req)) {
      return res.status(403).json({ ok:false, mensagem:"Sem permissão para consultar o vencimento mensal do aluno." });
    }
    res.json(await alunoDatasFinanceirasService.obterDiaVencimentoMensalAluno(req.params.id));
  } catch (error) {
    erro(res, error, 400);
  }
});

router.put("/:id/dia-vencimento-mensal", async (req, res) => {
  try {
    if (!podeAjustarDatasFinanceirasAluno20260826(req)) {
      return res.status(403).json({ ok:false, mensagem:"Sem permissão para alterar o vencimento mensal do aluno." });
    }
    const usuario = texto(
      req.usuario?.nome || req.usuario?.email || req.usuario?.id || "Administrador"
    );
    res.json(await alunoDatasFinanceirasService.alterarDiaVencimentoMensalAluno(
      req.params.id,
      { ...(req.body || {}), usuario }
    ));
  } catch (error) {
    erro(res, error, 400);
  }
});

router.post("/:id/app-link", async (req, res) => {
  try {
    if (!podeGerarCodigoApp(req)) {
      return res.status(403).json({
        ok: false,
        mensagem: "Somente administrador, gerente ou recepção pode enviar o link do aplicativo."
      });
    }

    const aluno = await alunosService.buscar(req.params.id);
    if (!aluno) {
      return res.status(404).json({ ok: false, mensagem: "Aluno não encontrado." });
    }

    const tenantId = texto(req.usuario?.tenantId).toLowerCase();
    if (!tenantId) {
      return res.status(401).json({
        ok: false,
        mensagem: "Sessão sem academia vinculada. Faça login novamente."
      });
    }

    const cpf = cpfAluno(aluno);
    if (cpf.length !== 11) {
      return res.status(400).json({
        ok: false,
        mensagem: "O aluno precisa ter CPF válido para receber o acesso ao aplicativo."
      });
    }

    // O token de primeiro acesso fica embutido no link e nunca precisa ser digitado.
    // Depois que a senha é criada, o aluno usa CPF + senha em qualquer aparelho.
    const acesso = await gerarAtivacaoAlunoERP({
      tenantId,
      cpf,
      validadeMinutos: 1440
    });

    const appUrl =
      `https://www.fusionsistema.com.br/${encodeURIComponent(tenantId)}/apps/aluno` +
      `?acesso=${encodeURIComponent(acesso.codigo)}`;

    const telefoneLocal = String(
      aluno.whatsapp || aluno.telefone || aluno.celular || ""
    ).replace(/\D/g, "");

    let whatsapp = telefoneLocal;
    if (/^\d{10,11}$/.test(whatsapp)) whatsapp = `55${whatsapp}`;
    if (whatsapp && !/^\d{12,13}$/.test(whatsapp)) whatsapp = "";

    const nome = texto(aluno.nome || aluno.nomeCompleto || "");
    const primeiroNome = nome.split(/\s+/).filter(Boolean)[0] || "";
    const mensagem =
      `Olá${primeiroNome ? `, ${primeiroNome}` : ""}! Acesse o Fusion Aluno pelo link abaixo:\n` +
      `${appUrl}\n\n` +
      `No primeiro acesso, crie sua senha. Depois entre com CPF e senha em qualquer celular.`;

    const whatsappUrl = whatsapp
      ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

    return res.json({
      ok: true,
      dados: {
        app_url: appUrl,
        whatsapp,
        whatsapp_url: whatsappUrl,
        expira_em: acesso.expira_em || null,
        mensagem
      }
    });
  } catch (error) {
    erro(res, error, 400);
  }
});

router.post("/:id/app-ativacao", async (req, res) => {
  try {
    if (!podeGerarCodigoApp(req)) {
      return res.status(403).json({
        ok: false,
        mensagem: "Somente administrador, gerente ou recepção pode gerar código do aplicativo."
      });
    }

    const aluno = await alunosService.buscar(req.params.id);
    if (!aluno) {
      return res.status(404).json({ ok: false, mensagem: "Aluno não encontrado." });
    }

    const cpf = cpfAluno(aluno);
    if (cpf.length !== 11) {
      return res.status(422).json({
        ok: false,
        mensagem: "Cadastre um CPF válido para o aluno antes de gerar o código do aplicativo."
      });
    }

    const tenantId = texto(req.usuario?.tenantId);
    if (!tenantId) {
      return res.status(401).json({
        ok: false,
        mensagem: "Sessão sem academia vinculada. Faça login novamente."
      });
    }

    const validade = Number(req.body?.validade_minutos ?? req.body?.validadeMinutos ?? 30);
    const dados = await gerarAtivacaoAlunoERP({
      tenantId,
      cpf,
      validadeMinutos: validade
    });

    return res.json({
      ok: true,
      dados,
      mensagem: `Código gerado para ${dados.aluno_nome || aluno.nome || "o aluno"}.`
    });
  } catch (error) {
    erro(res, error, 400);
  }
});

router.post("/:id/desligar", async (req, res) => {
  try {
    const resultado = await alunosService.desligar(req.params.id, {
      usuario: req.body?.usuario || "sistema",
      motivo: req.body?.motivo || "Desligamento manual do aluno."
    });

    if (!resultado) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    res.json({
      ok: true,
      sucesso: true,
      resultado,
      mensagem: "Aluno desligado. Matrículas e cobranças abertas vinculadas foram canceladas; histórico pago e caixa foram preservados."
    });
  } catch (error) {
    erro(res, error);
  }
});

router.post("/:id/reativar-cobranca", async (req, res) => {
  try {
    const resultado = await alunosService.criarCobrancaReativacao(req.params.id, {
      ...req.body,
      usuario: req.body?.usuario || "sistema",
      motivo: req.body?.motivo || req.body?.motivoReativacao || "Reativação com cobrança no caixa."
    });

    if (!resultado) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    res.json({
      ok: true,
      sucesso: true,
      resultado,
      mensagem: "Cobrança de reativação criada. O próximo vencimento ficou apenas programado; após a baixa no caixa, o aluno será ativado sem criar dívida futura antecipada."
    });
  } catch (error) {
    erro(res, error, 400);
  }
});

router.post("/:id/reativar", async (req, res) => {
  try {
    const resultado = await alunosService.criarCobrancaReativacao(req.params.id, {
      ...req.body,
      usuario: req.body?.usuario || "sistema",
      motivo: req.body?.motivo || req.body?.motivoReativacao || "Reativação com cobrança pendente."
    });

    if (!resultado) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    res.json({
      ok: true,
      sucesso: true,
      resultado,
      mensagem: "Cobrança de reativação criada. O aluno só será ativado após o recebimento confirmado no financeiro."
    });
  } catch (error) {
    erro(res, error, 400);
  }
});

router.get("/:id/prontuario", async (req, res) => {
  try {
    const resultado = await alunosService.prontuario(req.params.id);
    const restricaoAcesso = await consultarBloqueioFinanceiroAluno({
      aluno: resultado?.aluno || {},
      direcao: "entrada"
    });
    if (resultado && typeof resultado === "object") {
      resultado.restricaoAcesso = restricaoAcesso;
    }

    if (!resultado) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    if (!exigirAcessoPortalProfessor(req, res, resultado.aluno || resultado.dados || resultado)) return;
    res.json(req.usuario?.portal ? { ...resultado, aluno: semSenhaAdministrativaAluno(resultado.aluno || {}) } : resultado);
  } catch (error) {
    erro(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const aluno = await alunosService.buscar(req.params.id);

    if (!aluno) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    if (!exigirAcessoPortalProfessor(req, res, aluno)) return;
    res.json(ocultarSenhaParaPortal(req, aluno));
  } catch (error) {
    erro(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const aluno = await alunosService.criar(req.body);
    res.status(201).json({ ok: true, aluno, mensagem: "Aluno cadastrado com sucesso" });
  } catch (error) {
    erro(res, error, 400);
  }
});

router.put("/:id/foto", async (req, res) => {
  try {
    const atual = await alunosService.buscar(req.params.id);
    if (!atual) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    const portalAluno = req.usuario?.portal === true && normalizar(req.usuario?.portalTipo) === "aluno";
    if (portalAluno && !mesmo(req.usuario?.id, req.params.id)) {
      return res.status(403).json({ ok: false, mensagem: "Você só pode alterar a própria foto." });
    }

    const foto = texto(req.body?.foto_base64 || req.body?.fotoBase64 || req.body?.foto);
    if (!fotoAlunoValida(foto)) {
      return res.status(400).json({
        ok: false,
        mensagem: "Foto inválida. Envie uma imagem JPG, PNG ou WEBP válida."
      });
    }

    const aluno = await alunosService.atualizar(req.params.id, { foto_base64: foto });
    if (!aluno) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    res.json({
      ok: true,
      foto_base64: aluno.foto_base64 || foto,
      mensagem: "Foto atualizada com sucesso"
    });
  } catch (error) {
    erro(res, error, 400);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const atual = await alunosService.buscar(req.params.id);
    const solicitaAtivacao = ["ativo", "ativa", "active"].includes(normalizar(req.body?.status || req.body?.situacao));
    const jaAtivo = ["ativo", "ativa", "active"].includes(normalizar(atual?.status || atual?.situacao));
    if (solicitaAtivacao && !jaAtivo) {
      return res.status(409).json({ ok: false, mensagem: "Não ative o aluno pela edição. Use Reativar para criar a cobrança e confirme o pagamento no Financeiro." });
    }
    const aluno = await alunosService.atualizar(req.params.id, req.body);

    if (!aluno) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    // FONTE MESTRA NOME ALUNO - APP 20260826
    // Se o aluno ja usa o aplicativo, propaga o cadastro atual do ERP.
    // Falha na integracao nao desfaz nem bloqueia a edicao do ERP.
    try {
      const tenantId = texto(req.usuario?.tenantId);
      const cpfAtual = String(aluno.cpf || "").replace(/\D/g, "");
      const alunoId = texto(aluno.id || aluno._id || aluno.codigo || req.params.id);

      if (tenantId && cpfAtual.length === 11 && alunoId) {
        let deveSincronizar = true;

        if (typeof statusAplicativoAlunosERP === "function") {
          const statusApp = await statusAplicativoAlunosERP({
            tenantId,
            alunoIds: [alunoId]
          });
          deveSincronizar = statusApp?.[alunoId] === true;
        }

        if (deveSincronizar) {
          await sincronizarAlunoNoApp({
            tenant: tenantId,
            cpfNormalizado: cpfAtual
          });
        }
      }
    } catch (errorSyncApp) {
      console.warn(
        "[ALUNOS] Cadastro ERP salvo; sincronizacao com App nao concluida:",
        errorSyncApp?.message || errorSyncApp
      );
    }

    res.json({ ok: true, aluno, mensagem: "Aluno atualizado com sucesso" });
  } catch (error) {
    erro(res, error, 400);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const resultado = await alunosService.excluir(req.params.id, {
      usuario: req.body?.usuario || "sistema",
      motivo: req.body?.motivo || "Exclusão/desligamento pelo cadastro de alunos.",
      forcar: req.body?.forcar || req.query?.forcar
    });

    if (!resultado?.ok) {
      return res.status(404).json({ ok: false, erro: "Aluno não encontrado", mensagem: "Aluno não encontrado" });
    }

    const mensagem = resultado.desligado
      ? "Aluno possui histórico financeiro e foi desligado com segurança. Cobranças abertas foram canceladas e histórico pago/caixa foi preservado."
      : "Aluno excluído definitivamente. Vínculos abertos foram cancelados.";

    res.json({ ok: true, sucesso: true, resultado, mensagem });
  } catch (error) {
    erro(res, error);
  }
});

export default router;
