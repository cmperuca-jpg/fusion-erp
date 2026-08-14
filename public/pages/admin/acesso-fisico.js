(() => {
  const API = "/api/auth";
  const PERFIS_INTERNOS = new Set(["administrador", "gerente", "recepcao", "comercial"]);
  const PERFIS_ACESSO_FISICO = new Set(["administrador", "gerente", "recepcao"]);
  let ultimaLista = [];

  function norm(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  async function fetchAuth(url, opt = {}) {
    const fn = window.FusionAuth?.fetchAuth
      ? FusionAuth.fetchAuth.bind(FusionAuth)
      : fetch.bind(window);

    const resp = await fn(url, {
      ...opt,
      cache: opt.cache || "no-store",
      headers: {
        ...(opt.body ? { "Content-Type": "application/json" } : {}),
        ...(opt.headers || {})
      }
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) {
      throw new Error(json.mensagem || json.erro || `Erro HTTP ${resp.status}`);
    }
    return json;
  }

  function perfilCodigo(u) {
    return norm(u?.perfil);
  }

  function ehInterno(u) {
    return PERFIS_INTERNOS.has(perfilCodigo(u));
  }

  function temAcessoFisico(u) {
    return PERFIS_ACESSO_FISICO.has(perfilCodigo(u));
  }

  function ehLegado(u) {
    return ["aluno", "professor"].includes(perfilCodigo(u));
  }

  function ocultarLinhasLegadas() {
    const tbody = document.getElementById("tabelaUsuarios");
    if (!tbody) return;

    const emailsLegados = new Set(
      ultimaLista.filter(ehLegado).map(u => norm(u.email))
    );

    [...tbody.querySelectorAll("tr")].forEach(tr => {
      const cells = tr.querySelectorAll("td");
      if (cells.length < 2) return;
      const email = norm(cells[1].textContent);
      tr.hidden = emailsLegados.has(email);
    });
  }

  function atualizarKpis() {
    const internos = ultimaLista.filter(ehInterno);
    const ativos = internos.filter(u => norm(u.status) === "ativo").length;
    const inativos = internos.length - ativos;

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };

    set("kpiUsuarios", internos.length);
    set("kpiAtivos", ativos);
    set("kpiInativos", inativos);
  }

  function permissoesCorrigidas(u) {
    const lista = Array.isArray(u.permissoes) ? [...u.permissoes] : [];
    const perfil = perfilCodigo(u);

    if (["recepcao", "gerente"].includes(perfil) && !lista.includes("access-engine")) {
      lista.push("access-engine");
    }

    return [...new Set(lista)];
  }

  async function corrigirPermissoes(id) {
    const u = ultimaLista.find(item => String(item.id) === String(id));
    if (!u) return;

    try {
      await fetchAuth(`${API}/usuarios/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({
          nome: u.nome,
          email: u.email,
          perfil: u.perfil,
          status: u.status,
          permissoes: permissoesCorrigidas(u)
        })
      });

      alert("Permissões corrigidas. A conta agora também pode acessar o módulo de catracas.");
      await carregar();
      if (typeof window.carregarUsuarios === "function") {
        await window.carregarUsuarios();
      }
    } catch (e) {
      alert(e.message);
    }
  }

  async function removerLegado(id, nome, perfil) {
    const destino = norm(perfil) === "aluno"
      ? "O aluno continua sendo gerenciado pela matrícula e pelo cadastro de alunos."
      : "O professor continua sendo gerenciado pelo cadastro de Professores.";

    if (!confirm(
      `Remover a conta administrativa antiga "${nome}"?\n\n${destino}\n\n` +
      "Esta ação remove somente esta conta de login do Painel Administrativo."
    )) return;

    try {
      await fetchAuth(`${API}/usuarios/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      alert("Conta administrativa antiga removida.");
      location.reload();
    } catch (e) {
      alert(e.message);
    }
  }

  function renderLegados() {
    const painel = document.getElementById("painelContasLegadas");
    const lista = document.getElementById("listaContasLegadas");
    if (!painel || !lista) return;

    const legados = ultimaLista.filter(ehLegado);
    painel.hidden = legados.length === 0;

    if (!legados.length) {
      lista.innerHTML = "";
      return;
    }

    lista.innerHTML = legados.map(u => {
      const perfil = perfilCodigo(u);
      const destino = perfil === "aluno"
        ? "/pages/alunos/index.html"
        : "/pages/professores/index.html";
      const rotulo = perfil === "aluno"
        ? "Usar cadastro de Alunos"
        : "Usar cadastro de Professores";

      return `
        <article class="legacy-item">
          <div>
            <strong>${esc(u.nome)}</strong>
            <span>${esc(u.email)} · perfil antigo ${esc(u.perfil)}</span>
            <small>Esta conta não deve mais ser usada para representar ${perfil === "aluno" ? "um aluno" : "um professor"}.</small>
          </div>
          <div class="legacy-actions">
            <a class="btn-light acesso-link" href="${destino}">${rotulo}</a>
            <button type="button" class="btn-danger" data-remover-legado="${esc(u.id)}">Excluir conta antiga</button>
          </div>
        </article>`;
    }).join("");

    lista.querySelectorAll("[data-remover-legado]").forEach(btn => {
      btn.addEventListener("click", () => {
        const u = ultimaLista.find(item => String(item.id) === String(btn.dataset.removerLegado));
        if (u) removerLegado(u.id, u.nome, u.perfil);
      });
    });
  }

  async function statusDigital(u) {
    if (norm(u.status) !== "ativo") {
      return {
        classe: "bloqueado",
        texto: "Inativo · catraca bloqueada"
      };
    }

    try {
      const json = await fetchAuth(
        `/api/biometria/pessoa/usuario/${encodeURIComponent(u.id)}`
      );

      return json?.biometria?.cadastrada
        ? { classe: "ok", texto: "Digital cadastrada" }
        : { classe: "pendente", texto: "Sem digital" };
    } catch {
      return {
        classe: "indisponivel",
        texto: "Digital não verificada"
      };
    }
  }

  async function renderAcessoFisico() {
    const box = document.getElementById("listaAcessoFisico");
    if (!box) return;

    const elegiveis = ultimaLista.filter(temAcessoFisico);

    if (!elegiveis.length) {
      box.innerHTML = `
        <div class="acesso-vazio">
          Nenhuma conta de Administrador, Gerente ou Recepção cadastrada.
        </div>`;
      return;
    }

    box.innerHTML = elegiveis.map(u => {
      const perms = permissoesCorrigidas(u);
      const precisaCorrigir =
        ["recepcao", "gerente"].includes(perfilCodigo(u)) &&
        !(Array.isArray(u.permissoes) && u.permissoes.includes("access-engine"));

      const url = `/pages/biometria/index.html?tipo=usuario&id=${encodeURIComponent(u.id)}`;

      return `
        <article class="acesso-item" data-user-id="${esc(u.id)}">
          <div class="acesso-identidade">
            <strong>${esc(u.nome)}</strong>
            <span>${esc(u.perfil)} · ${esc(u.status || "ativo")}</span>
          </div>
          <div class="acesso-status pendente" data-status-digital>Verificando digital...</div>
          <div class="acesso-actions">
            <a class="btn-light acesso-link" href="${url}">Gerenciar digital</a>
            ${precisaCorrigir
              ? `<button type="button" class="btn-light" data-corrigir-permissoes="${esc(u.id)}">Corrigir permissões</button>`
              : ""}
          </div>
        </article>`;
    }).join("");

    box.querySelectorAll("[data-corrigir-permissoes]").forEach(btn => {
      btn.addEventListener("click", () => corrigirPermissoes(btn.dataset.corrigirPermissoes));
    });

    await Promise.allSettled(elegiveis.map(async u => {
      const item = box.querySelector(`[data-user-id="${CSS.escape(String(u.id))}"]`);
      const el = item?.querySelector("[data-status-digital]");
      if (!el) return;

      const status = await statusDigital(u);
      el.textContent = status.texto;
      el.className = `acesso-status ${status.classe}`;
    }));
  }

  function prepararPerfis() {
    const perfil = document.getElementById("perfil");
    if (!perfil) return;

    [...perfil.options].forEach(opt => {
      if (["aluno", "professor"].includes(norm(opt.value || opt.textContent))) {
        opt.remove();
      }
    });
  }

  async function carregar() {
    try {
      prepararPerfis();

      const json = await fetchAuth(`${API}/usuarios`);
      ultimaLista = Array.isArray(json.usuarios) ? json.usuarios : [];

      ocultarLinhasLegadas();
      atualizarKpis();
      renderLegados();
      await renderAcessoFisico();
    } catch (e) {
      const box = document.getElementById("listaAcessoFisico");
      if (box) {
        box.innerHTML = `<div class="acesso-vazio erro">${esc(e.message)}</div>`;
      }
    }
  }

  prepararPerfis();

  const tbody = document.getElementById("tabelaUsuarios");
  if (tbody) {
    let timer = null;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        ocultarLinhasLegadas();
        atualizarKpis();
      }, 50);
    }).observe(tbody, { childList: true, subtree: true });
  }

  window.addEventListener("focus", () => {
    carregar().catch(() => {});
  });

  carregar();
})();
