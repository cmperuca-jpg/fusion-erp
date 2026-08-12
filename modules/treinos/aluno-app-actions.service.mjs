import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { executarComTenant, normalizarTenantId } from "../core/persistence/tenant-context.mjs";
import { gerarTokenPortal } from "../auth/auth.service.mjs";
import * as alunosService from "../alunos/alunos.service.mjs";
import {
  liberarCatracaPortalAluno,
  obterContadorCatracaPortalAluno
} from "./treinos.service.mjs";
import { obterHomeAlunoApp } from "./aluno-app.service.mjs";

const FOTO_MAX_CHARS = 4_000_000;

function erroHttp(mensagem, statusCode = 400, code = "") {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  erro.code = code;
  return erro;
}

function texto(valor = "") {
  return String(valor ?? "").trim();
}

function fotoValida(foto = "") {
  const valor = texto(foto);
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(valor)
    && valor.length > 300
    && valor.length <= FOTO_MAX_CHARS;
}

async function localizarRegistroERP(legacyId = "") {
  const id = texto(legacyId);
  if (!id) {
    throw erroHttp(
      "Aluno ainda não está vinculado ao cadastro principal do Fusion ERP.",
      409,
      "ERP_STUDENT_NOT_LINKED"
    );
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const tabela = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";
  const { data, error } = await supabase
    .from(tabela)
    .select("tenant_id,record_id,payload")
    .eq("collection", "alunos")
    .eq("record_id", id)
    .limit(3);

  if (error) {
    throw erroHttp(
      `Falha ao localizar o aluno no Fusion ERP: ${error.message}`,
      502,
      "ERP_STUDENT_LOOKUP_FAILED"
    );
  }

  const linhas = Array.isArray(data) ? data : [];
  if (!linhas.length) {
    throw erroHttp("Aluno não encontrado no Fusion ERP.", 404, "ERP_STUDENT_NOT_FOUND");
  }

  // Defesa multiempresa: nunca escolhe uma academia por aproximação.
  // Se o mesmo legacy_id aparecer em mais de um tenant, bloqueia a ação.
  if (linhas.length !== 1) {
    throw erroHttp(
      "Vínculo do aluno é ambíguo entre academias. Procure a recepção.",
      409,
      "ERP_STUDENT_TENANT_AMBIGUOUS"
    );
  }

  const linha = linhas[0];
  const tenantId = normalizarTenantId(linha.tenant_id);
  if (!tenantId) {
    throw erroHttp("Academia do aluno não identificada.", 409, "ERP_TENANT_NOT_FOUND");
  }

  return {
    tenantId,
    legacyId: texto(linha.record_id),
    aluno: linha.payload && typeof linha.payload === "object" ? linha.payload : {}
  };
}

async function identidadeAlunoApp(req, res, deviceToken) {
  // Reutiliza a mesma validação do /aluno-app/me:
  // dispositivo ativo + sessão httpOnly válida + usuário dono do cadastro.
  const home = await obterHomeAlunoApp(req, res, deviceToken);
  const legacyId = texto(home?.aluno?.legacy_id);
  const registro = await localizarRegistroERP(legacyId);
  return { ...registro, home };
}

function tokenEfemeroAluno(alunoId) {
  return gerarTokenPortal({
    sub: alunoId,
    tipo: "aluno",
    perfil: "aluno",
    permissoes: ["aluno-treinos", "aluno-avaliacao"]
  });
}

export async function atualizarFotoAlunoApp(req, res, deviceToken, payload = {}) {
  const foto = texto(payload.foto_base64 || payload.fotoBase64 || payload.foto);
  if (!fotoValida(foto)) {
    throw erroHttp(
      "Foto inválida ou muito grande. Use JPG, PNG ou WEBP.",
      400,
      "INVALID_STUDENT_PHOTO"
    );
  }

  const identidade = await identidadeAlunoApp(req, res, deviceToken);

  const aluno = await executarComTenant(identidade.tenantId, () =>
    alunosService.atualizar(identidade.legacyId, { foto_base64: foto })
  );

  if (!aluno) {
    throw erroHttp("Aluno não encontrado para atualizar a foto.", 404, "ERP_STUDENT_NOT_FOUND");
  }

  return {
    alunoId: identidade.legacyId,
    foto: texto(aluno.foto_base64 || aluno.fotoBase64 || aluno.foto || foto),
    mensagem: "Foto atualizada com sucesso."
  };
}

export async function liberarCatracaAlunoApp(req, res, deviceToken, payload = {}) {
  const identidade = await identidadeAlunoApp(req, res, deviceToken);
  const direcao = texto(payload.direcao).toLowerCase() === "saida" ? "saida" : "entrada";

  return executarComTenant(identidade.tenantId, async () => {
    // Token nunca é enviado ao navegador; existe apenas durante esta chamada
    // para reutilizar o fluxo antigo já testado de limite + access-engine.
    const token = tokenEfemeroAluno(identidade.legacyId);
    return liberarCatracaPortalAluno({
      alunoId: identidade.legacyId,
      token,
      direcao
    });
  });
}

export async function contadorCatracaAlunoApp(req, res, deviceToken) {
  const identidade = await identidadeAlunoApp(req, res, deviceToken);

  return executarComTenant(identidade.tenantId, async () => {
    const token = tokenEfemeroAluno(identidade.legacyId);
    return obterContadorCatracaPortalAluno({
      alunoId: identidade.legacyId,
      token
    });
  });
}
