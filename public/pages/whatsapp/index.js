const lista = document.querySelector("#lista");
const resultado = document.querySelector("#resultado");
let alunos = [];

async function requisitar(url, opcoes = {}) {
  const fetcher = window.FusionAuth?.fetchAuth ? FusionAuth.fetchAuth : fetch;
  const resposta = await fetcher(url, { cache: "no-store", ...opcoes });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok || dados.ok === false) {
    throw new Error(dados.mensagem || dados.erro || `Erro HTTP ${resposta.status}`);
  }
  return dados;
}

function texto(valor, padrao = "") {
  return String(valor || padrao);
}

function renderizarLista() {
  lista.replaceChildren();
  if (!alunos.length) {
    lista.textContent = "Nenhum inativo elegível.";
    return;
  }

  for (const aluno of alunos) {
    const label = document.createElement("label");
    label.className = "aluno";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.value = texto(aluno.id);

    const nome = document.createElement("strong");
    nome.textContent = texto(aluno.nome, "Sem nome");

    const telefone = document.createElement("span");
    telefone.textContent = texto(aluno.telefone);

    label.append(check, nome, telefone);
    lista.append(label);
  }
}

async function carregar() {
  try {
    const [inativos, cfg] = await Promise.all([
      requisitar("/api/whatsapp/inativos"),
      requisitar("/api/whatsapp/configuracao")
    ]);

    alunos = Array.isArray(inativos) ? inativos : [];
    document.querySelector("#phoneNumberId").value = cfg.phoneNumberId || "";
    document.querySelector("#template5").value = cfg.templates?.lembrete5Dias || "";
    document.querySelector("#template0").value = cfg.templates?.lembreteVencimento || "";
    document.querySelector("#ativo").checked = Boolean(cfg.ativo);
    renderizarLista();
  } catch (erro) {
    resultado.textContent = erro.message;
  }
}

document.querySelector("#todos").addEventListener("change", (evento) => {
  document.querySelectorAll("#lista input").forEach((item) => {
    item.checked = evento.target.checked;
  });
});

document.querySelector("#salvarConfig").addEventListener("click", async () => {
  const body = {
    ativo: document.querySelector("#ativo").checked,
    phoneNumberId: document.querySelector("#phoneNumberId").value.trim(),
    templates: {
      lembrete5Dias: document.querySelector("#template5").value.trim(),
      lembreteVencimento: document.querySelector("#template0").value.trim()
    }
  };

  try {
    await requisitar("/api/whatsapp/configuracao", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    resultado.textContent = "Configuração salva.";
  } catch (erro) {
    resultado.textContent = erro.message;
  }
});

document.querySelector("#enviar").addEventListener("click", async () => {
  const alunoIds = [...document.querySelectorAll("#lista input:checked")].map((item) => item.value);
  const template = document.querySelector("#template").value.trim();
  const parametro = document.querySelector("#parametros").value.trim();

  if (!template || !alunoIds.length) {
    resultado.textContent = "Escolha clientes e informe o modelo Meta aprovado.";
    return;
  }

  if (!confirm(`Enviar para ${alunoIds.length} cliente(s)?`)) return;

  try {
    const dados = await requisitar("/api/whatsapp/campanhas/inativos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alunoIds, template, parametros: parametro ? [parametro] : [] })
    });
    resultado.textContent = dados.ok
      ? `Campanha enviada para ${dados.total} cliente(s).`
      : dados.mensagem || "Houve falha no envio.";
  } catch (erro) {
    resultado.textContent = erro.message;
  }
});

carregar();
