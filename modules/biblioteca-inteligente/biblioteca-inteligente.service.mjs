import fs from "node:fs/promises";
import path from "node:path";
import { lerColecao, salvarColecao } from "../core/persistence/collection-store.mjs";
import {
  caminhoAbsolutoFlashPorCodigo,
  caminhoFlashPorCodigo,
  codigoFlashDeExercicio,
  montarBibliotecaGifs,
  montarBibliotecaGifsComMetadados,
  normalizarBibliotecaShape,
  normalizarExercicioBiblioteca,
  contarExerciciosComGif
} from "../treinos/biblioteca-gifs.service.mjs";

const BIBLIOTECA_COLECAO = "treinos_exercicios";
const LOGS_COLECAO = "biblioteca_inteligente_logs";
const GRUPO_ARQUIVADOS = "ARQUIVADOS";

function texto(valor) {
  return String(valor ?? "").trim();
}

function normalizar(valor) {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function agoraISO() {
  return new Date().toISOString();
}

function midiaDe(ex = {}) {
  return texto(ex.gif || ex.midia || ex.imagemUrl || ex.foto || ex.videoUrl || "");
}

function grupoDe(ex = {}) {
  return texto(ex.grupo || ex.grupoMuscular || "GERAL").toUpperCase();
}

function grupoArquivados(valor = "") {
  const chave = normalizar(valor).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return chave === "arquivado" || chave === "arquivados" || chave === "importados flash";
}

function exercicioArquivado(ex = {}) {
  return ex.arquivado === true || normalizar(ex.status) === "arquivado" || grupoArquivados(ex.grupo || ex.grupoMuscular || ex.grupoId);
}

function chaveItem(ex = {}) {
  return texto(ex.bibliotecaKey || ex.bibliotecaId || ex.id || ex.exercicioId);
}

async function listarLogs() {
  const logs = await lerColecao(LOGS_COLECAO, []);
  return Array.isArray(logs) ? logs : [];
}

async function registrarLog(item = {}) {
  const logs = await listarLogs();
  const novo = {
    id: `log_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    criadoEm: agoraISO(),
    ...item
  };
  await salvarColecao(LOGS_COLECAO, [novo, ...logs].slice(0, 500));
  return novo;
}

async function lerBibliotecaPreferindoGifs() {
  const dados = await lerColecao(BIBLIOTECA_COLECAO, { grupos: [], objetivos: [], exercicios: [] });
  return await montarBibliotecaGifsComMetadados(dados);
}

async function salvarBiblioteca(biblioteca = {}) {
  const normalizada = normalizarBibliotecaShape(biblioteca);
  await salvarColecao(BIBLIOTECA_COLECAO, normalizada);
  return normalizada;
}

function estatisticas(biblioteca = {}) {
  const lista = Array.isArray(biblioteca.exercicios) ? biblioteca.exercicios : [];
  const grupos = new Set(lista.map(grupoDe).filter(Boolean));
  const gifs = contarExerciciosComGif(lista);
  const videos = lista.filter((ex) => /\.(mp4|webm|mov)($|\?)/i.test(midiaDe(ex))).length;
  const semMidia = lista.filter((ex) => !midiaDe(ex)).length;
  const chaves = new Map();

  for (const ex of lista) {
    const chave = `${normalizar(grupoDe(ex))}::${normalizar(ex.nome)}`;
    chaves.set(chave, (chaves.get(chave) || 0) + 1);
  }

  return {
    total: lista.length,
    ativos: lista.filter((ex) => ex.ativo !== false && normalizar(ex.status || "ativo") !== "inativo").length,
    gifs,
    videos,
    grupos: grupos.size,
    semMidia,
    duplicados: [...chaves.values()].filter((total) => total > 1).length
  };
}

export async function statusBibliotecaInteligente() {
  const biblioteca = await lerBibliotecaPreferindoGifs();
  return {
    ok: true,
    modulo: "biblioteca-inteligente",
    status: "Online",
    estatisticas: estatisticas(biblioteca)
  };
}

export async function dashboardBiblioteca() {
  const biblioteca = await lerBibliotecaPreferindoGifs();
  const logs = await listarLogs();
  return {
    ok: true,
    modulo: "biblioteca-inteligente",
    status: "Online",
    estatisticas: estatisticas(biblioteca),
    recentes: biblioteca.exercicios.slice(-8).reverse(),
    logs: logs.slice(0, 10)
  };
}

export async function listarExercicios(filtros = {}) {
  const biblioteca = await lerBibliotecaPreferindoGifs();
  let lista = biblioteca.exercicios.map(normalizarExercicioBiblioteca);
  const q = normalizar(filtros.q || filtros.busca || "");

  if (q) {
    lista = lista.filter((ex) =>
      normalizar([
        ex.id,
        ex.bibliotecaId,
        ex.nome,
        grupoDe(ex),
        ex.equipamento,
        ex.musculos,
        ...(Array.isArray(ex.tags) ? ex.tags : []),
        ...(Array.isArray(ex.sinonimos) ? ex.sinonimos : [])
      ].join(" ")).includes(q)
    );
  }

  if (filtros.grupo) lista = lista.filter((ex) => normalizar(grupoDe(ex)) === normalizar(filtros.grupo));
  if (filtros.status) lista = lista.filter((ex) => normalizar(ex.status) === normalizar(filtros.status));

  lista.sort((a, b) => grupoDe(a).localeCompare(grupoDe(b), "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"));
  return { ok: true, total: lista.length, dados: lista };
}

export async function obterExercicio(id) {
  const { dados } = await listarExercicios({});
  const item = dados.find((ex) =>
    texto(ex.id) === texto(id) ||
    texto(ex.bibliotecaId) === texto(id) ||
    texto(ex.exercicioId) === texto(id)
  );

  if (!item) {
    const erro = new Error("Exercicio nao encontrado.");
    erro.status = 404;
    throw erro;
  }

  return { ok: true, dados: item };
}

export async function atualizarExercicio(id, dados = {}) {
  const biblioteca = await lerBibliotecaPreferindoGifs();
  const lista = biblioteca.exercicios.map(normalizarExercicioBiblioteca);
  const indice = lista.findIndex((ex) =>
    texto(ex.id) === texto(id) ||
    texto(ex.bibliotecaId) === texto(id) ||
    texto(ex.exercicioId) === texto(id)
  );

  if (indice < 0) {
    const erro = new Error("Exercicio nao encontrado.");
    erro.status = 404;
    throw erro;
  }

  const atual = lista[indice];
  const codigo = codigoFlashDeExercicio(atual);
  const midia = caminhoFlashPorCodigo(codigo) || atual.gif || atual.midia || atual.imagemUrl || atual.foto || "";
  const grupoSolicitado = texto(dados.grupo || dados.grupoMuscular || dados.grupoId || atual.grupo);
  const vaiParaArquivo = dados.arquivado === true || normalizar(dados.status) === "arquivado" || grupoArquivados(grupoSolicitado);
  const voltaDoArquivo = exercicioArquivado(atual) && grupoSolicitado && !grupoArquivados(grupoSolicitado) && dados.arquivado !== true && normalizar(dados.status) !== "arquivado";
  const estadoArquivo = vaiParaArquivo
    ? {
        grupo: GRUPO_ARQUIVADOS,
        grupoMuscular: GRUPO_ARQUIVADOS,
        grupoId: GRUPO_ARQUIVADOS,
        status: "Arquivado",
        arquivado: true,
        ativo: false,
        grupoAnterior: texto(dados.grupoAnterior || atual.grupoAnterior || (!grupoArquivados(atual.grupo) ? atual.grupo : "")),
        statusAnterior: texto(dados.statusAnterior || atual.statusAnterior || (!exercicioArquivado(atual) ? atual.status : "")),
        arquivadoEm: texto(dados.arquivadoEm || atual.arquivadoEm || agoraISO())
      }
    : voltaDoArquivo
      ? {
          grupo: grupoSolicitado,
          grupoMuscular: grupoSolicitado,
          grupoId: grupoSolicitado,
          status: texto(dados.status || "Ativo"),
          arquivado: false,
          ativo: true,
          arquivadoEm: "",
          grupoAnterior: "",
          statusAnterior: ""
        }
      : {};
  const atualizado = normalizarExercicioBiblioteca({
    ...atual,
    ...dados,
    ...estadoArquivo,
    id: atual.id,
    bibliotecaId: atual.bibliotecaId || atual.id,
    exercicioId: atual.exercicioId || atual.id,
    bibliotecaKey: atual.bibliotecaKey || chaveItem(atual),
    codigoImagem: atual.codigoImagem || codigo,
    codigoFlash: atual.codigoFlash || codigo,
    codigo: atual.codigo,
    midia,
    imagemUrl: midia,
    foto: midia,
    gif: midia,
    tipoMidia: "gif",
    atualizadoEm: agoraISO(),
    historico: [
      ...(Array.isArray(atual.historico) ? atual.historico : []),
      {
        acao: "edicao",
        usuario: dados.usuario || "Administrador",
        criadoEm: agoraISO()
      }
    ]
  }, indice);

  lista[indice] = atualizado;
  const salvo = await salvarBiblioteca({ ...biblioteca, exercicios: lista });
  await registrarLog({ acao: "editar_exercicio", exercicioId: atualizado.id, nome: atualizado.nome });
  return { ok: true, dados: atualizado, estatisticas: estatisticas(salvo) };
}

export async function arquivarExercicio(id, dados = {}) {
  const { dados: atual } = await obterExercicio(id);
  const resultado = await atualizarExercicio(id, {
    usuario: dados.usuario || "Responsavel tecnico",
    grupo: GRUPO_ARQUIVADOS,
    grupoMuscular: GRUPO_ARQUIVADOS,
    grupoId: GRUPO_ARQUIVADOS,
    status: "Arquivado",
    arquivado: true,
    grupoAnterior: texto(atual.grupoAnterior || (!grupoArquivados(atual.grupo) ? atual.grupo : "")),
    statusAnterior: texto(atual.statusAnterior || (!exercicioArquivado(atual) ? atual.status : "")),
    arquivadoEm: agoraISO()
  });
  await registrarLog({ acao: "arquivar_exercicio", exercicioId: resultado.dados.id, codigoImagem: resultado.dados.codigoImagem });
  return { ...resultado, mensagem: "Exercicio movido para ARQUIVADOS." };
}

export async function restaurarExercicio(id, dados = {}) {
  const { dados: atual } = await obterExercicio(id);
  const grupoDestino = texto(dados.grupo || dados.grupoMuscular || atual.grupoAnterior || "");
  if (!grupoDestino || grupoArquivados(grupoDestino)) {
    throw erro("Informe um grupo valido para devolver o exercicio.", 400);
  }

  const resultado = await atualizarExercicio(id, {
    usuario: dados.usuario || "Responsavel tecnico",
    grupo: grupoDestino,
    grupoMuscular: grupoDestino,
    grupoId: grupoDestino,
    status: texto(dados.status || atual.statusAnterior || "Ativo"),
    arquivado: false,
    ativo: true,
    arquivadoEm: "",
    grupoAnterior: "",
    statusAnterior: ""
  });
  await registrarLog({ acao: "restaurar_exercicio", exercicioId: resultado.dados.id, grupo: grupoDestino });
  return { ...resultado, mensagem: "Exercicio devolvido para a biblioteca ativa." };
}

function erro(mensagem, status = 400) {
  const err = new Error(mensagem);
  err.status = status;
  return err;
}

function bufferGifDeBase64(valor = "") {
  const textoBase64 = texto(valor)
    .replace(/^data:image\/gif;base64,/i, "")
    .replace(/\s+/g, "");

  if (!textoBase64) throw erro("Arquivo GIF nao informado.");
  if (!/^[A-Za-z0-9+/=]+$/.test(textoBase64)) throw erro("Arquivo GIF invalido.");

  const buffer = Buffer.from(textoBase64, "base64");
  const limiteBytes = 8 * 1024 * 1024;
  if (!buffer.length) throw erro("Arquivo GIF vazio.");
  if (buffer.length > limiteBytes) throw erro("Arquivo GIF excede 8 MB.", 413);

  const assinatura = buffer.subarray(0, 6).toString("ascii");
  if (assinatura !== "GIF87a" && assinatura !== "GIF89a") {
    throw erro("A troca de imagem aceita apenas arquivo GIF.");
  }

  return buffer;
}

export async function substituirMidiaExercicio(id, dados = {}) {
  const { dados: exercicio } = await obterExercicio(id);
  const codigo = codigoFlashDeExercicio(exercicio);
  if (!codigo) throw erro("Exercicio sem codigo de imagem.", 422);

  const destino = caminhoAbsolutoFlashPorCodigo(codigo);
  if (!destino) throw erro("Caminho do GIF nao encontrado.", 422);

  const buffer = bufferGifDeBase64(dados.arquivoBase64 || dados.dataUrl || dados.gifBase64 || "");
  await fs.mkdir(path.dirname(destino), { recursive: true });

  const backupDir = path.resolve(process.cwd(), "data", "backups", "biblioteca-gifs");
  await fs.mkdir(backupDir, { recursive: true });
  try {
    await fs.copyFile(destino, path.join(backupDir, `${codigo}-${Date.now()}.gif`));
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }

  await fs.writeFile(destino, buffer);

  const atualizado = await atualizarExercicio(id, {
    usuario: dados.usuario || "Responsavel tecnico",
    midia: caminhoFlashPorCodigo(codigo),
    imagemUrl: caminhoFlashPorCodigo(codigo),
    foto: caminhoFlashPorCodigo(codigo),
    gif: caminhoFlashPorCodigo(codigo),
    tipoMidia: "gif",
    midiaAtualizadaEm: agoraISO()
  });

  await registrarLog({
    acao: "substituir_gif",
    exercicioId: atualizado.dados.id,
    codigoImagem: codigo,
    arquivoNome: texto(dados.arquivoNome || "")
  });

  return {
    ...atualizado,
    mensagem: "GIF substituido mantendo o mesmo caminho.",
    caminho: caminhoFlashPorCodigo(codigo),
    codigoImagem: codigo
  };
}

async function removerArquivoAtivoParaBackup(codigo = "") {
  const origem = caminhoAbsolutoFlashPorCodigo(codigo);
  if (!origem) return "";

  const destinoDir = path.resolve(process.cwd(), "data", "backups", "biblioteca-gifs", "excluidos");
  const destino = path.join(destinoDir, `${codigo}-${Date.now()}.gif`);
  await fs.mkdir(destinoDir, { recursive: true });

  try {
    await fs.copyFile(origem, destino);
    await fs.unlink(origem);
    return destino;
  } catch (err) {
    if (err?.code === "ENOENT") return "";
    throw err;
  }
}

export async function excluirExercicioArquivado(id, dados = {}) {
  const { dados: atual } = await obterExercicio(id);
  if (!exercicioArquivado(atual)) {
    throw erro("Arquive o exercicio antes de excluir.", 409);
  }

  const codigo = codigoFlashDeExercicio(atual);
  if (!codigo) throw erro("Exercicio sem codigo de imagem.", 422);

  const backup = await removerArquivoAtivoParaBackup(codigo);
  const biblioteca = await lerColecao(BIBLIOTECA_COLECAO, { grupos: [], objetivos: [], exercicios: [] });
  const normalizada = normalizarBibliotecaShape(biblioteca);
  const exercicios = normalizada.exercicios.filter((ex) => codigoFlashDeExercicio(ex) !== codigo);
  const salvo = await salvarBiblioteca({ ...normalizada, exercicios });

  await registrarLog({
    acao: "excluir_exercicio_arquivado",
    exercicioId: atual.id,
    codigoImagem: codigo,
    usuario: dados.usuario || "Responsavel tecnico",
    backup
  });

  return {
    ok: true,
    mensagem: "Exercicio arquivado excluido da biblioteca.",
    codigoImagem: codigo,
    backup,
    estatisticas: estatisticas(salvo)
  };
}

export async function organizarBiblioteca() {
  const atual = await lerBibliotecaPreferindoGifs();
  const fallback = await montarBibliotecaGifs();
  const existentes = new Map();

  for (const ex of atual.exercicios || []) {
    const normalizado = normalizarExercicioBiblioteca(ex);
    for (const chave of [normalizado.bibliotecaKey, normalizado.id, normalizado.bibliotecaId, normalizado.exercicioId]) {
      if (texto(chave)) existentes.set(texto(chave), normalizado);
    }
  }

  let atualizados = 0;
  let novos = 0;

  const exercicios = fallback.exercicios.map((gif, indice) => {
    const existente = existentes.get(gif.bibliotecaKey) || existentes.get(gif.id) || existentes.get(gif.bibliotecaId);
    if (!existente) {
      novos += 1;
      return gif;
    }

    atualizados += 1;
    return normalizarExercicioBiblioteca({
      ...gif,
      nome: existente.nome && !/^flash\s+\d+$/i.test(existente.nome) ? existente.nome : gif.nome,
      grupo: existente.grupo || gif.grupo,
      grupoMuscular: existente.grupoMuscular || existente.grupo || gif.grupoMuscular || gif.grupo,
      grupoId: existente.grupoId || existente.grupo || gif.grupoId || gif.grupo,
      equipamento: existente.equipamento || gif.equipamento,
      nivel: existente.nivel || gif.nivel,
      categoria: existente.categoria || gif.categoria,
      status: existente.status || gif.status,
      sinonimos: Array.isArray(existente.sinonimos) && existente.sinonimos.length ? existente.sinonimos : gif.sinonimos,
      tags: Array.isArray(existente.tags) ? existente.tags : gif.tags,
      historico: Array.isArray(existente.historico) ? existente.historico : [],
      atualizadoEm: agoraISO()
    }, indice);
  });

  const salvo = await salvarBiblioteca({ ...fallback, exercicios });
  const resumo = {
    novos,
    atualizados,
    preservados: Math.max(0, exercicios.length - novos - atualizados),
    total: exercicios.length,
    fonte: "gifs_restaurados"
  };

  await registrarLog({ acao: "organizar_biblioteca_gifs", resumo });
  return { ok: true, mensagem: "Biblioteca organizada com GIFs.", resumo, estatisticas: estatisticas(salvo) };
}

export async function validarBiblioteca() {
  const biblioteca = await lerBibliotecaPreferindoGifs();
  const problemas = [];
  const vistos = new Map();

  for (const ex of biblioteca.exercicios || []) {
    if (!texto(ex.nome)) problemas.push({ id: ex.id, tipo: "sem_nome" });
    if (!texto(grupoDe(ex))) problemas.push({ id: ex.id, tipo: "sem_grupo" });
    if (!midiaDe(ex)) problemas.push({ id: ex.id, tipo: "sem_midia" });
    if (midiaDe(ex) && !/\.gif($|\?)/i.test(midiaDe(ex))) problemas.push({ id: ex.id, tipo: "midia_nao_gif" });

    const chave = `${normalizar(grupoDe(ex))}::${normalizar(ex.nome)}`;
    if (vistos.has(chave)) problemas.push({ id: ex.id, tipo: "possivel_duplicado", duplicadoDe: vistos.get(chave) });
    else vistos.set(chave, ex.id);
  }

  await registrarLog({ acao: "validar_biblioteca", problemas: problemas.length });
  return { ok: true, problemas, estatisticas: estatisticas(biblioteca) };
}
