/* Fusion Avaliação 4.0.3 — Diagnóstico Inteligente
   Transforma cálculos e classificações em leitura comercial, clínica-operacional e acionável. */
import { numero, arredondar } from './calculos.engine.mjs';

function texto(v) { return String(v ?? '').trim(); }
function norm(v) { return texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function label(v) {
  if (v && typeof v === 'object') return v.classe || v.classificacao || v.nivel || '';
  return String(v || '');
}
function nivel(v) {
  if (v && typeof v === 'object') return v.nivel || v.cor || '';
  return '';
}
function temRisco(v) {
  const s = norm(label(v) + ' ' + nivel(v));
  return /alto|elevado|muito|critico|crítico|danger/.test(s);
}
function temRiscoModerado(v) {
  const s = norm(label(v) + ' ' + nivel(v));
  return /moderado|sobrepeso|warning/.test(s);
}
function classificacaoPendente(v) {
  if (!v || typeof v !== 'object') return false;
  return v.classificacao_pendente === true || norm(label(v)).includes('classificacao pendente') || norm(label(v)).includes('classificação pendente');
}
function pendenciaPorSexo(v) {
  const motivo = norm(v?.motivo_pendencia || v?.descricao || '');
  return classificacaoPendente(v) && /sexo/.test(motivo);
}
function pendenciaMenor20(v) {
  const motivo = norm(v?.motivo_pendencia || v?.descricao || '');
  return classificacaoPendente(v) && (v?.faixa_etaria === 'menor_20' || /menor|20 anos|adolescente|crianca|criança/.test(motivo));
}
function tendencia(diff) {
  const n = numero(diff?.diferenca);
  if (n > 0) return 'subiu';
  if (n < 0) return 'desceu';
  return 'estável';
}
function fraseDelta(rotulo, diff, unidade = '') {
  if (!diff || diff.diferenca === undefined) return '';
  const n = numero(diff.diferenca);
  if (!n) return `${rotulo} permaneceu estável.`;
  const sinal = n > 0 ? 'aumentou' : 'reduziu';
  return `${rotulo} ${sinal} ${Math.abs(arredondar(n, 2))}${unidade}.`;
}

export function calcularPrioridade(base = {}, classificacao = {}) {
  const pontos = [];
  const imc = numero(base.imc);
  const rcq = numero(base.rcq);
  const gordura = numero(base.percentual_gordura);
  const risco = numero(base.risco_escore);

  if (temRisco(classificacao.imc) || imc >= 30) pontos.push({ area: 'IMC', peso: 3, motivo: 'IMC em faixa de obesidade ou risco elevado.' });
  else if (temRiscoModerado(classificacao.imc) || imc >= 25) pontos.push({ area: 'IMC', peso: 2, motivo: 'IMC acima da faixa recomendada.' });
  else if (imc > 0 && imc < 18.5) pontos.push({ area: 'IMC', peso: 2, motivo: 'IMC abaixo da faixa recomendada.' });

  if (!classificacaoPendente(classificacao.rcq)) {
    if (temRisco(classificacao.rcq) || rcq >= 0.9) pontos.push({ area: 'RCQ', peso: 3, motivo: 'Relação cintura-quadril exige atenção cardiometabólica.' });
    else if (temRiscoModerado(classificacao.rcq)) pontos.push({ area: 'RCQ', peso: 2, motivo: 'Relação cintura-quadril em faixa de atenção.' });
  }

  if (!classificacaoPendente(classificacao.gordura)) {
    if (temRisco(classificacao.gordura) || gordura >= 32) pontos.push({ area: 'Composição corporal', peso: 3, motivo: 'Percentual de gordura elevado.' });
    else if (temRiscoModerado(classificacao.gordura)) pontos.push({ area: 'Composição corporal', peso: 2, motivo: 'Percentual de gordura em faixa de atenção.' });
  }

  if (temRisco(classificacao.risco) || risco >= 18) pontos.push({ area: 'Risco coronariano', peso: 3, motivo: 'Escore de risco coronariano elevado.' });
  else if (temRiscoModerado(classificacao.risco) || risco >= 12) pontos.push({ area: 'Risco coronariano', peso: 2, motivo: 'Escore de risco coronariano moderado.' });

  const total = pontos.reduce((s, p) => s + p.peso, 0);
  const nivelGeral = total >= 7 ? 'alto' : total >= 4 ? 'moderado' : total >= 1 ? 'atenção' : 'baixo';
  const principal = pontos.sort((a, b) => b.peso - a.peso)[0] || { area: 'Manutenção', peso: 0, motivo: 'Sem alertas críticos nos indicadores disponíveis.' };
  return { nivel: nivelGeral, pontuacao: total, prioridade_principal: principal.area, pontos };
}

export function gerarAlertas(base = {}, classificacao = {}) {
  const alertas = [];
  const pendenciasSexo = [classificacao.rcq, classificacao.gordura, classificacao.fmi, classificacao.ffmi].filter(pendenciaPorSexo);
  const pendenciasMenor20 = [classificacao.rcq, classificacao.gordura].filter(pendenciaMenor20);
  if (pendenciasSexo.length) {
    alertas.push('Classificação clínica parcial: informe sexo no cadastro do aluno para calcular os indicadores que dependem de tabela por sexo.');
  }
  if (pendenciasMenor20.length) {
    alertas.push('Classificação clínica parcial: RCQ e/ou percentual de gordura não foram classificados porque o protocolo adulto inicia aos 20 anos.');
  }
  const imc = numero(base.imc);
  const rcq = numero(base.rcq);
  const gordura = numero(base.percentual_gordura);

  if (imc >= 40) alertas.push('IMC em obesidade grau III. Recomenda-se acompanhamento próximo e metas graduais.');
  else if (imc >= 35) alertas.push('IMC em obesidade grau II. Monitorar evolução com atenção.');
  else if (imc >= 30) alertas.push('IMC em faixa de obesidade. Recomenda-se metas graduais e acompanhamento próximo.');
  else if (imc >= 25) alertas.push('IMC em faixa de sobrepeso. Monitorar evolução de peso e composição corporal.');
  else if (imc > 0 && imc < 18.5) alertas.push('IMC abaixo da faixa recomendada. Avaliar ganho de massa e ingestão adequada.');

  if (!classificacaoPendente(classificacao.rcq) && (temRisco(classificacao.rcq) || rcq >= 0.9)) alertas.push('RCQ em faixa de atenção. Monitorar cintura, quadril e risco cardiometabólico.');
  if (!classificacaoPendente(classificacao.gordura) && (gordura >= 32 || temRisco(classificacao.gordura))) alertas.push('Percentual de gordura elevado. Priorizar adesão, rotina e progressão segura.');
  if (temRisco(classificacao.risco)) alertas.push('Escore de risco elevado. Avaliar liberação, histórico e tolerância ao esforço.');

  return [...new Set(alertas)];
}

export function gerarResumo(base = {}, classificacao = {}) {
  const resumo = [];
  if (base.imc) resumo.push(`IMC ${arredondar(base.imc, 2)} (${label(classificacao.imc)})`);
  if (base.percentual_gordura) resumo.push(`Gordura corporal ${arredondar(base.percentual_gordura, 2)}% (${label(classificacao.gordura)})`);
  if (base.rcq) resumo.push(`RCQ ${arredondar(base.rcq, 2)} (${label(classificacao.rcq)})`);
  if (base.massa_magra) resumo.push(`Massa magra estimada ${arredondar(base.massa_magra, 2)} kg`);
  if (base.massa_gorda) resumo.push(`Massa gorda estimada ${arredondar(base.massa_gorda, 2)} kg`);
  return resumo;
}

export function gerarLeituraEvolutiva(evolucao = {}) {
  if (!evolucao || evolucao.primeira_avaliacao) {
    return {
      status: 'primeira_avaliacao',
      frases: ['Primeira avaliação registrada. Este resultado servirá como linha de base para comparações futuras.'],
      destaque: 'Linha de base criada.'
    };
  }

  const frases = [
    fraseDelta('Peso', evolucao.peso, ' kg'),
    fraseDelta('Massa gorda', evolucao.massa_gorda, ' kg'),
    fraseDelta('Massa magra', evolucao.massa_magra, ' kg'),
    fraseDelta('Cintura', evolucao.cintura, ' cm'),
    fraseDelta('RCQ', evolucao.rcq, '')
  ].filter(Boolean);

  const gorduraDesceu = tendencia(evolucao.massa_gorda) === 'desceu' || tendencia(evolucao.percentual_gordura) === 'desceu';
  const magraSubiu = tendencia(evolucao.massa_magra) === 'subiu';
  let destaque = 'Evolução estável. Reavaliar aderência e progressão.';
  if (gorduraDesceu && magraSubiu) destaque = 'Evolução positiva: redução de gordura com ganho de massa magra.';
  else if (gorduraDesceu) destaque = 'Evolução positiva: redução de gordura corporal.';
  else if (magraSubiu) destaque = 'Evolução positiva: aumento de massa magra.';
  else if (tendencia(evolucao.massa_gorda) === 'subiu') destaque = 'Atenção: massa gorda aumentou em relação à avaliação anterior.';

  return { status: 'comparada', frases, destaque };
}

export function gerarMetasSugeridas(base = {}, classificacao = {}, evolucao = {}) {
  const metas = [];
  const peso = numero(base.peso);
  const massaGorda = numero(base.massa_gorda);
  const massaMagra = numero(base.massa_magra);
  const cintura = numero(base.cintura);

  if (temRisco(classificacao.imc) || (!classificacaoPendente(classificacao.gordura) && temRisco(classificacao.gordura)) || (!classificacaoPendente(classificacao.rcq) && temRisco(classificacao.rcq))) {
    if (massaGorda > 0) metas.push({ indicador: 'Massa gorda', direcao: 'reduzir', alvo: arredondar(Math.max(0, massaGorda * 0.95), 2), unidade: 'kg', prazo: '30 a 45 dias' });
    if (cintura > 0) metas.push({ indicador: 'Cintura', direcao: 'reduzir', alvo: arredondar(Math.max(0, cintura - 2), 2), unidade: 'cm', prazo: '30 a 45 dias' });
  }

  if (massaMagra > 0) metas.push({ indicador: 'Massa magra', direcao: 'manter/elevar', alvo: arredondar(massaMagra + 0.5, 2), unidade: 'kg', prazo: '45 a 60 dias' });
  if (peso > 0 && numero(base.imc) >= 25) metas.push({ indicador: 'Peso corporal', direcao: 'ajustar gradualmente', alvo: 'queda progressiva sem perda relevante de massa magra', unidade: '', prazo: 'mensal' });

  return metas.slice(0, 4);
}

export function gerarPlanoAcao(base = {}, classificacao = {}, evolucao = {}) {
  const prioridade = calcularPrioridade(base, classificacao);
  const objetivo = norm(base.objetivo);
  const acoes = [];

  if (prioridade.prioridade_principal === 'RCQ' && !classificacaoPendente(classificacao.rcq)) acoes.push('Priorizar controle de cintura, rotina aeróbica progressiva e monitoramento cardiometabólico.');
  if (prioridade.prioridade_principal === 'Composição corporal' && !classificacaoPendente(classificacao.gordura)) acoes.push('Priorizar redução de gordura com treino resistido, regularidade e controle de evolução mensal.');
  if (prioridade.prioridade_principal === 'IMC') acoes.push('Definir meta gradual de peso e acompanhar se a mudança vem de gordura ou massa magra.');
  if (/hipertrof|massa/.test(objetivo)) acoes.push('Acompanhar sobrecarga progressiva, ingestão proteica e ganho de massa magra.');
  if (/emagrec|perder|peso/.test(objetivo)) acoes.push('Acompanhar redução de massa gorda e cintura, evitando perda excessiva de massa magra.');
  if (evolucao?.massa_magra?.diferenca < 0) acoes.push('Atenção à perda de massa magra: revisar treino, recuperação e estratégia nutricional.');
  if ([classificacao.rcq, classificacao.gordura, classificacao.fmi, classificacao.ffmi].some(pendenciaPorSexo)) acoes.push('Completar sexo no cadastro para liberar classificação clínica individualizada dos indicadores dependentes de sexo.');
  if ([classificacao.rcq, classificacao.gordura].some(pendenciaMenor20)) acoes.push('Para menores de 20 anos, usar protocolo específico para crianças/adolescentes em vez de tabela adulta.');
  if (!acoes.length) acoes.push('Manter acompanhamento periódico e comparar indicadores na próxima avaliação.');

  return [...new Set(acoes)];
}

export function gerarMensagens(base = {}, classificacao = {}, evolucao = {}) {
  const resumo = gerarResumo(base, classificacao);
  const leitura = gerarLeituraEvolutiva(evolucao);
  const prioridade = calcularPrioridade(base, classificacao);

  return {
    professor: [
      `Prioridade atual: ${prioridade.prioridade_principal} (${prioridade.nivel}).`,
      leitura.destaque,
      ...resumo
    ].filter(Boolean).join(' '),
    aluno: [
      leitura.destaque,
      'Continue acompanhando sua evolução pelas avaliações e metas definidas pelo professor.'
    ].filter(Boolean).join(' ')
  };
}

export function gerarDiagnostico(base = {}, classificacao = {}, evolucao = {}) {
  const objetivo = texto(base.objetivo);
  const alertas = gerarAlertas(base, classificacao);
  const resumo = gerarResumo(base, classificacao);
  const prioridade = calcularPrioridade(base, classificacao);
  const leitura_evolutiva = gerarLeituraEvolutiva(evolucao);
  const metas_sugeridas = gerarMetasSugeridas(base, classificacao, evolucao);
  const plano_acao = gerarPlanoAcao(base, classificacao, evolucao);
  const mensagens = gerarMensagens(base, classificacao, evolucao);

  const recomendacoes = [...plano_acao];
  if (objetivo) recomendacoes.push(`Objetivo declarado: ${objetivo}.`);

  const textoFinal = [
    `Diagnóstico: prioridade ${prioridade.nivel} em ${prioridade.prioridade_principal}.`,
    ...resumo,
    leitura_evolutiva.destaque,
    ...alertas,
    ...recomendacoes
  ].join(' ');

  return {
    versao: 'fusion-avaliacao-4.0.3-correção-sexo',
    prioridade,
    resumo,
    alertas,
    recomendacoes,
    leitura_evolutiva,
    metas_sugeridas,
    plano_acao,
    mensagens,
    texto: textoFinal
  };
}
