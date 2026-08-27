// Fusion ERP - ficha unica do aluno - 2026-08-25
(() => {
  let fotoAtual = "";
  const el = (id) => document.getElementById(id);
  const valor = (id) => String(el(id)?.value || "").trim();
  const numeros = (v) => String(v || "").replace(/\D/g, "");
  const set = (id, v) => { if (el(id)) el(id).value = v ?? ""; };
  const dataISO = (v) => { const s = String(v || "").slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };
  const alunoAtual = () => (typeof prontuario !== "undefined" && prontuario?.aluno) ? prontuario.aluno : null;

  function preencher() {
    const a = alunoAtual(); if (!a) return false;
    set("fuNome", nomeAluno(a)); set("fuCpf", a.cpf || a.documento || ""); set("fuRg", a.rg || "");
    set("fuNascimento", dataISO(a.data_nascimento || a.dataNascimento)); set("fuSexo", a.sexo || "");
    set("fuTelefone", a.telefone || a.celular || ""); set("fuWhatsapp", a.whatsapp || ""); set("fuEmail", a.email || "");
    set("fuProfessor", a.professor_responsavel || a.professorNome || a.professor_responsavel_nome || "");
    set("fuResponsavel", a.responsavel || ""); set("fuEmergencia", a.contato_emergencia || a.contatoEmergencia || "");
    set("fuCep", a.cep || ""); set("fuCidade", a.cidade || ""); set("fuEstado", a.estado || ""); set("fuEndereco", a.endereco || "");
    set("fuObjetivo", a.objetivo || ""); set("fuObservacoes", a.observacoes || a.observacao || "");
    set("fuTipoSanguineo", a.tipo_sanguineo || ""); set("fuPeso", a.peso || ""); set("fuAltura", a.altura || "");
    set("fuAlergias", a.alergias || ""); set("fuRestricoes", a.restricoes_medicas || ""); set("fuMedicamentos", a.medicamentos || ""); set("fuLesoes", a.lesoes || "");
    fotoAtual = a.foto_base64 || a.foto || "";
    if (el("fuFoto")) el("fuFoto").innerHTML = fotoAtual ? `<img src="${esc(fotoAtual)}" alt="Foto do aluno">` : "Foto";
    return true;
  }

  async function salvar() {
    const btn = el("btnSalvarFichaUnica");
    try {
      const nome = valor("fuNome"); if (nome.length < 3) throw new Error("Informe o nome completo do aluno.");
      const senha = valor("fuSenha"), senha2 = valor("fuSenha2");
      if (senha || senha2) { if (senha.length < 4) throw new Error("A nova senha deve ter pelo menos 4 caracteres."); if (senha !== senha2) throw new Error("A confirmação da nova senha não confere."); }
      const dados = {
        nome, cpf:numeros(valor("fuCpf")), rg:valor("fuRg"), data_nascimento:valor("fuNascimento"), sexo:valor("fuSexo"),
        telefone:numeros(valor("fuTelefone")), whatsapp:numeros(valor("fuWhatsapp")), email:valor("fuEmail"),
        professor_responsavel:valor("fuProfessor"), professorNome:valor("fuProfessor"), responsavel:valor("fuResponsavel"),
        contato_emergencia:valor("fuEmergencia"), cep:valor("fuCep"), cidade:valor("fuCidade"), estado:valor("fuEstado").toUpperCase(),
        endereco:valor("fuEndereco"), objetivo:valor("fuObjetivo"), observacoes:valor("fuObservacoes"),
        tipo_sanguineo:valor("fuTipoSanguineo"), peso:valor("fuPeso"), altura:valor("fuAltura"), alergias:valor("fuAlergias"),
        restricoes_medicas:valor("fuRestricoes"), medicamentos:valor("fuMedicamentos"), lesoes:valor("fuLesoes"), foto_base64:fotoAtual || ""
      };
      if (!dados.data_nascimento) delete dados.data_nascimento;
      if (senha) Object.assign(dados,{senhaAluno:senha,senhaAcesso:senha,senhaPortal:senha,portalSenha:senha});
      Object.keys(dados).forEach(k=>{ if (dados[k] === "") delete dados[k]; });
      if (btn) { btn.disabled=true; btn.textContent="Salvando..."; }
      const resp = await fetch(`/api/alunos/${encodeURIComponent(alunoId)}`, {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(dados)});
      const json = await resp.json().catch(()=>({})); if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `Erro HTTP ${resp.status}`);
      alerta("Dados do aluno atualizados. Matrícula e financeiro não foram alterados.","sucesso");
      set("fuSenha",""); set("fuSenha2",""); await carregar(); setTimeout(preencher,150);
    } catch(e) { alerta(e.message || "Não foi possível salvar o aluno."); }
    finally { if (btn) { btn.disabled=false; btn.textContent="Salvar alterações"; } }
  }

  async function appStatus() {
    const badge=el("fuAppStatus"); try {
      const resp=await fetch("/api/alunos/indicadores",{cache:"no-store"}); const json=await resp.json().catch(()=>({}));
      if(!resp.ok || json.ok===false) throw new Error(); const ativo=json?.indicadores?.[String(alunoId)]?.aplicativo;
      badge.textContent=ativo===true?"App ativado":ativo===false?"Não ativado":"Indisponível"; badge.classList.toggle("ok",ativo===true); badge.classList.toggle("bad",ativo===false);
    } catch { if(badge) badge.textContent="Indisponível"; }
  }

  async function gerarCodigo() {
    const btn=el("fuGerarCodigoApp"),box=el("fuAppResultado"); try {
      if(btn){btn.disabled=true;btn.textContent="Gerando...";}
      const resp=await fetch(`/api/alunos/${encodeURIComponent(alunoId)}/app-ativacao`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({validadeMinutos:30})});
      const json=await resp.json().catch(()=>({})); if(!resp.ok||json.ok===false) throw new Error(json.mensagem||json.erro||`Erro HTTP ${resp.status}`);
      const codigo=String(json?.dados?.codigo||"").trim(); if(!codigo) throw new Error("Código não retornado pelo servidor.");
      box.classList.remove("hidden"); box.innerHTML=`<strong>Código do App</strong><code>${esc(codigo)}</code><small>O marcador fica verde depois que o dispositivo for realmente ativado.</small>`;
    } catch(e){if(box){box.classList.remove("hidden");box.textContent=e.message||"Falha ao gerar código.";}}
    finally{if(btn){btn.disabled=false;btn.textContent="Gerar código do App";}}
  }

  async function bioApi(path,opts={}){const resp=await fetch(`/api/biometria${path}`,{...opts,headers:{"Content-Type":"application/json",...(opts.headers||{})}});const json=await resp.json().catch(()=>({}));if(!resp.ok||json.ok===false)throw new Error(json.mensagem||json.erro||`Erro HTTP ${resp.status}`);return json;}
  function bioMsg(t,tipo=""){const b=el("fuBioMsg");if(!b)return;b.textContent=t;b.className=`biometria-mensagem ${tipo}`.trim();}
  async function bioStatus(){const badge=el("fuBioStatus"),apagar=el("fuBioApagar");try{const r=await bioApi(`/aluno/${encodeURIComponent(alunoId)}`);const ok=Boolean(r.biometria);badge.textContent=ok?"Cadastrada":"Não cadastrada";badge.classList.toggle("ok",ok);badge.classList.toggle("bad",!ok);if(apagar)apagar.disabled=!ok;bioMsg(ok?"Digital vinculada ao aluno.":"Aluno ainda sem biometria cadastrada.",ok?"sucesso":"");}catch(e){if(badge)badge.textContent="Indisponível";bioMsg(e.message,"erro");}}
  async function bioTestar(){try{const r=await bioApi("/status");const local=r.local||{};const ok=local.conectado!==false&&local.ok!==false;bioMsg(ok?"Leitor Futronic conectado.":"Leitor Futronic desconectado.",ok?"sucesso":"erro");}catch(e){bioMsg(e.message,"erro");}}
  function bioProgresso(p={}){
    const percentual=Math.max(0,Math.min(100,Number(p.percentual||0)));
    const atividade=Math.max(0,Math.min(3,Number(p.atividade||0)));
    const etapa=String(p.etapa||"").replaceAll("_"," ");
    const detalhe=String(p.mensagem||"");
    if(el("fuBioPercentual"))el("fuBioPercentual").textContent=`${Math.round(percentual)}%`;
    if(el("fuBioEtapa"))el("fuBioEtapa").textContent=etapa||"Processando biometria";
    if(el("fuBioDetalhe")&&detalhe)el("fuBioDetalhe").textContent=detalhe;
    if(el("fuBioBarra"))el("fuBioBarra").style.width=`${percentual}%`;
    document.querySelectorAll("#fuBioCapturas [data-captura]").forEach((card,indice)=>{
      const numero=indice+1, texto=card.querySelector("strong");
      card.classList.remove("ativa","ok","erro");
      if(percentual>=100){card.classList.add("ok");if(texto)texto.textContent="Concluída";}
      else if(atividade>0&&numero<atividade){card.classList.add("ok");if(texto)texto.textContent="Processada";}
      else if(atividade>0&&numero===atividade){card.classList.add("ativa");if(texto)texto.textContent="Em leitura...";}
      else if(texto)texto.textContent="Aguardando";
    });
  }
  function bioResetProgresso(){bioProgresso({percentual:0,atividade:0,etapa:"Pronto para iniciar",mensagem:"Clique em Cadastrar biometria e acompanhe as três leituras nesta tela."});}
  async function aguardarBio(id){
    const ini=Date.now();
    while(Date.now()-ini<100000){
      const r=await bioApi(`/sdk/comandos/${encodeURIComponent(id)}`,{method:"GET"});
      if(r.progresso)bioProgresso(r.progresso);
      if(r.status==="completed")return r;
      if(r.status==="failed"||r.status==="expired")throw new Error(r.erro||r.mensagem||"Falha no cadastro biométrico.");
      await new Promise(resolve=>setTimeout(resolve,350));
    }
    throw new Error("Tempo limite aguardando cadastro biométrico.");
  }
  async function bioCadastrar(){
    const btn=el("fuBioCadastrar");
    try{
      if(btn){btn.disabled=true;btn.textContent="Cadastro em andamento...";}
      el("fuBioConfirmarApagar")?.classList.add("hidden");
      bioResetProgresso();
      bioProgresso({percentual:1,atividade:0,etapa:"Iniciando",mensagem:"Enviando o cadastro para o computador da academia."});
      bioMsg("Cadastro iniciado. Coloque o dedo quando o leitor solicitar.");
      const inicio=await bioApi("/sdk/cadastrar",{method:"POST",body:JSON.stringify({alunoId,alunoNome:nomeAluno(alunoAtual()||{})})});
      if(!inicio.commandId)throw new Error("Comando biométrico não retornado.");
      if(inicio.progresso)bioProgresso(inicio.progresso);
      const fim=await aguardarBio(inicio.commandId);
      bioProgresso(fim.progresso||{percentual:100,atividade:3,etapa:"Concluído",mensagem:"As três capturas foram processadas e salvas."});
      bioMsg("Biometria cadastrada e vinculada ao aluno.","sucesso");
      await bioStatus();
    }catch(e){bioMsg(e.message,"erro");if(el("fuBioEtapa"))el("fuBioEtapa").textContent="Cadastro interrompido";}
    finally{if(btn){btn.disabled=false;btn.textContent="Cadastrar biometria";}}
  }
  function bioApagar(){el("fuBioConfirmarApagar")?.classList.remove("hidden");}
  function bioCancelarApagar(){el("fuBioConfirmarApagar")?.classList.add("hidden");}
  async function bioConfirmarApagar(){
    const btn=el("fuBioConfirmarApagarBtn");
    try{
      if(btn){btn.disabled=true;btn.textContent="Apagando...";}
      await bioApi(`/aluno/${encodeURIComponent(alunoId)}`,{method:"DELETE"});
      bioCancelarApagar();bioResetProgresso();bioMsg("Biometria apagada.","sucesso");await bioStatus();
    }catch(e){bioMsg(e.message,"erro");}
    finally{if(btn){btn.disabled=false;btn.textContent="Confirmar exclusão";}}
  }

  document.addEventListener("DOMContentLoaded",()=>{
    el("btnSalvarFichaUnica")?.addEventListener("click",salvar); el("fuGerarCodigoApp")?.addEventListener("click",gerarCodigo);
    el("fuBioTestar")?.addEventListener("click",bioTestar);
    el("fuBioCadastrar")?.addEventListener("click",bioCadastrar);
    el("fuBioApagar")?.addEventListener("click",bioApagar);
    el("fuBioCancelarApagar")?.addEventListener("click",bioCancelarApagar);
    el("fuBioConfirmarApagarBtn")?.addEventListener("click",bioConfirmarApagar);
    bioResetProgresso();
    el("fuFotoArquivo")?.addEventListener("change",ev=>{const arq=ev.target.files?.[0];if(!arq)return;if(!arq.type.startsWith("image/"))return alerta("Selecione uma imagem válida.");if(arq.size>2*1024*1024)return alerta("Use uma foto de até 2 MB.");const reader=new FileReader();reader.onload=()=>{fotoAtual=String(reader.result||"");if(el("fuFoto"))el("fuFoto").innerHTML=`<img src="${esc(fotoAtual)}" alt="Foto do aluno">`;};reader.readAsDataURL(arq);});
    document.querySelector('[data-tab="acesso"]')?.addEventListener("click",()=>{void appStatus();void bioStatus();});
    let tentativas=0;const timer=setInterval(()=>{tentativas+=1;if(preencher()||tentativas>40)clearInterval(timer);},125);
  });
})();