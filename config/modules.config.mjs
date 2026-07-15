export const OFFICIAL_MODULES = Object.freeze([
  "auth", "alunos", "professores", "planos", "modalidades", "turmas", "agenda",
  "agenda-operacional", "checkin", "matriculas", "financeiro", "avaliacoes", "treinos",
  "cobranca", "bi", "presencas", "frequencia", "operacao", "comercial", "natacao",
  "fidelidade", "backup", "importador-access", "aparencia",
  "access-engine", "henry7x", "access-bridge"
]);

export const LEGACY_OR_CONSOLIDATION_CANDIDATES = Object.freeze([
  "biometria", "estoque", "portal-aluno", "portal-aluno-operacional",
  "portal-professor", "professor-painel"
]);

export const ARCHITECTURE_RULES = Object.freeze({
  reuseBeforeCreate: true,
  oneOfficialModulePerPurpose: true,
  productionDatabase: "supabase",
  productionStorage: "supabase-storage",
  localHardwareBoundary: ["biometria", "catraca"],
  patchDelivery: "somente arquivos alterados em ZIP"
});


export const INFRASTRUCTURE_MODULES = Object.freeze(["security", "core"]);

export const CANONICAL_PORTALS = Object.freeze({
  aluno: {
    page: "/pages/aluno-login/index.html",
    loginApi: "/api/treinos/aluno-login",
    legacyPages: [
      "/pages/portal-aluno/",
      "/pages/portal-aluno/index.html",
      "/pages/portal-aluno-operacional/",
      "/pages/portal-aluno-operacional/index.html"
    ],
    compatibilityModules: ["portal-aluno", "portal-aluno-operacional"]
  },
  professor: {
    page: "/pages/professor-area/index.html",
    loginPage: "/pages/professor-login/index.html",
    legacyPages: [
      "/pages/portal-professor/",
      "/pages/portal-professor/index.html",
      "/pages/professor-painel/",
      "/pages/professor-painel/index.html"
    ],
    compatibilityModules: ["portal-professor", "professor-painel"]
  }
});


export const CANONICAL_TRAINING = Object.freeze({
  module: "treinos",
  api: "/api/treinos",
  libraryApi: "/api/treinos/biblioteca",
  pages: {
    admin: "/pages/treinos/index.html",
    aluno: "/pages/aluno-treinos/index.html"
  },
  compatibilityModules: [
    "biblioteca-inteligente", "exercicios", "exercicios-biblioteca",
    "modelos-treino", "treinos-ciclo", "treinos-consolidacao",
    "treinos-editor", "treinos-integrado", "treinos-montador",
    "treinos-operacional"
  ],
  compatibilityRoot: "modules/treinos/compat",
  policy: "consolidated-under-canonical-module"
});


export const CANONICAL_FINANCE = Object.freeze({
  module: "financeiro",
  apis: {
    financeiro: "/api/financeiro",
    mensalidades: "/api/mensalidades",
    caixa: "/api/caixa",
    recebimentos: "/api/recebimentos"
  },
  pages: {
    financeiro: "/pages/financeiro/index.html",
    mensalidades: "/pages/mensalidades/index.html",
    caixa: "/pages/caixa/index.html",
    recebimentos: "/pages/recebimentos/index.html"
  },
  consolidatedLegacyModules: ["mensalidades"]
});


export const CANONICAL_COMMERCIAL = Object.freeze({
  module: "comercial",
  components: {
    contratos: "modules/comercial",
    crm: "modules/comercial/crm",
    chat: "modules/comercial/chat",
    matriculaOnline: "modules/comercial/matricula-online"
  },
  apis: {
    comercial: "/api/comercial",
    leads: "/api/leads",
    siteChat: "/api/site-chat",
    matriculaOnline: "/api/matricula-online"
  },
  pages: {
    site: "/pages/comercial/index.html",
    painel: "/pages/comercial-painel/index.html",
    chat: "/pages/site-chat/index.html",
    matriculaOnline: "/pages/matricula-online/index.html"
  },
  consolidatedLegacyModules: ["leads", "site-chat", "matricula-online"]
});
