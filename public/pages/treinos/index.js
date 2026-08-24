let biblioteca = { grupos: [], objetivos: [], exercicios: [] };
let alunos = [];
let professores = [];
let divisoes = [{ nome: "A", itens: [] }, { nome: "B", itens: [] }, { nome: "C", itens: [] }];
let divisaoAtiva = 0;
let treinoAtualId = "";
let carregandoTreinoAluno = false;

const $ = (id) => document.getElementById(id);
const metodos = ["Convencional", "Bi-set", "Tri-set", "Drop-set", "Rest-pause", "FST-7", "Pirâmide", "Pirâmide inversa", "Circuito", "Super-série", "Pré-exaustão", "Pós-exaustão"];
const fotoFallback = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='#edf2f7'/><text x='50%' y='52%' text-anchor='middle' font-size='14' fill='#64748b'>Exercício</text></svg>`);

function sessaoProfessorLogado() {
  try {
    const sessao = JSON.parse(localStorage.getItem("fusion_professor_sessao") || "null");
    if (sessao?.professorId) return sessao;
  } catch {}

  try {
    const professor = JSON.parse(localStorage.getItem("fusion_professor_portal") || "null");
    if (professor?.id || professor?.professorId) {
      return {
        professorId: String(professor.id || professor.professorId),
        professorNome: professor.nome || professor.professorNome || professor.name || "Professor"
      };
    }
  } catch {}

  const params = new URLSearchParams(location.search);
  const professorId = params.get("professorId") || params.get("professor_id");
  if (professorId) {
    return {
      professorId,
      professorNome: params.get("professorNome") || params.get("professor") || "Professor"
    };
  }

  return null;
}

function headersAutenticados(headers = {}) {
  const sessao = sessaoProfessorLogado();
  return sessao?.token ? { ...headers, Authorization: `Bearer ${sessao.token}` } : { ...headers };
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function statusAlunoAtivo(aluno = {}) {
  const statusCadastro = normalizarTexto(aluno.status || aluno.situacao || aluno.statusCadastro || "ativo");
  const statusMatricula = normalizarTexto(aluno.statusMatricula || aluno.matriculaStatus || aluno.status_matricula || "ativa");

  const cadastroAtivo = ["ativo", "ativa", "regular"].includes(statusCadastro);
  const matriculaAtiva = ["ativo", "ativa", "regular"].includes(statusMatricula);

  return cadastroAtivo && matriculaAtiva;
}

function nomesEquivalentes(a, b) {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Compatibilidade com cadastros antigos: "marcos andre" x "MARCOS ANDRE DE SOUZA".
  if (na.length >= 6 && nb.includes(na)) return true;
  if (nb.length >= 6 && na.includes(nb)) return true;
  return false;
}

function alunoPertenceAoProfessor(aluno = {}, sessao = null) {
  if (!sessao?.professorId) return true;

  const professorId = String(sessao.professorId || "").trim();
  const professorLogado = professores.find((p) => String(idPessoa(p)) === professorId) || null;
  const nomesProfessor = [
    sessao.professorNome,
    professorLogado?.nome,
    professorLogado?.professorNome,
    professorLogado?.name
  ].filter(Boolean);

  const ids = [
    aluno.professorId,
    aluno.professor_id,
    aluno.idProfessor,
    aluno.professorResponsavelId,
    aluno.professor_responsavel,
    aluno.professor_responsavel_id
  ].filter(Boolean).map((v) => String(v).trim());

  if (professorId && ids.some((id) => id === professorId)) return true;

  const nomesAluno = [
    aluno.professorNome,
    aluno.professor_nome,
    aluno.professor,
    aluno.professorResponsavel,
    aluno.nomeProfessor
  ].filter(Boolean);

  return nomesAluno.some((nomeAluno) =>
    nomesProfessor.some((nomeProfessor) => nomesEquivalentes(nomeAluno, nomeProfessor))
  );
}

function ehResponsavelTecnico(sessao = sessaoProfessorLogado()) {
  const perfil = normalizarTexto(sessao?.perfil || sessao?.tipoPerfil || sessao?.funcao || "");
  return sessao?.acessoTodosAlunos === true ||
    perfil === "responsavel_tecnico" ||
    perfil === "responsavel-tecnico" ||
    perfil === "responsavel tecnico";
}

function filtrarAlunosDoProfessor(lista = []) {
  const sessao = sessaoProfessorLogado();

  // O responsável técnico acessa todos os alunos ATIVOS,
  // mesmo sem vínculo direto com um professor específico.
  if (ehResponsavelTecnico(sessao)) {
    return (Array.isArray(lista) ? lista : []).filter(statusAlunoAtivo);
  }

  return lista.filter((aluno) => {
    if (!statusAlunoAtivo(aluno)) return false;
    if (!sessao?.professorId) return true;
    return alunoPertenceAoProfessor(aluno, sessao);
  });
}

async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: headersAutenticados(opts.headers || {}) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, mensagem: data.mensagem || data.erro || `Erro HTTP ${r.status}`, ...data };
  return data;
}

function listaDe(resposta) {
  if (Array.isArray(resposta)) return resposta;
  if (Array.isArray(resposta.dados)) return resposta.dados;
  if (Array.isArray(resposta.data)) return resposta.data;
  if (Array.isArray(resposta.alunos)) return resposta.alunos;
  if (Array.isArray(resposta.professores)) return resposta.professores;
  if (Array.isArray(resposta.treinos)) return resposta.treinos;
  if (resposta.dados && Array.isArray(resposta.dados.treinos)) return resposta.dados.treinos;
  if (Array.isArray(resposta.items)) return resposta.items;
  if (resposta.dados && Array.isArray(resposta.dados.itens)) return resposta.dados.itens;
  return [];
}

function nomePessoa(p) {
  return p.nome || p.nomeCompleto || p.alunoNome || p.professorNome || p.name || p.razaoSocial || "Sem nome";
}

function idPessoa(p) {
  return String(p.id ?? p.codigo ?? p.alunoId ?? p.professorId ?? p.matriculaId ?? p.cpf ?? nomePessoa(p));
}

function textoBuscaAluno(a) {
  return [nomePessoa(a), a.cpf, a.telefone, a.celular, a.email, a.matricula, a.codigo, a.id].filter(Boolean).join(" ").toLowerCase();
}

function normalizarExercicio(ex = {}) {
  const midia = ex.imagemUrl || ex.midia || ex.foto || ex.gif || "";
  return {
    ...ex,
    id: Number(ex.id) || ex.id,
    imagemUrl: ex.imagemUrl || midia,
    midia: ex.midia || midia,
    foto: midia || fotoFallback,
    gif: ""
  };
}


function bibliotecaValida(valor) {
  return Boolean(valor && Array.isArray(valor.exercicios) && valor.exercicios.length);
}

function popularFiltros() {
  $("grupoFiltro").innerHTML = `<option value="">Todos os grupos</option>` + (biblioteca.grupos || []).map(g => `<option value="${g.id}">${g.nome}</option>`).join("");
  $("objetivo").innerHTML = `<option value="">Selecione</option>` + (biblioteca.objetivos || []).map(o => `<option value="${o.nome}">${o.nome}</option>`).join("");
}

function renderAlunos() {
  const termo = ($("buscaAluno").value || "").toLowerCase().trim();
  const lista = alunos
    .filter(a => !termo || textoBuscaAluno(a).includes(termo))
    .sort((a, b) => nomePessoa(a).localeCompare(nomePessoa(b), "pt-BR", { sensitivity: "base" }))
    .slice(0, 250);

  $("alunoSelect").innerHTML = `<option value="">Selecione o aluno</option>` + lista.map(a => {
    const id = idPessoa(a);
    const nome = nomePessoa(a).toLocaleUpperCase("pt-BR");
    const extra = a.cpf || a.telefone || a.celular || a.email || a.matricula || "";
    return `<option value="${id}">${nome}${extra ? ` · ${extra}` : ""}</option>`;
  }).join("");
}

function renderProfessores() {
  const select = $("professorSelect");
  const sessao = sessaoProfessorLogado();

  select.innerHTML = `<option value="">Selecione o professor</option>` + professores.map(p => {
    const id = idPessoa(p);
    const nome = nomePessoa(p);
    const extra = p.especialidade || p.cargo || p.cref || p.email || "";
    return `<option value="${id}">${nome}${extra ? ` · ${extra}` : ""}</option>`;
  }).join("");

  if (sessao?.professorId) {
    const existe = Array.from(select.options).some((opt) => String(opt.value) === String(sessao.professorId));

    if (!existe) {
      const opt = document.createElement("option");
      opt.value = sessao.professorId;
      opt.textContent = sessao.professorNome || "Professor logado";
      select.appendChild(opt);
    }

    select.value = String(sessao.professorId);
    select.disabled = true;
    select.classList.add("readonly");
  } else {
    select.disabled = false;
    select.classList.remove("readonly");
  }
}

function renderExercicios() {
  const busca = ($("busca").value || "").toLowerCase();
  const grupo = $("grupoFiltro").value;
  const lista = (biblioteca.exercicios || [])
    .filter(e => (!grupo || String(e.grupoId) === String(grupo)) && (!busca || [e.nome, e.musculos, e.grupo].join(" ").toLowerCase().includes(busca)))
    .slice(0, 250);

  $("listaExercicios").innerHTML = lista.map(e => `
    <div class="ex" draggable="true" data-id="${e.id}">
      <img src="${e.foto}" onerror="this.src='${fotoFallback}'">
      <div>
        <strong>${e.nome}</strong>
        <small>${e.grupo || ""}${e.musculos ? ` · ${e.musculos}` : ""}</small>
        <div class="ex-actions">
          <button class="btn" data-add="${e.id}">Adicionar</button>
          <button class="btn ghost" data-view="${e.id}">Visualizar</button>
        </div>
      </div>
    </div>`).join("") || `<div class="empty">Nenhum exercício encontrado.</div>`;

  document.querySelectorAll("[data-add]").forEach(b => b.onclick = () => adicionarExercicio(b.dataset.add, divisaoAtiva));
  document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => visualizarExercicio(b.dataset.view));
  document.querySelectorAll(".ex").forEach(el => el.ondragstart = (ev) => ev.dataTransfer.setData("text/plain", el.dataset.id));
}

function visualizarExercicio(id) {
  const e = biblioteca.exercicios.find(x => String(x.id) === String(id));
  if (!e) return;
  alert(`${e.nome}\n\nGrupo: ${e.grupo || "-"}\nMúsculos: ${e.musculos || "-"}\n\n${e.descricao || ""}`);
}

function proximaLetra() {
  let n = divisoes.length;
  let s = "";
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

function adicionarDivisao() {
  divisoes.push({ nome: proximaLetra(), itens: [] });
  divisaoAtiva = divisoes.length - 1;
  renderDivisoes();
  agendarRegistroRevisaoAssistente();
}

function selecionarDivisao(idx) {
  if (!divisoes[idx]) return;
  divisaoAtiva = idx;
  renderDivisoes();
}

function adicionarExercicio(id, idx) {
  const ex = biblioteca.exercicios.find(e => String(e.id) === String(id));
  if (!ex || !divisoes[idx]) return;
  divisoes[idx].itens.push({
    ...ex,
    series: "3",
    repeticoes: "10",
    carga: "",
    descanso: "60s",
    metodo: "Convencional",
    cadencia: "",
    obs: ""
  });
  renderDivisoes();
  agendarRegistroRevisaoAssistente();
}

function renderAbasDivisoes() {
  const alvo = $("abasDivisoes");
  if (!alvo) return;
  alvo.innerHTML = divisoes.map((d, idx) => `
    <button type="button" class="aba-divisao ${idx === divisaoAtiva ? "ativa" : ""}" data-aba="${idx}">
      Treino ${d.nome} <span>${(d.itens || []).length}</span>
    </button>`).join("") + `<button type="button" class="aba-divisao aba-mais" id="addDivisaoAba" title="Adicionar divisão">+</button>`;

  document.querySelectorAll("[data-aba]").forEach(b => b.onclick = () => selecionarDivisao(Number(b.dataset.aba)));
  const add = $("addDivisaoAba");
  if (add) add.onclick = adicionarDivisao;
}

function renderDivisoes() {
  if (divisaoAtiva >= divisoes.length) divisaoAtiva = Math.max(0, divisoes.length - 1);
  if (divisaoAtiva < 0) divisaoAtiva = 0;
  renderAbasDivisoes();

  const d = divisoes[divisaoAtiva] || { nome: "A", itens: [] };
  const idx = divisaoAtiva;

  $("divisoes").innerHTML = `
    <div class="divisao divisao-ativa">
      <div class="divisao-head">
        <h3>Treino ${d.nome}</h3>
        <div class="divisao-actions">
          <button class="btn" data-add-to-div="${idx}">+ Exercício</button>
          <button class="btn" data-remdiv="${idx}">Remover divisão</button>
        </div>
      </div>
      <div class="drop" data-drop="${idx}">
        ${(d.itens || []).map((it, i) => `
          <div class="item">
            <img src="${it.foto || it.gif || fotoFallback}" onerror="this.src='${fotoFallback}'">
            <div>
              <strong>${it.nome}</strong>
              <small>${it.grupo || ""}${it.musculos ? ` · ${it.musculos}` : ""}</small>
              <div class="prescricao">
                <input placeholder="Séries" value="${it.series || ""}" data-f="series" data-d="${idx}" data-i="${i}">
                <input placeholder="Reps" value="${it.repeticoes || ""}" data-f="repeticoes" data-d="${idx}" data-i="${i}">
                <input placeholder="Carga" value="${it.carga || ""}" data-f="carga" data-d="${idx}" data-i="${i}">
                <input placeholder="Descanso" value="${it.descanso || ""}" data-f="descanso" data-d="${idx}" data-i="${i}">
                <select data-f="metodo" data-d="${idx}" data-i="${i}">${metodos.map(m => `<option value="${m}" ${m === (it.metodo || "Convencional") ? "selected" : ""}>${m}</option>`).join("")}</select>
                <input placeholder="Cadência" value="${it.cadencia || ""}" data-f="cadencia" data-d="${idx}" data-i="${i}">
              </div>
              <input placeholder="Observação do exercício" value="${it.obs || ""}" data-f="obs" data-d="${idx}" data-i="${i}">
            </div>
            <button class="btn danger" data-rem="${idx}:${i}">×</button>
          </div>`).join("") || `<small>Arraste exercícios para o Treino ${d.nome} ou use o botão adicionar.</small>`}
      </div>
    </div>`;

  document.querySelectorAll("[data-drop]").forEach(z => {
    z.ondragover = e => e.preventDefault();
    z.ondrop = e => { e.preventDefault(); adicionarExercicio(e.dataTransfer.getData("text/plain"), Number(z.dataset.drop)); };
  });
  document.querySelectorAll("[data-f]").forEach(inp => inp.oninput = inp.onchange = () => {
    const d = Number(inp.dataset.d), i = Number(inp.dataset.i);

    if (divisoes[d]?.itens?.[i]) {
      divisoes[d].itens[i][inp.dataset.f] = inp.value;
      agendarRegistroRevisaoAssistente();
    }
  });
  document.querySelectorAll("[data-rem]").forEach(b => b.onclick = () => {
    const [d, i] = b.dataset.rem.split(":").map(Number);

    divisoes[d].itens.splice(i, 1);
    renderDivisoes();
    agendarRegistroRevisaoAssistente();
  });
  document.querySelectorAll("[data-remdiv]").forEach(b => b.onclick = () => {
    if (divisoes.length > 1) {
      divisoes.splice(Number(b.dataset.remdiv), 1);
      if (divisaoAtiva >= divisoes.length) divisaoAtiva = divisoes.length - 1;
      renderDivisoes();
      agendarRegistroRevisaoAssistente();
    }
  });
  document.querySelectorAll("[data-add-to-div]").forEach(b => b.onclick = () => {
    const primeiroVisivel = document.querySelector(".ex[data-id]");
    if (primeiroVisivel) adicionarExercicio(primeiroVisivel.dataset.id, Number(b.dataset.addToDiv));
  });
}


/* assistente-treino-regras-v1 */

function idadeAlunoAssistente(aluno = {}) {
  const bruto = String(
    aluno.data_nascimento ||
    aluno.dataNascimento ||
    aluno.nascimento ||
    ""
  ).trim();

  if (!bruto) return null;

  let dataNascimento = null;

  const iso = bruto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    dataNascimento = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3])
    );
  } else {
    const br = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) {
      dataNascimento = new Date(
        Number(br[3]),
        Number(br[2]) - 1,
        Number(br[1])
      );
    }
  }

  if (!dataNascimento || Number.isNaN(dataNascimento.getTime())) {
    return null;
  }

  const hoje = new Date();

  let idade = hoje.getFullYear() - dataNascimento.getFullYear();

  const mes = hoje.getMonth() - dataNascimento.getMonth();

  if (
    mes < 0 ||
    (mes === 0 && hoje.getDate() < dataNascimento.getDate())
  ) {
    idade -= 1;
  }

  return idade >= 0 ? idade : null;
}


/* assistente-avaliacao-contexto-v1 */

let contextoAvaliacaoAssistente = null;
let contextoAvaliacaoAssistenteAlunoId = "";
let contextoAvaliacaoAssistenteCarregando = false;

/* assistente-aprendizado-front-v1 */

let assistenteAprendizadoExecucaoId = "";
let assistenteAprendizadoSugestaoId = "";
let assistenteAprendizadoPlanoOriginal = null;

/* assistente-aprendizado-revisao-front-v1 */

let assistenteAprendizadoPlanoUltimaRevisao = null;
let assistenteAprendizadoRevisaoTimer = null;
let assistenteAprendizadoRevisaoEmAndamento = false;
let assistenteAprendizadoRevisaoPendente = false;
let assistenteAprendizadoTotalRevisoes = 0;

/* treinos-versionamento-assistente-front-v1 */

let assistenteAprendizadoTreinoVersaoId = "";

/* assistente-aprovacao-automatica-front-v1 */

let assistenteAprendizadoAprovacaoPendente = false;

/* assistente-variacoes-controladas-v1 */

let assistenteVariacaoIndice = 0;
let assistenteVariacaoAssinatura = "";

/* assistente-preferencias-aprendidas-v1 */

let assistentePreferenciasAprendizado =
  new Map();

let assistentePreferenciasMeta = {
  exemplosAprovadosTotal: 0,
  exemplosConsiderados: 0,
  aplicado: false
};

function clonarPlanoAssistente(valor) {
  try {
    return JSON.parse(
      JSON.stringify(valor ?? null)
    );
  } catch {
    return null;
  }
}


function planoAtualAprendizadoAssistente() {
  return {
    divisoes: (Array.isArray(divisoes) ? divisoes : [])
      .map((divisao, indiceDivisao) => ({
        nome:
          String(
            divisao?.nome ||
            String.fromCharCode(65 + indiceDivisao)
          ).trim(),

        itens:
          (Array.isArray(divisao?.itens) ? divisao.itens : [])
            .map(item => ({
              id: String(item?.id || "").trim(),
              codigo: String(item?.codigo || "").trim(),
              nome: String(item?.nome || "").trim(),
              grupoId: String(item?.grupoId || "").trim(),
              grupo: String(item?.grupo || "").trim(),
              series: String(item?.series || ""),
              repeticoes: String(item?.repeticoes || ""),
              carga: String(item?.carga || ""),
              descanso: String(item?.descanso || ""),
              metodo: String(item?.metodo || ""),
              cadencia: String(item?.cadencia || ""),
              obs: String(item?.obs || "")
            }))
      }))
  };
}

function chaveDivisaoAprendizado(divisao, indice) {
  return String(
    divisao?.nome ||
    `DIVISAO_${indice}`
  ).trim();
}

function itensIndexadosAprendizado(divisao = {}) {
  const contadores = new Map();

  return (Array.isArray(divisao.itens) ? divisao.itens : [])
    .map((item, indice) => {
      const base =
        String(
          item?.id ||
          item?.codigo ||
          item?.nome ||
          `ITEM_${indice}`
        ).trim();

      const ocorrencia =
        (contadores.get(base) || 0) + 1;

      contadores.set(
        base,
        ocorrencia
      );

      return {
        chave: `${base}#${ocorrencia}`,
        item,
        indice
      };
    });
}

function diferencasPlanosAprendizado(
  antes = {},
  depois = {}
) {
  const alteracoes = [];

  const divisoesAntes =
    Array.isArray(antes.divisoes)
      ? antes.divisoes
      : [];

  const divisoesDepois =
    Array.isArray(depois.divisoes)
      ? depois.divisoes
      : [];

  const mapaAntes = new Map(
    divisoesAntes.map((divisao, indice) => [
      chaveDivisaoAprendizado(divisao, indice),
      divisao
    ])
  );

  const mapaDepois = new Map(
    divisoesDepois.map((divisao, indice) => [
      chaveDivisaoAprendizado(divisao, indice),
      divisao
    ])
  );

  for (const [nomeDivisao, divisaoAntes] of mapaAntes) {
    if (!mapaDepois.has(nomeDivisao)) {
      alteracoes.push({
        tipo: "divisao_removida",
        divisao: nomeDivisao,
        exercicioId: "",
        campo: "divisao",
        antes:
          `${Array.isArray(divisaoAntes.itens) ? divisaoAntes.itens.length : 0} exercício(s)`,
        depois: ""
      });
    }
  }

  for (const [nomeDivisao, divisaoDepois] of mapaDepois) {
    if (!mapaAntes.has(nomeDivisao)) {
      alteracoes.push({
        tipo: "divisao_adicionada",
        divisao: nomeDivisao,
        exercicioId: "",
        campo: "divisao",
        antes: "",
        depois:
          `${Array.isArray(divisaoDepois.itens) ? divisaoDepois.itens.length : 0} exercício(s)`
      });
    }
  }

  for (const [nomeDivisao, divisaoAntes] of mapaAntes) {
    const divisaoDepois =
      mapaDepois.get(nomeDivisao);

    if (!divisaoDepois) continue;

    const itensAntes =
      itensIndexadosAprendizado(divisaoAntes);

    const itensDepois =
      itensIndexadosAprendizado(divisaoDepois);

    const mapaItensAntes = new Map(
      itensAntes.map(registro => [
        registro.chave,
        registro.item
      ])
    );

    const mapaItensDepois = new Map(
      itensDepois.map(registro => [
        registro.chave,
        registro.item
      ])
    );

    for (const [chave, itemAntes] of mapaItensAntes) {
      if (!mapaItensDepois.has(chave)) {
        alteracoes.push({
          tipo: "exercicio_removido",
          divisao: nomeDivisao,
          exercicioId:
            String(
              itemAntes.id ||
              itemAntes.codigo ||
              ""
            ),
          campo: "exercicio",
          antes:
            String(itemAntes.nome || ""),
          depois: ""
        });
      }
    }

    for (const [chave, itemDepois] of mapaItensDepois) {
      if (!mapaItensAntes.has(chave)) {
        alteracoes.push({
          tipo: "exercicio_adicionado",
          divisao: nomeDivisao,
          exercicioId:
            String(
              itemDepois.id ||
              itemDepois.codigo ||
              ""
            ),
          campo: "exercicio",
          antes: "",
          depois:
            String(itemDepois.nome || "")
        });
      }
    }

    const campos = [
      "series",
      "repeticoes",
      "carga",
      "descanso",
      "metodo",
      "cadencia",
      "obs"
    ];

    for (const [chave, itemAntes] of mapaItensAntes) {
      const itemDepois =
        mapaItensDepois.get(chave);

      if (!itemDepois) continue;

      campos.forEach(campo => {
        const valorAntes =
          String(itemAntes?.[campo] || "");

        const valorDepois =
          String(itemDepois?.[campo] || "");

        if (valorAntes === valorDepois) {
          return;
        }

        alteracoes.push({
          tipo: "campo_alterado",
          divisao: nomeDivisao,
          exercicioId:
            String(
              itemDepois.id ||
              itemDepois.codigo ||
              itemAntes.id ||
              itemAntes.codigo ||
              ""
            ),
          campo,
          antes: valorAntes,
          depois: valorDepois
        });
      });
    }
  }

  return alteracoes.slice(0, 300);
}

async function registrarRevisaoAprendizadoAssistente() {
  if (
    !assistenteAprendizadoExecucaoId ||
    !assistenteAprendizadoSugestaoId ||
    !assistenteAprendizadoPlanoUltimaRevisao
  ) {
    return false;
  }

  if (assistenteAprendizadoRevisaoEmAndamento) {
    assistenteAprendizadoRevisaoPendente = true;
    return false;
  }

  const aluno =
    alunoSelecionadoAtual();

  const alunoId =
    String(
      idPessoa(aluno || {}) || ""
    ).trim();

  if (!alunoId) {
    return false;
  }

  const antes =
    clonarPlanoAssistente(
      assistenteAprendizadoPlanoUltimaRevisao
    );

  const depois =
    planoAtualAprendizadoAssistente();

  const alteracoes =
    diferencasPlanosAprendizado(
      antes,
      depois
    );

  if (!alteracoes.length) {
    return false;
  }

  assistenteAprendizadoRevisaoEmAndamento = true;

  try {
    const resposta = await api(
      "/api/treinos/assistente-aprendizado/revisao",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          alunoId,

          execucaoId:
            assistenteAprendizadoExecucaoId,

          sugestaoId:
            assistenteAprendizadoSugestaoId,

          antes,
          depois,
          alteracoes
        })
      }
    );

    if (resposta?.ok === false) {
      throw new Error(
        resposta?.mensagem ||
        "O banco de aprendizagem não confirmou a revisão."
      );
    }

    assistenteAprendizadoPlanoUltimaRevisao =
      clonarPlanoAssistente(depois);

    assistenteAprendizadoTotalRevisoes += 1;

    const status =
      $("assistenteStatus");

    if (status) {
      status.textContent =
        `Revisão registrada no banco de aprendizagem: ` +
        `${alteracoes.length} alteração(ões). ` +
        `Total de revisões desta sugestão: ` +
        `${assistenteAprendizadoTotalRevisoes}. ` +
        `Treino ainda não salvo/aprovado.`;

      status.classList.add("gerado");
    }

    return true;
  } catch (erro) {
    console.error(
      "Assistente Fusion: falha ao registrar revisão.",
      erro
    );

    const status =
      $("assistenteStatus");

    if (status) {
      status.textContent =
        "Atenção: a alteração ficou na tela, mas a revisão " +
        "ainda não foi registrada no banco de aprendizagem. " +
        String(
          erro?.message || ""
        );

      status.classList.remove("gerado");
    }

    return false;
  } finally {
    assistenteAprendizadoRevisaoEmAndamento = false;

    if (assistenteAprendizadoRevisaoPendente) {
      assistenteAprendizadoRevisaoPendente = false;

      setTimeout(
        registrarRevisaoAprendizadoAssistente,
        300
      );
    }
  }
}

function agendarRegistroRevisaoAssistente() {
  if (
    !assistenteAprendizadoExecucaoId ||
    !assistenteAprendizadoSugestaoId ||
    !assistenteAprendizadoPlanoUltimaRevisao
  ) {
    return;
  }

  if (assistenteAprendizadoRevisaoTimer) {
    clearTimeout(
      assistenteAprendizadoRevisaoTimer
    );
  }

  assistenteAprendizadoRevisaoTimer =
    setTimeout(() => {
      assistenteAprendizadoRevisaoTimer = null;

      registrarRevisaoAprendizadoAssistente();
    }, 1400);
}

function aguardarAssistente(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

async function garantirRevisaoAprendizadoAntesSalvar() {
  if (
    !assistenteAprendizadoExecucaoId ||
    !assistenteAprendizadoSugestaoId ||
    !assistenteAprendizadoPlanoUltimaRevisao
  ) {
    return true;
  }

  if (assistenteAprendizadoRevisaoTimer) {
    clearTimeout(
      assistenteAprendizadoRevisaoTimer
    );

    assistenteAprendizadoRevisaoTimer =
      null;
  }

  /*
   * Se o debounce disparou exatamente quando o professor
   * clicou em salvar, espera a gravação terminar.
   */
  const limite =
    Date.now() + 8000;

  while (
    assistenteAprendizadoRevisaoEmAndamento &&
    Date.now() < limite
  ) {
    await aguardarAssistente(100);
  }

  if (assistenteAprendizadoRevisaoEmAndamento) {
    throw new Error(
      "A revisão ainda está sendo registrada. Aguarde alguns segundos e tente novamente."
    );
  }

  const atual =
    planoAtualAprendizadoAssistente();

  const pendentesAntes =
    diferencasPlanosAprendizado(
      assistenteAprendizadoPlanoUltimaRevisao,
      atual
    );

  if (pendentesAntes.length) {
    await registrarRevisaoAprendizadoAssistente();
  }

  /*
   * Não permite criar a versão definitiva se alguma
   * alteração da tela ainda não estiver auditada.
   */
  const depois =
    planoAtualAprendizadoAssistente();

  const pendentesDepois =
    diferencasPlanosAprendizado(
      assistenteAprendizadoPlanoUltimaRevisao,
      depois
    );

  if (pendentesDepois.length) {
    throw new Error(
      "A última alteração do treino ainda não foi confirmada no banco de aprendizagem. O treino não foi salvo."
    );
  }

  return true;
}

async function registrarAprovacaoAprendizadoAssistente({
  alunoId,
  treinoVersaoId
}) {
  const idAluno =
    String(alunoId || "").trim();

  const idTreino =
    String(treinoVersaoId || "").trim();

  if (
    !idAluno ||
    !idTreino ||
    !assistenteAprendizadoExecucaoId ||
    !assistenteAprendizadoSugestaoId
  ) {
    throw new Error(
      "Rastreabilidade incompleta para aprovar o treino no banco de aprendizagem."
    );
  }

  /*
   * O backend não confia no plano da tela.
   * Enviamos apenas os identificadores da cadeia.
   * O plano final é lido do treino versionado no servidor.
   */
  const resposta =
    await api(
      "/api/treinos/assistente-aprendizado/aprovacao",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          alunoId:
            idAluno,

          execucaoId:
            assistenteAprendizadoExecucaoId,

          sugestaoId:
            assistenteAprendizadoSugestaoId,

          treinoVersaoId:
            idTreino
        })
      }
    );

  if (
    resposta?.ok === false ||
    !resposta?.dados?.id
  ) {
    throw new Error(
      resposta?.mensagem ||
      "O servidor não confirmou a aprovação para o banco de aprendizagem."
    );
  }

  return resposta.dados;
}

function resetarAprendizadoAssistente() {
  assistenteAprendizadoExecucaoId = "";
  assistenteAprendizadoSugestaoId = "";
  assistenteAprendizadoPlanoOriginal = null;
  assistenteAprendizadoPlanoUltimaRevisao = null;
  assistenteAprendizadoRevisaoEmAndamento = false;
  assistenteAprendizadoRevisaoPendente = false;
  assistenteAprendizadoTotalRevisoes = 0;
  assistenteAprendizadoTreinoVersaoId = "";
  assistenteAprendizadoAprovacaoPendente = false;

  if (assistenteAprendizadoRevisaoTimer) {
    clearTimeout(
      assistenteAprendizadoRevisaoTimer
    );

    assistenteAprendizadoRevisaoTimer = null;
  }
}

async function registrarGeracaoAprendizadoAssistente({
  aluno,
  contexto,
  divisoesGeradas,
  objetivo,
  nivel,
  frequencia,
  duracao,
  briefing
}) {
  const alunoId = String(
    idPessoa(aluno || {}) || ""
  ).trim();

  if (!alunoId) {
    throw new Error(
      "Aluno não identificado para registrar o aprendizado."
    );
  }

  if (!contexto?.avaliacao?.id) {
    throw new Error(
      "Avaliação física não identificada para registrar o aprendizado."
    );
  }

  const contextoAprendizado = {
    ...contexto,

    prescricao: {
      ...(contexto.prescricao || {}),

      objetivoPrincipal:
        String(objetivo || "").trim(),

      experiencia:
        String(nivel || "").trim(),

      frequenciaSemanal:
        Number(frequencia || 0) || null,

      duracaoSessaoMin:
        Number(duracao || 0) || null,

      briefingProfessor:
        clonarPlanoAssistente(
          briefing
        ) || null
    },

    equipamentos:
      Array.from(
        equipamentosAcademiaAssistente
      )
  };

  const planoGerado = {
    divisoes:
      clonarPlanoAssistente(
        divisoesGeradas
      ) || []
  };

  const resposta = await api(
    "/api/treinos/assistente-aprendizado/geracao",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        alunoId,

        avaliacaoId:
          contexto.avaliacao.id,

        provedor:
          "regras_local",

        modelo:
          "fusion-regras-v1",

        versaoMotor:
          "2026-08-22-local-briefing-v1",

        contexto:
          contextoAprendizado,

        sugestao:
          planoGerado
      })
    }
  );

  if (
    resposta?.ok === false ||
    !resposta?.dados?.execucaoId ||
    !resposta?.dados?.sugestaoId
  ) {
    throw new Error(
      resposta?.mensagem ||
      "O banco de aprendizagem não confirmou o registro da geração."
    );
  }

  assistenteAprendizadoExecucaoId =
    String(
      resposta.dados.execucaoId
    );

  assistenteAprendizadoSugestaoId =
    String(
      resposta.dados.sugestaoId
    );

  assistenteAprendizadoPlanoOriginal =
    clonarPlanoAssistente(
      planoGerado
    );

  assistenteAprendizadoPlanoUltimaRevisao =
    clonarPlanoAssistente(
      planoGerado
    );

  assistenteAprendizadoTotalRevisoes = 0;

  return resposta.dados;
}

function escaparAssistente(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function contextoAssistenteAtual() {
  const aluno = alunoSelecionadoAtual();
  const alunoId = String(idPessoa(aluno || {}) || "").trim();

  if (
    !alunoId ||
    alunoId !== contextoAvaliacaoAssistenteAlunoId
  ) {
    return null;
  }

  return contextoAvaliacaoAssistente;
}

function selecionarValorAssistente(id, valor) {
  const select = $(id);
  const desejado = String(valor ?? "").trim();

  if (!select || !desejado) return false;

  const normalizadoDesejado = normalizarTexto(desejado);

  const opcao = Array.from(select.options || []).find(opt => {
    const valorOpcao = normalizarTexto(
      opt.value || opt.textContent || ""
    );

    return (
      valorOpcao === normalizadoDesejado ||
      valorOpcao.includes(normalizadoDesejado) ||
      normalizadoDesejado.includes(valorOpcao)
    );
  });

  if (!opcao) return false;

  select.value = opcao.value;
  return true;
}

function aplicarContextoAvaliacaoAssistente() {
  const contexto = contextoAssistenteAtual();
  if (!contexto?.avaliacao) return;

  selecionarValorAssistente(
    "objetivo",
    contexto.prescricao?.objetivoPrincipal
  );

  selecionarValorAssistente(
    "assistenteNivel",
    contexto.prescricao?.experiencia
  );

  selecionarValorAssistente(
    "assistenteFrequencia",
    contexto.prescricao?.frequenciaSemanal
  );

  selecionarValorAssistente(
    "assistenteDuracao",
    contexto.prescricao?.duracaoSessaoMin
  );
}

async function carregarContextoAvaliacaoAssistente() {
  resetarAprendizadoAssistente();

  const aluno = alunoSelecionadoAtual();
  const alunoId = String(idPessoa(aluno || {}) || "").trim();

  contextoAvaliacaoAssistente = null;
  contextoAvaliacaoAssistenteAlunoId = alunoId;
  contextoAvaliacaoAssistenteCarregando = Boolean(alunoId);

  if (!alunoId) {
    contextoAvaliacaoAssistenteCarregando = false;
    return false;
  }

  const status = $("assistenteStatus");

  if (status) {
    status.textContent = "Carregando avaliação física do aluno...";
    status.classList.remove("gerado");
  }

  try {
    const resposta = await api(
      `/api/treinos/assistente-contexto/${encodeURIComponent(alunoId)}`
    );

    if (
      resposta?.ok === false ||
      !resposta?.dados
    ) {
      throw new Error(
        resposta?.mensagem ||
        "Contexto da avaliação indisponível."
      );
    }

    contextoAvaliacaoAssistente = resposta.dados;

    aplicarContextoAvaliacaoAssistente();

    return true;
  } catch (erro) {
    console.error(
      "Erro ao carregar avaliação física para o assistente.",
      erro
    );

    contextoAvaliacaoAssistente = {
      avaliacao: null,
      prontoParaGerar: false,
      motivosBloqueio: [
        erro?.message ||
        "Não foi possível carregar a avaliação física."
      ],
      atencoes: [],
      prescricao: {},
      seguranca: {}
    };

    return false;
  } finally {
    contextoAvaliacaoAssistenteCarregando = false;
  }
}


function restricoesAlunoAssistente(aluno = {}) {
  const contexto = contextoAssistenteAtual();
  const seguranca = contexto?.seguranca || {};

  return [
    seguranca.restricoesMedicas,
    seguranca.lesoes,
    seguranca.dorAtual === "sim"
      ? `Dor atual${seguranca.dorRegiao ? `: ${seguranca.dorRegiao}` : ""}`
      : "",
    seguranca.limitacaoMovimento,
    aluno.restricoes_medicas,
    aluno.restricoesMedicas,
    aluno.restricoes,
    aluno.lesoes,
    aluno.lesões
  ]
    .map(v => String(v || "").trim())
    .filter(Boolean)
    .filter((v, i, lista) => lista.indexOf(v) === i)
    .join(" · ");
}

function sincronizarObjetivoAlunoAssistente(aluno = {}) {
  const select = $("objetivo");
  if (!select || select.value) return;

  const objetivoAluno = String(aluno.objetivo || "").trim();
  if (!objetivoAluno) return;

  const normalizado = normalizarTexto(objetivoAluno);

  const opcao = Array.from(select.options).find(opt => {
    const texto = normalizarTexto(opt.value || opt.textContent);
    return texto === normalizado ||
      texto.includes(normalizado) ||
      normalizado.includes(texto);
  });

  if (opcao) select.value = opcao.value;
}

function renderAssistenteAluno() {
  const box = $("assistenteAlunoResumo");
  const alerta = $("assistenteAtencao");

  if (!box || !alerta) return;

  const aluno = alunoSelecionadoAtual();

  if (!aluno) {
    box.innerHTML =
      "<strong>Nenhum aluno selecionado.</strong> Selecione o aluno acima.";
    alerta.hidden = true;
    return;
  }

  if (contextoAvaliacaoAssistenteCarregando) {
    box.innerHTML =
      "<strong>Carregando avaliação física...</strong>";
    alerta.hidden = true;
    return;
  }

  const contexto = contextoAssistenteAtual();

  if (!contexto?.avaliacao) {
    sincronizarObjetivoAlunoAssistente(aluno);

    const idade = idadeAlunoAssistente(aluno);
    const objetivo =
      $("objetivo")?.value ||
      aluno.objetivo ||
      "Não informado";

    box.innerHTML = `
      <div>
        <span>Aluno</span>
        <strong>${escaparAssistente(nomePessoa(aluno))}</strong>
      </div>
      <div>
        <span>Idade</span>
        <strong>${idade === null ? "Não informada" : `${idade} anos`}</strong>
      </div>
      <div>
        <span>Avaliação física</span>
        <strong>Nenhuma concluída</strong>
      </div>
      <div>
        <span>Objetivo cadastral</span>
        <strong>${escaparAssistente(objetivo)}</strong>
      </div>
    `;

    alerta.hidden = false;
    alerta.textContent =
      contexto?.motivosBloqueio?.join(" · ") ||
      "Conclua uma Avaliação Física profissional antes de usar o Assistente Fusion.";

    return;
  }

  aplicarContextoAvaliacaoAssistente();

  const idade =
    contexto.idade ??
    idadeAlunoAssistente(aluno);

  const objetivo =
    contexto.prescricao?.objetivoPrincipal ||
    $("objetivo")?.value ||
    aluno.objetivo ||
    "Não informado";

  const nivel =
    contexto.prescricao?.experiencia ||
    "Não informado";

  const frequencia =
    contexto.prescricao?.frequenciaSemanal;

  const duracao =
    contexto.prescricao?.duracaoSessaoMin;

  const restricoes =
    restricoesAlunoAssistente(aluno);

  const avaliacaoData =
    contexto.avaliacao?.data ||
    "Data não informada";

  const situacao =
    contexto.prontoParaGerar
      ? "Liberada para sugestão"
      : "Revisão necessária";

  box.innerHTML = `
    <div>
      <span>Aluno</span>
      <strong>${escaparAssistente(nomePessoa(aluno))}</strong>
    </div>
    <div>
      <span>Idade</span>
      <strong>${idade === null ? "Não informada" : `${idade} anos`}</strong>
    </div>
    <div>
      <span>Avaliação física</span>
      <strong>${escaparAssistente(avaliacaoData)}</strong>
    </div>
    <div>
      <span>Situação</span>
      <strong>${escaparAssistente(situacao)}</strong>
    </div>
    <div>
      <span>Objetivo</span>
      <strong>${escaparAssistente(objetivo)}</strong>
    </div>
    <div>
      <span>Experiência</span>
      <strong>${escaparAssistente(nivel)}</strong>
    </div>
    <div>
      <span>Frequência</span>
      <strong>${frequencia ? `${frequencia}x/semana` : "Não informada"}</strong>
    </div>
    <div>
      <span>Duração</span>
      <strong>${duracao ? `${duracao} min` : "Não informada"}</strong>
    </div>
    <div>
      <span>Restrições / lesões</span>
      <strong>${escaparAssistente(restricoes || "Nenhuma informada")}</strong>
    </div>
  `;

  const mensagens = [
    ...(contexto.motivosBloqueio || []),
    ...(contexto.atencoes || [])
  ];

  if (mensagens.length) {
    alerta.hidden = false;
    alerta.textContent =
      "Atenção: " + mensagens.join(" · ");
  } else {
    alerta.hidden = true;
    alerta.textContent = "";
  }
}

function categoriaExercicioAssistente(ex = {}) {
  const nome = normalizarTexto(ex.nome || "");
  const musculos = normalizarTexto(ex.musculos || "");
  const grupoId = String(ex.grupoId || "").trim();

  // Movimento principal primeiro.
  if (/abdominal|abdome|crunch|prancha|pallof|core/.test(nome)) {
    return "core";
  }

  if (/supino fechado/.test(nome)) {
    return "triceps";
  }

  if (/triceps/.test(nome)) {
    return "triceps";
  }

  if (/rosca|biceps/.test(nome)) {
    return "biceps";
  }

  if (
    /crucifixo inverso|face pull|elevacao lateral|elevacao frontal|desenvolvimento|shoulder press|remada alta/.test(nome)
  ) {
    return "ombro";
  }

  if (
    /supino|peck deck|pec deck|voador/.test(nome) ||
    (/crucifixo/.test(nome) && !/inverso/.test(nome))
  ) {
    return "peito";
  }

  if (
    !/gluteo/.test(nome) &&
    /remada|puxada|pulley|graviton|pulldown|pull down/.test(nome)
  ) {
    return "costas";
  }

  if (/panturrilha|flexao plantar|foot press/.test(nome)) {
    return "panturrilha";
  }

  if (
    /stiff|mesa flexora|banco flexor|flexao de joelho|good morning|levantamento terra/.test(nome)
  ) {
    return "posterior";
  }

  if (
    /gluteo|elevacao pelvica|hip thrust|abducao/.test(nome)
  ) {
    return "gluteo";
  }

  if (
    /agachamento|afundo|passada|leg press|extensao de joelho|banco extensor|hack|pistol squat/.test(nome)
  ) {
    return "quadriceps";
  }

  // Depois usa a classificação oficial.
  if (grupoId === "1") return "antebraco";
  if (grupoId === "2") return "abdominal";
  if (grupoId === "3") return "biceps";
  if (grupoId === "4") return "triceps";
  if (grupoId === "5") return "peito";
  if (grupoId === "7") return "gluteo";
  if (grupoId === "8") return "costas";
  if (grupoId === "9") return "ombro";

  if (grupoId === "6") {
    if (
      /biceps femoral|semitend|semimembr/.test(musculos) &&
      !/reto femoral|vasto/.test(musculos)
    ) {
      return "posterior";
    }

    if (
      /gastrocn|soleo/.test(musculos) &&
      !/reto femoral|vasto/.test(musculos)
    ) {
      return "panturrilha";
    }

    return "quadriceps";
  }

  return "outros";
}

function parametrosPrescricaoAssistente(objetivo, nivel, idade) {
  const obj = normalizarTexto(objetivo);

  let series = nivel === "iniciante" ? "2-3" : "3";
  let repeticoes = "10-12";
  let descanso = "60-90s";

  if (/hipertrof|massa/.test(obj)) {
    series = nivel === "iniciante" ? "3" : "3-4";
    repeticoes = "8-12";
    descanso = "60-90s";
  } else if (/forca|força/.test(obj)) {
    series = nivel === "iniciante" ? "3" : "3-4";
    repeticoes = nivel === "iniciante" ? "8-10" : "5-8";
    descanso = nivel === "iniciante" ? "90s" : "90-120s";
  } else if (/resistencia|resistência/.test(obj)) {
    series = "2-3";
    repeticoes = "12-20";
    descanso = "45-60s";
  } else if (
    /emagrec|condicion|perda de peso|definicao|definição/.test(obj)
  ) {
    series = "3";
    repeticoes = "12-15";
    descanso = "45-60s";
  } else if (/saude|saúde|qualidade|bem estar/.test(obj)) {
    series = "2-3";
    repeticoes = "10-15";
    descanso = "60s";
  }

  if (Number.isFinite(idade) && idade >= 65) {
    series = "2";
    repeticoes = "10-15";
    descanso = "60-90s";
  }

  if (Number.isFinite(idade) && idade >= 16 && idade < 18) {
    series = "2-3";
    repeticoes = "10-15";
    descanso = "60-90s";
  }

  return { series, repeticoes, descanso };
}

/* assistente-prescricao-contextual-v2 */
function papelPrescricaoAssistente(
  ex = {},
  principalDisponivel = true
) {
  const categoria =
    categoriaExercicioBriefingAssistente(ex);

  const nome =
    normalizarTexto(ex.nome || "");

  if (
    categoria === "abdominal" ||
    categoria === "core"
  ) {
    return "core";
  }

  if (categoria === "cardio") {
    return "condicionamento";
  }

  if (categoria === "mobilidade") {
    return "mobilidade";
  }

  if (
    [
      "biceps",
      "triceps",
      "antebraco",
      "panturrilha"
    ].includes(categoria)
  ) {
    return "isolador_acessorio";
  }

  if (
    /crucifixo|peck deck|pec deck|voador|elevacao lateral|elevacao frontal|coice|mesa flexora|banco flexor|flexao de joelho|cadeira extensora|banco extensor|extensao de joelho|abducao|aducao/.test(
      nome
    )
  ) {
    return "isolador_acessorio";
  }

  return principalDisponivel
    ? "principal_composto"
    : "secundario_composto";
}

function prescricaoPorPapelAssistente(
  papel,
  nivel,
  parametros
) {
  if (papel === "principal_composto") {
    if (nivel === "iniciante") {
      return {
        series: "3",
        repeticoes: "6-10",
        descanso: "120s"
      };
    }

    if (nivel === "avancado") {
      return {
        series: "3-4",
        repeticoes: "5-10",
        descanso: "120-180s"
      };
    }

    return {
      series: "3-4",
      repeticoes: "6-10",
      descanso: "120-180s"
    };
  }

  if (papel === "secundario_composto") {
    return {
      series:
        nivel === "iniciante"
          ? "2-3"
          : "3",
      repeticoes: "8-12",
      descanso: "90-120s"
    };
  }

  if (papel === "isolador_acessorio") {
    return {
      series:
        nivel === "iniciante"
          ? "2-3"
          : "2-4",
      repeticoes: "10-15",
      descanso: "60-90s"
    };
  }

  if (papel === "core") {
    return {
      series: "2-3",
      repeticoes: "10-20",
      descanso: "45-90s"
    };
  }

  return {
    series: parametros.series,
    repeticoes: parametros.repeticoes,
    descanso: parametros.descanso
  };
}

function prescreverExerciciosAssistente(
  exercicios = [],
  parametros = {},
  objetivo = "",
  nivel = "iniciante",
  idade = null
) {
  const obj =
    normalizarTexto(objetivo);

  const idadeNumero =
    Number(idade);

  const usarPrescricaoContextual =
    /hipertrof|massa/.test(obj) &&
    Number.isFinite(idadeNumero) &&
    idadeNumero >= 18 &&
    idadeNumero < 65;

  let principalDefinido = false;

  return (
    Array.isArray(exercicios)
      ? exercicios
      : []
  ).map(ex => {
    let prescricao = {
      series: parametros.series,
      repeticoes: parametros.repeticoes,
      descanso: parametros.descanso
    };

    if (usarPrescricaoContextual) {
      const papel =
        papelPrescricaoAssistente(
          ex,
          !principalDefinido
        );

      if (
        papel === "principal_composto"
      ) {
        principalDefinido = true;
      }

      prescricao =
        prescricaoPorPapelAssistente(
          papel,
          nivel,
          parametros
        );
    }

    return {
      ...normalizarExercicio(ex),
      series: prescricao.series,
      repeticoes: prescricao.repeticoes,
      carga: "",
      descanso: prescricao.descanso,
      metodo: "Convencional",
      cadencia: "",
      obs: ""
    };
  });
}

/* assistente-briefing-professor-v1 */

function adicionarCategoriaBriefing(lista, ...categorias) {
  for (const categoria of categorias) {
    const chave =
      String(categoria || "").trim();

    if (
      chave &&
      !lista.includes(chave)
    ) {
      lista.push(chave);
    }
  }

  return lista;
}

function categoriasDoTextoBriefingAssistente(valor = "") {
  const texto =
    normalizarTexto(valor);

  const categorias = [];

  /*
   * "Perna" significa conjunto de membros inferiores.
   * Se o professor quiser apenas um segmento, pode escrever
   * quadríceps, posterior, glúteos ou panturrilha.
   */
  if (
    /\bperna|\bpernas|membros inferiores/.test(texto)
  ) {
    adicionarCategoriaBriefing(
      categorias,
      "quadriceps",
      "posterior",
      "gluteo",
      "panturrilha"
    );
  }

  if (/peito|peitoral/.test(texto)) {
    adicionarCategoriaBriefing(
      categorias,
      "peito"
    );
  }

  if (/costas?|dorsal/.test(texto)) {
    adicionarCategoriaBriefing(
      categorias,
      "costas"
    );
  }

  if (/ombro|deltoid/.test(texto)) {
    adicionarCategoriaBriefing(
      categorias,
      "ombro"
    );
  }

  if (/biceps/.test(texto)) {
    adicionarCategoriaBriefing(
      categorias,
      "biceps"
    );
  }

  if (/triceps/.test(texto)) {
    adicionarCategoriaBriefing(
      categorias,
      "triceps"
    );
  }

  if (
    /ante ?braco|antebraco|punho/.test(texto)
  ) {
    adicionarCategoriaBriefing(
      categorias,
      "antebraco"
    );
  }

  if (/quadriceps/.test(texto)) {
    adicionarCategoriaBriefing(
      categorias,
      "quadriceps"
    );
  }

  if (
    /posterior|isquiotib|femoral/.test(texto)
  ) {
    adicionarCategoriaBriefing(
      categorias,
      "posterior"
    );
  }

  if (/gluteo/.test(texto)) {
    adicionarCategoriaBriefing(
      categorias,
      "gluteo"
    );
  }

  if (/panturrilha|gemeos/.test(texto)) {
    adicionarCategoriaBriefing(
      categorias,
      "panturrilha"
    );
  }

  if (
    /abdomen|abdominal/.test(texto)
  ) {
    adicionarCategoriaBriefing(
      categorias,
      "abdominal"
    );
  }

  if (
    /\bcore\b/.test(texto)
  ) {
    adicionarCategoriaBriefing(
      categorias,
      "core"
    );
  }

  if (
    /cardio|aerob|esteira|bicicleta|bike/.test(texto)
  ) {
    adicionarCategoriaBriefing(
      categorias,
      "cardio"
    );
  }

  if (
    /aquecimento|mobilidade|alongamento/.test(texto)
  ) {
    adicionarCategoriaBriefing(
      categorias,
      "mobilidade"
    );
  }

  return categorias;
}

function categoriaExercicioBriefingAssistente(ex = {}) {
  const nome =
    normalizarTexto(
      ex.nome || ""
    );

  const grupoId =
    String(
      ex.grupoId || ""
    ).trim();

  /*
   * Primeiro respeita grupos oficiais inequívocos.
   */
  if (grupoId === "1") {
    return "antebraco";
  }

  if (grupoId === "2") {
    /*
     * Pranchas/core explícito podem ser usados como core.
     * Os demais exercícios do grupo ABDOME permanecem abdominal.
     */
    if (
      /\bprancha\b|\bcore\b/.test(nome)
    ) {
      return "core";
    }

    return "abdominal";
  }

  /*
   * Cardio é identificado pelo próprio exercício,
   * não por palavras ocasionais da descrição.
   */
  if (
    /esteira|bicicleta|bike|spinning|ergometr|eliptic/.test(nome)
  ) {
    return "cardio";
  }

  /*
   * Mobilidade/aquecimento somente quando o nome representa
   * esse tipo de exercício. Evita falsos positivos na descrição.
   */
  if (
    /alongamento|mobilidade|aquecimento|rotacao articular/.test(nome)
  ) {
    return "mobilidade";
  }

  /*
   * Antebraço também pode ser reconhecido por nomenclatura,
   * inclusive em registros antigos sem grupoId correto.
   */
  if (
    /ante ?braco|antebraco|punho|rosca inversa|pronacao|supinacao/.test(nome)
  ) {
    return "antebraco";
  }

  return categoriaExercicioAssistente(ex);
}

function ordenarCategoriasBriefingAssistente(categorias = []) {
  const lista =
    Array.isArray(categorias)
      ? categorias.slice()
      : [];

  const inicio =
    lista.filter(
      item =>
        item === "mobilidade"
    );

  const apoio =
    lista.filter(
      item =>
        item === "abdominal" ||
        item === "core"
    );

  const final =
    lista.filter(
      item =>
        item === "cardio"
    );

  const principais =
    lista.filter(
      item =>
        ![
          "mobilidade",
          "abdominal",
          "core",
          "cardio"
        ].includes(item)
    );

  return [
    ...inicio,
    ...principais,
    ...apoio,
    ...final
  ];
}

function inferirFocoTextoBriefingAssistente(valor = "") {
  const texto =
    normalizarTexto(valor);

  if (
    !/foco|enfase/.test(texto)
  ) {
    return null;
  }

  const mapa = [
    ["gluteo", /gluteo/],
    ["peito", /peito|peitoral/],
    ["costas", /costas?|dorsal/],
    ["quadriceps", /quadriceps/],
    ["posterior", /posterior|isquiotib|femoral/],
    ["ombro", /ombro|deltoid/],
    ["biceps", /biceps/],
    ["triceps", /triceps/],
    ["antebraco", /ante ?braco|antebraco|punho/]
  ];

  const item =
    mapa.find(
      ([, regex]) =>
        regex.test(texto)
    );

  if (!item) return null;

  const vezesMatch =
    texto.match(
      /([1-3])\s*x/
    );

  return {
    categoria:
      item[0],

    vezes:
      vezesMatch
        ? Number(vezesMatch[1])
        : 1
  };
}

function aplicarCategoriaEmTreinosBriefing(
  modelos,
  categoria,
  quantidade,
  {
    repetirSeExistente = false
  } = {}
) {
  let faltam =
    Math.max(
      0,
      Number(quantidade || 0)
    );

  if (!faltam) return;

  /*
   * Primeiro utiliza divisões que já possuem o grupo.
   * Para "ênfase", repete a categoria e o seletor buscará
   * um segundo exercício diferente do mesmo grupo.
   */
  for (const modelo of modelos) {
    if (!faltam) break;

    if (
      modelo.categorias.includes(categoria)
    ) {
      if (repetirSeExistente) {
        const cardioIndex =
          modelo.categorias.indexOf("cardio");

        const pos =
          cardioIndex >= 0
            ? cardioIndex
            : modelo.categorias.length;

        modelo.categorias.splice(
          pos,
          0,
          categoria
        );
      }

      faltam -= 1;
    }
  }

  /*
   * Se não havia aquele grupo em número suficiente de
   * divisões, acrescenta nos demais treinos.
   */
  for (const modelo of modelos) {
    if (!faltam) break;

    if (
      modelo.categorias.includes(categoria)
    ) {
      continue;
    }

    const cardioIndex =
      modelo.categorias.indexOf("cardio");

    const pos =
      cardioIndex >= 0
        ? cardioIndex
        : modelo.categorias.length;

    modelo.categorias.splice(
      pos,
      0,
      categoria
    );

    faltam -= 1;
  }
}

function construirBriefingProfessorAssistente(
  frequenciaAutomatica
) {
  /* assistente-briefing-flexivel-v2 */

  const modoSelecionado =
    String(
      $("assistenteModoDivisao")?.value ||
      "automatico"
    );

  const textoLivre =
    String(
      $("assistenteBriefingLivre")?.value ||
      ""
    ).trim();

  /*
   * Se o professor escreveu explicitamente A:, B:, C:...
   * isso prevalece sobre o seletor. Evita ignorar um briefing
   * estruturado porque o select permaneceu em "Automática".
   */
  const possuiDivisaoExplicita =
    /(?:^|[\n;])\s*(?:[-•*]\s*)?[A-F]\s*[:\-.)]\s*/i
      .test(textoLivre);

  const modo =
    possuiDivisaoExplicita
      ? "personalizado"
      : modoSelecionado;

  let modelos = [];

  if (modo === "personalizado") {
    const encontrados =
      new Map();

    const partes =
      textoLivre
        .split(/[\n;]+/)
        .map(item => item.trim())
        .filter(Boolean);

    for (const parte of partes) {
      const match =
        parte.match(
          /^(?:[-•*]\s*)?([A-F])\s*[:\-.)]\s*(.+)$/i
        );

      if (!match) continue;

      const nome =
        match[1].toUpperCase();

      const categorias =
        categoriasDoTextoBriefingAssistente(
          match[2]
        );

      if (!categorias.length) {
        continue;
      }

      encontrados.set(
        nome,
        {
          nome,
          categorias
        }
      );
    }

    modelos =
      Array.from(
        encontrados.values()
      )
        .sort(
          (a, b) =>
            a.nome.localeCompare(b.nome)
        );

    if (!modelos.length) {
      throw new Error(
        "No modo definido pelo professor, informe pelo menos uma divisão usando A:, B:, C: até F:. Ex.: A: peito e tríceps; B: costas e bíceps."
      );
    }
  } else {
    modelos =
      modelosDivisaoAssistente(
        frequenciaAutomatica
      )
        .map(
          (categorias, indice) => ({
            nome:
              String.fromCharCode(
                65 + indice
              ),

            categorias:
              Array.isArray(categorias)
                ? categorias.slice()
                : []
          })
        );
  }

  const aquecimento =
    String(
      $("assistenteAquecimentoPadrao")?.value ||
      "conforme"
    );

  if (aquecimento === "todos") {
    for (const modelo of modelos) {
      if (
        !modelo.categorias.includes(
          "mobilidade"
        )
      ) {
        modelo.categorias.unshift(
          "mobilidade"
        );
      }
    }
  }

  const core =
    String(
      $("assistenteCorePadrao")?.value ||
      "conforme"
    );

  if (
    core === "todos"
  ) {
    aplicarCategoriaEmTreinosBriefing(
      modelos,
      "core",
      modelos.length
    );
  } else if (
    ["1", "2"].includes(core)
  ) {
    aplicarCategoriaEmTreinosBriefing(
      modelos,
      "core",
      Number(core)
    );
  }

  const cardio =
    String(
      $("assistenteCardioPadrao")?.value ||
      "conforme"
    );

  if (
    cardio === "todos"
  ) {
    aplicarCategoriaEmTreinosBriefing(
      modelos,
      "cardio",
      modelos.length
    );
  } else if (
    ["1", "2"].includes(cardio)
  ) {
    aplicarCategoriaEmTreinosBriefing(
      modelos,
      "cardio",
      Number(cardio)
    );
  }

  let foco =
    String(
      $("assistenteFoco")?.value ||
      ""
    );

  let focoVezes =
    Number(
      $("assistenteFocoVezes")?.value ||
      1
    );

  const focoTexto =
    inferirFocoTextoBriefingAssistente(
      textoLivre
    );

  /*
   * Se o professor não escolheu pelo select, aceita:
   * "foco glúteo 1x", "ênfase costas 2x", etc.
   */
  if (
    !foco &&
    focoTexto
  ) {
    foco =
      focoTexto.categoria;

    focoVezes =
      focoTexto.vezes;
  }

  if (foco) {
    aplicarCategoriaEmTreinosBriefing(
      modelos,
      foco,
      Math.min(
        modelos.length,
        Math.max(
          1,
          focoVezes
        )
      ),
      {
        repetirSeExistente:
          true
      }
    );
  }

  for (const modelo of modelos) {
    modelo.categorias =
      ordenarCategoriasBriefingAssistente(
        modelo.categorias
      );
  }

  return {
    modo,
    textoLivre,
    foco:
      foco || null,

    focoVezes:
      foco
        ? focoVezes
        : 0,

    core,
    cardio,
    aquecimento,

    modelos,

    resumo:
      modelos
        .map(
          modelo =>
            `${modelo.nome}: ${modelo.categorias.join(", ")}`
        )
        .join("; ")
  };
}

function modelosDivisaoAssistente(frequencia) {
  if (frequencia <= 2) {
    return [
      ["peito", "costas", "quadriceps", "posterior", "ombro", "core"],
      ["costas", "peito", "gluteo", "quadriceps", "biceps", "triceps"]
    ];
  }

  if (frequencia === 3) {
    return [
      ["peito", "ombro", "triceps", "core"],
      ["quadriceps", "posterior", "gluteo", "panturrilha", "core"],
      ["costas", "biceps", "ombro", "core"]
    ];
  }

  if (frequencia === 4) {
    return [
      ["peito", "costas", "ombro", "biceps", "triceps"],
      ["quadriceps", "posterior", "gluteo", "panturrilha", "core"],
      ["costas", "peito", "ombro", "biceps", "triceps"],
      ["quadriceps", "posterior", "gluteo", "panturrilha", "core"]
    ];
  }

  const base = [
    ["peito", "triceps", "ombro", "core"],
    ["costas", "biceps", "core"],
    ["quadriceps", "posterior", "gluteo", "panturrilha"],
    ["ombro", "peito", "triceps", "core"],
    ["costas", "biceps", "quadriceps", "posterior", "core"],
    ["gluteo", "quadriceps", "posterior", "panturrilha", "core"]
  ];

  return base.slice(0, Math.min(6, frequencia));
}



/* assistente-equipamentos-academia-v1 */

let equipamentosAcademiaAssistente = new Set();
let equipamentosAcademiaAssistenteCarregados = false;

async function carregarEquipamentosAcademiaAssistente() {
  equipamentosAcademiaAssistente = new Set();
  equipamentosAcademiaAssistenteCarregados = false;

  try {
    const resposta = await api("/api/treinos/equipamentos-academia");

    if (
      resposta?.ok === false ||
      !Array.isArray(resposta?.dados?.selecionados)
    ) {
      console.warn(
        "Configuração de equipamentos da academia indisponível.",
        resposta?.mensagem || ""
      );
      return false;
    }

    equipamentosAcademiaAssistente = new Set(
      resposta.dados.selecionados.map(id => String(id || "").trim()).filter(Boolean)
    );

    equipamentosAcademiaAssistenteCarregados = true;
    return true;
  } catch (erro) {
    console.error(
      "Erro ao carregar equipamentos da academia para o assistente.",
      erro
    );
    return false;
  }
}

function requisitosEquipamentosExercicioAssistente(ex = {}) {
  const nome = normalizarTexto(ex.nome || "");
  const descricao = normalizarTexto(ex.descricao || "");
  const texto = `${nome} ${descricao}`.trim();

  const todos = new Set();
  const algum = [];

  const exigir = (...ids) => {
    ids.filter(Boolean).forEach(id => todos.add(id));
  };

  const exigirAlgum = (...ids) => {
    const grupo = [...new Set(ids.filter(Boolean))];
    if (grupo.length) algum.push(grupo);
  };

  // ----------------------------------------------------------
  // PERNAS / GLÚTEOS
  // ----------------------------------------------------------

  if (/leg press vertical no smith/.test(nome)) {
    exigir("smith");
  } else if (/leg press vertical/.test(nome)) {
    exigir("leg_press_vertical");
  } else if (/leg press deitado|leg press horizontal/.test(nome)) {
    exigir("leg_press_horizontal");
  } else if (/leg press inclinado/.test(nome)) {
    exigir("leg_press_45");
  } else if (/\bleg press\b/.test(nome)) {
    exigir("leg_press_45");
  }

  if (
    /\bhack\b/.test(nome) &&
    !/com barra/.test(nome)
  ) {
    exigir("hack_squat");
  }

  if (/pendulum/.test(nome)) {
    exigir("pendulum_squat");
  }

  if (/barra guiada|\bsmith\b/.test(nome)) {
    exigir("smith");
  }

  if (/graviton/.test(nome)) {
    exigir("graviton");
  }

  if (/cadeira extensora/.test(nome)) {
    exigir("cadeira_extensora");
  }

  if (/banco extensor/.test(nome)) {
    exigir("banco_extensor");
  }

  if (
    /extensao de joelhos/.test(nome) &&
    !/banco extensor/.test(nome)
  ) {
    exigir("cadeira_extensora");
  }

  if (/mesa flexora/.test(nome)) {
    exigir("mesa_flexora");
  }

  if (/cadeira flexora|flexor sentado/.test(nome)) {
    exigir("cadeira_flexora");
  }

  if (/banco flexor/.test(nome)) {
    exigir("banco_flexor");
  }

  if (/cadeira adutora/.test(nome)) {
    exigir("cadeira_adutora");
  }

  if (/banco adutor/.test(nome)) {
    exigir("banco_adutor");
  }

  if (/cadeira abdutora/.test(nome)) {
    exigir("cadeira_abdutora");
  }

  if (/banco abdutor/.test(nome)) {
    exigir("banco_abdutor");
  }

  if (/gluteo em pe.*aparelho|gluteo em pe.*maquina/.test(nome)) {
    exigir("gluteo_em_pe_maquina");
  } else if (/gluteo.*aparelho|gluteo.*maquina/.test(nome)) {
    exigir("gluteo_maquina");
  }

  if (/apolete/.test(nome)) {
    exigir("apolete");
  }

  if (/hip thrust.*maquina|elevacao pelvica.*maquina/.test(nome)) {
    exigir("hip_thrust_maquina");
  }

  if (/panturrilha.*sentad.*maquina|panturrilha.*sentad.*aparelho/.test(nome)) {
    exigir("panturrilha_sentada_maquina");
  } else if (/panturrilha.*maquina|panturrilha.*aparelho/.test(nome)) {
    exigir("panturrilha_em_pe_maquina");
  }

  if (/belt squat/.test(nome)) {
    exigir("belt_squat");
  }

  if (/sissy squat/.test(nome)) {
    exigir("sissy_squat");
  }

  if (/tibial.*maquina|tibial.*aparelho/.test(nome)) {
    exigir("tibial_maquina");
  }

  // ----------------------------------------------------------
  // PEITO / OMBRO / BRAÇOS — MÁQUINAS
  // ----------------------------------------------------------

  if (/peck deck|pec deck|\bvoador\b/.test(nome)) {
    exigir("peck_deck_voador");
  }

  if (/supino articulado/.test(nome)) {
    exigir("supino_articulado");
  } else if (/supino vertical.*maquina/.test(nome)) {
    exigir("supino_vertical_maquina");
  } else if (/supino inclinado.*maquina|supino inclinado.*aparelho/.test(nome)) {
    exigir("chest_press_inclinado");
  } else if (
    /supino.*maquina|supino.*aparelho|chest press/.test(nome)
  ) {
    exigir("chest_press_reto");
  }

  if (/desenvolvimento articulado/.test(nome)) {
    exigir("desenvolvimento_articulado");
  } else if (
    /desenvolvimento.*maquina|desenvolvimento.*aparelho|shoulder press/.test(nome)
  ) {
    exigir("desenvolvimento_maquina");
  }

  if (/elevacao lateral.*maquina|elevacao lateral.*aparelho/.test(nome)) {
    exigir("elevacao_lateral_maquina");
  }

  if (
    /rosca scott.*maquina|rosca scott.*aparelho/.test(nome)
  ) {
    exigir("rosca_scott_maquina");
  } else if (
    /(rosca|biceps).*maquina|(rosca|biceps).*aparelho/.test(nome)
  ) {
    exigir("biceps_maquina");
  }

  if (/triceps paralelo.*aparelho|mergulho.*maquina|dip.*maquina/.test(nome)) {
    exigir("mergulho_maquina");
  } else if (/triceps.*maquina|triceps.*aparelho/.test(nome)) {
    exigir("triceps_maquina");
  }

  // ----------------------------------------------------------
  // COSTAS / CORE — MÁQUINAS
  // ----------------------------------------------------------

  if (/remada cavalinho.*aparelho|remada cavalinho.*maquina/.test(nome)) {
    exigir("remada_cavalinho_maquina");
  } else if (/remada.*articulad/.test(nome)) {
    exigir("remada_articulada");
  } else if (/remada.*aparelho|remada.*maquina/.test(nome)) {
    exigir("remada_baixa_maquina");
  }

  if (/puxada alta.*bi.articulad/.test(nome)) {
    exigir("puxada_alta_maquina");
  } else if (/puxada.*articulad/.test(nome)) {
    exigir("puxada_articulada");
  } else if (/puxada.*aparelho|puxada.*maquina/.test(nome)) {
    exigir("puxada_alta_maquina");
  }

  if (/pull.?over.*maquina|pull.?over.*aparelho/.test(nome)) {
    exigir("pullover_maquina");
  }

  if (/lombar.*maquina|lombar.*aparelho/.test(nome)) {
    exigir("lombar_maquina");
  }

  if (/abdominal.*maquina|abdominal.*aparelho/.test(nome)) {
    exigir("abdominal_maquina");
  }

  if (/rotacao.*tronco.*maquina|rotacao.*tronco.*aparelho/.test(nome)) {
    exigir("rotacao_tronco_maquina");
  }

  // ----------------------------------------------------------
  // ESTAÇÕES / CABOS
  // ----------------------------------------------------------

  const usaCrossover = /cross over|crossover/.test(nome);

  if (usaCrossover) {
    exigir("crossover");
  } else if (/polia alta/.test(nome)) {
    exigirAlgum(
      "polia_alta",
      "crossover",
      "torre_cabos_dupla",
      "estacao_multifuncional"
    );
  } else if (/polia baixa/.test(nome)) {
    exigirAlgum(
      "polia_baixa",
      "crossover",
      "torre_cabos_dupla",
      "estacao_multifuncional"
    );
  } else if (/\bpolia\b|\bpulley\b|\bcabo\b/.test(nome)) {
    exigirAlgum(
      "polia_alta",
      "polia_baixa",
      "crossover",
      "torre_cabos_dupla",
      "estacao_multifuncional"
    );
  }

  if (
    /corda/.test(nome) &&
    (
      usaCrossover ||
      /\bpolia\b|\bpulley\b|\bcabo\b/.test(nome)
    )
  ) {
    exigir("corda_triceps");
  }

  // ----------------------------------------------------------
  // ESTRUTURAS
  // ----------------------------------------------------------

  if (/barra fixa/.test(nome)) {
    exigir("barra_fixa");
  }

  if (/barra paralela|\bparalela\b/.test(nome) && !/aparelho/.test(nome)) {
    exigir("paralelas");
  }

  // ----------------------------------------------------------
  // PESOS LIVRES
  // ----------------------------------------------------------

  if (/kettlebell/.test(nome)) {
    exigir("kettlebells");
  }

  if (/\bhalter|\bhalteres/.test(nome)) {
    exigir("halteres");
  }

  if (/\banilha|\banilhas/.test(nome)) {
    exigir("anilhas");
  }

  if (/barra hexagonal|trap bar/.test(nome)) {
    exigir("barra_hexagonal", "anilhas");
  } else if (/barra olimpica/.test(nome)) {
    exigir("barra_olimpica", "anilhas");
  } else if (/barra w|barra ez|\bez\b/.test(nome)) {
    exigir("barra_w", "anilhas");
  } else if (
    /com barra/.test(nome) &&
    !/barra guiada|barra fixa|barra paralela/.test(nome)
  ) {
    exigir("barra_reta", "anilhas");
  }

  // ----------------------------------------------------------
  // BANCOS
  // ----------------------------------------------------------

  if (/banco scott/.test(nome)) {
    exigir("banco_scott");
  }

  if (/banco inclinado/.test(nome)) {
    exigirAlgum("banco_inclinado", "banco_regulavel");
  }

  if (/banco declinado/.test(nome)) {
    exigirAlgum("banco_declinado", "banco_regulavel");
  }

  if (/banco reto/.test(nome)) {
    exigirAlgum(
      "banco_reto",
      "banco_regulavel",
      "banco_supino_reto"
    );
  }

  if (
    /supino inclinado/.test(nome) &&
    !/maquina|aparelho|articulado|barra guiada|smith/.test(nome)
  ) {
    exigirAlgum(
      "banco_supino_inclinado",
      "banco_inclinado",
      "banco_regulavel"
    );

    if (!/halter/.test(nome)) {
      exigir("barra_reta", "anilhas");
    }
  }

  if (
    /supino declinado/.test(nome) &&
    !/maquina|aparelho|articulado|barra guiada|smith/.test(nome)
  ) {
    exigirAlgum(
      "banco_supino_declinado",
      "banco_declinado",
      "banco_regulavel"
    );

    if (!/halter/.test(nome)) {
      exigir("barra_reta", "anilhas");
    }
  }

  if (
    /supino reto/.test(nome) &&
    !/maquina|aparelho|articulado|barra guiada|smith/.test(nome)
  ) {
    exigirAlgum(
      "banco_supino_reto",
      "banco_reto",
      "banco_regulavel"
    );

    if (!/halter/.test(nome)) {
      exigir("barra_reta", "anilhas");
    }
  }

  if (/crucifixo 30|crucifixo 45/.test(nome)) {
    exigir("halteres");
    exigirAlgum("banco_inclinado", "banco_regulavel");
  }

  if (
    /crucifixo declinado/.test(nome) &&
    !/voador|peck deck|cross over|crossover/.test(nome)
  ) {
    exigirAlgum("banco_declinado", "banco_regulavel");
  }

  // ----------------------------------------------------------
  // FUNCIONAL / ACESSÓRIOS
  // ----------------------------------------------------------

  if (/\btrx\b/.test(nome)) exigir("trx");
  if (/faixa elastica/.test(nome)) exigir("faixa_elastica");
  if (/mini band/.test(nome)) exigir("mini_band");
  if (/tubo elastico/.test(nome)) exigir("tubo_elastico");
  if (/corda naval/.test(nome)) exigir("corda_naval");
  if (/medicine ball/.test(nome)) exigir("medicine_ball");
  if (/slam ball/.test(nome)) exigir("slam_ball");
  if (/bola suica/.test(nome)) exigir("bola_suica");
  if (/\bbosu\b/.test(nome)) exigir("bosu");
  if (/\bstep\b/.test(nome)) exigir("step");

  if (/box jump|caixa pliometrica/.test(nome)) {
    exigir("caixa_plyo");
  }

  if (/\bjump\b/.test(nome) && !/box jump/.test(nome)) {
    exigir("jump");
  }

  if (/caneleira/.test(nome)) exigir("caneleiras");
  if (/roda abdominal/.test(nome)) exigir("roda_abdominal");

  /*
   * Briefing: cardio e calistenia continuam obrigados
   * a respeitar os equipamentos físicos da academia.
   */
  if (/esteira/.test(nome)) {
    exigir("esteira");
  }

  if (
    /spinning/.test(nome)
  ) {
    exigir("bike_spinning");
  } else if (
    /bicicleta|bike/.test(nome)
  ) {
    exigirAlgum(
      "bike_horizontal",
      "bike_spinning"
    );
  }

  if (/eliptic/.test(nome)) {
    exigir("eliptico");
  }

  if (
    /pull.?up|toes to bar|muscle.?up/.test(nome)
  ) {
    exigir("barra_fixa");
  }

  if (
    /ring row|remada.*argola|\bargolas?\b/.test(nome)
  ) {
    exigir("argolas");
  }

  if (
    /mergulho|\bdip\b/.test(nome) &&
    !/maquina|aparelho/.test(nome)
  ) {
    exigir("paralelas");
  }

  return {
    todos: [...todos],
    algum
  };
}

function exercicioCompativelEquipamentosAssistente(ex = {}, nivel = "iniciante") {
  if (!equipamentosAcademiaAssistenteCarregados) return false;

  const requisitos = requisitosEquipamentosExercicioAssistente(ex);

  for (const id of requisitos.todos) {
    if (!equipamentosAcademiaAssistente.has(id)) {
      return false;
    }
  }

  for (const grupo of requisitos.algum) {
    if (!grupo.some(id => equipamentosAcademiaAssistente.has(id))) {
      return false;
    }
  }

  const classificacao = prioridadeEquipamentoAssistente(ex, nivel);

  const possuiRequisitoMapeado =
    requisitos.todos.length > 0 ||
    requisitos.algum.length > 0;

  // Se o exercício claramente depende de equipamento e ainda não possui
  // requisito reconhecido, ele não entra automaticamente. Evita prescrever
  // uma máquina que não foi cadastrada na academia.
  if (
    !possuiRequisitoMapeado &&
    [
      "MAQUINA",
      "CABO_POLIA",
      "BARRA_GUIADA",
      "PESO_LIVRE",
      "FUNCIONAL"
    ].includes(classificacao.tipo)
  ) {
    return false;
  }

  return true;
}


/* assistente-prioridade-musculacao-v1 */
function prioridadeEquipamentoAssistente(ex = {}, nivel = "iniciante") {
  const nome = normalizarTexto(ex.nome || "");
  const texto = normalizarTexto([
    ex.nome,
    ex.descricao
  ].filter(Boolean).join(" "));

  const grupoId = String(ex.grupoId || "").trim();

  // Grupo CORPO não entra automaticamente no treino de musculação.
  if (grupoId === "10") {
    return { tipo: "CORPO", prioridade: 0 };
  }

  if (
    /aparelho|maquina|cadeira|mesa flexora|banco extensor|banco flexor|banco abdutor|banco adutor|peck deck|pec deck|voador|graviton|leg press|hack|articulad|pendulum/.test(texto)
  ) {
    return { tipo: "MAQUINA", prioridade: 100 };
  }

  if (
    /cross over|crossover|polia|pulley|cabo/.test(nome)
  ) {
    return { tipo: "CABO_POLIA", prioridade: 95 };
  }

  if (/barra guiada|smith/.test(nome)) {
    return { tipo: "BARRA_GUIADA", prioridade: 90 };
  }

  if (
    /barra fixa|barra paralela|flexao de bracos/.test(nome) &&
    !/aparelho|maquina/.test(nome)
  ) {
    return { tipo: "PESO_CORPORAL", prioridade: 5 };
  }

  if (/halter|barra|anilha|kettlebell/.test(nome)) {
    return {
      tipo: "PESO_LIVRE",
      prioridade: nivel === "avancado" ? 84 : 74
    };
  }

  if (
    /trx|faixa elastica|elastico|corda naval|medicine ball|bola suica|bosu|jump/.test(nome)
  ) {
    return { tipo: "FUNCIONAL", prioridade: 25 };
  }

  if (
    /burpee|polichinelo|prancha|flexao de bracos|pull up|muscle-up|muscle up|handstand|wall walk|toes to bar|ring row|pistol squat|escalador|corrida estacionaria|corrida no mesmo lugar|minhoca/.test(nome)
  ) {
    return { tipo: "PESO_CORPORAL", prioridade: 5 };
  }

  return { tipo: "LIVRE", prioridade: 45 };
}

function chavePreferenciaAprendizadoAssistente(
  ex = {}
) {
  return String(
    ex?.id ||
    ex?.codigo ||
    ex?.nome ||
    ""
  ).trim();
}

function pesoPreferenciaAprendizadoAssistente(
  ex = {}
) {
  const chave =
    chavePreferenciaAprendizadoAssistente(
      ex
    );

  return Number(
    assistentePreferenciasAprendizado.get(
      chave
    ) || 0
  );
}

async function carregarPreferenciasAprendizadoAssistente({
  alunoId,
  objetivo,
  nivel,
  frequencia,
  duracao,
  briefing
}) {
  assistentePreferenciasAprendizado =
    new Map();

  assistentePreferenciasMeta = {
    exemplosAprovadosTotal: 0,
    exemplosConsiderados: 0,
    aplicado: false
  };

  try {
    const resposta =
      await api(
        "/api/treinos/assistente-aprendizado/preferencias",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              alunoId,
              objetivo,
              nivel,
              frequencia,
              duracao,
              briefingProfessor:
                briefing
            })
        }
      );

    if (resposta?.ok === false) {
      return assistentePreferenciasMeta;
    }

    const dados =
      resposta?.dados ||
      {};

    const exercicios =
      Array.isArray(
        dados.exercicios
      )
        ? dados.exercicios
        : [];

    for (const item of exercicios) {
      const chave =
        String(
          item?.chave ||
          ""
        ).trim();

      const peso =
        Number(
          item?.peso ||
          0
        );

      if (
        chave &&
        Number.isFinite(peso) &&
        peso > 0
      ) {
        assistentePreferenciasAprendizado.set(
          chave,
          peso
        );
      }
    }

    assistentePreferenciasMeta = {
      exemplosAprovadosTotal:
        Number(
          dados.exemplosAprovadosTotal ||
          0
        ),

      exemplosConsiderados:
        Number(
          dados.exemplosConsiderados ||
          0
        ),

      aplicado:
        assistentePreferenciasAprendizado.size >
        0
    };

    return assistentePreferenciasMeta;
  } catch (erro) {
    console.warn(
      "Preferências do aprendizado indisponíveis:",
      erro
    );

    assistentePreferenciasAprendizado =
      new Map();

    return assistentePreferenciasMeta;
  }
}

/* assistente-briefing-distribuicao-v3 */
function categoriaAtendeBriefingAssistente(
  categoriaExercicio,
  categoriaSolicitada
) {
  if (
    categoriaSolicitada === "core"
  ) {
    return (
      categoriaExercicio === "core" ||
      categoriaExercicio === "abdominal"
    );
  }

  return (
    categoriaExercicio ===
    categoriaSolicitada
  );
}

function prioridadeEstruturalAssistente(ex = {}) {
  const p = normalizarTexto([ex.prioridade, ex.papel, ex.tipo].join(" "));
  if (p.includes("composto_principal") || p.includes("principal")) return 3;
  if (p.includes("composto") || p.includes("secundario")) return 2;
  if (p.includes("isolamento") || p.includes("acessorio")) return 1;
  return 0;
}

function compostoHorizontalPeitoAssistente(ex = {}) {
  const movimento = normalizarTexto(ex.movimento || ex.padraoMovimento || "");
  const papel = normalizarTexto([ex.prioridade, ex.papel, ex.tipo].join(" "));
  return movimento === "empurrar_horizontal" && !papel.includes("isolamento") && !papel.includes("acessorio");
}

function prioridadePeitoAssistente(ex = {}) {
  const nome = normalizarTexto(ex.nome || "");

  if (/^supino reto com barra$/.test(nome)) return 100;
  if (/^supino reto com halteres$/.test(nome)) return 90;
  if (/supino reto/.test(nome)) return 80;
  if (/supino inclinado com barra/.test(nome)) return 70;
  if (/supino inclinado/.test(nome)) return 60;
  if (compostoHorizontalPeitoAssistente(ex)) return 50;

  return 0;
}

function escolherExerciciosAssistente(
  categorias,
  quantidade,
  usados,
  nivel = "iniciante",
  variacao = 0
) {
  const categoriasPlanejadas =
    ordenarCategoriasBriefingAssistente(
      Array.isArray(categorias)
        ? categorias
        : []
    );

  const catalogo =
    (biblioteca.exercicios || [])
      .map(ex => ({
        ex,

        categoria:
          categoriaExercicioBriefingAssistente(
            ex
          ),

        equipamento:
          prioridadeEquipamentoAssistente(
            ex,
            nivel
          )
      }))
      .filter(item => {
        const chave =
          String(
            item.ex.id ||
            item.ex.codigo ||
            item.ex.nome ||
            ""
          );

        if (!chave) {
          return false;
        }

        /*
         * A aprendizagem/briefing nunca contorna
         * a compatibilidade física da academia.
         */
        if (
          !exercicioCompativelEquipamentosAssistente(
            item.ex,
            nivel
          )
        ) {
          return false;
        }

        return categoriasPlanejadas.some(
          categoria =>
            categoriaAtendeBriefingAssistente(
              item.categoria,
              categoria
            )
        );
      })
      .sort((a, b) => {
        /*
         * Só candidatos já aprovados pelos filtros
         * de categoria e equipamentos chegam aqui.
         */
        const estrutural =
          prioridadeEstruturalAssistente(b.ex) -
          prioridadeEstruturalAssistente(a.ex);

        if (estrutural !== 0) {
          return estrutural;
        }

        const aprendizado =
          pesoPreferenciaAprendizadoAssistente(
            b.ex
          ) -
          pesoPreferenciaAprendizadoAssistente(
            a.ex
          );

        if (aprendizado !== 0) {
          return aprendizado;
        }

        const p =
          b.equipamento.prioridade -
          a.equipamento.prioridade;

        if (p !== 0) {
          return p;
        }

        return String(
          a.ex.nome || ""
        ).localeCompare(
          String(
            b.ex.nome || ""
          ),
          "pt-BR",
          {
            sensitivity:
              "base"
          }
        );
      });

  const limite =
    Math.max(
      0,
      Number(quantidade || 0)
    );

  const inicio = [];
  const principais = [];
  const apoio = [];
  const final = [];

  function chaveExercicio(item) {
    return String(
      item?.ex?.id ||
      item?.ex?.codigo ||
      item?.ex?.nome ||
      ""
    );
  }

  const chamadasPorCategoria =
    new Map();

  function pegarCandidato(categoria) {
    const candidatos =
      catalogo.filter(item => {
        const chave =
          chaveExercicio(item);

        return (
          chave &&
          !usados.has(chave) &&
          categoriaAtendeBriefingAssistente(
            item.categoria,
            categoria
          )
        );
      });

    if (
      normalizarTexto(categoria) === "peito" &&
      (chamadasPorCategoria.get(categoria) || 0) === 0
    ) {
      const compostosPeito = candidatos.filter(item =>
        compostoHorizontalPeitoAssistente(item.ex)
      );

      if (compostosPeito.length) {
        compostosPeito.sort(
          (a, b) =>
            prioridadePeitoAssistente(b.ex) -
            prioridadePeitoAssistente(a.ex)
        );

        candidatos.splice(0, candidatos.length, ...compostosPeito);
      }
    }

    if (!candidatos.length) {
      return null;
    }

    /*
     * A lista já passou pelos filtros de segurança,
     * equipamento, categoria e prioridade.
     *
     * A variação apenas desloca a escolha dentro
     * dessa lista válida.
     */
    const chamada =
      chamadasPorCategoria.get(
        categoria
      ) || 0;

    chamadasPorCategoria.set(
      categoria,
      chamada + 1
    );

    const deslocamento =
      Math.max(
        0,
        Number(variacao || 0)
      ) + chamada;

    return candidatos[
      deslocamento %
      candidatos.length
    ];
  }

  function destinoCategoria(categoria) {
    if (categoria === "mobilidade") {
      return inicio;
    }

    if (
      categoria === "abdominal" ||
      categoria === "core"
    ) {
      return apoio;
    }

    if (categoria === "cardio") {
      return final;
    }

    return principais;
  }

  /*
   * PASSO 1:
   * Cada ocorrência do briefing ganha uma vaga reservada.
   *
   * Exemplo:
   * glúteo repetido duas vezes = dois exercícios distintos.
   */
  for (
    const categoria
    of categoriasPlanejadas
  ) {
    if (
      inicio.length +
      principais.length +
      apoio.length +
      final.length >= limite
    ) {
      break;
    }

    const candidato =
      pegarCandidato(
        categoria
      );

    if (!candidato) {
      continue;
    }

    const chave =
      chaveExercicio(
        candidato
      );

    usados.add(
      chave
    );

    destinoCategoria(
      categoria
    ).push(
      candidato.ex
    );
  }

  /*
   * PASSO 2:
   * As vagas restantes são distribuídas em rodízio
   * somente entre os grupos musculares principais.
   *
   * Isso evita:
   * B = 5 exercícios de costas + 1 bíceps
   * quando o professor pediu costas + bíceps + antebraço.
   */
  const categoriasPrincipais =
    categoriasPlanejadas.filter(
      categoria =>
        ![
          "mobilidade",
          "abdominal",
          "core",
          "cardio"
        ].includes(
          categoria
        )
    );

  let houveInclusao =
    true;

  while (
    inicio.length +
    principais.length +
    apoio.length +
    final.length < limite &&
    houveInclusao
  ) {
    houveInclusao =
      false;

    for (
      const categoria
      of categoriasPrincipais
    ) {
      if (
        inicio.length +
        principais.length +
        apoio.length +
        final.length >= limite
      ) {
        break;
      }

      const candidato =
        pegarCandidato(
          categoria
        );

      if (!candidato) {
        continue;
      }

      const chave =
        chaveExercicio(
          candidato
        );

      usados.add(
        chave
      );

      principais.push(
        candidato.ex
      );

      houveInclusao =
        true;
    }
  }

  return [
    ...inicio,
    ...principais,
    ...apoio,
    ...final
  ];
}

/* assistente-regras-v1-seguranca-1 */
async function gerarSugestaoAssistenteRegras(
  {
    proximaOpcao = false
  } = {}
) {
  const aluno = alunoSelecionadoAtual();

  if (!aluno) {
    return alert("Selecione um aluno antes de gerar a sugestão.");
  }

  if (contextoAvaliacaoAssistenteCarregando) {
    return alert(
      "A avaliação física ainda está sendo carregada. Aguarde alguns segundos."
    );
  }

  const contexto = contextoAssistenteAtual();

  if (!contexto?.avaliacao) {
    return alert(
      "Este aluno não possui uma Avaliação Física concluída disponível para o Assistente Fusion. " +
      "O professor pode montar o treino manualmente, mas a sugestão automática ficará bloqueada."
    );
  }

  if (!contexto.prontoParaGerar) {
    const motivos = Array.isArray(contexto.motivosBloqueio)
      ? contexto.motivosBloqueio.join("\n• ")
      : "Avaliação pendente de revisão.";

    return alert(
      "A sugestão automática está bloqueada pela Avaliação Física:\n\n• " +
      motivos
    );
  }

  if (!equipamentosAcademiaAssistenteCarregados) {
    return alert(
      "Não foi possível carregar a configuração de equipamentos desta academia. " +
      "O assistente não fará uma prescrição automática sem essa referência."
    );
  }

  if (!equipamentosAcademiaAssistente.size) {
    return alert(
      "Nenhum equipamento foi configurado para esta academia. " +
      "O responsável técnico precisa cadastrar os equipamentos antes da geração automática."
    );
  }

  const idade = idadeAlunoAssistente(aluno);

  if (idade === null) {
    return alert(
      "A data de nascimento do aluno precisa estar cadastrada antes " +
      "de gerar uma sugestão automática."
    );
  }

  if (idade < 16) {
    return alert(
      "Nesta primeira versão, o assistente não gera automaticamente " +
      "treino para aluno com menos de 16 anos. O professor deve montar " +
      "e revisar manualmente."
    );
  }

  const restricoes = restricoesAlunoAssistente(aluno);

  if (restricoes) {
    return alert(
      "Este aluno possui restrição médica ou lesão cadastrada. " +
      "Por segurança, o Assistente Fusion V1 não fará prescrição " +
      "automática. O professor deve montar o treino manualmente " +
      "considerando as informações do prontuário."
    );
  }

  const objetivo = String(
    $("objetivo")?.value ||
    contexto?.prescricao?.objetivoPrincipal ||
    aluno.objetivo ||
    ""
  ).trim();

  if (!objetivo) {
    return alert(
      "Informe o objetivo do aluno antes de gerar a sugestão."
    );
  }

  const nivel = String(
    $("assistenteNivel")?.value ||
    contexto?.prescricao?.experiencia ||
    "iniciante"
  );

  const frequencia = Math.max(
    2,
    Math.min(
      6,
      Number(
        $("assistenteFrequencia")?.value ||
        contexto?.prescricao?.frequenciaSemanal ||
        3
      )
    )
  );

  const duracao = Number(
    $("assistenteDuracao")?.value ||
    contexto?.prescricao?.duracaoSessaoMin ||
    60
  );

  const quantidadePorTreino =
    duracao <= 30 ? 4 :
    duracao <= 45 ? 5 :
    duracao <= 60 ? 6 :
    duracao <= 75 ? 7 : 8;

  const parametros = parametrosPrescricaoAssistente(
    objetivo,
    nivel,
    idade
  );

  let briefing;

  try {
    briefing =
      construirBriefingProfessorAssistente(
        frequencia
      );
  } catch (erro) {
    return alert(
      erro?.message ||
      "Não foi possível interpretar o briefing do professor."
    );
  }

  const modelos =
    briefing.modelos;

  await carregarPreferenciasAprendizadoAssistente({
    alunoId:
      String(
        idPessoa(aluno) ||
        ""
      ),

    objetivo,
    nivel,
    frequencia,
    duracao,
    briefing
  });

  /*
   * Identifica o cenário exato de geração.
   * Mudou aluno, briefing, objetivo, nível, frequência
   * ou duração = volta automaticamente para Opção 1.
   */
  const assinaturaVariacao =
    JSON.stringify({
      alunoId:
        String(
          idPessoa(aluno) || ""
        ),

      objetivo,
      nivel,
      frequencia,
      duracao,

      briefing:
        briefing.resumo,

      equipamentos:
        Array.from(
          equipamentosAcademiaAssistente
        ).sort()
    });

  if (
    !proximaOpcao ||
    assinaturaVariacao !==
      assistenteVariacaoAssinatura
  ) {
    assistenteVariacaoIndice = 0;
  } else {
    assistenteVariacaoIndice += 1;
  }

  assistenteVariacaoAssinatura =
    assinaturaVariacao;

  briefing.opcaoGerada =
    assistenteVariacaoIndice + 1;

  const frequenciaPlanejada =
    modelos.length;

  /*
   * A duração define uma base de exercícios, não um bloqueio.
   *
   * Se o professor pediu explicitamente mais blocos — por exemplo:
   * peito + tríceps + core + cardio + aquecimento — o agente
   * tenta atender o briefing em vez de impedir a geração.
   *
   * Limite defensivo de 12 itens por divisão evita briefing
   * acidentalmente excessivo.
   */
  const LIMITE_ITENS_DIVISAO =
    12;

  const usados = new Set();

  const novasDivisoes = modelos.map((modelo, indice) => {
    const categorias =
      modelo.categorias
        .slice(
          0,
          LIMITE_ITENS_DIVISAO
        );

    const quantidadePlanejada =
      Math.min(
        LIMITE_ITENS_DIVISAO,
        Math.max(
          quantidadePorTreino,
          categorias.length
        )
      );

    const exercicios =
      escolherExerciciosAssistente(
        categorias,
        quantidadePlanejada,
        usados,
        nivel,
        assistenteVariacaoIndice
      );

    return {
      nome:
        modelo.nome ||
        String.fromCharCode(65 + indice),
      itens:
        prescreverExerciciosAssistente(
          exercicios,
          parametros,
          objetivo,
          nivel,
          idade
        )
    };
  });

  if (!novasDivisoes.some(div => div.itens.length)) {
    return alert(
      "A biblioteca não possui exercícios suficientes para gerar a sugestão."
    );
  }

  /*
   * Confere se cada categoria explicitamente solicitada
   * foi realmente atendida.
   *
   * Categorias repetidas representam ênfase e exigem
   * a mesma quantidade de exercícios distintos.
   */
  const faltasBriefing = [];

  modelos.forEach(
    (modelo, indice) => {
      const treino =
        novasDivisoes[indice];

      const categoriasObtidas =
        (treino?.itens || [])
          .map(
            item =>
              categoriaExercicioBriefingAssistente(
                item
              )
          );

      const solicitadas =
        new Map();

      for (
        const categoria
        of modelo.categorias
      ) {
        solicitadas.set(
          categoria,
          (
            solicitadas.get(
              categoria
            ) || 0
          ) + 1
        );
      }

      for (
        const [
          categoria,
          quantidadeSolicitada
        ]
        of solicitadas.entries()
      ) {
        let quantidadeObtida =
          categoriasObtidas.filter(
            obtida =>
              categoriaAtendeBriefingAssistente(
                obtida,
                categoria
              )
          ).length;

        if (
          quantidadeObtida <
          quantidadeSolicitada
        ) {
          faltasBriefing.push(
            `${modelo.nome}: ${categoria} ` +
            `(${quantidadeObtida}/${quantidadeSolicitada})`
          );
        }
      }
    }
  );

  if (faltasBriefing.length) {
    return alert(
      "O agente não encontrou exercícios compatíveis para cumprir integralmente o briefing:\n\n• " +
      faltasBriefing.join("\n• ") +
      "\n\nNenhum treino foi substituído. Revise o briefing ou os equipamentos cadastrados."
    );
  }

  divisoes = novasDivisoes;
  divisaoAtiva = 0;

  const observacoesAssistente = [
    `Sugestão gerada pelo Assistente Fusion por regras.`,
    contexto?.avaliacao?.data
      ? `Avaliação física considerada: ${contexto.avaliacao.data}.`
      : "",
    contexto?.atencoes?.length
      ? `Pontos de atenção da avaliação: ${contexto.atencoes.join("; ")}.`
      : "",
    `Objetivo: ${objetivo}.`,
    `Nível: ${nivel}.`,
    `Frequência planejada: ${frequenciaPlanejada}x/semana.`,
    `Briefing do professor: ${briefing.resumo}.`,
    `Duração aproximada: ${duracao} min.`,
    briefing.modelos.some(
      modelo =>
        modelo.categorias.length >
        quantidadePorTreino
    )
      ? `O briefing possui treino(s) acima da quantidade-base para ${duracao} min; o professor deve validar o tempo real da sessão.`
      : "",
    `Equipamentos cadastrados na academia considerados: ${equipamentosAcademiaAssistente.size}.`,
    assistentePreferenciasMeta.aplicado
      ? `Aprendizado local considerado: ${assistentePreferenciasMeta.exemplosConsiderados} exemplo(s) aprovado(s) semelhante(s).`
      : `Aprendizado local: sem exemplo aprovado semelhante suficiente; geração baseada nas regras atuais.`,
    idade !== null ? `Idade considerada: ${idade} anos.` : "",
    restricoes
      ? `ATENÇÃO — restrições/lesões cadastradas: ${restricoes}. Revisão profissional obrigatória.`
      : "",
    `Carga deve ser definida pelo professor conforme execução técnica do aluno.`
  ].filter(Boolean).join(" ");

  $("observacoes").value = observacoesAssistente;

  renderDivisoes();

  resetarAprendizadoAssistente();

  let aprendizadoRegistrado = false;
  let erroAprendizado = "";

  try {
    await registrarGeracaoAprendizadoAssistente({
      aluno,
      contexto,
      divisoesGeradas: novasDivisoes,
      objetivo,
      nivel,
      frequencia:
        frequenciaPlanejada,

      duracao,
      briefing
    });

    aprendizadoRegistrado = true;
  } catch (erro) {
    erroAprendizado =
      erro?.message ||
      "Falha ao registrar a geração.";

    console.error(
      "Assistente Fusion: sugestão criada, mas o banco de aprendizagem não registrou a geração.",
      erro
    );
  }

  const status = $("assistenteStatus");
  if (status) {
    status.textContent =
      `Opção ${assistenteVariacaoIndice + 1} gerada: ${novasDivisoes.length} divisão(ões). ` +
      (
        aprendizadoRegistrado
          ? "Geração registrada no banco de aprendizagem. "
          : `Atenção: geração NÃO registrada no banco de aprendizagem (${erroAprendizado}). `
      ) +
      `Revise exercícios, séries, repetições e cargas. Não salve o treino ainda.`;

    status.classList.add("gerado");
  }

  const botaoOutraOpcao =
    $("gerarOutraOpcaoAssistido");

  if (botaoOutraOpcao) {
    botaoOutraOpcao.disabled =
      false;

    botaoOutraOpcao.textContent =
      `Gerar outra opção (atual: ${assistenteVariacaoIndice + 1})`;
  }

  document.querySelector(".card.treino")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function selecionado(lista, selectId) {
  const id = $(selectId).value;
  return lista.find(p => String(idPessoa(p)) === String(id));
}


function alunoSelecionadoAtual() {
  return selecionado(alunos, "alunoSelect");
}

function professorSelecionadoAtual() {
  const selecionadoNaLista = selecionado(professores, "professorSelect");
  if (selecionadoNaLista) return selecionadoNaLista;

  // No portal do professor, o select pode conter o profissional da sessão
  // mesmo quando /api/professores não o devolve na lista permitida.
  const sessao = sessaoProfessorLogado();
  const valorSelect = $("professorSelect")?.value || "";
  const professorId = String(valorSelect || sessao?.professorId || "").trim();

  if (!professorId) return null;

  return {
    id: professorId,
    professorId,
    nome: sessao?.professorNome || "Professor responsável",
    professorNome: sessao?.professorNome || "Professor responsável",
    perfil: sessao?.perfil || sessao?.tipoPerfil || sessao?.funcao || ""
  };
}

function prescricaoLiberada() {
  const aluno = alunoSelecionadoAtual();
  const professor = professorSelecionadoAtual();
  return Boolean(aluno && idPessoa(aluno) && professor && idPessoa(professor));
}

function atualizarEstadoPrescricao() {
  const liberado = prescricaoLiberada();
  ["salvarTreino", "salvarTreinoRodape"].forEach((id) => {
    const botao = $(id);
    if (!botao) return;
    const alunoOk = Boolean(alunoSelecionadoAtual());
    const professorOk = Boolean(professorSelecionadoAtual());
    botao.disabled = !liberado || carregandoTreinoAluno;
    botao.classList.toggle("disabled", !liberado || carregandoTreinoAluno);
    botao.title = carregandoTreinoAluno
      ? "Carregando treino do aluno..."
      : liberado
      ? "Salvar treino prescrito"
      : (!alunoOk
          ? "Selecione um aluno para liberar a prescrição."
          : (!professorOk
              ? "Professor responsável não identificado."
              : "Complete os dados obrigatórios para liberar a prescrição."));
  });
}

function dataCampo(valor) {
  const texto = String(valor || "").trim();
  const iso = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : "";
}

function divisoesVazias() {
  return [{ nome: "A", itens: [] }, { nome: "B", itens: [] }, { nome: "C", itens: [] }];
}

function normalizarDivisoesTreino(treino = {}) {
  const lista = Array.isArray(treino.divisoes) ? treino.divisoes : [];
  if (!lista.length) return divisoesVazias();
  return lista.map((divisao, indice) => ({
    nome: String(divisao?.nome || String.fromCharCode(65 + indice)).trim() || String.fromCharCode(65 + indice),
    itens: Array.isArray(divisao?.itens)
      ? divisao.itens.map((item) => ({
          ...normalizarExercicio(item || {}),
          series: item?.series || "",
          repeticoes: item?.repeticoes || "",
          carga: item?.carga || "",
          descanso: item?.descanso || "",
          metodo: item?.metodo || "Convencional",
          cadencia: item?.cadencia || "",
          obs: item?.obs || item?.observacoes || ""
        }))
      : []
  }));
}

function limparFormularioTreino() {
  treinoAtualId = "";
  divisoes = divisoesVazias();
  divisaoAtiva = 0;
  $("objetivo").value = "";
  $("validade").value = "";
  $("dataPrescricao").value = new Date().toISOString().slice(0, 10);
  $("observacoes").value = "";
  renderDivisoes();
}

function aplicarTreinoNoFormulario(treino = {}) {
  treinoAtualId = String(treino.id || treino._id || "");
  divisoes = normalizarDivisoesTreino(treino);
  divisaoAtiva = 0;
  $("objetivo").value = treino.objetivo || "";
  $("validade").value = dataCampo(treino.validade);
  $("dataPrescricao").value = dataCampo(treino.dataPrescricao || treino.criadoEm) || new Date().toISOString().slice(0, 10);
  $("observacoes").value = treino.observacoes || treino.observacao || "";
  renderDivisoes();
}

function dataOrdenacaoTreino(treino = {}) {
  const valor = treino.atualizadoEm || treino.dataPrescricao || treino.criadoEm || "";
  const tempo = new Date(valor).getTime();
  return Number.isFinite(tempo) ? tempo : 0;
}

async function carregarTreinoDoAluno() {
  const aluno = alunoSelecionadoAtual();
  if (!aluno) {
    limparFormularioTreino();
    atualizarEstadoPrescricao();
    return;
  }

  carregandoTreinoAluno = true;
  atualizarEstadoPrescricao();
  try {
    const alunoId = idPessoa(aluno);
    const resposta = await api(`/api/treinos?alunoId=${encodeURIComponent(alunoId)}`);
    if (resposta.ok === false) throw new Error(resposta.mensagem || "Erro ao carregar treino do aluno.");
    const chavesAluno = [alunoId, aluno.id, aluno.alunoId, aluno.codigo, aluno.matriculaId, aluno.cpf]
      .filter(Boolean)
      .map((valor) => String(valor).trim());
    const treinosRecebidos = listaDe(resposta);
    const treinosDoAluno = treinosRecebidos.filter((treino) => {
      const chavesTreino = [treino.alunoId, treino.idAluno, treino.aluno_id, treino.aluno?.id, treino.aluno?.alunoId]
        .filter(Boolean)
        .map((valor) => String(valor).trim());
      return !chavesTreino.length || chavesTreino.some((chave) => chavesAluno.includes(chave));
    });
    const treinos = treinosDoAluno.slice().sort((a, b) => dataOrdenacaoTreino(b) - dataOrdenacaoTreino(a));
    if (treinos.length) aplicarTreinoNoFormulario(treinos[0]);
    else limparFormularioTreino();
  } catch (erro) {
    limparFormularioTreino();
    alert(erro.message || "Não foi possível carregar o treino já montado do aluno.");
  } finally {
    carregandoTreinoAluno = false;
    atualizarEstadoPrescricao();
  }
}

async function salvar() {
  const aluno =
    alunoSelecionadoAtual();

  const professor =
    professorSelecionadoAtual();

  if (!aluno || !professor) {
    atualizarEstadoPrescricao();

    return alert(
      "Para prescrever treino é obrigatório selecionar o aluno e o professor responsável."
    );
  }

  const alunoIdAtual =
    String(
      idPessoa(aluno) || ""
    ).trim();

  /*
   * Se o treino já foi criado e somente a entrada no
   * banco de aprendizagem falhou, um novo clique NÃO
   * cria outra versão. Ele tenta apenas aprovar a versão
   * que já está salva.
   */
  if (
    assistenteAprendizadoAprovacaoPendente &&
    assistenteAprendizadoTreinoVersaoId &&
    assistenteAprendizadoExecucaoId &&
    assistenteAprendizadoSugestaoId
  ) {
    const status =
      $("assistenteStatus");

    try {
      const aprovacao =
        await registrarAprovacaoAprendizadoAssistente({
          alunoId:
            alunoIdAtual,

          treinoVersaoId:
            assistenteAprendizadoTreinoVersaoId
        });

      if (status) {
        status.textContent =
          `Aprovação confirmada. ` +
          `O treino já salvo foi registrado no banco de aprendizagem` +
          `${aprovacao?.jaExistia ? " (registro já existente)" : ""}. ` +
          `Nenhuma nova versão foi criada.`;

        status.classList.add(
          "gerado"
        );
      }

      resetarAprendizadoAssistente();

      alert(
        "Aprovação concluída.\n\n" +
        "O treino já estava salvo e nenhuma nova versão foi criada."
      );

      atualizarEstadoPrescricao();
      return;
    } catch (erro) {
      if (status) {
        status.textContent =
          "O treino continua salvo, mas a aprovação para aprendizagem ainda não foi confirmada. " +
          String(
            erro?.message || ""
          );

        status.classList.remove(
          "gerado"
        );
      }

      alert(
        "O treino já está salvo. A tentativa de registrar a aprovação falhou.\n\n" +
        String(
          erro?.message || ""
        ) +
        "\n\nNenhuma nova versão foi criada."
      );

      atualizarEstadoPrescricao();
      return;
    }
  }

  if (
    !divisoes.some(
      d => (d.itens || []).length
    )
  ) {
    return alert(
      "Adicione pelo menos um exercício ao treino."
    );
  }

  const sugestaoAssistidaAtiva =
    Boolean(
      assistenteAprendizadoExecucaoId &&
      assistenteAprendizadoSugestaoId &&
      assistenteAprendizadoPlanoOriginal
    );

  if (sugestaoAssistidaAtiva) {
    const confirmou =
      window.confirm(
        "Confirma que o professor revisou os exercícios, séries, repetições, carga, descanso, método e observações?\n\n" +
        "Ao confirmar, o Fusion criará uma NOVA VERSÃO do treino. " +
        "O treino anterior será preservado no histórico e ficará inativo. " +
        "Depois do salvamento, esta versão será registrada como exemplo aprovado no banco de aprendizagem."
      );

    if (!confirmou) {
      return;
    }

    try {
      await garantirRevisaoAprendizadoAntesSalvar();
    } catch (erro) {
      const status =
        $("assistenteStatus");

      if (status) {
        status.textContent =
          "Salvamento bloqueado: " +
          String(
            erro?.message || ""
          );

        status.classList.remove(
          "gerado"
        );
      }

      alert(
        erro?.message ||
        "A revisão ainda não foi confirmada. O treino não foi salvo."
      );

      atualizarEstadoPrescricao();
      return;
    }
  }

  const payload = {
    alunoId:
      idPessoa(aluno),

    alunoNome:
      nomePessoa(aluno),

    professorId:
      idPessoa(professor),

    professorNome:
      nomePessoa(professor),

    objetivo:
      $("objetivo").value,

    validade:
      $("validade").value,

    dataPrescricao:
      $("dataPrescricao").value,

    observacoes:
      $("observacoes").value,

    divisoes
  };

  let url;
  let method;

  if (sugestaoAssistidaAtiva) {
    /*
     * Sugestão assistida nunca sobrescreve a versão atual.
     */
    url =
      "/api/treinos";

    method =
      "POST";

    payload.origem =
      "assistente_regras";

    payload.versaoOrigemId =
      treinoAtualId || "";

    payload.assistenteExecucaoId =
      assistenteAprendizadoExecucaoId;

    payload.assistenteSugestaoId =
      assistenteAprendizadoSugestaoId;

    payload.revisaoProfessorConfirmada =
      true;
  } else {
    url =
      treinoAtualId
        ? `/api/treinos/${encodeURIComponent(treinoAtualId)}`
        : "/api/treinos";

    method =
      treinoAtualId
        ? "PUT"
        : "POST";
  }

  const r =
    await api(
      url,
      {
        method,

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(payload)
      }
    );

  if (!r.ok) {
    alert(
      r.mensagem ||
      "Erro ao salvar treino."
    );

    atualizarEstadoPrescricao();
    return;
  }

  const salvo =
    r.dados ||
    r.data ||
    {};

  treinoAtualId =
    String(
      salvo.id ||
      salvo._id ||
      treinoAtualId ||
      ""
    );

  localStorage.setItem(
    "fusion_aluno_treino_selecionado",
    JSON.stringify({
      alunoId:
        payload.alunoId,

      alunoNome:
        payload.alunoNome
    })
  );

  if (!sugestaoAssistidaAtiva) {
    alert(
      method === "PUT"
        ? "Treino atualizado."
        : "Treino prescrito salvo."
    );

    atualizarEstadoPrescricao();
    return;
  }

  /*
   * A partir daqui a nova versão JÁ EXISTE.
   * Falha no aprendizado nunca desfaz ou duplica o treino.
   */
  assistenteAprendizadoTreinoVersaoId =
    treinoAtualId;

  assistenteAprendizadoAprovacaoPendente =
    true;

  const status =
    $("assistenteStatus");

  if (status) {
    status.textContent =
      `Treino V${salvo.versao || "?"} salvo. ` +
      `A versão anterior foi preservada. ` +
      `Confirmando aprovação no banco de aprendizagem...`;

    status.classList.add(
      "gerado"
    );
  }

  try {
    const aprovacao =
      await registrarAprovacaoAprendizadoAssistente({
        alunoId:
          payload.alunoId,

        treinoVersaoId:
          treinoAtualId
      });

    if (status) {
      status.textContent =
        `Treino V${salvo.versao || "?"} salvo e liberado. ` +
        `Versão anterior preservada. ` +
        `Exemplo aprovado no banco de aprendizagem` +
        `${aprovacao?.jaExistia ? " (registro já existente)" : ""}.`;

      status.classList.add(
        "gerado"
      );
    }

    /*
     * Fluxo encerrado. Isso também impede um segundo clique
     * de reutilizar a mesma sugestão para criar outra versão.
     */
    resetarAprendizadoAssistente();

    alert(
      `Treino V${salvo.versao || "?"} criado e liberado com sucesso.\n\n` +
      "A versão anterior foi preservada e arquivada. " +
      "A versão revisada pelo professor foi registrada no banco de aprendizagem."
    );
  } catch (erro) {
    /*
     * O treino permanece válido e ativo.
     * Mantemos os IDs para permitir retry idempotente.
     */
    assistenteAprendizadoAprovacaoPendente =
      true;

    if (status) {
      status.textContent =
        `Treino V${salvo.versao || "?"} salvo e ativo, mas a aprovação para aprendizagem falhou. ` +
        `Clique em Salvar novamente para tentar SOMENTE a aprovação. ` +
        String(
          erro?.message || ""
        );

      status.classList.remove(
        "gerado"
      );
    }

    alert(
      `Treino V${salvo.versao || "?"} foi criado e está ativo.\n\n` +
      "A entrada no banco de aprendizagem ainda não foi confirmada.\n\n" +
      "Clique em Salvar treino novamente para tentar apenas a aprovação. " +
      "Nenhuma nova versão será criada nessa tentativa.\n\n" +
      String(
        erro?.message || ""
      )
    );
  }

  atualizarEstadoPrescricao();
}

async function carregarAlunos() {
  const r = await api("/api/alunos");
  alunos = filtrarAlunosDoProfessor(listaDe(r));
  renderAlunos();
  atualizarEstadoPrescricao();
  await carregarContextoAvaliacaoAssistente();
  renderAssistenteAluno();
}

async function carregarProfessores() {
  const r = await api("/api/professores");
  professores = listaDe(r);
  renderProfessores();
  atualizarEstadoPrescricao();
}

async function init() {
  $("dataPrescricao").value = new Date().toISOString().slice(0, 10);
  const r = await api("/api/treinos/biblioteca");
  const bibliotecaApi = r?.dados || null;
  biblioteca = bibliotecaValida(bibliotecaApi)
    ? bibliotecaApi
    : { grupos: [], objetivos: [], exercicios: [] };
  biblioteca.grupos = Array.isArray(biblioteca.grupos) ? biblioteca.grupos : [];
  biblioteca.objetivos = Array.isArray(biblioteca.objetivos) ? biblioteca.objetivos : [];
  biblioteca.exercicios = (biblioteca.exercicios || []).map(normalizarExercicio);

  if (!biblioteca.exercicios.length) {
    console.error("Biblioteca de exercícios vazia: API e catálogo local indisponíveis.");
  }
  popularFiltros();
  renderExercicios();
  renderDivisoes();
  atualizarEstadoPrescricao();
  await carregarProfessores();
  await carregarAlunos();
}

$("busca").oninput = renderExercicios;
$("grupoFiltro").onchange = renderExercicios;
$("buscaAluno").oninput = () => { renderAlunos(); atualizarEstadoPrescricao(); };
$("alunoSelect").onchange = async () => {
  await carregarTreinoDoAluno();
  await carregarContextoAvaliacaoAssistente();
  renderAssistenteAluno();
};
$("professorSelect").onchange = atualizarEstadoPrescricao;
$("objetivo")?.addEventListener("change", renderAssistenteAluno);
async function executarGeracaoAssistente(proximaOpcao = false) {
  try {
    await gerarSugestaoAssistenteRegras({ proximaOpcao });
  } catch (erro) {
    console.error("Assistente Fusion: erro ao gerar sugestao.", erro);

    const status = $("assistenteStatus");
    const mensagem = erro?.message || "Erro inesperado durante a geracao.";

    if (status) {
      status.textContent = `Erro ao gerar sugestão: ${mensagem}`;
      status.classList.remove("gerado");
    }

    alert(`Não foi possível gerar a sugestão.\n\n${mensagem}`);
  }
}

$("gerarTreinoAssistido")?.addEventListener(
  "click",
  () => executarGeracaoAssistente(false)
);

$("gerarOutraOpcaoAssistido")?.addEventListener(
  "click",
  () => executarGeracaoAssistente(true)
);
if ($("addDivisao")) $("addDivisao").onclick = adicionarDivisao;
$("salvarTreino").onclick = salvar;
if ($("salvarTreinoRodape")) $("salvarTreinoRodape").onclick = salvar;
init();
