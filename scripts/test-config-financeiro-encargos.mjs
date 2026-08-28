import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

process.env.NODE_ENV = "development";
process.env.FUSION_DATABASE_PROVIDER = "json";
process.env.FUSION_JSON_FALLBACK = "true";

const raiz = process.cwd();

const tmp = await fs.mkdtemp(
  path.join(
    os.tmpdir(),
    "fusion-config-financeiro-"
  )
);

const dataDir = path.join(tmp, "data");
await fs.mkdir(dataDir, { recursive: true });

// collection-store fixa DATA_DIR usando process.cwd() durante o import.
// Portanto todos os módulos que tocam persistência precisam ser importados
// somente depois de entrar na pasta temporária.
process.chdir(tmp);

const configModule = await import(
  `../modules/financeiro/configuracao-financeira.service.mjs?cfg=${Date.now()}`
);

const config20 = {
  configurado: true,
  ativo: true,
  multaPercentual: 20,
  jurosDiaPercentual: 0,
  carenciaDias: 0
};

const puro = configModule.calcularEncargosAtraso({
  titulo: {
    id: "tit",
    categoria: "Mensalidades",
    origem: "mensalidades",
    valorCentavos: 6500,
    valorPagoCentavos: 0,
    vencimento: "2026-08-20"
  },
  mensalidade: {
    id: "men",
    origem: "mensalidades",
    vencimento: "2026-08-20"
  },
  plano: { id: "plano" },
  config: config20,
  dataPagamento: "2026-08-28"
});

assert.equal(puro.diasAtraso, 8);
assert.equal(puro.multaPendenteCentavos, 1300);
assert.equal(puro.jurosPendenteCentavos, 0);
assert.equal(puro.valorDevidoCentavos, 7800);

const comJuros =
  configModule.calcularEncargosAtraso({
    titulo: {
      id: "tit",
      categoria: "Mensalidades",
      origem: "mensalidades",
      valorCentavos: 6500,
      valorPagoCentavos: 0,
      vencimento: "2026-08-20"
    },
    mensalidade: {
      id: "men",
      origem: "mensalidades"
    },
    plano: {},
    config: {
      configurado: true,
      ativo: true,
      multaPercentual: 20,
      jurosDiaPercentual: 0.1,
      carenciaDias: 0
    },
    dataPagamento: "2026-08-28"
  });

assert.equal(
  comJuros.multaPendenteCentavos,
  1300
);
assert.equal(
  comJuros.jurosPendenteCentavos,
  52
);
assert.equal(
  comJuros.valorDevidoCentavos,
  7852
);

const inicial =
  configModule.calcularEncargosAtraso({
    titulo: {
      categoria: "Matrículas",
      origem: "matricula_inicial_unificada",
      valorCentavos: 13000,
      vencimento: "2026-08-01"
    },
    mensalidade: {
      id: "inicial",
      origem: "matricula_inicial_unificada"
    },
    config: config20,
    dataPagamento: "2026-08-28"
  });

assert.equal(
  inicial.encargosPendentesCentavos,
  0
);
assert.equal(
  inicial.motivo,
  "nao_mensalidade_recorrente"
);

const base = {
  "financeiro_config.json": {
    atraso: {
      ativo: true,
      multaPercentual: 20,
      jurosDiaPercentual: 0,
      carenciaDias: 0
    }
  },
  "planos.json": [
    {
      id: "plano_mensal",
      nome: "MensAL",
      status: "Ativo",
      multaAtrasoPercentual: 5
    }
  ],
  "alunos.json": [
    {
      id: "aluno_teste",
      nome: "Aluno Teste",
      status: "ativo"
    }
  ],
  "matriculas.json": [
    {
      id: "mat_teste",
      alunoId: "aluno_teste",
      planoId: "plano_mensal",
      status: "Ativa"
    }
  ],
  "mensalidades.json": [
    {
      id: "men_teste",
      alunoId: "aluno_teste",
      matriculaId: "mat_teste",
      planoId: "plano_mensal",
      competencia: "2026-08",
      vencimento: "2026-08-20",
      valor: 65,
      valorOriginal: 65,
      valorPago: 0,
      valorRestante: 65,
      saldoRestante: 65,
      status: "atrasado",
      origem: "mensalidades",
      lancamentoFinanceiroId: "tit_teste"
    }
  ],
  "financeiro.json": [
    {
      id: "tit_teste",
      tipo: "receber",
      categoria: "Mensalidades",
      origem: "mensalidades",
      mensalidadeId: "men_teste",
      matriculaId: "mat_teste",
      planoId: "plano_mensal",
      alunoId: "aluno_teste",
      alunoFornecedor: "Aluno Teste",
      descricao:
        "Mensalidade Aluno Teste - 2026-08",
      valor: 65,
      valorCentavos: 6500,
      valorPago: 0,
      valorPagoCentavos: 0,
      vencimento: "2026-08-20",
      status: "Aberto"
    }
  ],
  "taxas_cartao.json": [
    {
      bandeira: "Elo",
      modalidade: "debito",
      parcelas: 1,
      percentual: 1.35,
      taxaFixa: 0,
      descricao: "Débito Elo"
    }
  ]
};

for (const [arquivo, dados] of Object.entries(base)) {
  await fs.writeFile(
    path.join(dataDir, arquivo),
    JSON.stringify(dados, null, 2)
  );
}

try {
  const ledger = await import(
    `../modules/financeiro/financeiro-ledger.service.mjs?cfg=${Date.now()}`
  );

  const caixa = await import(
    `../modules/financeiro/caixa.service.mjs?cfg=${Date.now()}`
  );

  await ledger.garantirEstruturaFinanceira();

  await caixa.abrirCaixa({
    valorAbertura: 0,
    responsavel: "Teste config financeiro"
  });

  const preview =
    await ledger.calcularEncargosAtrasoTitulo(
      "tit_teste",
      "2026-08-28"
    );

  assert.equal(
    preview.multaPercentual,
    20
  );
  assert.equal(
    preview.multaPendente,
    13
  );
  assert.equal(
    preview.valorDevido,
    78
  );

  const baixa = await ledger.receberTitulos({
    operacaoId: "op_config_fin_1",
    tituloId: "tit_teste",
    valorAplicado: 78,
    valorPago: 78,
    valorRecebido: 78,
    valorEntregue: 78,
    dataPagamento: "2026-08-28",
    formaPagamento: "Cartão de Débito",
    bandeiraCartao: "Elo",
    modalidadeCartao: "debito",
    parcelasCartao: 1,

    taxaOperadoraPercentual: 99,
    taxaOperadoraFixa: 25,
    taxaOperadoraValor: 77,

    usuario: "teste"
  });

  assert.equal(
    baixa.lancamento.status,
    "Pago"
  );
  assert.equal(
    baixa.lancamento.acrescimo,
    13
  );
  assert.equal(
    baixa.lancamento.multaAtrasoAplicada,
    13
  );
  assert.equal(
    baixa.lancamento.taxaOperadoraPercentual,
    1.35
  );
  assert.equal(
    baixa.lancamento.ultimaTaxaOperadoraValor,
    1.05
  );
  assert.equal(
    baixa.lancamento.valorLiquido,
    76.95
  );

  await ledger.estornarRecibo(
    baixa.recibo.id,
    {
      operacaoId: "op_config_fin_estorno",
      motivo: "Teste de estorno",
      usuario: "teste"
    }
  );

  const reaberto =
    (await ledger.listarTitulos()).find(
      (item) => item.id === "tit_teste"
    );

  assert.equal(reaberto.status, "Aberto");
  assert.equal(reaberto.valorRestante, 65);
  assert.equal(reaberto.acrescimo, 0);
  assert.equal(
    reaberto.multaAtrasoAplicada,
    0
  );

  const preview2 =
    await ledger.calcularEncargosAtrasoTitulo(
      "tit_teste",
      "2026-08-28"
    );

  assert.equal(
    preview2.multaPendente,
    13
  );

  console.log(JSON.stringify({
    ok: true,
    modulo: "config-financeiro-encargos",
    painelAdministrativoAutoridade: true,
    mensalidade65ComMulta20Total78: true,
    jurosDiarioConfiguravel: true,
    matriculaInicialSemEncargo: true,
    taxaOperadoraServidorAutoridade: true,
    taxaElo135AplicadaAutomaticamente: true,
    estornoRestauraEncargos: true,
    dadosPessoaisExibidos: false
  }, null, 2));
} finally {
  process.chdir(raiz);
  await fs.rm(
    tmp,
    {
      recursive: true,
      force: true
    }
  );
}

const [
  financeiroHtml,
  financeiroJs,
  configHtml,
  configJs,
  configIndex,
  planosHtml,
  planosJs,
  routes,
  ledgerSource,
  mensalidadesSource
] = await Promise.all([
  fs.readFile(
    path.join(
      raiz,
      "public/pages/financeiro/index.html"
    ),
    "utf8"
  ),
  fs.readFile(
    path.join(
      raiz,
      "public/pages/financeiro/financeiro.js"
    ),
    "utf8"
  ),
  fs.readFile(
    path.join(
      raiz,
      "public/pages/configuracoes/financeiro.html"
    ),
    "utf8"
  ),
  fs.readFile(
    path.join(
      raiz,
      "public/pages/configuracoes/financeiro.js"
    ),
    "utf8"
  ),
  fs.readFile(
    path.join(
      raiz,
      "public/pages/configuracoes/index.html"
    ),
    "utf8"
  ),
  fs.readFile(
    path.join(
      raiz,
      "public/pages/planos/index.html"
    ),
    "utf8"
  ),
  fs.readFile(
    path.join(
      raiz,
      "public/pages/planos/planos.js"
    ),
    "utf8"
  ),
  fs.readFile(
    path.join(
      raiz,
      "modules/financeiro/financeiro.routes.mjs"
    ),
    "utf8"
  ),
  fs.readFile(
    path.join(
      raiz,
      "modules/financeiro/financeiro-ledger.service.mjs"
    ),
    "utf8"
  ),
  fs.readFile(
    path.join(
      raiz,
      "modules/financeiro/mensalidades.service.mjs"
    ),
    "utf8"
  )
]);

assert.doesNotMatch(
  financeiroHtml,
  /id="btnTaxasCartao"/
);
assert.doesNotMatch(
  financeiroHtml,
  /id="btnAbrirTaxasNoRecebimento"/
);
assert.doesNotMatch(
  financeiroHtml,
  /id="modalTaxasCartao"/
);
assert.match(
  financeiroHtml,
  /Taxa % automática/
);
assert.match(
  financeiroHtml,
  /Multa por atraso \(automática\)/
);
assert.match(
  financeiroHtml,
  /Juros por atraso \(automáticos\)/
);
assert.match(
  financeiroHtml,
  /20260828-config-financeiro-encargos-1/
);

assert.match(
  financeiroJs,
  /atualizarEncargosAtrasoBaixa/
);
assert.match(
  financeiroJs,
  /encargos-atraso\?dataPagamento=/
);
assert.match(
  financeiroJs,
  /acrescimoTotalBaixa/
);

assert.match(
  configHtml,
  /Encargos por atraso/
);
assert.match(
  configHtml,
  /Taxas de recebimento/
);
assert.match(
  configJs,
  /configuracao-atraso/
);
assert.match(
  configJs,
  /taxas-cartao/
);
assert.match(
  configIndex,
  /Configurações financeiras/
);

assert.doesNotMatch(
  planosHtml,
  /id="multaAtrasoPercentual"/
);
assert.doesNotMatch(
  planosJs,
  /multaAtrasoPercentual/
);
assert.match(
  planosHtml,
  /Configurações financeiras/
);

assert.match(
  routes,
  /podeConfigurarFinanceiro/
);
assert.match(
  routes,
  /configuracao-atraso/
);
assert.match(
  ledgerSource,
  /calcularEncargosAtrasoTitulo/
);
assert.match(
  ledgerSource,
  /multaAtrasoAplicadaCentavos/
);
assert.match(
  ledgerSource,
  /taxaConfigurada\s*\?/
);
assert.match(
  mensalidadesSource,
  /obterConfiguracaoAtraso/
);

assert.doesNotMatch(
  mensalidadesSource,
  /numero\(config\.multaPercentual,\s*2\)/
);
assert.doesNotMatch(
  mensalidadesSource,
  /numero\(config\.jurosDiaPercentual,\s*0\.033\)/
);
