(() => {
  const $ = id => document.getElementById(id);

  function normalizar(v){
    return String(v ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .trim()
      .toLowerCase();
  }

  function idAluno(a = {}){
    return String(
      a.id ??
      a._id ??
      a.alunoId ??
      a.aluno_id ??
      ""
    ).trim();
  }

  function alunoAtivo(a = {}){
    return normalizar(a.status || "ativo") === "ativo";
  }

  function alunoPreMatriculado(a = {}){
    const status = normalizar(
      a.status ||
      a.situacao ||
      a.statusMatricula ||
      a.matriculaStatus ||
      ""
    );

    return [
      "pre-matriculado",
      "pre matriculado",
      "pendente"
    ].includes(status);
  }

  function dataBrasilia(){
    const partes = new Intl.DateTimeFormat("pt-BR",{
      timeZone:"America/Maceio",
      year:"numeric",
      month:"2-digit",
      day:"2-digit"
    }).formatToParts(new Date());

    const mapa = Object.fromEntries(
      partes.map(p => [p.type,p.value])
    );

    return `${mapa.year}-${mapa.month}-${mapa.day}`;
  }

  function mesDiaNascimento(valor){
    const s = String(valor || "").trim();

    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m) return `${m[2]}-${m[3]}`;

    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if(m) return `${m[2]}-${m[1]}`;

    return "";
  }

  async function requisitar(url){
    const fetcher = window.FusionAuth?.fetchAuth
      ? FusionAuth.fetchAuth.bind(FusionAuth)
      : fetch;

    const resp = await fetcher(url,{cache:"no-store"});

    if(!resp.ok){
      throw new Error(`${url}: HTTP ${resp.status}`);
    }

    return resp.json();
  }

  function listaDoPayload(json,chave){
    if(Array.isArray(json)) return json;
    if(Array.isArray(json?.[chave])) return json[chave];
    if(Array.isArray(json?.dados)) return json.dados;
    if(Array.isArray(json?.data)) return json.data;
    return [];
  }

  function urlArea(area){
    const match = location.pathname.match(/^\/([^/]+)\/app(?:\/|$)/);

    if(match){
      return `/${match[1]}/app/${area}`;
    }

    return `/pages/${area}/index.html`;
  }

  function configurarLinks(){
    const destinos = {
      "aniversariantes-ativos":"alunos",
      "aniversariantes-inativos":"alunos",
      debito:"mensalidades",
      bloqueados:"alunos",
      receber:"recebimentos",
      pagar:"pagamentos"
    };

    Object.entries(destinos).forEach(([id,area]) => {
      const el = $(`infoDia-${id}`);
      if(el) el.href = urlArea(area);
    });
  }

  function setNumero(id,valor,alerta=false){
    const numero = $(`infoDiaNumero-${id}`);
    const item = $(`infoDia-${id}`);

    if(numero){
      numero.textContent =
        Number.isFinite(Number(valor))
          ? String(Number(valor))
          : "—";
    }

    if(item){
      item.dataset.alerta =
        Number(valor) > 0 && alerta ? "1" : "0";
    }
  }

  function setMovimento(id,valor){
    const el = $(`movimentoNumero-${id}`);

    if(!el) return;

    el.textContent =
      Number.isFinite(Number(valor))
        ? String(Number(valor))
        : "—";
  }

  function alunoBloqueado(a = {}){
    if(a.bloqueado === true || a.bloqueioCheckin === true){
      return true;
    }

    const alvo = [
      a.status,
      a.situacao,
      a.statusMatricula,
      a.matriculaStatus
    ].map(normalizar).join(" ");

    return alvo.includes("bloquead");
  }

  function nascimentoAluno(a = {}){
    return String(
      a.data_nascimento ||
      a.dataNascimento ||
      a.nascimento ||
      ""
    ).trim();
  }

  function analisarNascimento(valor){
    const s = String(valor || "").trim();

    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m){
      return {
        ano:Number(m[1]),
        mes:Number(m[2]),
        dia:Number(m[3]),
        original:s
      };
    }

    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if(m){
      return {
        ano:Number(m[3]),
        mes:Number(m[2]),
        dia:Number(m[1]),
        original:s
      };
    }

    return null;
  }

  function diasAteAniversario(valor, hojeISO){
    const nasc = analisarNascimento(valor);
    if(!nasc) return null;

    const [anoHoje,mesHoje,diaHoje] =
      String(hojeISO).split("-").map(Number);

    if(!anoHoje || !mesHoje || !diaHoje) return null;

    const hojeUtc = Date.UTC(anoHoje,mesHoje - 1,diaHoje);

    let aniversarioUtc =
      Date.UTC(anoHoje,nasc.mes - 1,nasc.dia);

    if(aniversarioUtc < hojeUtc){
      aniversarioUtc =
        Date.UTC(anoHoje + 1,nasc.mes - 1,nasc.dia);
    }

    return Math.round(
      (aniversarioUtc - hojeUtc) / 86400000
    );
  }

  function dataNascimentoBR(valor){
    const nasc = analisarNascimento(valor);
    if(!nasc) return "Nascimento não informado";

    return [
      String(nasc.dia).padStart(2,"0"),
      String(nasc.mes).padStart(2,"0"),
      String(nasc.ano).padStart(4,"0")
    ].join("/");
  }

  function escaparHtml(valor){
    return String(valor ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function telefoneAluno(a = {}){
    return String(
      a.whatsapp ||
      a.telefone ||
      a.celular ||
      ""
    ).trim();
  }

  function numeroWhatsapp(valor){
    let n = String(valor || "").replace(/\D/g,"");

    if(!n) return "";

    if((n.length === 10 || n.length === 11) && !n.startsWith("55")){
      n = `55${n}`;
    }

    return n.length >= 12 && n.length <= 13 ? n : "";
  }

  function textoDiaAniversario(dias){
    if(dias === 0) return "Hoje";
    if(dias === 1) return "Amanhã";
    return `Em ${dias} dias`;
  }

  function planoAluno(a = {}){
    return String(
      a.plano ||
      a.planoNome ||
      a.modalidade ||
      ""
    ).trim();
  }

  function mensagemWhatsapp(a, tipo){
    const primeiroNome =
      String(a.nome || "aluno")
        .trim()
        .split(/\s+/)[0] || "aluno";

    if(tipo === "inativo"){
      return [
        `Olá, ${primeiroNome}! Feliz aniversário!`,
        "A equipe Fusion deseja um excelente dia para você.",
        "Temos um presente especial de aniversário e queremos convidar você a voltar para a academia.",
        "Fale com a gente para saber mais."
      ].join(" ");
    }

    return [
      `Olá, ${primeiroNome}! Feliz aniversário!`,
      "A equipe Fusion deseja um excelente dia para você."
    ].join(" ");
  }

  function linhaAniversario(a, tipo, hoje){
    const dias = diasAteAniversario(
      nascimentoAluno(a),
      hoje
    );

    const numero = numeroWhatsapp(
      telefoneAluno(a)
    );

    const plano = planoAluno(a);

    const contato = numero
      ? `<a class="aniversario-whatsapp"
            href="https://wa.me/${numero}?text=${encodeURIComponent(
              mensagemWhatsapp(a,tipo)
            )}"
            target="_blank"
            rel="noopener noreferrer">WhatsApp</a>`
      : `<span class="aniversario-sem-contato">Sem WhatsApp</span>`;

    return `
      <article class="aniversario-pessoa" data-situacao="${tipo}">
        <div class="aniversario-pessoa-principal">
          <div class="aniversario-pessoa-nome">
            ${escaparHtml(a.nome || "Aluno")}
          </div>

          <div class="aniversario-pessoa-meta">
            <span>${escaparHtml(
              dataNascimentoBR(nascimentoAluno(a))
            )}</span>
            ${plano
              ? `<span>${escaparHtml(plano)}</span>`
              : ""
            }
          </div>
        </div>

        <div class="aniversario-pessoa-acoes">
          <span class="aniversario-quando">
            ${escaparHtml(textoDiaAniversario(dias))}
          </span>
          ${contato}
        </div>
      </article>
    `;
  }

  function proximosAniversarios(lista, hoje, limiteDias = 7){
    return (Array.isArray(lista) ? lista : [])
      .map(a => ({
        aluno:a,
        dias:diasAteAniversario(
          nascimentoAluno(a),
          hoje
        )
      }))
      .filter(item =>
        Number.isInteger(item.dias) &&
        item.dias >= 0 &&
        item.dias <= limiteDias
      )
      .sort((a,b) =>
        a.dias - b.dias ||
        String(a.aluno.nome || "").localeCompare(
          String(b.aluno.nome || ""),
          "pt-BR"
        )
      )
      .map(item => item.aluno);
  }

  function renderizarGrupoAniversarios(
    id,
    lista,
    tipo,
    hoje
  ){
    const el = $(id);
    if(!el) return;

    const proximos = proximosAniversarios(
      lista,
      hoje,
      7
    );

    if(!proximos.length){
      el.innerHTML =
        `<p class="aniversarios-vazio">Nenhum aniversário nos próximos 7 dias.</p>`;
      return;
    }

    el.innerHTML = proximos
      .map(a => linhaAniversario(a,tipo,hoje))
      .join("");
  }

  function renderizarAgendaAniversarios(
    ativos,
    inativos,
    hoje
  ){
    renderizarGrupoAniversarios(
      "aniversariosListaAtivos",
      ativos,
      "ativo",
      hoje
    );

    renderizarGrupoAniversarios(
      "aniversariosListaInativos",
      inativos,
      "inativo",
      hoje
    );
  }

  function renderizarAgendaIndisponivel(){
    [
      "aniversariosListaAtivos",
      "aniversariosListaInativos"
    ].forEach(id => {
      const el = $(id);

      if(el){
        el.innerHTML =
          `<p class="aniversarios-vazio">Não foi possível carregar os aniversários.</p>`;
      }
    });
  }

  function mensalidadeEmDebito(m = {}, hoje){
    const st = normalizar(m.status);
    const vencimento = String(
      m.vencimento ||
      m.dataVencimento ||
      m.data_vencimento ||
      ""
    ).slice(0,10);

    if(["atrasado","atrasada","vencido","vencida"].includes(st)){
      return true;
    }

    return (
      ["aberto","aberta","parcial"].includes(st) &&
      /^\d{4}-\d{2}-\d{2}$/.test(vencimento) &&
      vencimento < hoje
    );
  }

  async function carregar(){
    configurarLinks();

    const hoje = dataBrasilia();
    const mesDiaHoje = hoje.slice(5);

    const resultados = await Promise.allSettled([
      requisitar("/api/alunos"),
      requisitar("/api/mensalidades"),
      requisitar("/api/recebimentos/resumo"),
      requisitar("/api/pagamentos"),
      requisitar("/api/checkin/resumo")
    ]);

    // ALUNOS
    if(resultados[0].status === "fulfilled"){
      const alunos = listaDoPayload(
        resultados[0].value,
        "alunos"
      );

      const ativos = alunos.filter(alunoAtivo);

      const inativos = alunos.filter(a =>
        !alunoAtivo(a) &&
        !alunoPreMatriculado(a)
      );

      const idsAtivos = new Set(
        ativos.map(idAluno).filter(Boolean)
      );

      const aniversariantesAtivos = ativos.filter(a =>
        mesDiaNascimento(
          nascimentoAluno(a)
        ) === mesDiaHoje
      );

      const aniversariantesInativos = inativos.filter(a =>
        mesDiaNascimento(
          nascimentoAluno(a)
        ) === mesDiaHoje
      );

      const bloqueados = alunos.filter(alunoBloqueado);

      setNumero(
        "aniversariantes-ativos",
        aniversariantesAtivos.length,
        true
      );

      setNumero(
        "aniversariantes-inativos",
        aniversariantesInativos.length,
        true
      );

      setNumero("bloqueados",bloqueados.length,true);

      renderizarAgendaAniversarios(
        ativos,
        inativos,
        hoje
      );

      // MENSALIDADES / ALUNOS EM DÉBITO
      if(resultados[1].status === "fulfilled"){
        const mensalidades = listaDoPayload(
          resultados[1].value,
          "mensalidades"
        );

        const idsDebito = new Set();
        let semId = 0;

        mensalidades
          .filter(m => mensalidadeEmDebito(m,hoje))
          .forEach(m => {
            const id = String(
              m.alunoId ??
              m.aluno_id ??
              m.idAluno ??
              ""
            ).trim();

            if(id){
              if(!idsAtivos.size || idsAtivos.has(id)){
                idsDebito.add(id);
              }
            }else{
              semId++;
            }
          });

        setNumero(
          "debito",
          idsDebito.size || semId,
          true
        );
      }else{
        setNumero("debito",NaN);
      }
    }else{
      setNumero("aniversariantes-ativos",NaN);
      setNumero("aniversariantes-inativos",NaN);
      setNumero("bloqueados",NaN);
      setNumero("debito",NaN);
      renderizarAgendaIndisponivel();
    }

    // CONTAS A RECEBER
    if(resultados[2].status === "fulfilled"){
      const r = resultados[2].value || {};
      const total =
        Number(r.abertos || 0) +
        Number(r.parciais || 0);

      setNumero("receber",total,true);
    }else{
      setNumero("receber",NaN);
    }

    // CONTAS A PAGAR
    if(resultados[3].status === "fulfilled"){
      const payload = resultados[3].value || {};
      const r = payload.resumo || {};

      const total =
        Number(r.abertos || 0) +
        Number(r.parciais || 0);

      setNumero("pagar",total,true);
    }else{
      setNumero("pagar",NaN);
    }

    // MOVIMENTO / CHECK-IN
    if(resultados[4].status === "fulfilled"){
      const resumo =
        resultados[4].value?.resumo || {};

      setMovimento("entradas",resumo.entradasHoje);
      setMovimento("alunos",resumo.alunosPresentesAgora);
      setMovimento("funcionarios",resumo.funcionariosPresentesAgora);
      setMovimento("saidas",resumo.saidasHoje);
      setMovimento("bloqueados",resumo.bloqueadosHoje);
      setMovimento("mes",resumo.pessoasMes);
    }else{
      setMovimento("entradas",NaN);
      setMovimento("alunos",NaN);
      setMovimento("funcionarios",NaN);
      setMovimento("saidas",NaN);
      setMovimento("bloqueados",NaN);
      setMovimento("mes",NaN);
    }

    const atualizado = $("infoDiaAtualizado");

    if(atualizado){
      atualizado.textContent =
        `Atualizado às ${new Intl.DateTimeFormat("pt-BR",{
          timeZone:"America/Maceio",
          hour:"2-digit",
          minute:"2-digit"
        }).format(new Date())}`;
    }
  }

  carregar();

  document.addEventListener("fusion:checkin-atualizado",() => {
    carregar();
  });

  document.addEventListener("visibilitychange",() => {
    if(!document.hidden){
      carregar();
    }
  });
})();


// DASHBOARD OPERACIONAL LADO A LADO 20260820
document.addEventListener("DOMContentLoaded", () => {
  try {
    const movimento = document.querySelector(".dashboard-faixa-card");
    const infosDia = document.querySelector(".infos-dia-card");

    if (!movimento || !infosDia) return;
    if (movimento.closest(".dashboard-operacional-linha")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "dashboard-operacional-linha";

    movimento.parentNode.insertBefore(wrapper, movimento);
    wrapper.appendChild(movimento);
    wrapper.appendChild(infosDia);
  } catch (e) {
    console.warn("Falha ao compactar linha operacional do dashboard:", e);
  }
});


// LAYOUT RELACIONAMENTO + AVALIACOES 20260820
document.addEventListener("DOMContentLoaded", () => {
  try {
    const secao = document.querySelector(".aniversarios-relacionamento");
    const topo = secao?.querySelector(".aniversarios-relacionamento-topo");
    const gridOriginal = secao?.querySelector(".aniversarios-relacionamento-grid");
    const grupos = gridOriginal ? [...gridOriginal.querySelectorAll(".aniversarios-grupo")] : [];
    const grupoAtivos = grupos[0] || null;
    const grupoInativos = grupos[1] || null;
    const avaliacoes = document.querySelector("#agendaAvaliacoesDashboard");

    if (!secao || !topo || !gridOriginal || !grupoAtivos || !grupoInativos || !avaliacoes) {
      return;
    }

    if (secao.querySelector(".dashboard-rel-av-layout")) {
      return;
    }

    const layout = document.createElement("div");
    layout.className = "dashboard-rel-av-layout";

    const colEsquerda = document.createElement("div");
    colEsquerda.className = "dashboard-rel-av-col dashboard-rel-av-col-esq";

    const colDireita = document.createElement("div");
    colDireita.className = "dashboard-rel-av-col dashboard-rel-av-col-dir";

    layout.appendChild(colEsquerda);
    layout.appendChild(colDireita);

    secao.appendChild(layout);

    // esquerda: ativos em cima + inativos abaixo
    colEsquerda.appendChild(grupoAtivos);
    colEsquerda.appendChild(grupoInativos);

    // direita: avaliações
    colDireita.appendChild(avaliacoes);

    // remove grade antiga vazia
    gridOriginal.remove();
  } catch (erro) {
    console.warn("Falha ao reorganizar relacionamento e avaliações:", erro);
  }
});
