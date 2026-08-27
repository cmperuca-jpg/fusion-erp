;(() => {
  const palavrasIgnoradas = new Set([
    "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos",
    "e", "em", "na", "nas", "no", "nos", "o", "os", "para", "pela",
    "pelas", "pelo", "pelos", "por", "sem", "cabo", "maquina", "aparelho"
  ]);

  const texto = (valor) => String(valor || "").trim();
  const normalizar = (valor) => texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  function chaveNome(valor) {
    return normalizar(valor)
      .replace(/\btrceps\b/g, "triceps")
      .replace(/\btr[ií]ceps\b/g, "triceps")
      .replace(/\bmartelho\b/g, "martelo")
      .replace(/\bbicepis\b/g, "biceps")
      .replace(/\bpull\s+over\b/g, "pullover")
      .replace(/\bpulley\b/g, "polia")
      .replace(/\bpullover\s+(?:na|no|em|de|da|do)?\s*(?:polia|cabo)\b/g, "pullover")
      .replace(/\bcross\s+over\b/g, "crossover")
      .replace(/\b\d{1,5}\b$/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokens(valor) {
    return new Set(
      chaveNome(valor)
        .split(" ")
        .filter((token) => token.length > 2 && !palavrasIgnoradas.has(token))
    );
  }

  function codigoGif(valor) {
    const bruto = texto(valor);
    if (!bruto) return "";
    const match = bruto.match(/(?:^|\/|flash[_:\s-]*)(\d{1,5})(?:\.gif)?(?:$|\D)/i);
    if (!match) return "";
    const numero = Number(match[1]);
    return Number.isInteger(numero) && numero > 0 ? String(numero).padStart(3, "0") : "";
  }

  let indiceCache = null;

  function indiceFlash() {
    if (indiceCache) return indiceCache;

    const exercicios = Array.isArray(window.FUSION_EXERCICIOS_FLASH?.exercicios)
      ? window.FUSION_EXERCICIOS_FLASH.exercicios
      : [];
    const porCodigo = new Map();
    const porNome = new Map();
    const nomes = [];

    for (const item of exercicios) {
      const gif = [item.gif, item.midia, item.imagemUrl, item.foto]
        .filter(Boolean)
        .find((src) => /\.gif($|\?)/i.test(texto(src)));
      if (!gif) continue;

      for (const codigo of [codigoGif(item.codigo), codigoGif(item.id)].filter(Boolean)) {
        porCodigo.set(codigo, gif);
      }

      const chave = chaveNome(item.nome || item.exercicio || item.titulo || "");
      if (chave) {
        porNome.set(chave, gif);
        nomes.push({ chave, tokens: tokens(chave), gif });
      }
    }

    indiceCache = { porCodigo, porNome, nomes };
    return indiceCache;
  }

  function gifPorNome(indice, chaves) {
    let melhor = null;

    for (const chave of chaves) {
      if (indice.porNome.has(chave)) return indice.porNome.get(chave);

      for (const item of indice.nomes || []) {
        if (chave.length >= 8 && (item.chave.includes(chave) || chave.includes(item.chave))) {
          return item.gif;
        }
      }

      const tokensBusca = tokens(chave);
      if (tokensBusca.size < 2) continue;

      for (const item of indice.nomes || []) {
        let comuns = 0;
        for (const token of tokensBusca) {
          if (item.tokens.has(token)) comuns += 1;
        }

        const coberturaBusca = comuns / tokensBusca.size;
        const coberturaItem = comuns / Math.max(item.tokens.size, 1);
        const score = comuns * 100 + coberturaBusca * 10 + coberturaItem;
        if (comuns >= 2 && coberturaBusca >= 0.6 && (!melhor || score > melhor.score)) {
          melhor = { score, gif: item.gif };
        }
      }
    }

    return melhor?.gif || "";
  }

  function localizarGif(exercicio = {}) {
    const midias = [exercicio.gif, exercicio.midia, exercicio.imagemUrl, exercicio.foto].filter(Boolean);
    const gifAtual = midias.find((src) => /\.gif($|\?)/i.test(texto(src)));
    if (gifAtual) return gifAtual;

    const indice = indiceFlash();
    const codigos = [
      exercicio.codigo,
      exercicio.codigoFlash,
      exercicio.exercicioCodigo,
      exercicio.bibliotecaCodigo
    ].map(codigoGif).filter(Boolean);

    for (const codigo of codigos) {
      if (indice.porCodigo.has(codigo)) return indice.porCodigo.get(codigo);
    }

    const chaves = [
      exercicio.nome,
      exercicio.exercicio,
      exercicio.titulo,
      exercicio.nomeExercicio,
      exercicio.descricaoCurta
    ].map(chaveNome).filter(Boolean);

    return gifPorNome(indice, chaves);
  }

  function aplicarGif(exercicio = {}) {
    const gif = localizarGif(exercicio);
    if (!gif) return exercicio;
    return {
      ...exercicio,
      gif,
      foto: gif,
      midia: gif,
      imagemUrl: gif,
      tipoMidia: "gif",
      fonteMidia: "catalogo_flash_hotfix"
    };
  }

  function patchBiblioteca(payload) {
    const aplicarLista = (lista) => Array.isArray(lista) ? lista.map(aplicarGif) : lista;

    if (Array.isArray(payload)) return aplicarLista(payload);
    if (!payload || typeof payload !== "object") return payload;

    if (Array.isArray(payload.exercicios)) {
      return { ...payload, exercicios: aplicarLista(payload.exercicios) };
    }

    if (payload.dados && typeof payload.dados === "object" && Array.isArray(payload.dados.exercicios)) {
      return {
        ...payload,
        dados: {
          ...payload.dados,
          exercicios: aplicarLista(payload.dados.exercicios)
        }
      };
    }

    if (payload.data && typeof payload.data === "object" && Array.isArray(payload.data.exercicios)) {
      return {
        ...payload,
        data: {
          ...payload.data,
          exercicios: aplicarLista(payload.data.exercicios)
        }
      };
    }

    return payload;
  }

  if (window.__fusionBibliotecaGifsHotfix) return;
  window.__fusionBibliotecaGifsHotfix = true;

  const fetchOriginal = window.fetch?.bind(window);
  if (!fetchOriginal) return;

  window.fetch = async (input, init) => {
    const resposta = await fetchOriginal(input, init);
    const url = texto(typeof input === "string" ? input : input?.url);
    if (!/\/api\/treinos\/biblioteca(?:\?|$)/.test(url)) return resposta;

    try {
      const dados = await resposta.clone().json();
      const corrigido = patchBiblioteca(dados);
      const headers = new Headers(resposta.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(corrigido), {
        status: resposta.status,
        statusText: resposta.statusText,
        headers
      });
    } catch (erro) {
      console.warn("Fusion: hotfix de GIF da biblioteca nao aplicado.", erro);
      return resposta;
    }
  };
})();
