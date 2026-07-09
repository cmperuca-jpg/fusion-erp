/* Fusion Avaliação 4.0.4 — Comparador */
import { numero, arredondar } from './calculos.engine.mjs';

function item(label, campo, a = {}, b = {}, unidade = '') {
  const inicial = numero(a[campo]);
  const final = numero(b[campo]);
  const diferenca = arredondar(final - inicial, 2);
  const percentual = inicial ? arredondar((diferenca / inicial) * 100, 2) : 0;
  return { label, campo, inicial, final, diferenca, percentual, unidade, tendencia: diferenca > 0 ? 'subiu' : diferenca < 0 ? 'desceu' : 'estável' };
}

export function compararAvaliacoes(anterior = {}, atual = {}) {
  return {
    anterior_id: anterior.id || '',
    atual_id: atual.id || '',
    anterior_data: String(anterior.data || anterior.dataAvaliacao || '').slice(0, 10),
    atual_data: String(atual.data || atual.dataAvaliacao || '').slice(0, 10),
    indicadores: [
      item('Peso', 'peso', anterior, atual, 'kg'),
      item('IMC', 'imc', anterior, atual, ''),
      item('Gordura corporal', 'percentual_gordura', anterior, atual, '%'),
      item('Massa gorda', 'massa_gorda', anterior, atual, 'kg'),
      item('Massa magra', 'massa_magra', anterior, atual, 'kg'),
      item('Cintura', 'cintura', anterior, atual, 'cm'),
      item('Quadril', 'quadril', anterior, atual, 'cm'),
      item('RCQ', 'rcq', anterior, atual, '')
    ]
  };
}
