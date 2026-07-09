const $ = (id) => document.getElementById(id);

function texto(v) {
  return String(v ?? "").trim();
}

function normalizar(v) {
  return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function numeros(v) {
  return texto(v).replace(/\D/g, "");
}

function mensagem(textoMsg, tipo = "") {
  const el = $("mensagem");
  el.textContent = textoMsg || "";
  el.className = `msg ${tipo}`.trim();
}

function extrairLista(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.professores)) return payload.professores;
  if (Array.isArray(payload.dados)) return payload.dados;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.itens)) return payload.itens;
  if (Array.isArray(payload.registros)) return payload.registros;
  return [];
}

function professorId(p) {
  return String(p?.id ?? p?._id ?? p?.codigo ?? p?.professorId ?? p?.cpf ?? p?.cref ?? "");
}

function professorNome(p) {
  return p?.nome || p?.nomeCompleto || p?.professorNome || p?.name || "Professor";
}

function professorLoginTexto(p) {
  return normalizar([
    p?.nome,
    p?.nomeCompleto,
    p?.email,
    p?.cpf,
    p?.telefone,
    p?.celular,
    p?.whatsapp,
    p?.cref,
    p?.codigo,
    p?.id
  ].filter(Boolean).join(" "));
}

function senhaPossiveis(p) {
  const cpf = numeros(p?.cpf);
  const cref = texto(p?.cref);
  const nascimento = numeros(p?.data_nascimento || p?.dataNascimento || p?.nascimento);
  const senhaCadastrada = texto(p?.senha || p?.password || p?.senhaAcesso || p?.senha_app || p?.senhaProfessor);
  return [
    senhaCadastrada,
    cpf,
    cpf.slice(-4),
    cref,
    nascimento
  ].filter(Boolean);
}

async function carregarProfessores() {
  const resp = await fetch("/api/professores", { cache: "no-store" });
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(payload.mensagem || payload.erro || `Erro HTTP ${resp.status}`);
  return extrairLista(payload);
}

async function entrar() {
  const login = texto($("login").value);
  const senha = texto($("senha").value);

  if (!login || !senha) {
    mensagem("Informe login e senha.", "erro");
    return;
  }

  $("entrar").disabled = true;
  mensagem("Validando acesso...", "");

  try {
    const professores = await carregarProfessores();
    const loginNorm = normalizar(login);
    const loginNum = numeros(login);

    const professor = professores.find((p) => {
      const textoLogin = professorLoginTexto(p);
      const nums = numeros([p?.cpf, p?.telefone, p?.celular, p?.whatsapp, p?.cref, p?.codigo, p?.id].filter(Boolean).join(" "));
      return textoLogin.includes(loginNorm) || (loginNum && nums.includes(loginNum));
    });

    if (!professor) throw new Error("Professor não encontrado.");

    const senhaOk = senhaPossiveis(professor).some((s) => texto(s) === senha || numeros(s) === numeros(senha));
    if (!senhaOk) throw new Error("Senha inválida.");

    const sessao = {
      professorId: professorId(professor),
      professorNome: professorNome(professor),
      cref: professor?.cref || "",
      email: professor?.email || "",
      perfil: "professor",
      criadoEm: new Date().toISOString()
    };

    localStorage.setItem("fusion_professor_sessao", JSON.stringify(sessao));
    mensagem("Acesso liberado.", "ok");
    location.href = "/pages/professor-area/index.html";
  } catch (erro) {
    mensagem(erro.message || "Erro ao entrar.", "erro");
  } finally {
    $("entrar").disabled = false;
  }
}

$("entrar").onclick = entrar;
["login", "senha"].forEach((id) => {
  $(id).addEventListener("keydown", (ev) => { if (ev.key === "Enter") entrar(); });
});
