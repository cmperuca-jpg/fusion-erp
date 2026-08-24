import {
  lerEquipamentosAcademia,
  salvarEquipamentosAcademia
} from "./equipamentos-academia.repository.mjs";

/* equipamentos-academia-v1 */

const CATALOGO = [
  {
    id: "pernas_gluteos",
    nome: "Máquinas — pernas e glúteos",
    itens: [
      ["leg_press_45", "Leg Press 45°"],
      ["leg_press_horizontal", "Leg Press horizontal / deitado"],
      ["leg_press_vertical", "Leg Press vertical"],
      ["hack_squat", "Hack Squat"],
      ["pendulum_squat", "Pendulum Squat"],
      ["smith", "Smith / Barra guiada"],
      ["cadeira_extensora", "Cadeira extensora"],
      ["banco_extensor", "Banco extensor"],
      ["mesa_flexora", "Mesa flexora"],
      ["cadeira_flexora", "Cadeira flexora"],
      ["banco_flexor", "Banco flexor"],
      ["cadeira_adutora", "Cadeira adutora"],
      ["banco_adutor", "Banco adutor"],
      ["cadeira_abdutora", "Cadeira abdutora"],
      ["banco_abdutor", "Banco abdutor"],
      ["gluteo_maquina", "Máquina de glúteo"],
      ["gluteo_em_pe_maquina", "Glúteo em pé no aparelho"],
      ["apolete", "Apolete"],
      ["hip_thrust_maquina", "Hip Thrust / Elevação pélvica em máquina"],
      ["panturrilha_em_pe_maquina", "Panturrilha em pé na máquina"],
      ["panturrilha_sentada_maquina", "Panturrilha sentada na máquina"],
      ["belt_squat", "Belt Squat"],
      ["sissy_squat", "Sissy Squat"],
      ["tibial_maquina", "Máquina de tibial"]
    ]
  },
  {
    id: "peito_ombros_bracos",
    nome: "Máquinas — peito, ombros e braços",
    itens: [
      ["peck_deck_voador", "Peck Deck / Voador"],
      ["chest_press_reto", "Chest Press / Supino reto em máquina"],
      ["chest_press_inclinado", "Supino inclinado em máquina"],
      ["supino_vertical_maquina", "Supino vertical em máquina"],
      ["supino_articulado", "Supino articulado"],
      ["desenvolvimento_maquina", "Desenvolvimento / Shoulder Press"],
      ["desenvolvimento_articulado", "Desenvolvimento articulado"],
      ["elevacao_lateral_maquina", "Elevação lateral em máquina"],
      ["biceps_maquina", "Bíceps / Rosca em máquina"],
      ["rosca_scott_maquina", "Rosca Scott em máquina"],
      ["triceps_maquina", "Tríceps em máquina"],
      ["mergulho_maquina", "Mergulho / Dip em máquina"]
    ]
  },
  {
    id: "costas_core",
    nome: "Máquinas — costas e core",
    itens: [
      ["graviton", "Graviton"],
      ["puxada_alta_maquina", "Puxada alta em máquina"],
      ["puxada_articulada", "Puxada articulada"],
      ["pullover_maquina", "Pullover em máquina"],
      ["remada_baixa_maquina", "Remada baixa em máquina"],
      ["remada_articulada", "Remada articulada"],
      ["remada_cavalinho_maquina", "Remada cavalinho em aparelho"],
      ["lombar_maquina", "Lombar em máquina"],
      ["abdominal_maquina", "Abdominal em máquina"],
      ["rotacao_tronco_maquina", "Rotação de tronco em máquina"]
    ]
  },
  {
    id: "estacoes",
    nome: "Estações e estruturas",
    itens: [
      ["crossover", "Crossover"],
      ["polia_alta", "Polia alta"],
      ["polia_baixa", "Polia baixa"],
      ["torre_cabos_dupla", "Torre dupla de cabos"],
      ["estacao_multifuncional", "Estação multifuncional"],
      ["barra_fixa", "Barra fixa"],
      ["paralelas", "Paralelas"],
      ["power_rack", "Power Rack / Gaiola"],
      ["squat_rack", "Suporte / Rack de agachamento"]
    ]
  },
  {
    id: "bancos",
    nome: "Bancos",
    itens: [
      ["banco_reto", "Banco reto"],
      ["banco_regulavel", "Banco regulável"],
      ["banco_inclinado", "Banco inclinado"],
      ["banco_declinado", "Banco declinado"],
      ["banco_supino_reto", "Banco de supino reto"],
      ["banco_supino_inclinado", "Banco de supino inclinado"],
      ["banco_supino_declinado", "Banco de supino declinado"],
      ["banco_scott", "Banco Scott"],
      ["banco_romano", "Banco romano / lombar"],
      ["banco_abdominal", "Banco abdominal"]
    ]
  },
  {
    id: "cardio",
    nome: "Cardio",
    itens: [
      ["esteira", "Esteira"],
      ["bike_vertical", "Bike vertical"],
      ["bike_horizontal", "Bike horizontal"],
      ["bike_spinning", "Bike de spinning"],
      ["air_bike", "Air Bike"],
      ["eliptico", "Elíptico"],
      ["escada", "Escada / Stair Climber"],
      ["remo_ergometro", "Remo ergométrico"],
      ["ski_erg", "Ski Erg"]
    ]
  },
  {
    id: "pesos_livres",
    nome: "Pesos livres",
    itens: [
      ["halteres", "Halteres"],
      ["barra_olimpica", "Barra olímpica"],
      ["barra_reta", "Barra reta"],
      ["barra_w", "Barra W / EZ"],
      ["barra_hexagonal", "Barra hexagonal / Trap Bar"],
      ["anilhas", "Anilhas"],
      ["anilhas_olimpicas", "Anilhas olímpicas"],
      ["kettlebells", "Kettlebells"],
      ["presilhas", "Presilhas para barras"]
    ]
  },
  {
    id: "acessorios_polia",
    nome: "Acessórios de polia",
    itens: [
      ["corda_triceps", "Corda de tríceps"],
      ["barra_reta_polia", "Barra reta para polia"],
      ["barra_curva_polia", "Barra curva para polia"],
      ["puxador_aberto", "Puxador aberto"],
      ["puxador_fechado", "Puxador fechado / Triângulo"],
      ["pegador_unilateral", "Pegador unilateral"],
      ["pegador_d", "Pegador tipo D"],
      ["tornozeleira_polia", "Tornozeleira para polia"]
    ]
  },
  {
    id: "funcional",
    nome: "Funcional e acessórios",
    itens: [
      ["trx", "TRX"],
      ["faixa_elastica", "Faixa elástica"],
      ["mini_band", "Mini Band"],
      ["tubo_elastico", "Tubo elástico"],
      ["corda_naval", "Corda naval"],
      ["medicine_ball", "Medicine Ball"],
      ["slam_ball", "Slam Ball"],
      ["bola_suica", "Bola suíça"],
      ["bosu", "Bosu"],
      ["step", "Step"],
      ["caixa_plyo", "Caixa / Box Jump"],
      ["jump", "Jump / Mini trampolim"],
      ["caneleiras", "Caneleiras"],
      ["colchonetes", "Colchonetes"],
      ["roda_abdominal", "Roda abdominal"],
      ["foam_roller", "Rolo de liberação / Foam Roller"],
      ["straps", "Straps"],
      ["cinturao_carga", "Cinturão para carga"],
      ["colete_carga", "Colete de carga"],
      ["cones", "Cones"],
      ["escada_agilidade", "Escada de agilidade"]
    ]
  }
].map(categoria => ({
  ...categoria,
  itens: categoria.itens.map(([id, nome]) => ({ id, nome }))
}));

const IDS_VALIDOS = new Set(
  CATALOGO.flatMap(categoria => categoria.itens.map(item => item.id))
);

function texto(valor = "") {
  return String(valor || "").trim();
}

function normalizarSelecionados(valor) {
  const lista = Array.isArray(valor) ? valor : [];

  return [...new Set(
    lista
      .map(texto)
      .filter(id => IDS_VALIDOS.has(id))
  )].sort();
}

export function catalogoEquipamentosAcademia() {
  return CATALOGO.map(categoria => ({
    ...categoria,
    itens: categoria.itens.map(item => ({ ...item }))
  }));
}

export async function obterConfiguracaoEquipamentosAcademia() {
  const configuracao = await lerEquipamentosAcademia();
  const selecionados = normalizarSelecionados(configuracao?.selecionados);

  return {
    schemaVersion: 1,
    categorias: catalogoEquipamentosAcademia(),
    selecionados,
    totalSelecionados: selecionados.length,
    atualizadoEm: configuracao?.atualizadoEm || null,
    atualizadoPor: configuracao?.atualizadoPor || null
  };
}

export async function atualizarConfiguracaoEquipamentosAcademia(
  selecionados = [],
  usuario = {}
) {
  const limpos = normalizarSelecionados(selecionados);

  const dados = {
    schemaVersion: 1,
    selecionados: limpos,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: {
      id: texto(usuario?.id),
      nome: texto(usuario?.nome),
      perfil: texto(usuario?.perfil)
    }
  };

  await salvarEquipamentosAcademia(dados);

  return {
    ...dados,
    categorias: catalogoEquipamentosAcademia(),
    totalSelecionados: limpos.length
  };
}
