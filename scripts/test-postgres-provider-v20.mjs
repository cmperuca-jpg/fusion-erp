import assert from "node:assert/strict";

const { executarComTenant } =
  await import("../modules/core/persistence/tenant-context.mjs");

const {
  verificarPersistenciaTransacional,
  lerColecao,
  salvarColecoesAtomicas
} = await import("../modules/core/persistence/collection-store.mjs");

const {
  obterPostgresPool,
  encerrarPostgres
} = await import("../config/postgres.mjs");

const {
  localizarTenantPorEmail,
  sincronizarIndiceUsuario
} = await import("../modules/auth/tenant-registry.service.mjs");

const {
  selecionarAcademia,
  validarTokenSelecaoAcademia
} = await import("../modules/auth/academy-access.service.mjs");

await verificarPersistenciaTransacional();

await executarComTenant("tenant-a", async () => {
  await salvarColecoesAtomicas({
    teste: [
      { id: "r1", nome: "Primeiro" },
      { id: "r2", nome: "Segundo" }
    ]
  });

  const lidos = await lerColecao("teste", []);
  assert.equal(lidos.length, 2);
  assert.equal(lidos[0].id, "r1");
  assert.equal(lidos[1].id, "r2");

  await salvarColecoesAtomicas({
    documento: { ativo: true, valor: 42 }
  });

  assert.deepEqual(
    await lerColecao("documento", null),
    { ativo: true, valor: 42 }
  );
});

await executarComTenant("tenant-b", async () => {
  await salvarColecoesAtomicas({
    teste: [{ id: "b1", nome: "Isolado" }]
  });
  const lidos = await lerColecao("teste", []);
  assert.equal(lidos.length, 1);
  assert.equal(lidos[0].id, "b1");
});

await executarComTenant("tenant-a", async () => {
  const antes = await lerColecao("teste", []);

  let falhou = false;
  try {
    await salvarColecoesAtomicas({
      teste: [{ id: "novo", nome: "Não pode persistir" }],
      quebrar: [{ id: "x", valor: 1n }]
    });
  } catch {
    falhou = true;
  }

  assert.equal(falhou, true);
  assert.deepEqual(await lerColecao("teste", []), antes);
});

const db = obterPostgresPool({ obrigatorio: true });

await db.query(
  `INSERT INTO public.fusion_tenants
    (tenant_id,slug,name,status,access_code)
   VALUES ('academia-teste-local','academia-teste-local','Academia Teste Local','active','ABCD1234')`
);

await sincronizarIndiceUsuario(
  {
    id: "usr_teste",
    email: "teste-local@fusion.invalid",
    perfil: "Administrador",
    status: "ativo"
  },
  "academia-teste-local"
);

const indice = await localizarTenantPorEmail("teste-local@fusion.invalid");
assert.equal(indice.tenant_id, "academia-teste-local");
assert.equal(indice.user_id, "usr_teste");

const selecao = await selecionarAcademia(
  { academia: "academia-teste-local", codigo: "ABCD1234" },
  { ip: "127.0.0.1" }
);

assert.equal(selecao.ok, true);
assert.equal(selecao.tenantId, "academia-teste-local");

const token = validarTokenSelecaoAcademia(
  selecao.selectionToken,
  "academia-teste-local"
);
assert.equal(token.tenantId, "academia-teste-local");

await encerrarPostgres();
console.log("POSTGRES_PROVIDER_V20_OK");
