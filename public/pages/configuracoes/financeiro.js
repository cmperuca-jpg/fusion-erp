if (typeof carregarLayout === "function") {
  carregarLayout("Configurações financeiras");
}

const API = "/api/financeiro";
let taxas = [];

const $ = (id) => document.getElementById(id);
const numero = (valor) => {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const esc = (valor) =>
  String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));

async function request(url, options = {}) {
  const resp = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.ok === false) {
    throw new Error(
      json.mensagem ||
      json.erro ||
      `Erro HTTP ${resp.status}`
    );
  }
  return json;
}

function mostrarResultado(texto, erro = false) {
  const el = $("resultadoConfigFinanceiro");
  el.textContent = texto || "";
  el.classList.toggle("erro", erro);
}

function atualizarExemplo() {
  const multa = numero($("multaPercentual").value);
  const jurosDia = numero($("jurosDiaPercentual").value);
  const carencia = Math.max(
    0,
    Math.trunc(numero($("carenciaDias").value))
  );

  const principal = 65;
  const diasAtraso = 8;
  const diasCobrados = Math.max(
    0,
    diasAtraso - carencia
  );
  const valorMulta =
    diasCobrados > 0
      ? principal * multa / 100
      : 0;
  const valorJuros =
    diasCobrados > 0
      ? principal * jurosDia / 100 * diasCobrados
      : 0;
  const total =
    principal + valorMulta + valorJuros;

  $("exemploAtraso").textContent =
    `Exemplo em R$ 65,00 com 8 dias de atraso: ` +
    `multa R$ ${valorMulta.toFixed(2).replace(".", ",")} + ` +
    `juros R$ ${valorJuros.toFixed(2).replace(".", ",")} = ` +
    `R$ ${total.toFixed(2).replace(".", ",")}.`;
}

function renderTaxas() {
  const tbody = $("taxasTabela");

  if (!taxas.length) {
    tbody.innerHTML =
      '<tr><td colspan="7">Nenhuma taxa configurada.</td></tr>';
    return;
  }

  tbody.innerHTML = taxas.map((taxa, i) => `
    <tr>
      <td>
        <input
          data-i="${i}"
          data-campo="bandeira"
          value="${esc(taxa.bandeira || "")}"
        >
      </td>
      <td>
        <select data-i="${i}" data-campo="modalidade">
          <option value="debito" ${taxa.modalidade === "debito" ? "selected" : ""}>Débito</option>
          <option value="credito" ${taxa.modalidade === "credito" ? "selected" : ""}>Crédito</option>
          <option value="pix" ${taxa.modalidade === "pix" ? "selected" : ""}>PIX</option>
          <option value="boleto" ${taxa.modalidade === "boleto" ? "selected" : ""}>Boleto</option>
        </select>
      </td>
      <td>
        <input
          data-i="${i}"
          data-campo="parcelas"
          type="number"
          min="1"
          step="1"
          value="${Math.max(1, Number(taxa.parcelas || 1))}"
        >
      </td>
      <td>
        <input
          data-i="${i}"
          data-campo="percentual"
          type="number"
          min="0"
          step="0.01"
          value="${Number(taxa.percentual || 0).toFixed(2)}"
        >
      </td>
      <td>
        <input
          data-i="${i}"
          data-campo="taxaFixa"
          type="number"
          min="0"
          step="0.01"
          value="${Number(taxa.taxaFixa || 0).toFixed(2)}"
        >
      </td>
      <td>
        <input
          data-i="${i}"
          data-campo="descricao"
          value="${esc(taxa.descricao || "")}"
        >
      </td>
      <td>
        <button
          class="config-danger"
          type="button"
          data-remover-taxa="${i}"
        >
          Remover
        </button>
      </td>
    </tr>
  `).join("");
}

function coletarTaxas() {
  const mapa = new Map();

  document.querySelectorAll("[data-i][data-campo]").forEach((el) => {
    const i = Number(el.dataset.i);
    const atual = mapa.get(i) || {};
    atual[el.dataset.campo] = el.value;
    mapa.set(i, atual);
  });

  return [...mapa.values()]
    .map((item) => ({
      bandeira: String(item.bandeira || "").trim(),
      modalidade: String(
        item.modalidade || "credito"
      ).trim().toLowerCase(),
      parcelas: Math.max(
        1,
        Math.trunc(numero(item.parcelas) || 1)
      ),
      percentual: Math.max(
        0,
        numero(item.percentual)
      ),
      taxaFixa: Math.max(
        0,
        numero(item.taxaFixa)
      ),
      descricao: String(
        item.descricao || ""
      ).trim()
    }))
    .filter((item) => item.bandeira);
}

async function carregar() {
  mostrarResultado("Carregando configurações...");

  const [atrasoResp, taxasResp] = await Promise.all([
    request(
      `${API}/configuracao-atraso`,
      { cache: "no-store" }
    ),
    request(
      `${API}/taxas-cartao`,
      { cache: "no-store" }
    )
  ]);

  const atraso = atrasoResp.configuracao || {};

  $("atrasoAtivo").value =
    atraso.ativo === false ? "false" : "true";

  $("multaPercentual").value =
    numero(atraso.multaPercentual).toFixed(2);

  $("jurosDiaPercentual").value =
    numero(atraso.jurosDiaPercentual).toFixed(3);

  $("carenciaDias").value =
    Math.max(0, Number(atraso.carenciaDias || 0));

  const fonte = $("fonteAtraso");
  fonte.textContent =
    atraso.configurado
      ? "Regra administrativa"
      : "Compatibilidade com planos antigos";

  fonte.className =
    `status-pill ${atraso.configurado ? "ok" : "aguardando"}`;

  const aviso = $("avisoAtraso");
  const mensagens = [];

  if (!atraso.configurado) {
    mensagens.push(
      "A regra ainda não foi salva neste painel. Até salvar, o Fusion preserva a multa existente do plano de cada mensalidade."
    );
  }
  if (atraso.aviso) {
    mensagens.push(atraso.aviso);
  }

  aviso.hidden = mensagens.length === 0;
  aviso.textContent = mensagens.join(" ");

  taxas =
    Array.isArray(taxasResp.taxas)
      ? taxasResp.taxas
      : [];

  renderTaxas();
  atualizarExemplo();
  mostrarResultado("");
}

$("salvarAtraso").addEventListener("click", async () => {
  const btn = $("salvarAtraso");
  btn.disabled = true;

  try {
    const body = {
      ativo: $("atrasoAtivo").value === "true",
      multaPercentual:
        numero($("multaPercentual").value),
      jurosDiaPercentual:
        numero($("jurosDiaPercentual").value),
      carenciaDias: Math.max(
        0,
        Math.trunc(numero($("carenciaDias").value))
      )
    };

    const json = await request(
      `${API}/configuracao-atraso`,
      {
        method: "PUT",
        body: JSON.stringify(body)
      }
    );

    const cfg = json.configuracao || {};

    $("fonteAtraso").textContent =
      "Regra administrativa";
    $("fonteAtraso").className =
      "status-pill ok";
    $("avisoAtraso").hidden = true;

    mostrarResultado(
      `Encargos salvos: multa ${numero(cfg.multaPercentual)
        .toFixed(2)}% e juros ${numero(cfg.jurosDiaPercentual)
        .toFixed(3)}% ao dia.`
    );
  } catch (erro) {
    mostrarResultado(
      erro.message || "Falha ao salvar encargos.",
      true
    );
  } finally {
    btn.disabled = false;
  }
});

$("salvarTaxas").addEventListener("click", async () => {
  const btn = $("salvarTaxas");
  btn.disabled = true;

  try {
    const lista = coletarTaxas();

    if (!lista.length) {
      throw new Error(
        "Informe ao menos uma taxa válida."
      );
    }

    const json = await request(
      `${API}/taxas-cartao`,
      {
        method: "PUT",
        body: JSON.stringify({ taxas: lista })
      }
    );

    taxas =
      Array.isArray(json.taxas)
        ? json.taxas
        : lista;

    renderTaxas();
    mostrarResultado(
      "Taxas de recebimento salvas."
    );
  } catch (erro) {
    mostrarResultado(
      erro.message || "Falha ao salvar taxas.",
      true
    );
  } finally {
    btn.disabled = false;
  }
});

$("adicionarTaxa").addEventListener("click", () => {
  taxas = coletarTaxas();

  taxas.push({
    bandeira: "",
    modalidade: "credito",
    parcelas: 1,
    percentual: 0,
    taxaFixa: 0,
    descricao: ""
  });

  renderTaxas();
});

document.addEventListener("click", (event) => {
  const btn = event.target.closest(
    "[data-remover-taxa]"
  );

  if (!btn) return;

  taxas = coletarTaxas();
  taxas.splice(
    Number(btn.dataset.removerTaxa),
    1
  );
  renderTaxas();
});

[
  "multaPercentual",
  "jurosDiaPercentual",
  "carenciaDias"
].forEach((id) => {
  $(id).addEventListener(
    "input",
    atualizarExemplo
  );
});

carregar().catch((erro) => {
  mostrarResultado(
    erro.message ||
      "Falha ao carregar configurações.",
    true
  );
});
