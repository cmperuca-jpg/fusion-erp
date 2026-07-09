/* Fusion Avaliação 4.0.4 — Evolução */
import { numero, arredondar } from './calculos.engine.mjs';

function dataValor(av = {}) {
  return String(av.data || av.dataAvaliacao || av.criado_em || av.criadoEm || '').slice(0, 10);
}

function ordenarCronologico(lista = []) {
  return [...lista].sort((a, b) => dataValor(a).localeCompare(dataValor(b)) || String(a.id || '').localeCompare(String(b.id || '')));
}

function diff(atual, anterior) {
  const a = numero(atual);
  const b = numero(anterior);
  if (!a || !b) return { atual: a, anterior: b, diferenca: 0, percentual: 0, tendencia: 'neutro' };
  const diferenca = arredondar(a - b, 2);
  const percentual = arredondar((diferenca / b) * 100, 2);
  return { atual: a, anterior: b, diferenca, percentual, tendencia: diferenca > 0 ? 'subiu' : diferenca < 0 ? 'desceu' : 'estável' };
}

export function calcularEvolucao(avaliacao = {}, historicoAluno = []) {
  const lista = ordenarCronologico(historicoAluno).filter(a => String(a.id || '') !== String(avaliacao.id || ''));
  const anteriores = lista.filter(a => dataValor(a) <= dataValor(avaliacao));
  const anterior = anteriores[anteriores.length - 1] || lista[lista.length - 1] || null;
  const total = lista.length + 1;

  if (!anterior) {
    return {
      primeira_avaliacao: true,
      ordem_cronologica_aluno: total,
      total_avaliacoes_aluno: total,
      avaliacao_anterior_id: '',
      avaliacao_anterior_data: ''
    };
  }

  return {
    primeira_avaliacao: false,
    ordem_cronologica_aluno: total,
    total_avaliacoes_aluno: total,
    avaliacao_anterior_id: anterior.id || '',
    avaliacao_anterior_data: dataValor(anterior),
    peso: diff(avaliacao.peso, anterior.peso),
    imc: diff(avaliacao.imc, anterior.imc),
    percentual_gordura: diff(avaliacao.percentual_gordura, anterior.percentual_gordura),
    massa_gorda: diff(avaliacao.massa_gorda, anterior.massa_gorda),
    massa_magra: diff(avaliacao.massa_magra, anterior.massa_magra),
    cintura: diff(avaliacao.cintura, anterior.cintura),
    quadril: diff(avaliacao.quadril, anterior.quadril),
    rcq: diff(avaliacao.rcq, anterior.rcq)
  };
}

export function montarTimeline(lista = []) {
  return ordenarCronologico(lista).map((av, index, arr) => ({
    id: av.id,
    data: dataValor(av),
    ordem: index + 1,
    total: arr.length,
    peso: numero(av.peso),
    imc: numero(av.imc),
    percentual_gordura: numero(av.percentual_gordura),
    massa_magra: numero(av.massa_magra),
    massa_gorda: numero(av.massa_gorda),
    objetivo: av.objetivo || ''
  }));
}
