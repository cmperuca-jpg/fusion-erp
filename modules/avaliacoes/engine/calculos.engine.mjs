/* Fusion Avaliação 4.0.1 — Engine de cálculos
   Fonte única de fórmulas para Avaliação Física. */

export function texto(v) {
  return String(v ?? '').trim();
}

export function numero(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;

  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/\s+/g, '').replace(/kg|cm|m|%|anos?|lt|g/gi, '');

  // Formato brasileiro com milhar e decimal: 1.234,56
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function arredondar(valor, casas = 2) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(casas));
}

export function alturaMetros(valor) {
  const n = numero(valor);
  if (n <= 0) return 0;
  // Access e formulários podem vir em cm.
  return n > 3 ? arredondar(n / 100, 2) : n;
}

export function calcularIMC(peso, altura) {
  const p = numero(peso);
  const a = alturaMetros(altura);
  if (p <= 0 || a <= 0) return 0;
  return arredondar(p / (a * a), 2);
}

export function calcularRCQ(cintura, quadril) {
  const c = numero(cintura);
  const q = numero(quadril);
  if (c <= 0 || q <= 0) return 0;
  return arredondar(c / q, 2);
}

export function calcularMassaGorda(peso, percentualGordura) {
  const p = numero(peso);
  const g = numero(percentualGordura);
  if (p <= 0 || g <= 0) return 0;
  return arredondar(p * (g / 100), 2);
}

export function calcularMassaMagra(peso, percentualGordura) {
  const p = numero(peso);
  const mg = calcularMassaGorda(p, percentualGordura);
  if (p <= 0 || mg <= 0) return 0;
  return arredondar(p - mg, 2);
}

export function calcularTMB(peso) {
  const p = numero(peso);
  if (p <= 0) return 0;
  return Math.round(22 * p);
}

export function calcularPesoIdealPorIMC(altura, imcMin = 18.5, imcMax = 24.9) {
  const a = alturaMetros(altura);
  if (a <= 0) return { minimo: 0, maximo: 0, faixa: '' };
  const minimo = arredondar(imcMin * a * a, 2);
  const maximo = arredondar(imcMax * a * a, 2);
  return { minimo, maximo, faixa: `${minimo} kg a ${maximo} kg` };
}

export function calcularFMI(peso, altura, percentualGordura) {
  const massaGorda = calcularMassaGorda(peso, percentualGordura);
  const a = alturaMetros(altura);
  if (massaGorda <= 0 || a <= 0) return 0;
  return arredondar(massaGorda / (a * a), 2);
}

export function calcularFFMI(peso, altura, percentualGordura) {
  const massaMagra = calcularMassaMagra(peso, percentualGordura);
  const a = alturaMetros(altura);
  if (massaMagra <= 0 || a <= 0) return 0;
  return arredondar(massaMagra / (a * a), 2);
}

export function extrairMedidas(avaliacao = {}) {
  const per = avaliacao.perimetros || {};
  return {
    peso: numero(avaliacao.peso || avaliacao.composicao?.peso),
    altura: alturaMetros(avaliacao.altura || avaliacao.composicao?.altura),
    percentual_gordura: numero(avaliacao.percentual_gordura || avaliacao.percentualGordura || avaliacao.gordura || avaliacao.composicao?.percentual_gordura),
    cintura: numero(avaliacao.cintura || avaliacao.rcq_cintura || per.cintura),
    quadril: numero(avaliacao.quadril || avaliacao.rcq_quadril || per.quadril),
    risco_escore: numero(avaliacao.risco?.escore_total || avaliacao.risco_coronariano || avaliacao.escore_risco)
  };
}

export function calcularBase(avaliacao = {}) {
  const m = extrairMedidas(avaliacao);
  const imc = calcularIMC(m.peso, m.altura);
  const rcq = calcularRCQ(m.cintura, m.quadril);
  const massa_gorda = calcularMassaGorda(m.peso, m.percentual_gordura);
  const massa_magra = calcularMassaMagra(m.peso, m.percentual_gordura);
  const peso_ideal = calcularPesoIdealPorIMC(m.altura);

  return {
    ...m,
    imc,
    rcq,
    massa_gorda,
    massa_magra,
    tmb: calcularTMB(m.peso),
    peso_ideal,
    fmi: calcularFMI(m.peso, m.altura, m.percentual_gordura),
    ffmi: calcularFFMI(m.peso, m.altura, m.percentual_gordura)
  };
}
