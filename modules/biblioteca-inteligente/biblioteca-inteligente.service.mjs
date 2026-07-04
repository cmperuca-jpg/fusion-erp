import {
  listarBiblioteca,
  salvarBiblioteca,
  listarLogs,
  registrarLog,
  escanearMidias,
  VIDEO_EXTS
} from './biblioteca-inteligente.repository.mjs';
import path from 'node:path';

function agoraISO(){ return new Date().toISOString(); }
function texto(v){ return String(v ?? '').trim(); }
function normalizar(v){ return texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function gerarId(prefixo='EXB') { return `${prefixo}${String(Date.now()).slice(-8)}${Math.random().toString(16).slice(2,6).toUpperCase()}`; }
function title(nome='') { return texto(nome).replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/\.[^.]+$/,'').trim(); }
function grupoDe(ex={}) { return texto(ex.grupoMuscular || ex.grupo || ex.folder || 'GERAL').toUpperCase(); }
function midiaDe(ex={}) { return texto(ex.midia || ex.imagemUrl || ex.videoUrl || ex.imagem || ex.image || ex.arquivo || ''); }
function chavePorRel(rel='') { return normalizar(rel).replace(/%20/g,' '); }
function chavePorNomeGrupo(nome='', grupo='') { return `${normalizar(grupo)}::${normalizar(nome)}`; }
function isVideoUrl(url='') { return VIDEO_EXTS.has(path.extname(String(url).split('?')[0]).toLowerCase()); }

function normalizarRegistro(ex={}, idx=0) {
  const midia = midiaDe(ex);
  const nome = texto(ex.nome || ex.name || ex.exercicio || title(String(midia).split('/').pop() || `Exercício ${idx+1}`));
  const grupo = grupoDe(ex);
  return {
    id: texto(ex.id || ex.bibliotecaId || ex.exercicioId) || gerarId(),
    bibliotecaId: texto(ex.bibliotecaId || ex.id || ex.exercicioId) || '',
    nome,
    grupo,
    grupoMuscular: texto(ex.grupoMuscular || grupo),
    equipamento: texto(ex.equipamento || ''),
    nivel: texto(ex.nivel || 'Iniciante'),
    categoria: texto(ex.categoria || 'Musculação'),
    sinonimos: Array.isArray(ex.sinonimos) ? ex.sinonimos : [],
    tags: Array.isArray(ex.tags) ? ex.tags : [],
    status: texto(ex.status || 'Ativo'),
    midia,
    imagemUrl: texto(ex.imagemUrl || (!isVideoUrl(midia) ? midia : '')),
    videoUrl: texto(ex.videoUrl || (isVideoUrl(midia) ? midia : '')),
    tipoMidia: texto(ex.tipoMidia || ex.tipo || (isVideoUrl(midia) ? 'video' : (midia ? 'imagem' : ''))),
    arquivoRelativo: texto(ex.arquivoRelativo || midia.replace(/^\/assets\/exercises\//,'')),
    origem: texto(ex.origem || 'biblioteca_inteligente'),
    criadoEm: ex.criadoEm || agoraISO(),
    atualizadoEm: ex.atualizadoEm || agoraISO(),
    historico: Array.isArray(ex.historico) ? ex.historico : []
  };
}

function estatisticas(lista=[]) {
  const ativos = lista.filter(x => !['inativo','arquivado','removido','cancelado'].includes(normalizar(x.status || 'Ativo')));
  const grupos = new Set(lista.map(grupoDe).filter(Boolean));
  const gifs = lista.filter(x => /\.gif($|\?)/i.test(midiaDe(x))).length;
  const videos = lista.filter(x => isVideoUrl(midiaDe(x))).length;
  const semMidia = lista.filter(x => !midiaDe(x)).length;
  const semGrupo = lista.filter(x => !grupoDe(x) || grupoDe(x) === 'GERAL' || grupoDe(x) === 'IMPORTADOS_FLASH').length;
  const chaves = new Map();
  for (const x of lista) {
    const k = chavePorNomeGrupo(x.nome, grupoDe(x));
    chaves.set(k, (chaves.get(k) || 0) + 1);
  }
  const duplicados = [...chaves.values()].filter(n => n > 1).length;
  return { total: lista.length, ativos: ativos.length, gifs, videos, grupos: grupos.size, semMidia, semGrupo, duplicados };
}

export async function dashboardBiblioteca() {
  const lista = (await listarBiblioteca()).map(normalizarRegistro);
  const logs = await listarLogs();
  return { ok:true, modulo:'biblioteca-inteligente', versao:'Fusion ERP 2.7', status:'Online', estatisticas: estatisticas(lista), recentes: lista.slice(-8).reverse(), logs: logs.slice(0, 10) };
}

export async function listarExercicios(filtros={}) {
  let lista = (await listarBiblioteca()).map(normalizarRegistro);
  const q = normalizar(filtros.q || filtros.busca || '');
  if (q) lista = lista.filter(x => normalizar([x.id,x.nome,grupoDe(x),x.equipamento,...(x.tags||[]),...(x.sinonimos||[])].join(' ')).includes(q));
  if (filtros.grupo) lista = lista.filter(x => normalizar(grupoDe(x)) === normalizar(filtros.grupo));
  if (filtros.status) lista = lista.filter(x => normalizar(x.status) === normalizar(filtros.status));
  lista.sort((a,b) => grupoDe(a).localeCompare(grupoDe(b),'pt-BR') || a.nome.localeCompare(b.nome,'pt-BR'));
  return { ok:true, total: lista.length, dados: lista };
}

export async function obterExercicio(id) {
  const lista = (await listarBiblioteca()).map(normalizarRegistro);
  const item = lista.find(x => String(x.id) === String(id) || String(x.bibliotecaId) === String(id));
  if (!item) throw Object.assign(new Error('Exercício não encontrado.'), { status:404 });
  return { ok:true, dados:item };
}

export async function atualizarExercicio(id, dados={}) {
  const lista = (await listarBiblioteca()).map(normalizarRegistro);
  const idx = lista.findIndex(x => String(x.id) === String(id) || String(x.bibliotecaId) === String(id));
  if (idx < 0) throw Object.assign(new Error('Exercício não encontrado.'), { status:404 });
  const atual = lista[idx];
  const novo = normalizarRegistro({ ...atual, ...dados, id: atual.id, bibliotecaId: atual.bibliotecaId || atual.id }, idx);
  novo.atualizadoEm = agoraISO();
  novo.historico = [...(atual.historico || []), { acao:'edicao', usuario: dados.usuario || 'Administrador', criadoEm: agoraISO(), antes:{ nome:atual.nome, grupo:grupoDe(atual), midia:midiaDe(atual) }, depois:{ nome:novo.nome, grupo:grupoDe(novo), midia:midiaDe(novo) } }];
  lista[idx] = novo;
  await salvarBiblioteca(lista);
  await registrarLog({ acao:'editar_exercicio', exercicioId: novo.id, nome: novo.nome });
  return { ok:true, dados:novo };
}

function casarMidiaComRegistro(midia, registros, usados) {
  const byRel = registros.find(x => !usados.has(x.id) && chavePorRel(x.arquivoRelativo || midiaDe(x).replace(/^\/assets\/exercises\//,'')) === chavePorRel(midia.rel));
  if (byRel) return byRel;

  const byNomeGrupo = registros.find(x => !usados.has(x.id) && chavePorNomeGrupo(x.nome, grupoDe(x)) === chavePorNomeGrupo(title(midia.nomeBase), midia.grupo));
  if (byNomeGrupo) return byNomeGrupo;

  const baseNormal = normalizar(midia.nomeBase);
  if (/^\d{1,5}$/.test(baseNormal)) {
    const byArquivo = registros.find(x => !usados.has(x.id) && normalizar((x.arquivoRelativo || midiaDe(x)).split('/').pop()?.replace(/\.[^.]+$/,'') || '') === baseNormal);
    if (byArquivo) return byArquivo;
  }
  return null;
}

export async function organizarBiblioteca() {
  const midias = await escanearMidias();
  const registros = (await listarBiblioteca()).map(normalizarRegistro);
  const usados = new Set();
  const saida = [];
  let novos = 0, atualizados = 0, preservados = 0;

  for (const midia of midias) {
    let reg = casarMidiaComRegistro(midia, registros, usados);
    if (reg) {
      usados.add(reg.id);
      const antes = JSON.stringify({ nome:reg.nome, grupo:grupoDe(reg), midia:midiaDe(reg) });
      reg = {
        ...reg,
        nome: /^\d{1,5}$/.test(reg.nome) || normalizar(reg.nome) === normalizar(path.parse(reg.arquivoRelativo || '').name) ? title(midia.nomeBase) : reg.nome,
        grupo: midia.grupo,
        grupoMuscular: midia.grupo,
        midia: midia.url,
        imagemUrl: midia.tipo === 'imagem' ? midia.url : '',
        videoUrl: midia.tipo === 'video' ? midia.url : '',
        tipoMidia: midia.tipo,
        arquivoRelativo: midia.rel,
        atualizadoEm: agoraISO()
      };
      const depois = JSON.stringify({ nome:reg.nome, grupo:grupoDe(reg), midia:midiaDe(reg) });
      if (antes !== depois) atualizados++; else preservados++;
      saida.push(reg);
    } else {
      novos++;
      saida.push(normalizarRegistro({
        id: gerarId(), bibliotecaId:'', nome: title(midia.nomeBase), grupo: midia.grupo, grupoMuscular: midia.grupo,
        midia: midia.url, imagemUrl: midia.tipo === 'imagem' ? midia.url : '', videoUrl: midia.tipo === 'video' ? midia.url : '', tipoMidia: midia.tipo,
        arquivoRelativo: midia.rel, origem:'scan_organizador'
      }));
    }
  }

  const removidos = registros.filter(x => !usados.has(x.id) && midiaDe(x)).map(x => ({ ...x, status:'Midia não localizada', atualizadoEm:agoraISO() }));
  const semMidia = registros.filter(x => !midiaDe(x) && !usados.has(x.id));
  const final = [...saida, ...removidos, ...semMidia];
  await salvarBiblioteca(final);
  const resumo = { novos, atualizados, preservados, removidos: removidos.length, total: final.length };
  await registrarLog({ acao:'organizar_biblioteca', resumo });
  return { ok:true, mensagem:'Biblioteca organizada.', resumo, estatisticas: estatisticas(final) };
}

export async function validarBiblioteca() {
  const lista = (await listarBiblioteca()).map(normalizarRegistro);
  const problemas = [];
  const nomes = new Map();
  for (const ex of lista) {
    if (!ex.nome) problemas.push({ id:ex.id, tipo:'sem_nome' });
    if (!grupoDe(ex)) problemas.push({ id:ex.id, tipo:'sem_grupo' });
    if (!midiaDe(ex)) problemas.push({ id:ex.id, tipo:'sem_midia' });
    const k = chavePorNomeGrupo(ex.nome, grupoDe(ex));
    if (nomes.has(k)) problemas.push({ id:ex.id, tipo:'possivel_duplicado', duplicadoDe: nomes.get(k) });
    else nomes.set(k, ex.id);
  }
  await registrarLog({ acao:'validar_biblioteca', problemas: problemas.length });
  return { ok:true, problemas, estatisticas: estatisticas(lista) };
}

export async function statusBibliotecaInteligente() {
  const lista = (await listarBiblioteca()).map(normalizarRegistro);
  return { ok:true, modulo:'biblioteca-inteligente', versao:'Fusion ERP 2.7', status:'Online', estatisticas:estatisticas(lista) };
}
