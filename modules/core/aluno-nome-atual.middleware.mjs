import { listarAlunos } from "../alunos/alunos.repository.mjs";

const CAMPOS_NOME = [
  "aluno",
  "alunoNome",
  "aluno_nome",
  "nomeAluno",
  "nome_aluno",
  "pessoa",
  "pessoaNome",
  "pessoa_nome",
  "nomePessoa",
  "nome_pessoa",
  "cliente",
  "clienteNome",
  "cliente_nome",
  "nomeCliente",
  "nome_cliente",
  "alunoFornecedor"
];

// NORMALIZACAO DESCRICAO NOME ALUNO 20260826
// Campos operacionais podem guardar o nome do aluno com aliases diferentes.
// Todos servem apenas para descobrir o snapshot antigo da mesma pessoa.
function nomesSnapshotDoRegistro(item = {}) {
  const nomes = [];

  for (const [chave, valor] of Object.entries(item || {})) {
    if (typeof valor !== "string") continue;

    const k = String(chave || "").toLowerCase();
    const pareceNome =
      k.includes("aluno") ||
      k.includes("cliente") ||
      k.includes("pessoa");

    if (!pareceNome) continue;

    const nome = texto(valor);
    if (nome && nome.length >= 3) nomes.push(nome);
  }

  return [...new Set(nomes)];
}

function texto(valor) {
  return String(valor ?? "").trim();
}

function idAlunoDoRegistro(item = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return "";

  // RESOLVE ALUNOID EM REFERENCIAS 20260826
  // Relatorios/BI consolidam alguns registros e movem os IDs para "referencias".
  // A fonte mestra deve continuar funcionando mesmo depois dessa transformacao.
  return texto(
    item.alunoId ||
    item.aluno_id ||
    item.idAluno ||
    item.alunoCodigo ||
    item.aluno_codigo ||
    item?.aluno?.id ||
    item?.aluno?.alunoId ||
    item?.referencias?.alunoId ||
    item?.referencias?.aluno_id ||
    item?.referencias?.idAluno ||
    item?.referencias?.alunoCodigo ||
    item?.referencias?.aluno_codigo
  );
}

function nomeAlunoAtual(aluno = {}) {
  return texto(
    aluno.nome ||
    aluno.nomeCompleto ||
    aluno.nome_completo ||
    aluno.alunoNome ||
    aluno.aluno
  );
}

function idAlunoAtual(aluno = {}) {
  return texto(
    aluno.id ||
    aluno._id ||
    aluno.codigo ||
    aluno.alunoId ||
    aluno.aluno_id
  );
}

function escaparRegex(valor) {
  return String(valor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function substituirNomeEmTexto(valor, antigos, atual) {
  let saida = String(valor ?? "");
  for (const antigo of antigos) {
    const a = texto(antigo);
    if (!a || a === atual) continue;
    saida = saida.replace(new RegExp(escaparRegex(a), "gi"), atual);
  }
  return saida;
}

function hidratarObjeto(item, nomesPorId) {
  if (Array.isArray(item)) {
    return item.map((valor) => hidratarObjeto(valor, nomesPorId));
  }
  if (!item || typeof item !== "object") return item;

  const idAluno = idAlunoDoRegistro(item);
  const nomeAtual = idAluno ? nomesPorId.get(idAluno) : "";
  const saida = {};

  for (const [chave, valor] of Object.entries(item)) {
    saida[chave] = hidratarObjeto(valor, nomesPorId);
  }

  if (!nomeAtual) return saida;

  const nomesAntigos = [
    ...CAMPOS_NOME
      .map((campo) => typeof item[campo] === "string" ? texto(item[campo]) : "")
      .filter(Boolean),
    ...nomesSnapshotDoRegistro(item)
  ];

  for (const [campo, valor] of Object.entries(item)) {
    if (typeof valor !== "string" || !texto(valor)) continue;

    const k = String(campo || "").toLowerCase();
    const pareceCampoNome =
      CAMPOS_NOME.includes(campo) ||
      k.includes("alunonome") ||
      k.includes("aluno_nome") ||
      k.includes("pessoanome") ||
      k.includes("pessoa_nome") ||
      k.includes("clientenome") ||
      k.includes("cliente_nome") ||
      k.includes("nomealuno") ||
      k.includes("nome_aluno") ||
      k.includes("nomepessoa") ||
      k.includes("nome_pessoa") ||
      k.includes("nomecliente") ||
      k.includes("nome_cliente");

    if (pareceCampoNome) saida[campo] = nomeAtual;
  }

  if (typeof item.descricao === "string") {
    // Inclui tambem o proprio nome atual entre os candidatos.
    // Isso corrige somente capitalizacao quando a descricao contem
    // "ariana silva..." e o cadastro atual contem "ARIANA SILVA...".
    // Os snapshots antigos continuam cobrindo correcoes de grafia.
    const candidatosDescricao = [...new Set([...nomesAntigos, nomeAtual].filter(Boolean))];
    saida.descricao = substituirNomeEmTexto(
      item.descricao,
      candidatosDescricao,
      nomeAtual
    );
  }

  return saida;
}

function extrairListaAlunos(payload) {
  if (Array.isArray(payload)) return payload;
  for (const chave of ["alunos", "dados", "items", "resultado"]) {
    if (Array.isArray(payload?.[chave])) return payload[chave];
  }
  return [];
}

export async function nomesAtuaisAlunoMiddleware(req, res, next) {
  if (String(req.method || "").toUpperCase() !== "GET") return next();

  try {
    const alunosPayload = await listarAlunos();
    const alunos = extrairListaAlunos(alunosPayload);
    const nomesPorId = new Map();

    for (const aluno of alunos) {
      const id = idAlunoAtual(aluno);
      const nome = nomeAlunoAtual(aluno);
      if (id && nome) nomesPorId.set(id, nome);
    }

    if (!nomesPorId.size) return next();

    const jsonOriginal = res.json.bind(res);
    res.json = (payload) => {
      try {
        res.setHeader("X-Fusion-Nome-Aluno", "fonte-mestra");
        return jsonOriginal(hidratarObjeto(payload, nomesPorId));
      } catch (error) {
        console.warn(
          "[NOME ALUNO] Falha ao hidratar resposta; enviando payload original:",
          error?.message || error
        );
        return jsonOriginal(payload);
      }
    };
  } catch (error) {
    console.warn(
      "[NOME ALUNO] Fonte mestra indisponivel; resposta mantida sem hidratacao:",
      error?.message || error
    );
  }

  return next();
}
