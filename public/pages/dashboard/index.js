const dadosFallback = { alunos: [], mensalidades: [], avaliacoes: [], lancamentos: [] };

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

function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

(async function carregarDashboard() {
  const [alunos, mensalidades, avaliacoes, financeiro] = await Promise.all([
    buscar('/api/alunos', 'alunos'),
    buscar('/api/mensalidades', 'mensalidades'),
    buscar('/api/avaliacoes', 'avaliacoes'),
    buscar('/api/financeiro', 'lancamentos')
  ]);

  const ativos = alunos.filter(a => String(a.status || 'ativo').toLowerCase() === 'ativo').length;
  const abertas = mensalidades.filter(m => String(m.status || '').toLowerCase().includes('aberto')).length;
  const receita = financeiro
    .filter(f => String(f.status || '').toLowerCase() === 'pago')
    .reduce((s, f) => s + Number(f.valorLiquido || f.valorPago || f.valor || 0), 0);

  setText('kpiAlunos', ativos);
  setText('kpiAbertas', abertas);
  setText('kpiAvaliacoes', avaliacoes.length);
  setText('kpiReceita', moeda(receita));
})();


(function configurarLiberacaoManualCatraca() {
  const usuario = window.FusionAuth?.usuarioAtual?.() || null;
  const perfil = String(usuario?.perfil || usuario?.perfilOriginal || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const perfilPermitido = perfil === "admin" || perfil.includes("administrador") || perfil.includes("recepc");
  const card = document.getElementById("controleCatracaDashboard");
  const botao = document.getElementById("btnLiberarCatracaDashboard");
  const status = document.getElementById("statusLiberacaoCatraca");

  if (!card || !botao || !status || !perfilPermitido) return;
  card.style.display = "block";

  botao.addEventListener("click", async () => {
    if (botao.disabled) return;

    const motivoInformado = window.prompt(
      "Motivo da liberação:\n\n1 - Visitante\n2 - Aluno sem biometria\n3 - Manutenção\n4 - Outro",
      "Visitante"
    );

    if (motivoInformado === null) return;
    const motivo = String(motivoInformado || "Liberação manual").trim() || "Liberação manual";

    botao.disabled = true;
    botao.textContent = "Liberando...";
    status.textContent = "Enviando comando para a catraca...";

    try {
      const fetchSeguro = window.FusionAuth?.fetchAuth
        ? FusionAuth.fetchAuth.bind(FusionAuth)
        : fetch.bind(window);

      const resposta = await fetchSeguro("/api/henry7x/liberar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: "10.0.0.236",
          port: 3000,
          tempoSegundos: 5,
          origem: "dashboard-liberacao-manual",
          usuarioId: usuario?.id || "",
          usuarioNome: usuario?.nome || "Usuário do sistema",
          usuarioPerfil: usuario?.perfilOriginal || usuario?.perfil || "",
          motivo
        })
      });

      const json = await resposta.json().catch(() => ({}));
      if (!resposta.ok || json.ok === false || json.respostasValidas === false) {
        throw new Error(json.mensagem || json.erro || "A catraca não confirmou a liberação.");
      }

      const agora = new Date().toLocaleString("pt-BR");
      status.textContent = `Catraca liberada por 5 segundos às ${agora}. Motivo: ${motivo}.`;
      alert("Catraca liberada com sucesso por 5 segundos.");
    } catch (erro) {
      console.error("Falha na liberação manual da catraca:", erro);
      status.textContent = `Falha na liberação: ${erro?.message || "erro de comunicação"}.`;
      alert(erro?.message || "Não foi possível liberar a catraca.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Liberar catraca";
    }
  });
})();
