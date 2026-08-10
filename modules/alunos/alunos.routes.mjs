import { Router } from "express";
import * as alunosService from "./alunos.service.mjs";
import { gerarAtivacaoAlunoERP } from "../treinos/aluno-app.service.mjs";

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

function filtrarAlunosPorPortal(req, alunos = []) {
  if (!usuarioPortalProfessor(req) || responsavelTecnico(req)) return alunos;
  return alunos.filter(aluno => alunoPertenceAoProfessor(aluno, req.usuario));
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
    res.json(filtrarAlunosPorPortal(req, alunos).map(aluno => ocultarSenhaParaPortal(req, aluno)));
  } catch (error) {
    erro(res, error);
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
