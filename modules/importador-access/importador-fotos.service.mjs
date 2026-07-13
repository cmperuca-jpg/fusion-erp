import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DATA_DIR = path.resolve(process.cwd(), "data");
const IMPORT_DIR = path.join(DATA_DIR, "importacao");
const ALUNOS_JSON = path.join(DATA_DIR, "alunos.json");
const RELATORIO_FOTOS_JSON = path.join(IMPORT_DIR, "relatorio_importacao_fotos_access.json");
const UPLOADS_ALUNOS_DIR = path.resolve(process.cwd(), "uploads", "alunos");
const PUBLIC_UPLOADS_PREFIX = "/uploads/alunos";
const FOTOS_TXT_LOCAL = path.resolve(process.cwd(), "Fotos.txt");
const FOTOS_ZIP_LOCAL = path.resolve(process.cwd(), "Fotos.zip");

const EXT_IMAGEM = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function texto(valor) {
  return String(valor ?? "").replace(/\u0000/g, "").trim();
}

function somenteDigitos(valor) {
  return texto(valor).replace(/\D/g, "");
}

function safeFileName(nome = "") {
  const base = path.basename(String(nome || "foto.jpg"));
  return base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "foto.jpg";
}

function parseLinhaCsv(linha, delimitador = ";") {
  const campos = [];
  let atual = "";
  let dentroAspas = false;

  for (let i = 0; i < linha.length; i += 1) {
    const char = linha[i];
    const prox = linha[i + 1];

    if (char === '"') {
      if (dentroAspas && prox === '"') {
        atual += '"';
        i += 1;
      } else {
        dentroAspas = !dentroAspas;
      }
      continue;
    }

    if (char === delimitador && !dentroAspas) {
      campos.push(atual);
      atual = "";
      continue;
    }

    atual += char;
  }

  campos.push(atual);
  return campos.map(texto);
}

export function parseFotosTxt(conteudo = "") {
  const linhas = String(conteudo || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  const registros = [];
  const ignorados = [];

  for (const linha of linhas) {
    const campos = parseLinhaCsv(linha, ";");
    const idFoto = texto(campos[0]);
    const arquivo = texto(campos[1]);
    const dataLegado = texto(campos[2]);
    const flag = texto(campos[3]);
    const idLegadoAluno = somenteDigitos(campos[4]);

    if (!arquivo || !idLegadoAluno) {
      ignorados.push({ linha, motivo: "sem_arquivo_ou_id_legado" });
      continue;
    }

    registros.push({
      id_foto_legado: idFoto,
      arquivo,
      arquivo_lower: path.basename(arquivo).toLowerCase(),
      data_legado: dataLegado,
      flag,
      id_legado_aluno: idLegadoAluno
    });
  }

  return { total_linhas: linhas.length, registros, ignorados };
}

async function lerAlunos() {
  try {
    const bruto = await fs.readFile(ALUNOS_JSON, "utf-8");
    const dados = bruto.trim() ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

async function salvarAlunos(alunos = []) {
  await fs.mkdir(path.dirname(ALUNOS_JSON), { recursive: true });
  await fs.writeFile(ALUNOS_JSON, JSON.stringify(alunos, null, 2), "utf-8");
}

function indexarAlunosPorIdLegado(alunos = []) {
  const map = new Map();
  for (const aluno of alunos) {
    const idLegado = somenteDigitos(aluno.id_legado ?? aluno.idLegado ?? aluno.legacyId);
    if (idLegado && !map.has(idLegado)) map.set(idLegado, aluno);
  }
  return map;
}

function validarZipLocal(zipPath) {
  try {
    const fd = fsSync.openSync(zipPath, "r");
    const buffer = Buffer.alloc(4);
    fsSync.readSync(fd, buffer, 0, 4, 0);
    fsSync.closeSync(fd);
    const assinatura = buffer.toString("hex");
    return assinatura === "504b0304" || assinatura === "504b0506" || assinatura === "504b0708";
  } catch {
    return false;
  }
}

function psQuote(valor = "") {
  return `'${String(valor).replace(/'/g, "''")}'`;
}

async function extrairZipWindows(zipPath, extractDir) {
  const comando = `Expand-Archive -LiteralPath ${psQuote(zipPath)} -DestinationPath ${psQuote(extractDir)} -Force`;
  return execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    comando
  ], { windowsHide: true, maxBuffer: 1024 * 1024 * 20 });
}

async function extrairZipLinux(zipPath, extractDir) {
  return execFileAsync("unzip", ["-qq", zipPath, "-d", extractDir], { maxBuffer: 1024 * 1024 * 20 });
}

async function prepararZip(zipBase64 = "", nomeArquivo = "Fotos.zip") {
  if (!zipBase64) {
    const erro = new Error("Envie o arquivo Fotos.zip.");
    erro.status = 400;
    throw erro;
  }

  const token = `${Date.now()}_${crypto.randomUUID()}`;
  const tempDir = path.join(IMPORT_DIR, `fotos_zip_${token}`);
  const extractDir = path.join(tempDir, "extraido");
  const zipPath = path.join(tempDir, safeFileName(nomeArquivo || "Fotos.zip"));

  await fs.mkdir(extractDir, { recursive: true });
  const base64Limpo = String(zipBase64).includes(",") ? String(zipBase64).split(",").pop() : String(zipBase64);
  const bufferZip = Buffer.from(base64Limpo, "base64");
  await fs.writeFile(zipPath, bufferZip);

  if (!validarZipLocal(zipPath)) {
    const erro = new Error("O arquivo recebido não parece ser um ZIP válido. Selecione novamente o Fotos.zip original.");
    erro.status = 400;
    throw erro;
  }

  try {
    if (process.platform === "win32") {
      await extrairZipWindows(zipPath, extractDir);
    } else {
      await extrairZipLinux(zipPath, extractDir);
    }
  } catch (error) {
    const erro = new Error(`Não foi possível extrair o ZIP. Verifique se o arquivo é um .zip válido. Detalhe: ${error.stderr || error.message}`);
    erro.status = 400;
    throw erro;
  }

  return { tempDir, extractDir, zipPath };
}


async function prepararZipDeArquivoLocal(zipPathLocal = FOTOS_ZIP_LOCAL) {
  if (!fsSync.existsSync(zipPathLocal)) {
    const erro = new Error(`Fotos.zip não encontrado no servidor em: ${zipPathLocal}`);
    erro.status = 400;
    throw erro;
  }

  if (!validarZipLocal(zipPathLocal)) {
    const erro = new Error(`O arquivo local não parece ser um ZIP válido: ${zipPathLocal}`);
    erro.status = 400;
    throw erro;
  }

  const token = `${Date.now()}_${crypto.randomUUID()}`;
  const tempDir = path.join(IMPORT_DIR, `fotos_zip_local_${token}`);
  const extractDir = path.join(tempDir, "extraido");
  await fs.mkdir(extractDir, { recursive: true });

  try {
    if (process.platform === "win32") {
      await extrairZipWindows(zipPathLocal, extractDir);
    } else {
      await extrairZipLinux(zipPathLocal, extractDir);
    }
  } catch (error) {
    const erro = new Error(`Não foi possível extrair o Fotos.zip local. Detalhe: ${error.stderr || error.message}`);
    erro.status = 400;
    throw erro;
  }

  return { tempDir, extractDir, zipPath: zipPathLocal };
}

async function lerFotosTxtLocal(txtPathLocal = FOTOS_TXT_LOCAL) {
  if (!fsSync.existsSync(txtPathLocal)) {
    const erro = new Error(`Fotos.txt não encontrado no servidor em: ${txtPathLocal}`);
    erro.status = 400;
    throw erro;
  }
  return fs.readFile(txtPathLocal, "utf-8");
}

async function listarImagens(dir) {
  const itens = [];

  async function percorrer(atual) {
    const entradas = await fs.readdir(atual, { withFileTypes: true });
    for (const entrada of entradas) {
      const full = path.join(atual, entrada.name);
      if (entrada.isDirectory()) {
        await percorrer(full);
        continue;
      }
      const ext = path.extname(entrada.name).toLowerCase();
      if (!EXT_IMAGEM.has(ext)) continue;
      itens.push({
        caminho: full,
        nome: entrada.name,
        nome_lower: entrada.name.toLowerCase(),
        basename_lower: path.basename(entrada.name).toLowerCase(),
        tamanho: (await fs.stat(full)).size
      });
    }
  }

  await percorrer(dir);
  return itens;
}

function montarIndiceImagens(imagens = []) {
  const map = new Map();
  for (const img of imagens) {
    if (!map.has(img.basename_lower)) map.set(img.basename_lower, img);
  }
  return map;
}

function montarNomeDestino(aluno, registro, imagem) {
  const ext = path.extname(imagem.nome || registro.arquivo || ".jpg").toLowerCase() || ".jpg";
  const idLegado = somenteDigitos(registro.id_legado_aluno || aluno.id_legado || "semid");
  const nomeBase = safeFileName(`${idLegado}_${texto(aluno.nome || "aluno").toLowerCase().replace(/\s+/g, "_")}${ext}`);
  return nomeBase;
}

async function executarVinculacaoFotos({ fotosTxt, zipBase64, nomeZip = "Fotos.zip", dryRun = true, usarArquivosLocais = false } = {}) {
  if (usarArquivosLocais) {
    fotosTxt = await lerFotosTxtLocal();
    nomeZip = "Fotos.zip";
  }

  if (!fotosTxt) {
    const erro = new Error("Envie o arquivo Fotos.txt ou use os arquivos locais do servidor.");
    erro.status = 400;
    throw erro;
  }

  const parsed = parseFotosTxt(fotosTxt);
  const alunos = await lerAlunos();
  const alunosPorLegado = indexarAlunosPorIdLegado(alunos);
  const { tempDir, extractDir } = usarArquivosLocais
    ? await prepararZipDeArquivoLocal()
    : await prepararZip(zipBase64, nomeZip);
  const imagens = await listarImagens(extractDir);
  const imagensPorNome = montarIndiceImagens(imagens);

  const vinculadas = [];
  const semAluno = [];
  const semArquivo = [];
  const erros = [];

  await fs.mkdir(UPLOADS_ALUNOS_DIR, { recursive: true });

  for (const registro of parsed.registros) {
    const aluno = alunosPorLegado.get(String(registro.id_legado_aluno));
    if (!aluno) {
      semAluno.push({ id_legado: registro.id_legado_aluno, arquivo: registro.arquivo, motivo: "aluno_nao_encontrado" });
      continue;
    }

    const imagem = imagensPorNome.get(registro.arquivo_lower) || imagensPorNome.get(path.basename(registro.arquivo).toLowerCase());
    if (!imagem) {
      semArquivo.push({ id_legado: registro.id_legado_aluno, aluno: aluno.nome || "", arquivo: registro.arquivo, motivo: "arquivo_nao_encontrado_no_zip" });
      continue;
    }

    const nomeDestino = montarNomeDestino(aluno, registro, imagem);
    const destinoAbs = path.join(UPLOADS_ALUNOS_DIR, nomeDestino);
    const fotoUrl = `${PUBLIC_UPLOADS_PREFIX}/${nomeDestino}`;

    try {
      if (!dryRun) {
        await fs.copyFile(imagem.caminho, destinoAbs);
        aluno.foto = fotoUrl;
        aluno.foto_url = fotoUrl;
        aluno.fotoUrl = fotoUrl;
        aluno.temFoto = true;
        aluno.fotoImportadaAccess = true;
        aluno.fotoArquivoOriginal = registro.arquivo;
        aluno.fotoImportadaEm = new Date().toISOString();
        aluno.atualizadoEm = new Date().toISOString();
        aluno.atualizado_em = new Date().toISOString();
      }

      vinculadas.push({
        id_legado: registro.id_legado_aluno,
        alunoId: aluno.id,
        aluno: aluno.nome || "",
        arquivo_origem: registro.arquivo,
        arquivo_destino: nomeDestino,
        foto: fotoUrl
      });
    } catch (error) {
      erros.push({ id_legado: registro.id_legado_aluno, aluno: aluno.nome || "", arquivo: registro.arquivo, erro: error.message });
    }
  }

  if (!dryRun) {
    await salvarAlunos(alunos);
  }

  const relatorio = {
    ok: true,
    destino: dryRun ? "simulacao" : "uploads/alunos + data/alunos.json",
    arquivo_fotos_txt: "Fotos.txt",
    arquivo_zip: nomeZip,
    modo_arquivos: usarArquivosLocais ? "servidor" : "upload",
    total_linhas_txt: parsed.total_linhas,
    registros_txt_validos: parsed.registros.length,
    imagens_no_zip: imagens.length,
    alunos_na_base: alunos.length,
    vinculadas: vinculadas.length,
    sem_aluno: semAluno.length,
    sem_arquivo: semArquivo.length,
    ignorados_txt: parsed.ignorados.length,
    erros: erros.length,
    gerado_em: new Date().toISOString(),
    preview: vinculadas.slice(0, 20),
    detalhes: {
      sem_aluno: semAluno.slice(0, 100),
      sem_arquivo: semArquivo.slice(0, 100),
      ignorados_txt: parsed.ignorados.slice(0, 50),
      erros: erros.slice(0, 50)
    }
  };

  await fs.mkdir(IMPORT_DIR, { recursive: true });
  await fs.writeFile(RELATORIO_FOTOS_JSON, JSON.stringify(relatorio, null, 2), "utf-8");

  // Limpa o diretório temporário sem afetar os arquivos copiados para uploads/alunos.
  try {
    if (fsSync.existsSync(tempDir)) await fs.rm(tempDir, { recursive: true, force: true });
  } catch {}

  return relatorio;
}

export async function analisarFotosAccess(payload = {}) {
  return executarVinculacaoFotos({ ...payload, dryRun: true });
}

export async function importarFotosAccess(payload = {}) {
  return executarVinculacaoFotos({ ...payload, dryRun: false });
}

export async function analisarFotosAccessLocal() {
  return executarVinculacaoFotos({ dryRun: true, usarArquivosLocais: true });
}

export async function importarFotosAccessLocal() {
  return executarVinculacaoFotos({ dryRun: false, usarArquivosLocais: true });
}

export async function lerRelatorioFotosAccess() {
  try {
    const bruto = await fs.readFile(RELATORIO_FOTOS_JSON, "utf-8");
    return JSON.parse(bruto);
  } catch {
    return { ok: true, mensagem: "Nenhuma importação de fotos executada ainda." };
  }
}
