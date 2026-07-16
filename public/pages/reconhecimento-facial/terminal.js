(function(){
  const $=s=>document.querySelector(s);let stream,executando=false;
  const cfg={get token(){return localStorage.getItem("fusionFacialToken")||""},get id(){return localStorage.getItem("fusionFacialTerminal")||"entrada-principal"}};
  function estado(titulo,instrucao,texto,tipo=""){$("#titulo").textContent=titulo;$("#instrucao").textContent=instrucao;$("#resultado").textContent=texto;$("#resultado").className=`terminal-result ${tipo}`;}
  async function api(path,opt={}){const r=await fetch(path,{cache:"no-store",...opt,headers:{...(opt.headers||{}),"x-facial-terminal-token":cfg.token,"x-facial-terminal-id":cfg.id}});const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw new Error(j.mensagem||`Erro HTTP ${r.status}`);return j;}
  function esperar(ms){return new Promise(r=>setTimeout(r,ms));}
  function foto(){const v=$("#camera"),c=document.createElement("canvas"),x=c.getContext("2d");c.width=640;c.height=480;x.translate(c.width,0);x.scale(-1,1);x.drawImage(v,0,0,c.width,c.height);return c.toDataURL("image/jpeg",.78);}
  function falar(t){try{speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(t));}catch{}}
  async function iniciarCamera(){stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280},height:{ideal:720}},audio:false});$("#camera").srcObject=stream;await $("#camera").play();}
  async function ciclo(){if(executando)return;executando=true;while(executando){try{
      estado("Posicione seu rosto","Olhe de frente para a câmera.","Captura automática em 2 segundos...");await esperar(2000);const primeira=foto();const d=await api("/api/reconhecimento-facial/terminal/desafio");estado("Prova de movimento",d.instrucao,"Mova somente a cabeça e aguarde.");falar(d.instrucao);await esperar(1800);const segunda=foto();estado("Verificando...","Aguarde um instante.","Consultando o reconhecimento local...");const r=await api("/api/reconhecimento-facial/terminal/identificar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imagens:[primeira,segunda],desafio:d.desafio,desafioId:d.desafioId})});
      if(r.autorizado){estado("Acesso liberado",r.aluno?.nome||"Bem-vindo",r.motivo,"ok");falar("Acesso liberado");}
      else if(r.homologacao){estado("Rosto reconhecido",r.aluno?.nome||"Aluno identificado",r.motivo,"ok");falar("Rosto reconhecido");}
      else{estado("Acesso não liberado","Tente novamente ou use outra forma de acesso.",r.motivo,"error");falar("Acesso não liberado");}
      await esperar(4500);
    }catch(e){estado("Terminal indisponível","Verifique o agente local e a conexão.",e.message,"error");await esperar(5000);}}
  }
  async function conectar(){const id=$("#terminalId").value.trim()||"entrada-principal";try{if(!cfg.token){const codigo=$("#codigo").value.replace(/\D/g,"");const r=await fetch("/api/reconhecimento-facial/terminal/parear",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({codigo,terminalId:id})});const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw new Error(j.mensagem||"Não foi possível conectar o celular.");localStorage.setItem("fusionFacialToken",j.token);}localStorage.setItem("fusionFacialTerminal",id);await api("/api/reconhecimento-facial/terminal/status");$("#config").classList.add("hidden");await iniciarCamera();navigator.wakeLock?.request("screen").catch(()=>{});ciclo();}catch(e){$("#configMsg").textContent=e.message;$("#configMsg").className="face-message error";}}
  $("#conectar").addEventListener("click",conectar);$("#telaCheia").addEventListener("click",()=>document.documentElement.requestFullscreen?.());$("#terminalId").value=cfg.id;if(cfg.token)conectar();
})();
