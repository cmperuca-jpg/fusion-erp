/* Fusion Avaliação 4.0.1-4.0.4 — Engine principal */
import { calcularBase, arredondar } from './calculos.engine.mjs';
import { classificarTodos } from './classificacao.engine.mjs';
import { gerarDiagnostico } from './diagnostico.engine.mjs';
import { calcularEvolucao, montarTimeline } from './evolucao.engine.mjs';
import { compararAvaliacoes } from './comparador.engine.mjs';

export function calcularAvaliacaoCompleta(avaliacao = {}, historicoAluno = []) {
  const base = calcularBase(avaliacao);
  const pre = {
    ...avaliacao,
    peso: base.peso || avaliacao.peso,
    altura: base.altura || avaliacao.altura,
    percentual_gordura: base.percentual_gordura || avaliacao.percentual_gordura,
    cintura: base.cintura || avaliacao.cintura,
    quadril: base.quadril || avaliacao.quadril,
    imc: base.imc || avaliacao.imc || 0,
    rcq: base.rcq || avaliacao.rcq || 0,
    massa_gorda: base.massa_gorda || avaliacao.massa_gorda || 0,
    massa_magra: base.massa_magra || avaliacao.massa_magra || 0,
    tmb: base.tmb || avaliacao.tmb || 0,
    peso_ideal: base.peso_ideal,
    fmi: base.fmi,
    ffmi: base.ffmi
  };

  const classificacao = classificarTodos(base, avaliacao);
  const detalhesClassificacao = classificacao.detalhes || {};
  const evolucao = calcularEvolucao(pre, historicoAluno);
  const diagnostico = gerarDiagnostico({ ...base, objetivo: avaliacao.objetivo }, {
    imc: detalhesClassificacao.imc || classificacao.imc,
    rcq: detalhesClassificacao.rcq || classificacao.rcq,
    risco: detalhesClassificacao.risco || classificacao.risco,
    gordura: detalhesClassificacao.gordura || classificacao.gordura
  }, evolucao);

  return {
    ...pre,
    imc: arredondar(pre.imc, 2),
    rcq: arredondar(pre.rcq, 2),
    massa_gorda: arredondar(pre.massa_gorda, 2),
    massa_magra: arredondar(pre.massa_magra, 2),
    evaluation_engine: {
      versao: 'fusion-avaliacao-4.0.3-correção-sexo',
      calculado_em: new Date().toISOString()
    },
    classificacao_engine: classificacao,
    diagnostico_comercial: {
      imc: { valor: arredondar(pre.imc, 2), classificacao: classificacao.imc, ...(detalhesClassificacao.imc || {}) },
      rcq: { valor: arredondar(pre.rcq, 2), classificacao: classificacao.rcq, ...(detalhesClassificacao.rcq || {}) },
      risco: { escore: base.risco_escore || 0, classificacao: classificacao.risco, ...(detalhesClassificacao.risco || {}) },
      composicao: {
        percentual_gordura: base.percentual_gordura || 0,
        classificacao_gordura: classificacao.gordura,
        gordura: detalhesClassificacao.gordura,
        fmi: detalhesClassificacao.fmi,
        ffmi: detalhesClassificacao.ffmi,
        gordura_visceral: detalhesClassificacao.gordura_visceral,
        peso_ideal_classificacao: detalhesClassificacao.peso_ideal,
        massa_gorda: arredondar(pre.massa_gorda, 2),
        massa_magra: arredondar(pre.massa_magra, 2),
        peso_ideal: base.peso_ideal
      },
      diagnostico_versao: diagnostico.versao,
      prioridade: diagnostico.prioridade,
      alertas: diagnostico.alertas,
      resumo: diagnostico.resumo,
      recomendacoes: diagnostico.recomendacoes,
      leitura_evolutiva: diagnostico.leitura_evolutiva,
      metas_sugeridas: diagnostico.metas_sugeridas,
      plano_acao: diagnostico.plano_acao,
      mensagens: diagnostico.mensagens,
      texto: diagnostico.texto
    },
    evolucao,
    ordem_cronologica_aluno: evolucao.ordem_cronologica_aluno,
    total_avaliacoes_aluno: evolucao.total_avaliacoes_aluno,
    avaliacao_anterior_id: evolucao.avaliacao_anterior_id,
    avaliacao_anterior_data: evolucao.avaliacao_anterior_data
  };
}

export { montarTimeline, compararAvaliacoes };
