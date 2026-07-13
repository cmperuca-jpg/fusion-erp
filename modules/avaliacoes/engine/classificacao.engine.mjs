/* Fusion Avaliação 4.0.2 — Engine de Classificação
   Fonte única para classificações clínicas e comerciais usadas pela Avaliação Física. */
import { numero, arredondar } from './calculos.engine.mjs';

function norm(v) {
  return String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function faixa(classe, nivel = 'neutro', cor = 'muted', descricao = '') {
  return { classe, classificacao: classe, nivel, cor, descricao };
}

function pendente(motivo = 'Informe sexo e idade do aluno para classificação clínica individualizada.') {
  return {
    valor: 0,
    ...faixa('Classificação pendente', 'pendente', 'muted', motivo),
    classificacao_pendente: true,
    motivo_pendencia: motivo
  };
}

function sexoNormalizado(avaliacao = {}) {
  const s = norm(avaliacao.sexo || avaliacao.genero || avaliacao.alunoSexo || avaliacao.alunoGenero || avaliacao.dadosAluno?.sexo);
  if (/^(m|masc|masculino|homem)/.test(s)) return 'masculino';
  if (/^(f|fem|feminino|mulher)/.test(s)) return 'feminino';
  return '';
}

function idadeNormalizada(avaliacao = {}) {
  const n = numero(avaliacao.idade || avaliacao.alunoIdade || avaliacao.dadosAluno?.idade);
  return n > 0 ? Math.round(n) : 0;
}

export function classificarIMCDetalhado(imc) {
  const n = numero(imc);
  if (n <= 0) return { valor: 0, ...faixa('Não calculado', 'neutro', 'muted') };
  if (n < 16) return { valor: arredondar(n, 2), ...faixa('Magreza grave', 'muito_alto', 'danger') };
  if (n < 17) return { valor: arredondar(n, 2), ...faixa('Magreza moderada', 'alto', 'danger') };
  if (n < 18.5) return { valor: arredondar(n, 2), ...faixa('Magreza leve', 'moderado', 'warning') };
  if (n < 25) return { valor: arredondar(n, 2), ...faixa('Eutrofia', 'bom', 'success') };
  if (n < 30) return { valor: arredondar(n, 2), ...faixa('Sobrepeso', 'moderado', 'warning') };
  if (n < 35) return { valor: arredondar(n, 2), ...faixa('Obesidade grau I', 'alto', 'danger') };
  if (n < 40) return { valor: arredondar(n, 2), ...faixa('Obesidade grau II', 'muito_alto', 'danger') };
  return { valor: arredondar(n, 2), ...faixa('Obesidade grau III', 'critico', 'danger') };
}

export function classificarIMC(imc) {
  return classificarIMCDetalhado(imc).classe;
}

function faixaEtariaRCQ(idade) {
  if (idade <= 0) return 'adulto';
  if (idade < 20) return 'menor_20';
  if (idade < 30) return '20_29';
  if (idade < 40) return '30_39';
  if (idade < 50) return '40_49';
  if (idade < 60) return '50_59';
  return '60_mais';
}

const RCQ_TABELA = {
  masculino: {
    '20_29': [0.83, 0.89, 0.94],
    '30_39': [0.84, 0.92, 0.96],
    '40_49': [0.88, 0.95, 1.00],
    '50_59': [0.90, 0.96, 1.02],
    '60_mais': [0.91, 0.98, 1.03],
    adulto: [0.90, 0.95, 1.00]
  },
  feminino: {
    '20_29': [0.71, 0.77, 0.82],
    '30_39': [0.72, 0.78, 0.84],
    '40_49': [0.73, 0.79, 0.87],
    '50_59': [0.74, 0.81, 0.88],
    '60_mais': [0.76, 0.83, 0.90],
    adulto: [0.80, 0.85, 0.90]
  },
  geral: {
    adulto: [0.80, 0.90, 1.00]
  }
};

export function classificarRCQDetalhado(rcq, sexo = '', idade = 0) {
  const n = numero(rcq);
  if (n <= 0) return { valor: 0, ...faixa('Não calculado', 'neutro', 'muted') };
  const sx = sexo === 'masculino' || sexo === 'feminino' ? sexo : '';
  if (!sx) return { valor: arredondar(n, 2), sexo: 'não informado', faixa_etaria: 'pendente', ...pendente('Informe o sexo do aluno para classificar RCQ com segurança.') };
  const grupo = faixaEtariaRCQ(idade);
  if (grupo === 'menor_20') {
    return {
      ...pendente('RCQ não classificado: o protocolo adulto inicia aos 20 anos. Use avaliação específica para crianças/adolescentes.'),
      valor: arredondar(n, 2),
      sexo: sx,
      faixa_etaria: 'menor_20'
    };
  }
  const limites = (RCQ_TABELA[sx] && RCQ_TABELA[sx][grupo]) || RCQ_TABELA[sx].adulto;
  let res;
  if (n < limites[0]) res = faixa('Baixo risco', 'bom', 'success');
  else if (n < limites[1]) res = faixa('Risco moderado', 'moderado', 'warning');
  else if (n < limites[2]) res = faixa('Risco alto', 'alto', 'danger');
  else res = faixa('Risco muito alto', 'muito_alto', 'danger');
  return { valor: arredondar(n, 2), sexo: sx, faixa_etaria: grupo, ...res };
}

export function classificarRCQ(rcq, sexo = '', idade = 0) {
  return classificarRCQDetalhado(rcq, sexoNormalizado({ sexo }), idade).classe;
}

export function classificarRiscoCoronarianoDetalhado(escore) {
  const n = numero(escore);
  if (n <= 0) return { escore: 0, ...faixa('Não calculado', 'neutro', 'muted') };
  if (n <= 11) return { escore: n, ...faixa('Baixo', 'bom', 'success') };
  if (n <= 17) return { escore: n, ...faixa('Moderado', 'moderado', 'warning') };
  if (n <= 24) return { escore: n, ...faixa('Alto', 'alto', 'danger') };
  return { escore: n, ...faixa('Muito alto', 'muito_alto', 'danger') };
}

export function classificarRiscoCoronariano(escore) {
  return classificarRiscoCoronarianoDetalhado(escore).classe;
}

function limitesGordura(sexo, idade) {
  const sx = sexo || 'geral';
  const jovem = idade > 0 && idade < 40;
  const adulto = idade >= 40 && idade < 60;
  if (sx === 'masculino') return jovem ? [8, 14, 20, 25] : adulto ? [11, 17, 23, 28] : [13, 19, 25, 30];
  if (sx === 'feminino') return jovem ? [18, 23, 30, 35] : adulto ? [21, 27, 33, 38] : [23, 29, 35, 40];
  return [12, 20, 28, 35];
}

export function classificarPercentualGorduraDetalhado(valor, sexo = '', idade = 0) {
  const n = numero(valor);
  if (n <= 0) return { valor: 0, ...faixa('Não calculado', 'neutro', 'muted') };
  const sx = sexo === 'masculino' || sexo === 'feminino' ? sexo : '';
  if (!sx) return { valor: arredondar(n, 2), sexo: 'não informado', idade: idade || '', ...pendente('Informe o sexo do aluno para classificar percentual de gordura com segurança.') };
  if (idade > 0 && idade < 20) {
    return {
      ...pendente('Percentual de gordura não classificado: o protocolo adulto inicia aos 20 anos. Use avaliação específica para crianças/adolescentes.'),
      valor: arredondar(n, 2),
      sexo: sx,
      idade,
      faixa_etaria: 'menor_20'
    };
  }
  const limites = limitesGordura(sx, idade);
  let res;
  if (n < limites[0]) res = faixa('Muito baixo', 'baixo', 'warning');
  else if (n < limites[1]) res = faixa('Baixo', 'bom', 'success');
  else if (n < limites[2]) res = faixa('Adequado', 'bom', 'success');
  else if (n < limites[3]) res = faixa('Elevado', 'alto', 'warning');
  else res = faixa('Muito elevado', 'muito_alto', 'danger');
  return { valor: arredondar(n, 2), sexo: sx, idade: idade || '', ...res };
}

export function classificarPercentualGordura(valor, sexo = '', idade = 0) {
  return classificarPercentualGorduraDetalhado(valor, sexoNormalizado({ sexo }), idade).classe;
}

export function classificarFMIDetalhado(fmi, sexo = '') {
  const n = numero(fmi);
  if (n <= 0) return { valor: 0, ...faixa('Não calculado', 'neutro', 'muted') };
  const sx = sexo === 'masculino' || sexo === 'feminino' ? sexo : '';
  if (!sx) return { valor: arredondar(n, 2), sexo: 'não informado', ...pendente('Informe o sexo do aluno para classificar FMI com segurança.') };
  const limites = sx === 'feminino' ? [4, 8, 12] : [2, 6, 9];
  if (n < limites[0]) return { valor: arredondar(n, 2), ...faixa('Déficit', 'baixo', 'warning') };
  if (n < limites[1]) return { valor: arredondar(n, 2), ...faixa('Adequado', 'bom', 'success') };
  if (n < limites[2]) return { valor: arredondar(n, 2), ...faixa('Elevado', 'alto', 'warning') };
  return { valor: arredondar(n, 2), ...faixa('Muito elevado', 'muito_alto', 'danger') };
}

export function classificarFFMIDetalhado(ffmi, sexo = '') {
  const n = numero(ffmi);
  if (n <= 0) return { valor: 0, ...faixa('Não calculado', 'neutro', 'muted') };
  const sx = sexo === 'masculino' || sexo === 'feminino' ? sexo : '';
  if (!sx) return { valor: arredondar(n, 2), sexo: 'não informado', ...pendente('Informe o sexo do aluno para classificar FFMI com segurança.') };
  const limites = sx === 'feminino' ? [15, 17, 19] : [18, 20, 22];
  if (n < limites[0]) return { valor: arredondar(n, 2), ...faixa('Muito baixo', 'baixo', 'warning') };
  if (n < limites[1]) return { valor: arredondar(n, 2), ...faixa('Baixo', 'moderado', 'warning') };
  if (n < limites[2]) return { valor: arredondar(n, 2), ...faixa('Normal', 'bom', 'success') };
  return { valor: arredondar(n, 2), ...faixa('Excelente', 'excelente', 'success') };
}

export function classificarPesoIdealDetalhado(peso, pesoIdeal = {}) {
  const p = numero(peso);
  const min = numero(pesoIdeal.minimo);
  const max = numero(pesoIdeal.maximo);
  if (p <= 0 || min <= 0 || max <= 0) return { valor: p || 0, ...faixa('Não calculado', 'neutro', 'muted') };
  if (p < min) return { valor: p, minimo: min, maximo: max, diferenca: arredondar(min - p, 2), ...faixa('Abaixo da faixa ideal', 'baixo', 'warning') };
  if (p <= max) return { valor: p, minimo: min, maximo: max, diferenca: 0, ...faixa('Dentro da faixa ideal', 'bom', 'success') };
  return { valor: p, minimo: min, maximo: max, diferenca: arredondar(p - max, 2), ...faixa('Acima da faixa ideal', 'alto', 'warning') };
}

export function classificarGorduraVisceralDetalhado(valor) {
  const n = numero(valor);
  if (n <= 0) return { valor: 0, ...faixa('Não calculado', 'neutro', 'muted') };
  if (n <= 9) return { valor: n, ...faixa('Normal', 'bom', 'success') };
  if (n <= 14) return { valor: n, ...faixa('Elevado', 'alto', 'warning') };
  return { valor: n, ...faixa('Muito elevado', 'muito_alto', 'danger') };
}

export function classificarTodos(base = {}, avaliacao = {}) {
  const sexo = sexoNormalizado(avaliacao);
  const idade = idadeNormalizada(avaliacao);
  const imc = classificarIMCDetalhado(base.imc);
  const rcq = classificarRCQDetalhado(base.rcq, sexo, idade);
  const risco = classificarRiscoCoronarianoDetalhado(base.risco_escore);
  const gordura = classificarPercentualGorduraDetalhado(base.percentual_gordura, sexo, idade);
  const fmi = classificarFMIDetalhado(base.fmi, sexo);
  const ffmi = classificarFFMIDetalhado(base.ffmi, sexo);
  const pesoIdeal = classificarPesoIdealDetalhado(base.peso, base.peso_ideal);
  const gorduraVisceral = classificarGorduraVisceralDetalhado(avaliacao.bioimpedancia?.itens?.['Gordura Visceral']?.valor || avaliacao.gordura_visceral);

  return {
    versao: 'fusion-avaliacao-4.0.2-correção-sexo',
    sexo: sexo || 'não informado',
    classificacao_pendente: !sexo || rcq.classificacao_pendente === true || gordura.classificacao_pendente === true,
    idade,
    imc: imc.classe,
    rcq: rcq.classe,
    risco: risco.classe,
    gordura: gordura.classe,
    detalhes: { imc, rcq, risco, gordura, fmi, ffmi, peso_ideal: pesoIdeal, gordura_visceral: gorduraVisceral }
  };
}
