const dadosFallback = { alunos: [], mensalidades: [], avaliacoes: [], lancamentos: [], resumo: {} };

async function buscar(url, chave) {
  try {
    const resp = await (window.FusionAuth?.fetchAuth ? FusionAuth.fetchAuth(url, { cache: 'no-store' }) : fetch(url, { cache: 'no-store' }));
    if (!resp.ok) return dadosFallback[chave] || [];
    const json = await resp.json();
    if (Array.isArray(json)) return json;
    return json[chave] || json.dados || json.data || [];
  } catch {
    return dadosFallback[chave] || [];
  }
}

async function buscarObjeto(url, chave = '') {
  try {
    const resp = await (window.FusionAuth?.fetchAuth ? FusionAuth.fetchAuth(url, { cache: 'no-store' }) : fetch(url, { cache: 'no-store' }));
    if (!resp.ok) return {};
    const json = await resp.json();
    if (chave && json?.[chave] && typeof json[chave] === 'object') return json[chave];
    if (json && !Array.isArray(json) && typeof json === 'object') return json;
    return {};
  } catch {
    return {};
  }
}

function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}


function agendaDashboardTexto(v) {
  return String(v ?? '').trim();
}

function agendaDashboardEsc(v) {
  return agendaDashboardTexto(v).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function agendaDashboardData(v) {
  const s = agendaDashboardTexto(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '-';
  const [ano, mes, dia] = s.split('-');
  return `${dia}/${mes}/${ano}`;
}

function agendaDashboardStatus(v) {
  const s = agendaDashboardTexto(v).toLowerCase();
  return s === 'realizada' ? 'realizada' : 'pendente';
}

function agendaDashboardChaveBrasilia(valor = new Date()) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(valor);

  const mapa = Object.fromEntries(
    partes.map(parte => [parte.type, parte.value])
  );

  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

function agendaDashboardDataRealizadaBrasilia(item = {}) {
  const bruto = String(item.realizadaEm || item.realizada_em || '').trim();

  if (bruto) {
    if (/^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/.test(bruto)) {
      return bruto.slice(0, 10);
    }

    const instante = new Date(bruto);
    if (!Number.isNaN(instante.getTime())) {
      return agendaDashboardChaveBrasilia(instante);
    }
  }

  return String(item.data || '').slice(0, 10);
}

let agendaAvaliacoesDashboardAtual = [];

function agendarViradaAgendaDashboard(callback) {
  let diaObservado = agendaDashboardChaveBrasilia();

  function verificarVirada() {
    const diaAtual = agendaDashboardChaveBrasilia();

    if (diaAtual !== diaObservado) {
      diaObservado = diaAtual;
      callback();
    }
  }

  function milissegundosAteVirada() {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());

    const mapa = Object.fromEntries(
      partes.map(parte => [parte.type, parte.value])
    );

    const segundosHoje =
      Number(mapa.hour || 0) * 3600 +
      Number(mapa.minute || 0) * 60 +
      Number(mapa.second || 0);

    return Math.max(
      250,
      (86400 - segundosHoje) * 1000 -
        new Date().getMilliseconds() +
        250
    );
  }

  function agendar() {
    setTimeout(() => {
      verificarVirada();
      agendar();
    }, milissegundosAteVirada());
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) verificarVirada();
  });

  agendar();
}

function renderAgendaAvaliacoesDashboard(lista = []) {
  const container = document.getElementById('dashboardListaAgendaAvaliacoes');
  if (!container) return;

  agendaAvaliacoesDashboardAtual =
    Array.isArray(lista) ? lista : [];

  const registros = agendaAvaliacoesDashboardAtual;
  const hojeBrasilia = agendaDashboardChaveBrasilia();

  const pendentes = registros
    .filter(x => agendaDashboardStatus(x.status) === 'pendente')
    .sort((a, b) =>
      `${a.data || ''}T${a.hora || ''}`.localeCompare(
        `${b.data || ''}T${b.hora || ''}`
      )
    );

  const realizadas = registros
    .filter(x =>
      agendaDashboardStatus(x.status) === 'realizada' &&
      agendaDashboardDataRealizadaBrasilia(x) === hojeBrasilia
    )
    .sort((a, b) =>
      `${b.realizadaEm || b.data || ''}T${b.hora || ''}`.localeCompare(
        `${a.realizadaEm || a.data || ''}T${a.hora || ''}`
      )
    );

  setText('dashboardAgendaPendentes', pendentes.length);
  setText('dashboardAgendaRealizadas', realizadas.length);

  const exibidos = [...pendentes, ...realizadas].slice(0, 12);

  if (!exibidos.length) {
    container.innerHTML =
      '<p style="margin:0; color:#64748b;">Nenhuma avaliação programada.</p>';
    return;
  }

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; min-width:720px;">
        <thead>
          <tr style="text-align:left; border-bottom:1px solid #e2e8f0;">
            <th style="padding:10px 8px;">Data</th>
            <th style="padding:10px 8px;">Horário</th>
            <th style="padding:10px 8px;">Aluno</th>
            <th style="padding:10px 8px;">Professor</th>
            <th style="padding:10px 8px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${exibidos.map(item => {
            const realizada =
              agendaDashboardStatus(item.status) === 'realizada';

            const statusHtml = realizada
              ? '<span style="display:inline-block; padding:6px 10px; border-radius:999px; background:#dcfce7; color:#166534; font-weight:700; white-space:nowrap;">✓ Realizada com sucesso</span>'
              : '<span style="display:inline-block; padding:6px 10px; border-radius:999px; background:#fff7ed; color:#c2410c; font-weight:700; white-space:nowrap;">Pendente</span>';

            return `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:11px 8px;">
                  ${agendaDashboardEsc(agendaDashboardData(item.data))}
                </td>
                <td style="padding:11px 8px; font-weight:700;">
                  ${agendaDashboardEsc(item.hora || '-')}
                </td>
                <td style="padding:11px 8px;">
                  ${agendaDashboardEsc(item.alunoNome || '-')}
                </td>
                <td style="padding:11px 8px;">
                  ${agendaDashboardEsc(item.professorNome || '-')}
                </td>
                <td style="padding:11px 8px;">
                  ${statusHtml}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

agendarViradaAgendaDashboard(() =>
  renderAgendaAvaliacoesDashboard(agendaAvaliacoesDashboardAtual)
);

(async function carregarDashboard() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const hojeIso = hoje.toISOString().slice(0, 10);
  const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().slice(0, 10);
  const [alunos, mensalidadesResumo, avaliacoes, financeiroResumo, financeiroAnteriorResumo, agendaAvaliacoes] = await Promise.all([
    buscar('/api/alunos', 'alunos'),
    buscarObjeto('/api/mensalidades/resumo'),
    buscar('/api/avaliacoes', 'avaliacoes'),
    buscarObjeto(`/api/financeiro/relatorios/bi-financeiro?inicio=${inicioMes}&fim=${hojeIso}`, 'resumo'),
    buscarObjeto(`/api/financeiro/relatorios/bi-financeiro?inicio=2000-01-01&fim=${fimMesAnterior}`, 'resumo'),
    buscar('/api/agenda-avaliacoes', 'agenda')
  ]);

  const ativos = alunos.filter(a => String(a.status || 'ativo').toLowerCase() === 'ativo').length;
  // A cobrança inicial unificada é uma entrada financeira, não uma segunda
  // mensalidade recorrente. O backend já a exclui deste campo específico.
  const abertas = mensalidadesResumo.recorrentesAbertas !== undefined
    ? Number(mensalidadesResumo.recorrentesAbertas || 0)
    : Number(mensalidadesResumo.abertas || 0) +
      Number(mensalidadesResumo.atrasadas || 0) +
      Number(mensalidadesResumo.parciais || 0);
  const recebidoMes = Number(financeiroResumo.recebido ?? financeiroResumo.receitasLiquidasPagas ?? 0);
  const saidoMes = Number(financeiroResumo.pago ?? financeiroResumo.despesasPagas ?? 0);
  const resultadoMes = Number(financeiroResumo.saldoRealizado ?? (recebidoMes - saidoMes));
  const fechamentoAnterior = Number(financeiroAnteriorResumo.saldoRealizado ?? 0);
  const disponivelAgora = Number((fechamentoAnterior + resultadoMes).toFixed(2));

  setText('kpiAlunos', ativos);
  setText('kpiAbertas', abertas);
  const idsAlunosValidos = new Set(
    alunos
      .map(a => String(a.id ?? a._id ?? a.alunoId ?? a.aluno_id ?? "").trim())
      .filter(Boolean)
  );

  const avaliacoesValidas = avaliacoes.filter(avaliacao => {
    const id = String(
      avaliacao.alunoId ??
      avaliacao.aluno_id ??
      avaliacao.idAluno ??
      ""
    ).trim();
    return Boolean(id && idsAlunosValidos.has(id));
  });

  setText('kpiAvaliacoes', avaliacoesValidas.length);
  setText('kpiReceita', moeda(recebidoMes));
  setText('kpiSaidoMes', moeda(saidoMes));
  setText('kpiResultadoMes', moeda(resultadoMes));
  setText('kpiDisponivelAgora', moeda(disponivelAgora));
  setText('kpiFechamentoAnterior', moeda(fechamentoAnterior));

  renderAgendaAvaliacoesDashboard(agendaAvaliacoes);
})();


(function configurarEntradaRapidaIdentificada() {
  const campo = document.getElementById("dashboardEntradaCodigo");
  const botao = document.getElementById("dashboardBtnEntradaRapida");
  const status = document.getElementById("dashboardEntradaStatus");

  if (!campo || !botao || !status) return;

  const fetchSeguro = window.FusionAuth?.fetchAuth
    ? FusionAuth.fetchAuth.bind(FusionAuth)
    : fetch.bind(window);

  function agoraAcademia() {
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Maceio",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(new Date());

    const p = Object.fromEntries(
      partes.map(item => [item.type, item.value])
    );

    return {
      data: `${p.year}-${p.month}-${p.day}`,
      hora: `${p.hour}:${p.minute}`
    };
  }

  const aguardar = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  async function aguardarLiberacaoFisica(commandId) {
    const inicioEspera = Date.now();
    const limiteMs = 20000;

    while (Date.now() - inicioEspera < limiteMs) {
      const resp = await fetchSeguro(
        `/api/access-engine/comandos/${encodeURIComponent(commandId)}`
      );

      const json =
        await resp.json().catch(() => ({}));

      if (!resp.ok || !json.ok) {
        throw new Error(
          json.mensagem ||
          json.erro ||
          "Não foi possível consultar a catraca."
        );
      }

      const command = json.command || {};
      const statusComando =
        String(command.status || "")
          .trim()
          .toLowerCase();

      if (statusComando === "failed") {
        throw new Error(
          command.error ||
          command.result?.erro ||
          command.result?.error ||
          "O Access Agent informou falha na liberação da catraca."
        );
      }

      if (statusComando === "completed") {
        const resultado =
          command.result || {};

        if (
          resultado.ok === false ||
          resultado.respostasValidas === false
        ) {
          throw new Error(
            resultado.erro ||
            resultado.error ||
            "A Henry 7X não confirmou corretamente a sequência de liberação."
          );
        }

        return command;
      }

      await aguardar(500);
    }

    throw new Error(
      "A catraca não confirmou a liberação dentro do tempo esperado."
    );
  }

  async function registrarEntrada() {
    const codigo =
      String(campo.value || "").trim();

    if (!codigo) {
      status.textContent =
        "Informe matrícula, CPF, QR Code ou código do aluno.";
      campo.focus();
      return;
    }

    if (botao.disabled) return;

    botao.disabled = true;
    botao.textContent = "Validando...";
    status.textContent =
      "Identificando aluno e validando acesso...";

    try {
      /*
       * 1. Somente autorização.
       * Esta chamada NÃO cria presença.
       */
      const query =
        new URLSearchParams({
          codigo
        });

      const respostaAutorizacao =
        await fetchSeguro(
          `/api/checkin/musculacao/autorizacao?${query.toString()}`
        );

      const autorizacao =
        await respostaAutorizacao
          .json()
          .catch(() => ({}));

      if (
        !respostaAutorizacao.ok ||
        autorizacao.ok === false
      ) {
        throw new Error(
          autorizacao.mensagem ||
          autorizacao.motivo ||
          "Não foi possível validar o acesso."
        );
      }

      const nome =
        autorizacao?.aluno?.nome ||
        codigo;

      if (!autorizacao.autorizado) {
        status.textContent =
          `Acesso negado: ${nome}. ${
            autorizacao.motivo ||
            autorizacao.mensagem ||
            ""
          }`.trim();

        return;
      }

      /*
       * 2. Enfileira a liberação no Access Bridge.
       * O VPS não tenta acessar diretamente o IP privado da Henry.
       */
      botao.textContent = "Liberando...";
      status.textContent =
        `Acesso autorizado para ${nome}. Aguardando catraca...`;

      const respostaLiberacao =
        await fetchSeguro(
          "/api/access-engine/liberar-remoto",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              alunoId:
                autorizacao?.aluno?.id || "",
              alunoNome: nome,
              direcao: "entrada",
              origem:
                "dashboard-entrada-rapida",
              motivo:
                "checkin-musculacao-autorizado"
            })
          }
        );

      const liberacao =
        await respostaLiberacao
          .json()
          .catch(() => ({}));

      if (
        !respostaLiberacao.ok ||
        liberacao.ok === false
      ) {
        throw new Error(
          liberacao.mensagem ||
          liberacao.erro ||
          "Não foi possível enviar o comando ao Access Agent."
        );
      }

      const commandId =
        liberacao?.catraca?.commandId ||
        liberacao?.catraca?.command?.id ||
        "";

      if (!commandId) {
        throw new Error(
          "O servidor não retornou o identificador do comando da catraca."
        );
      }

      /*
       * 3. Aguarda o agente local executar a Henry.
       * Aceitamos completed; rejeitamos falha física explícita.
       */
      const comando =
        await aguardarLiberacaoFisica(
          commandId
        );

      /*
       * 4. Somente DEPOIS da confirmação física
       * gravamos check-in e frequência.
       */
      botao.textContent = "Registrando...";
      status.textContent =
        `Catraca confirmada para ${nome}. Registrando presença...`;

      const horario =
        agoraAcademia();

      const resp =
        await fetchSeguro(
          "/api/checkin/musculacao",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              codigo,
              data: horario.data,
              horaEntrada: horario.hora,
              tipo:
                "Check-in Inteligente Musculação",
              usuario: "Recepção",
              observacao:
                `Entrada física confirmada pelo Fusion Access Agent. commandId=${commandId}`
            })
          }
        );

      const json =
        await resp.json().catch(() => ({}));

      if (!resp.ok || !json.ok) {
        throw new Error(
          json.mensagem ||
          "A catraca foi liberada, mas não foi possível registrar a presença."
        );
      }

      if (!json.autorizado) {
        throw new Error(
          json.mensagem ||
          "A catraca foi liberada, porém a autorização mudou antes do registro."
        );
      }

      const nomeRegistro =
        json?.registro?.aluno ||
        nome;

      status.textContent =
        `Entrada registrada: ${nomeRegistro}. Catraca confirmada e presença registrada.`;

      campo.value = "";

      document.dispatchEvent(
        new CustomEvent(
          "fusion:checkin-atualizado"
        )
      );

      campo.focus();

      console.info(
        "Entrada física confirmada:",
        {
          commandId:
            comando?.id || commandId,
          alunoId:
            autorizacao?.aluno?.id || ""
        }
      );

    } catch (erro) {
      console.error(
        "Falha na entrada rápida do Dashboard:",
        erro
      );

      status.textContent =
        erro?.message ||
        "Não foi possível registrar a entrada.";

    } finally {
      botao.disabled = false;
      botao.textContent =
        "Registrar entrada";
    }
  }

  botao.addEventListener("click", registrarEntrada);

  campo.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      registrarEntrada();
    }
  });
})();
