const PROVEDORES = Object.freeze({
  regras_local: {
    id: "regras_local",
    nome: "Motor local por regras",
    tipo: "deterministico",
    externo: false
  },

  groq: {
    id: "groq",
    nome: "Groq",
    tipo: "llm",
    externo: true
  },

  openrouter: {
    id: "openrouter",
    nome: "OpenRouter",
    tipo: "llm",
    externo: true
  },

  ollama: {
    id: "ollama",
    nome: "Ollama",
    tipo: "llm_local",
    externo: false
  }
});

function texto(valor) {
  return String(valor ?? "").trim();
}

function configurado(id) {
  if (id === "regras_local") return true;

  if (id === "groq") {
    return Boolean(
      texto(process.env.GROQ_API_KEY)
    );
  }

  if (id === "openrouter") {
    return Boolean(
      texto(process.env.OPENROUTER_API_KEY)
    );
  }

  if (id === "ollama") {
    return Boolean(
      texto(process.env.OLLAMA_BASE_URL)
    );
  }

  return false;
}

export function obterStatusProvedoresAssistente() {
  const solicitado =
    texto(
      process.env.FUSION_TREINO_AI_PROVIDER
    ) || "regras_local";

  const selecionado =
    PROVEDORES[solicitado]
      ? solicitado
      : "regras_local";

  return {
    selecionado,

    chamadasExternasHabilitadas: false,

    observacao:
      "A camada de provedores está pronta, mas chamadas LLM externas permanecem desabilitadas nesta etapa.",

    provedores:
      Object.values(PROVEDORES).map(item => ({
        ...item,
        configurado: configurado(item.id),

        habilitadoAgora:
          item.id === "regras_local"
      }))
  };
}

export function obterProvedorAssistente(id = "") {
  const chave =
    texto(id) ||
    texto(
      process.env.FUSION_TREINO_AI_PROVIDER
    ) ||
    "regras_local";

  return PROVEDORES[chave] ||
    PROVEDORES.regras_local;
}

/*
 * Esta função é deliberadamente bloqueada.
 * A interface está criada para permitir Groq/OpenRouter/Ollama
 * posteriormente sem acoplar o Montador a um fornecedor.
 */
export async function executarProvedorAssistente(
  _payload = {},
  { provedor = "" } = {}
) {
  const escolhido =
    obterProvedorAssistente(provedor);

  const erro = new Error(
    escolhido.id === "regras_local"
      ? "O motor local continua sendo executado pelo Montador atual."
      : "Chamadas externas de IA ainda não foram habilitadas."
  );

  erro.statusCode = 409;
  erro.code = "AI_PROVIDER_NOT_ENABLED";

  throw erro;
}
