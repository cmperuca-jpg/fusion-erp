/* Fusion ERP - emissão de código de ativação do Fusion Aluno */
(() => {
  if (!window.location.pathname.includes('/pages/alunos/') && !/\/app\/alunos\/?$/.test(window.location.pathname)) return;
  if (window.__fusionAlunoAppAccessLoaded) return;
  window.__fusionAlunoAppAccessLoaded = true;

  const API_ALUNOS = '/api/alunos';
  const APP_PATH = '/pages/aluno-login/index.html';
  const BUTTON_ATTR = 'data-fusion-app-code';
  const SESSION_PREFIX = 'fusion_aluno_codigo_';

  function texto(valor) {
    return String(valor ?? '').trim();
  }

  function somenteNumeros(valor) {
    return texto(valor).replace(/\D/g, '');
  }

  function safeJson(response) {
    return response.json().catch(() => ({}));
  }

  function mostrarAlertaLocal(mensagem, tipo = 'info') {
    if (typeof window.mostrarAlerta === 'function') {
      window.mostrarAlerta(mensagem, tipo);
      return;
    }
    const alvo = document.getElementById('alertaAlunos');
    if (alvo) {
      alvo.textContent = mensagem;
      alvo.className = `alunos-alert ${tipo}`;
      alvo.classList.remove('hidden');
      setTimeout(() => alvo.classList.add('hidden'), 9000);
      return;
    }
    window.alert(mensagem);
  }

  function idDoOnclick(valor = '') {
    const match = texto(valor).match(/abrirEdicao\(\s*['"]([^'"]+)['"]\s*\)/i);
    return match?.[1] || '';
  }

  function localizarIdNoContainer(container) {
    if (!container) return '';
    const botaoEditar = Array.from(container.querySelectorAll('button')).find((btn) =>
      /abrirEdicao\(/i.test(btn.getAttribute('onclick') || '')
    );
    return idDoOnclick(botaoEditar?.getAttribute('onclick') || '');
  }

  function chaveSessao(alunoId) {
    return `${SESSION_PREFIX}${texto(alunoId)}`;
  }

  function expiraEmMs(dados) {
    const valor = new Date(dados?.expira_em || '').getTime();
    return Number.isFinite(valor) ? valor : 0;
  }

  function limparCodigoSessao(alunoId) {
    try {
      sessionStorage.removeItem(chaveSessao(alunoId));
    } catch {}
  }

  function salvarCodigoSessao(alunoId, dados) {
    const codigo = texto(dados?.codigo).toUpperCase();
    const expira = expiraEmMs(dados);
    if (!alunoId || !/^[0-9A-F]{8}$/.test(codigo) || !expira || expira <= Date.now()) return;
    try {
      sessionStorage.setItem(chaveSessao(alunoId), JSON.stringify({ ...dados, codigo }));
    } catch {}
  }

  function lerCodigoSessao(alunoId) {
    if (!alunoId) return null;
    try {
      const bruto = sessionStorage.getItem(chaveSessao(alunoId));
      if (!bruto) return null;
      const dados = JSON.parse(bruto);
      const codigo = texto(dados?.codigo).toUpperCase();
      const expira = expiraEmMs(dados);

      if (!/^[0-9A-F]{8}$/.test(codigo) || !expira || expira <= Date.now()) {
        limparCodigoSessao(alunoId);
        return null;
      }
      return { ...dados, codigo };
    } catch {
      limparCodigoSessao(alunoId);
      return null;
    }
  }

  function tempoRestante(dados) {
    const ms = Math.max(0, expiraEmMs(dados) - Date.now());
    const total = Math.ceil(ms / 1000);
    const minutos = Math.floor(total / 60);
    const segundos = total % 60;
    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  }

  function aplicarVisualBotao(botao, mobile = false) {
    if (!botao) return;
    botao.style.setProperty('background', '#0b4452', 'important');
    botao.style.setProperty('border', '1px solid #073946', 'important');
    botao.style.setProperty('color', '#ffffff', 'important');
    botao.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
    botao.style.setProperty('font-weight', '800', 'important');
    botao.style.setProperty('opacity', '1', 'important');
    botao.style.setProperty('cursor', 'pointer', 'important');
    if (mobile) botao.style.setProperty('min-height', '40px', 'important');
  }

  function atualizarEstadoBotao(botao) {
    if (!botao) return;
    const alunoId = texto(botao.dataset.alunoId);
    const padrao =
      botao.dataset.textoPadrao ||
      (botao.getAttribute(BUTTON_ATTR) === 'modal' ? 'Gerar código do app' : 'Código app');

    botao.dataset.textoPadrao = padrao;
    const ativo = lerCodigoSessao(alunoId);

    if (ativo) {
      const novoTexto = `Código: ${ativo.codigo} • ${tempoRestante(ativo)}`;
      if (botao.textContent !== novoTexto) botao.textContent = novoTexto;
      botao.title = 'Código válido. Clique para copiar ou enviar ao aluno.';
      botao.dataset.codigoAtivo = '1';
    } else {
      if (botao.textContent !== padrao) botao.textContent = padrao;
      botao.title = '';
      delete botao.dataset.codigoAtivo;
    }

    botao.disabled = false;
    aplicarVisualBotao(botao, Boolean(botao.closest('#alunosMobileCards')));
  }

  function atualizarBotoesDoAluno(alunoId) {
    document.querySelectorAll(`[${BUTTON_ATTR}]`).forEach((botao) => {
      if (texto(botao.dataset.alunoId) === texto(alunoId)) atualizarEstadoBotao(botao);
    });
  }

  function atualizarTodosBotoes() {
    document.querySelectorAll(`[${BUTTON_ATTR}]`).forEach(atualizarEstadoBotao);
  }

  function criarBotaoCodigo(id, mobile = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Código app';
    btn.dataset.textoPadrao = 'Código app';
    btn.setAttribute(BUTTON_ATTR, '1');
    btn.dataset.alunoId = id;
    if (!mobile) btn.className = 'btn-row';
    aplicarVisualBotao(btn, mobile);
    btn.addEventListener('click', () => acionarCodigo(id, btn));
    atualizarEstadoBotao(btn);
    return btn;
  }

  function injetarBotoesLista() {
    document.querySelectorAll('#tabelaAlunos .aluno-actions-inline').forEach((acoes) => {
      if (acoes.querySelector(`[${BUTTON_ATTR}]`)) return;
      const id = localizarIdNoContainer(acoes);
      if (!id) return;

      const editar = Array.from(acoes.querySelectorAll('button')).find((btn) =>
        /abrirEdicao\(/i.test(btn.getAttribute('onclick') || '')
      );
      const btn = criarBotaoCodigo(id, false);
      if (editar?.nextSibling) acoes.insertBefore(btn, editar.nextSibling);
      else acoes.appendChild(btn);
    });

    document.querySelectorAll('#alunosMobileCards .aluno-mobile-actions').forEach((acoes) => {
      if (acoes.querySelector(`[${BUTTON_ATTR}]`)) return;
      const id = localizarIdNoContainer(acoes);
      if (!id) return;

      const editar = Array.from(acoes.querySelectorAll('button')).find((btn) =>
        /abrirEdicao\(/i.test(btn.getAttribute('onclick') || '')
      );
      const btn = criarBotaoCodigo(id, true);
      if (editar?.nextSibling) acoes.insertBefore(btn, editar.nextSibling);
      else acoes.appendChild(btn);
    });
  }

  function injetarBotaoModalAluno() {
    const acoes = document.querySelector('#modalAluno .modal-actions');
    if (!acoes) return;

    let btn = acoes.querySelector(`[${BUTTON_ATTR}="modal"]`);
    const idAtual = texto(document.getElementById('alunoId')?.value);

    if (btn) {
      btn.dataset.alunoId = idAtual;
      atualizarEstadoBotao(btn);
      return;
    }

    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-light';
    btn.textContent = 'Gerar código do app';
    btn.dataset.textoPadrao = 'Gerar código do app';
    btn.dataset.alunoId = idAtual;
    btn.setAttribute(BUTTON_ATTR, 'modal');
    aplicarVisualBotao(btn, false);

    btn.addEventListener('click', () => {
      const id = texto(document.getElementById('alunoId')?.value);
      btn.dataset.alunoId = id;

      if (!id) {
        mostrarAlertaLocal('Salve o aluno antes de gerar o código do aplicativo.', 'erro');
        return;
      }
      acionarCodigo(id, btn);
    });

    acoes.insertBefore(btn, acoes.firstChild);
    atualizarEstadoBotao(btn);
  }

  function garantirEstilosModal() {
    if (document.getElementById('fusionAlunoAppAccessStyles')) return;

    const style = document.createElement('style');
    style.id = 'fusionAlunoAppAccessStyles';
    style.textContent = `
      #fusionAlunoCodigoModal{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.68);display:flex;align-items:center;justify-content:center;padding:18px}
      #fusionAlunoCodigoModal.hidden{display:none!important}
      #fusionAlunoCodigoModal .fusion-app-code-card{width:min(520px,100%);background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.30);padding:22px;color:#0f172a}
      #fusionAlunoCodigoModal .fusion-app-code-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}
      #fusionAlunoCodigoModal h3{margin:0;color:#0b4452;font-size:1.25rem}
      #fusionAlunoCodigoModal .fusion-app-code-close{border:0;background:#eef2f7;border-radius:9px;width:38px;height:38px;font-size:22px;cursor:pointer;color:#334155}
      #fusionAlunoCodigoModal .fusion-app-code-meta{display:grid;gap:6px;margin-bottom:16px;font-size:.95rem;color:#475569}
      #fusionAlunoCodigoModal .fusion-app-code-value{font:800 clamp(2rem,10vw,3.4rem)/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em;text-align:center;background:#f0fdfa;border:1px solid #99f6e4;color:#0f766e;border-radius:14px;padding:18px 12px;margin:10px 0 16px;user-select:all}
      #fusionAlunoCodigoModal .fusion-app-code-expira{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;color:#9a3412;margin-bottom:16px}
      #fusionAlunoCodigoModal .fusion-app-code-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #fusionAlunoCodigoModal .fusion-app-code-actions button{min-height:44px;border-radius:10px;border:1px solid #0b4452;font-weight:800;cursor:pointer}
      #fusionAlunoCodigoModal .fusion-app-code-copy{background:#fff;color:#0b4452}
      #fusionAlunoCodigoModal .fusion-app-code-whatsapp{background:#0b4452;color:#fff}
      #fusionAlunoCodigoModal .fusion-app-code-url{margin-top:14px;font-size:.82rem;color:#64748b;overflow-wrap:anywhere}
      @media(max-width:520px){#fusionAlunoCodigoModal .fusion-app-code-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function garantirModalCodigo() {
    garantirEstilosModal();

    let modal = document.getElementById('fusionAlunoCodigoModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'fusionAlunoCodigoModal';
    modal.className = 'hidden';
    modal.innerHTML = `
      <div class="fusion-app-code-card" role="dialog" aria-modal="true" aria-labelledby="fusionAlunoCodigoTitulo">
        <div class="fusion-app-code-head">
          <div>
            <h3 id="fusionAlunoCodigoTitulo">Acesso ao Fusion Aluno</h3>
            <small id="fusionAlunoCodigoAcademia"></small>
          </div>
          <button type="button" class="fusion-app-code-close" aria-label="Fechar">×</button>
        </div>
        <div class="fusion-app-code-meta">
          <strong id="fusionAlunoCodigoNome"></strong>
          <span id="fusionAlunoCodigoTelefone"></span>
        </div>
        <div id="fusionAlunoCodigoValor" class="fusion-app-code-value">--------</div>
        <div id="fusionAlunoCodigoExpira" class="fusion-app-code-expira"></div>
        <div class="fusion-app-code-actions">
          <button type="button" class="fusion-app-code-copy" id="fusionAlunoCodigoCopiar">Copiar código</button>
          <button type="button" class="fusion-app-code-whatsapp" id="fusionAlunoCodigoWhatsApp">Enviar pelo WhatsApp</button>
        </div>
        <div class="fusion-app-code-url" id="fusionAlunoCodigoUrl"></div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.fusion-app-code-close')?.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.classList.add('hidden');
    });

    return modal;
  }

  async function copiarTexto(textoAlvo) {
    try {
      await navigator.clipboard.writeText(textoAlvo);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = textoAlvo;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  }

  function telefoneWhatsApp(valor) {
    let numero = somenteNumeros(valor);
    if (!numero) return '';
    if ((numero.length === 10 || numero.length === 11) && !numero.startsWith('55')) {
      numero = `55${numero}`;
    }
    return numero;
  }

  function dataHoraBR(valor) {
    if (!valor) return 'horário não informado';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return texto(valor);

    return data.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  function abrirResultado(dados) {
    const modal = garantirModalCodigo();
    const codigo = texto(dados.codigo).toUpperCase();
    const appUrl = `${window.location.origin}${APP_PATH}`;
    const telefone = telefoneWhatsApp(dados.telefone_destino);
    const expira = dataHoraBR(dados.expira_em);
    const nome = texto(dados.aluno_nome) || 'Aluno';
    const academia = texto(dados.academia_nome);

    modal.querySelector('#fusionAlunoCodigoAcademia').textContent = academia;
    modal.querySelector('#fusionAlunoCodigoNome').textContent = nome;
    modal.querySelector('#fusionAlunoCodigoTelefone').textContent =
      telefone ? `WhatsApp: ${telefone}` : 'WhatsApp não informado';
    modal.querySelector('#fusionAlunoCodigoValor').textContent = codigo;
    modal.querySelector('#fusionAlunoCodigoExpira').textContent =
      `Código de uso único. Válido até ${expira}.`;
    modal.querySelector('#fusionAlunoCodigoUrl').textContent =
      `Acesso do aluno: ${appUrl}`;

    const copiar = modal.querySelector('#fusionAlunoCodigoCopiar');
    copiar.onclick = async () => {
      const ok = await copiarTexto(codigo);
      copiar.textContent = ok ? 'Código copiado' : 'Não foi possível copiar';
      setTimeout(() => {
        copiar.textContent = 'Copiar código';
      }, 1800);
    };

    const whatsapp = modal.querySelector('#fusionAlunoCodigoWhatsApp');
    whatsapp.disabled = !telefone;
    whatsapp.title = telefone ? '' : 'Aluno sem telefone/WhatsApp válido';

    whatsapp.onclick = () => {
      if (!telefone) return;

      const primeiroNome = nome.split(/\s+/).filter(Boolean)[0] || 'aluno';
      const mensagem = [
        `Olá, ${primeiroNome}!`,
        '',
        `Seu código de acesso ao Fusion Aluno é: ${codigo}`,
        `Código válido até ${expira}.`,
        '',
        `Acesse: ${appUrl}`,
        'No primeiro acesso, o aplicativo solicitará seu CPF e a criação da sua senha.'
      ].join('\n');

      const url = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    };

    modal.classList.remove('hidden');
  }

  function acionarCodigo(id, botao) {
    const alunoId = texto(id);
    if (!alunoId) return;

    const ativo = lerCodigoSessao(alunoId);
    if (ativo) {
      abrirResultado(ativo);
      atualizarEstadoBotao(botao);
      return;
    }

    gerarCodigo(alunoId, botao);
  }

  async function gerarCodigo(id, botao) {
    const alunoId = texto(id);
    if (!alunoId) return;

    const original =
      botao?.dataset.textoPadrao ||
      botao?.textContent ||
      'Código app';

    if (botao) {
      botao.dataset.textoPadrao = original;
      botao.disabled = true;
      botao.textContent = 'Gerando...';
    }

    try {
      const response = await fetch(
        `${API_ALUNOS}/${encodeURIComponent(alunoId)}/app-ativacao`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ validade_minutos: 30 })
        }
      );

      const payload = await safeJson(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.mensagem ||
          payload.erro ||
          `Erro HTTP ${response.status}`
        );
      }

      const dados = payload.dados || payload;

      salvarCodigoSessao(alunoId, dados);
      atualizarBotoesDoAluno(alunoId);
      abrirResultado(dados);
    } catch (error) {
      mostrarAlertaLocal(
        error.message || 'Não foi possível gerar o código do aplicativo.',
        'erro'
      );
    } finally {
      if (botao) atualizarEstadoBotao(botao);
    }
  }

  window.gerarCodigoAppAluno = gerarCodigo;

  function aplicarTudo() {
    injetarBotoesLista();
    injetarBotaoModalAluno();
    atualizarTodosBotoes();
  }

  function iniciar() {
    aplicarTudo();

    const alvos = [
      document.getElementById('tabelaAlunos'),
      document.getElementById('alunosMobileCards'),
      document.getElementById('modalAluno')
    ].filter(Boolean);

    alvos.forEach((alvo) => {
      if (alvo.dataset.fusionAppCodeObserver === '1') return;
      alvo.dataset.fusionAppCodeObserver = '1';
      new MutationObserver(() => {
        injetarBotoesLista();
        injetarBotaoModalAluno();
      }).observe(alvo, {
        childList: true,
        subtree: true
      });
    });

    setTimeout(aplicarTudo, 300);
    setTimeout(aplicarTudo, 1000);
    setInterval(atualizarTodosBotoes, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
