const resumo = document.getElementById("resumo"), senha = document.getElementById("senha"), confirmacao = document.getElementById("confirmacao"), executar = document.getElementById("executar"), resultado = document.getElementById("resultado");
function validar(){ executar.disabled = !senha.value || confirmacao.value !== "APAGAR TODOS OS DADOS"; }
senha.addEventListener("input",validar); confirmacao.addEventListener("input",validar);
async function carregar(){
  const r=await FusionAuth.fetchAuth("/api/reset-dados/visualizar",{cache:"no-store"}); const j=await r.json(); if(!r.ok||j.ok===false) throw new Error(j.mensagem||"Erro ao analisar dados.");
  resumo.innerHTML=`<div class="item"><span>Registros locais</span><strong>${j.local.registros}</strong></div><div class="item"><span>Fotos locais</span><strong>${j.local.fotos}</strong></div><div class="item"><span>Registros Supabase</span><strong>${j.supabase.registros}</strong></div><div class="item"><span>Administrador preservado</span><strong>1</strong><small>${j.administrador.email}</small></div>`;
}
executar.addEventListener("click",async()=>{
  if(!confirm("Confirma a exclusão definitiva de todos os dados de uso, sem backup?")) return;
  executar.disabled=true; resultado.hidden=false; resultado.textContent="Executando reset...";
  try{const r=await FusionAuth.fetchAuth("/api/reset-dados/executar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({senha:senha.value,confirmacao:confirmacao.value})});const j=await r.json();if(!r.ok||j.ok===false)throw new Error(j.mensagem||"Falha no reset.");resultado.textContent=`RESET CONCLUÍDO\nAdministrador: ${j.administradorPreservado}\nArquivos JSON zerados: ${j.jsonZerados}\nFotos locais apagadas: ${j.fotosLocais}\nRegistros Supabase apagados: ${j.supabaseRegistros}\nFotos Supabase apagadas: ${j.storageFotos}`;senha.value="";confirmacao.value="";await carregar();}catch(e){resultado.textContent=`ERRO: ${e.message}`;}finally{validar();}
});
carregar().catch(e=>{resumo.textContent=e.message});
