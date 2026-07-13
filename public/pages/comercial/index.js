const listaPlanos = document.getElementById('listaPlanos');
const formLead = document.getElementById('formLead');
const alertaLead = document.getElementById('alertaLead');
const leadPlano = document.getElementById('leadPlano');
let planos = [];

function lista(payload) {
  return Array.isArray(payload)
    ? payload
    : (payload.dados || payload.data || payload.planos || payload.itens || []);
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[caractere]));
}

function textoNormalizado(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function planoAtivo(plano) {
  const status = textoNormalizado(plano.status || 'ativo');
  return !['inativo', 'cancelado', 'excluido'].includes(status);
}

function nomePlano(plano) {
  return plano.nome || plano.descricao || 'Plano';
}

function valorPlano(plano) {
  return plano.valorMensal ?? plano.valor ?? plano.mensalidade ?? plano.preco ?? 0;
}

function idPlano(plano) {
  return plano.id || plano.codigo || nomePlano(plano);
}

function tipoPlano(plano) {
  return plano.tipoPlano || plano.tipo || 'Mensal';
}

function recorrenciaPlano(plano) {
  const meses = Number(plano.recorrenciaMeses || plano.fidelidadeMeses || 0);
  if (meses > 1) return `${meses} meses`;
  if (meses === 1) return '1 mês';
  return tipoPlano(plano);
}

function modalidadesPlano(plano) {
  const modalidades = Array.isArray(plano.modalidadesIncluidas)
    ? plano.modalidadesIncluidas.filter(Boolean)
    : [];
  return modalidades.length ? modalidades.join(', ') : 'Consulte as modalidades';
}

function limitePlano(plano) {
  const limite = Number(plano.limiteSemanal || 0);
  return limite > 0 ? `${limite}x por semana` : 'Acesso ilimitado';
}

function textoValor(plano) {
  const valor = moeda(valorPlano(plano));
  const meses = Number(plano.recorrenciaMeses || 0);
  const tipo = textoNormalizado(tipoPlano(plano));

  if (tipo.includes('diar')) return `${valor} por diária`;
  if (tipo.includes('pre') && meses > 1) return `${valor} pelo período`;
  if (meses > 1) return `${valor} · plano de ${meses} meses`;
  return `${valor} por mês`;
}

function mensagem(texto, tipo = 'info') {
  alertaLead.textContent = texto;
  alertaLead.className = `alerta ${tipo}`;
  alertaLead.classList.remove('hidden');
}

function classeTemplatePlano(plano, indice) {
  const tipo = textoNormalizado(tipoPlano(plano));
  if (tipo.includes('diar')) return 'plano-template-diaria';
  if (tipo.includes('pre')) return 'plano-template-periodo';
  if (indice % 4 === 1) return 'plano-template-premium';
  if (indice % 4 === 2) return 'plano-template-compacto';
  if (indice % 4 === 3) return 'plano-template-familia';
  return 'plano-template-classico';
}

function seloPlano(plano, indice) {
  const tipo = textoNormalizado(tipoPlano(plano));
  if (tipo.includes('diar')) return 'Acesso avulso';
  if (tipo.includes('pre')) return 'Período fechado';
  if (indice === 0) return 'Plano atual';
  return 'Novo plano';
}

function renderizarPlanos() {
  if (!planos.length) {
    listaPlanos.innerHTML = '<div class="loading">Nenhum plano ativo disponível no momento.</div>';
    leadPlano.innerHTML = '<option value="">Nenhum plano disponível</option>';
    return;
  }

  listaPlanos.innerHTML = planos.map((plano, indice) => {
    const descricao = plano.descricao || 'Plano disponível para matrícula.';
    const destaque = `<span class="plano-destaque">${esc(seloPlano(plano, indice))}</span>`;
    const classeTemplate = classeTemplatePlano(plano, indice);
    const taxa = Number(plano.taxaMatricula ?? plano.valorMatricula ?? 0);

    return `
      <article class="plano ${classeTemplate}">
        ${destaque}
        <div class="plano-topo">
          <p class="plano-tipo">${esc(tipoPlano(plano))}</p>
          <h3>${esc(nomePlano(plano))}</h3>
          <p class="plano-descricao">${esc(descricao)}</p>
        </div>

        <div class="plano-preco">${esc(textoValor(plano))}</div>

        <ul class="plano-detalhes">
          <li><strong>Modalidade:</strong> ${esc(modalidadesPlano(plano))}</li>
          <li><strong>Duração:</strong> ${esc(recorrenciaPlano(plano))}</li>
          <li><strong>Frequência:</strong> ${esc(limitePlano(plano))}</li>
          <li><strong>Horário:</strong> ${esc(plano.horariosPermitidos || 'Livre')}</li>
          ${taxa > 0 ? `<li><strong>Taxa de matrícula:</strong> ${esc(moeda(taxa))}</li>` : '<li><strong>Taxa de matrícula:</strong> sem taxa adicional</li>'}
        </ul>

        <a class="plano-cta" href="/pages/matricula-online/index.html?planoId=${encodeURIComponent(idPlano(plano))}">
          Escolher este plano
        </a>
      </article>`;
  }).join('');

  leadPlano.innerHTML = '<option value="">Plano de interesse</option>' + planos.map((plano) => `
    <option value="${esc(idPlano(plano))}">${esc(nomePlano(plano))} — ${esc(textoValor(plano))}</option>
  `).join('');
}

async function carregarPlanos() {
  listaPlanos.innerHTML = '<div class="loading">Carregando planos disponíveis...</div>';

  try {
    const resposta = await fetch('/api/planos?status=Ativo', { cache: 'no-store' });
    const json = await resposta.json().catch(() => ({}));

    if (!resposta.ok || json.sucesso === false || json.ok === false) {
      throw new Error(json.erro || json.mensagem || 'Não foi possível carregar os planos.');
    }

    planos = lista(json).filter(planoAtivo);
    renderizarPlanos();
  } catch (erro) {
    listaPlanos.innerHTML = '<div class="loading erro-planos">Não foi possível carregar os planos disponíveis. Atualize a página.</div>';
    leadPlano.innerHTML = '<option value="">Planos indisponíveis</option>';
  }
}

formLead.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const plano = planos.find((item) => String(idPlano(item)) === String(leadPlano.value));
  const payload = {
    nome: document.getElementById('leadNome').value.trim(),
    telefone: document.getElementById('leadTelefone').value.trim(),
    email: document.getElementById('leadEmail').value.trim(),
    planoId: leadPlano.value,
    plano: plano ? nomePlano(plano) : '',
    valorPrevisto: plano ? valorPlano(plano) : 0,
    horarioAgendado: document.getElementById('leadHorario').value.trim(),
    objetivo: document.getElementById('leadObjetivo').value.trim(),
    origem: 'site_comercial',
    etapa: document.getElementById('leadHorario').value.trim() ? 'agendado' : 'novo'
  };

  try {
    const resposta = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await resposta.json().catch(() => ({}));

    if (!resposta.ok || json.ok === false || json.sucesso === false) {
      throw new Error(json.erro || json.mensagem || 'Erro ao enviar interesse.');
    }

    formLead.reset();
    mensagem('Interesse enviado. A recepção entrará em contato.', 'sucesso');
  } catch (erro) {
    mensagem(erro.message, 'erro');
  }
});

carregarPlanos();
