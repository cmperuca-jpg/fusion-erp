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

  const modal = document.getElementById("modalLiberacao");
  const categoria = document.getElementById("categoriaLiberacao");
  const aluno = document.getElementById("alunoLiberacao");
  const visitante = document.getElementById("visitanteLiberacao");
  const detalhe = document.getElementById("detalheLiberacao");
  const fetchSeguro = window.FusionAuth?.fetchAuth ? FusionAuth.fetchAuth.bind(FusionAuth) : fetch.bind(window);

  function atualizarCampos() {
    document.getElementById("campoAlunoLiberacao").hidden = categoria.value !== "aluno_sem_biometria";
    document.getElementById("campoVisitanteLiberacao").hidden = categoria.value !== "visitante";
    document.getElementById("campoDetalheLiberacao").hidden = !["manutencao","outro"].includes(categoria.value);
  }
  categoria.addEventListener("change", atualizarCampos);
  document.getElementById("fecharLiberacao").onclick = () => modal.close();
  document.getElementById("cancelarLiberacao").onclick = () => modal.close();

  async function abrirModal() {
    const resp = await fetchSeguro("/api/access-engine/liberacao/opcoes", { cache:"no-store" });
    const json = await resp.json();
    aluno.innerHTML = '<option value="">Selecione o aluno</option>' + (json.alunos || []).map(x => `<option value="${x.id}">${x.nome}${x.matricula ? ` · ${x.matricula}` : ''}</option>`).join('');
    visitante.innerHTML = '<option value="">Selecione o pré-cadastro</option>' + (json.visitantes || []).map(x => `<option value="${x.id}">${x.nome}${x.telefone ? ` · ${x.telefone}` : ''}</option>`).join('');
    categoria.value = ""; detalhe.value = ""; atualizarCampos(); modal.showModal();
  }

  botao.addEventListener("click", () => abrirModal().catch(e => alert(e.message)));
  document.getElementById("formLiberacao").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (botao.disabled) return;
    if (!categoria.value) return alert("Selecione o motivo.");
    if (categoria.value === "aluno_sem_biometria" && !aluno.value) return alert("Selecione o aluno.");
    if (categoria.value === "visitante" && !visitante.value) return alert("Selecione o visitante pré-cadastrado.");

    botao.disabled = true;
    botao.textContent = "Liberando...";
    status.textContent = "Enviando comando para a catraca...";

    try {
      const resposta = await fetchSeguro("/api/access-engine/liberar-remoto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispositivoId: "disp_henry7x_01",
          direcao: "ambos",
          tempoSegundos: 5,
          origem: "dashboard-liberacao-manual",
          operadorId: usuario?.id || "",
          operadorNome: usuario?.nome || "Usuário do sistema",
          operadorPerfil: usuario?.perfilOriginal || usuario?.perfil || "",
          categoriaMotivo: categoria.value,
          alunoId: aluno.value || null,
          visitanteId: visitante.value || null,
          motivoDetalhe: detalhe.value.trim()
        })
      });

      const json = await resposta.json().catch(() => ({}));
      if (!resposta.ok || json.ok === false) {
        throw new Error(json.mensagem || json.erro || "A catraca não confirmou a liberação.");
      }

      const agora = new Date().toLocaleString("pt-BR");
      status.textContent = `Catraca liberada às ${agora}. Uso: ${json.usadosHoje}/${json.limiteDiario}.`;
      modal.close();
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
