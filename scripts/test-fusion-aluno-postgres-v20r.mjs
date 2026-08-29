import assert from "node:assert/strict";
import {
  gerarAtivacaoAlunoERP,
  primeiroAcessoAlunoApp,
  loginAlunoApp,
  statusAplicativoAlunosERP
} from "../modules/treinos/aluno-app.service.mjs";
import {
  requestAlunoAppPostgres,
  buscarAlunoErpPorCpfPostgres,
  listarRegistrosAlunoErpPostgres
} from "../modules/treinos/aluno-app-postgres.repository.mjs";
import { encerrarPostgres, obterPostgresPool } from "../config/postgres.mjs";

const TENANT = "academia-teste";
const LEGACY = "aluno-v20r-001";
const CPF = "12345678901";
const PASSWORD = "Teste12345";

try {
  assert.equal(process.env.FUSION_DATABASE_PROVIDER, "postgres");
  assert.equal(process.env.SUPABASE_URL || "", "");
  assert.equal(process.env.FUSION_APP_SUPABASE_URL || "", "");

  const db = obterPostgresPool({ obrigatorio: true });

  await db.query(
    `INSERT INTO public.fusion_tenants(tenant_id,slug,name,status,created_at,updated_at)
     VALUES ($1,$1,'Academia Teste','active',now(),now())`,
    [TENANT]
  );

  await db.query(
    `INSERT INTO public.fusion_v3_records(tenant_id,collection,record_id,payload,updated_at,position)
     VALUES ($1,'alunos',$2,$3::jsonb,now(),0)`,
    [TENANT, LEGACY, JSON.stringify({
      id: LEGACY,
      nome: "Aluno Teste V20R",
      cpf: CPF,
      telefone: "82999998888",
      dataNascimento: "1990-01-02",
      numeroMatricula: "T001",
      status: "ativo"
    })]
  );

  await db.query(
    `INSERT INTO public.fusion_v3_records(tenant_id,collection,record_id,payload,updated_at,position)
     VALUES ($1,'matriculas','mat-v20r',$2::jsonb,now(),0)`,
    [TENANT, JSON.stringify({ id: "mat-v20r", alunoId: LEGACY, status: "ativa", plano: "Teste" })]
  );

  const erp = await buscarAlunoErpPorCpfPostgres(TENANT, CPF);
  assert.equal(erp.length, 1);
  assert.equal(erp[0].record_id, LEGACY);

  const matriculas = await listarRegistrosAlunoErpPostgres(TENANT, "matriculas", LEGACY, 10);
  assert.equal(matriculas.length, 1);

  let erroLogin = null;
  try {
    await loginAlunoApp({ tenant: TENANT, cpf: CPF, senha: PASSWORD });
  } catch (error) {
    erroLogin = error;
  }
  assert.equal(erroLogin?.code, "FIRST_ACCESS_REQUIRED");
  assert.equal(erroLogin?.statusCode, 409);

  const ativacao = await gerarAtivacaoAlunoERP({ tenantId: TENANT, cpf: CPF, validadeMinutos: 30 });
  assert.match(ativacao.codigo, /^[0-9A-F]{8}$/);
  assert.equal(ativacao.aluno_nome, "Aluno Teste V20R");

  const primeiro = await primeiroAcessoAlunoApp({
    tenant: TENANT,
    access_code: ativacao.codigo,
    cpf: CPF,
    senha: PASSWORD,
    confirmar_senha: PASSWORD
  });
  assert.match(primeiro?.session?.access_token || "", /^[0-9a-f]{64}$/);
  assert.match(primeiro?.session?.refresh_token || "", /^[0-9a-f]{64}$/);
  assert.match(primeiro?.session?.fusion_session_id || "", /^[0-9a-f]{64}$/);

  const primeiroValido = await requestAlunoAppPostgres(
    "/rest/v1/rpc/fusion_app_validar_sessao_unica",
    { body: { p_usuario_id: primeiro.user.id, p_session_id: primeiro.session.fusion_session_id } }
  );
  assert.equal(primeiroValido, true);

  const login = await loginAlunoApp({ tenant: TENANT, cpf: CPF, senha: PASSWORD });
  assert.match(login?.session?.access_token || "", /^[0-9a-f]{64}$/);
  assert.notEqual(login.session.fusion_session_id, primeiro.session.fusion_session_id);

  const antigoValido = await requestAlunoAppPostgres(
    "/rest/v1/rpc/fusion_app_validar_sessao_unica",
    { body: { p_usuario_id: primeiro.user.id, p_session_id: primeiro.session.fusion_session_id } }
  );
  assert.equal(antigoValido, false);

  const novoValido = await requestAlunoAppPostgres(
    "/rest/v1/rpc/fusion_app_validar_sessao_unica",
    { body: { p_usuario_id: login.user.id, p_session_id: login.session.fusion_session_id } }
  );
  assert.equal(novoValido, true);

  const usuario = await requestAlunoAppPostgres("/auth/v1/user", { accessToken: login.session.access_token });
  assert.equal(usuario.id, login.user.id);

  const renovada = await requestAlunoAppPostgres(
    "/auth/v1/token?grant_type=refresh_token",
    { body: { refresh_token: login.session.refresh_token } }
  );
  assert.match(renovada.access_token, /^[0-9a-f]{64}$/);
  assert.match(renovada.refresh_token, /^[0-9a-f]{64}$/);

  const indicador = await statusAplicativoAlunosERP({ tenantId: TENANT, alunoIds: [LEGACY] });
  assert.equal(indicador[LEGACY], true);

  console.log("FUSION_ALUNO_POSTGRES_V20R_OK");
} finally {
  await encerrarPostgres();
}
