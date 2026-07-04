import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

const router = Router();
const ROOT = path.resolve(process.cwd(), 'public', 'assets', 'exercises');
const IMAGE_EXTS = new Set(['.gif', '.png', '.jpg', '.jpeg', '.webp', '.svg']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov']);
const MEDIA_EXTS = new Set([...IMAGE_EXTS, ...VIDEO_EXTS]);

function titleCaseFromFile(value = '') {
  return String(value)
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)([a-záàâãéêíóôõúç])/g, (_, sep, chr) => sep + chr.toUpperCase());
}

function publicUrl(...segments) {
  return '/assets/exercises/' + segments.map(s => encodeURIComponent(String(s))).join('/');
}

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function readJson(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function listarBiblioteca() {
  await fs.mkdir(ROOT, { recursive: true });
  const gruposDir = await fs.readdir(ROOT, { withFileTypes: true });
  const exercicios = [];

  for (const grupoEntry of gruposDir) {
    if (!grupoEntry.isDirectory() || grupoEntry.name.startsWith('.')) continue;
    const grupo = grupoEntry.name;
    const grupoPath = path.join(ROOT, grupo);
    const arquivos = await fs.readdir(grupoPath, { withFileTypes: true }).catch(() => []);

    for (const arquivoEntry of arquivos) {
      if (!arquivoEntry.isFile() || arquivoEntry.name.startsWith('.')) continue;
      const ext = path.extname(arquivoEntry.name).toLowerCase();
      if (!MEDIA_EXTS.has(ext)) continue;

      const base = arquivoEntry.name.slice(0, -ext.length);
      const metaPath = path.join(grupoPath, `${base}.json`);
      const meta = await exists(metaPath) ? await readJson(metaPath) : {};
      const tipo = VIDEO_EXTS.has(ext) ? 'video' : 'imagem';

      exercicios.push({
        id: `${grupo}/${arquivoEntry.name}`,
        grupo,
        nome: meta.nome || titleCaseFromFile(base),
        arquivo: arquivoEntry.name,
        extensao: ext.replace('.', ''),
        tipo,
        midia: publicUrl(grupo, arquivoEntry.name),
        thumb: meta.thumb ? publicUrl(grupo, meta.thumb) : publicUrl(grupo, arquivoEntry.name),
        equipamento: meta.equipamento || '',
        nivel: meta.nivel || '',
        musculosPrimarios: Array.isArray(meta.musculosPrimarios) ? meta.musculosPrimarios : [],
        musculosSecundarios: Array.isArray(meta.musculosSecundarios) ? meta.musculosSecundarios : [],
        observacoes: meta.observacoes || '',
        contraIndicacoes: meta.contraIndicacoes || '',
        variacoes: Array.isArray(meta.variacoes) ? meta.variacoes : []
      });
    }
  }

  exercicios.sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
  const grupos = [...new Set(exercicios.map(e => e.grupo))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return { grupos, exercicios };
}

router.get('/status', async (req, res) => {
  try {
    const biblioteca = await listarBiblioteca();
    res.json({ ok: true, modulo: 'exercicios-biblioteca', status: 'Online', grupos: biblioteca.grupos.length, exercicios: biblioteca.exercicios.length });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: 'Erro ao verificar biblioteca de exercícios.', erro: erro.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const biblioteca = await listarBiblioteca();
    const grupoFiltro = String(req.query.grupo || '').trim().toLowerCase();
    const busca = String(req.query.q || req.query.busca || '').trim().toLowerCase();
    let exercicios = biblioteca.exercicios;
    if (grupoFiltro) exercicios = exercicios.filter(e => e.grupo.toLowerCase() === grupoFiltro);
    if (busca) {
      exercicios = exercicios.filter(e => [e.nome, e.grupo, e.equipamento, e.nivel, e.arquivo].join(' ').toLowerCase().includes(busca));
    }
    res.json({ ok: true, total: exercicios.length, grupos: biblioteca.grupos, exercicios });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: 'Erro ao listar biblioteca de exercícios.', erro: erro.message });
  }
});

router.get('/grupos', async (req, res) => {
  try {
    const biblioteca = await listarBiblioteca();
    res.json({ ok: true, grupos: biblioteca.grupos });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: 'Erro ao listar grupos musculares.', erro: erro.message });
  }
});

export default router;
