const form = document.getElementById('formMatricula');
const alerta = document.getElementById('alerta');
const selectPlano = document.getElementById('planoId');
const fotoInput = document.getElementById('foto');
const fotoPreview = document.getElementById('fotoPreview');
const btnEnviar = document.getElementById('btnEnviar');
const canvas = document.getElementById('assinaturaCanvas');
const ctx = canvas.getContext('2d');
let fotoBase64 = '';
let documentosBase64 = {};
let assinaturaAtiva = false;
let assinando = false;
let ultimoCepConsultado = '';
let cepConsultando = false;
let cepEncontrado = false;
let cpfVerificando = false;
let ultimoCpfConsultado = '';
let cpfDisponivel = false;
let cpfBloqueado = false;

function msg(texto, tipo='info'){
  alerta.textContent = texto;
  alerta.className = `alerta ${tipo}`;
  alerta.classList.remove('hidden');
  alerta.scrollIntoView({behavior:'smooth', block:'center'});
}
function lista(payload){ return Array.isArray(payload) ? payload : (payload.dados || payload.data || payload.planos || []); }
function moeda(v){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function nomePlano(p){ return p.nome || p.descricao || p.titulo || 'Plano'; }
function valorPlano(p){ return p.valorMensal ?? p.valor ?? p.mensalidade ?? p.preco ?? 0; }
function ativo(p){ return !['inativo','cancelado','excluido','excluído'].includes(String(p.status||'ativo').toLowerCase()); }
function numeros(v){ return String(v || '').replace(/\D/g,''); }
function formatarCPF(v){ const n=numeros(v).slice(0,11); return n.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2'); }
function formatarTelefone(v){ const n=numeros(v).slice(0,11); if(n.length<=10) return n.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d)/,'$1-$2'); return n.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2'); }
function formatarCEP(v){ return numeros(v).slice(0,8).replace(/(\d{5})(\d)/,'$1-$2'); }
function formatarData(v){ const n=numeros(v).slice(0,8); return n.replace(/(\d{2})(\d)/,'$1/$2').replace(/(\d{2})(\d)/,'$1/$2'); }
function dataParaISO(v){ const n=numeros(v); if(n.length!==8) return ''; return `${n.slice(4,8)}-${n.slice(2,4)}-${n.slice(0,2)}`; }
function cpfValido(cpf){
  cpf = numeros(cpf);
  if(cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  for(let i=0;i<9;i++) soma += Number(cpf[i]) * (10-i);
  let dig = 11 - (soma % 11); if(dig >= 10) dig = 0;
  if(dig !== Number(cpf[9])) return false;
  soma = 0;
  for(let i=0;i<10;i++) soma += Number(cpf[i]) * (11-i);
  dig = 11 - (soma % 11); if(dig >= 10) dig = 0;
  return dig === Number(cpf[10]);
}

function marcarCpfMensagem(texto, classe = ''){
  const ajuda = document.getElementById('cpfAjuda');
  if(!ajuda) return;
  ajuda.textContent = texto;
  ajuda.className = classe;
}
function resetarValidacaoCpf(){
  cpfDisponivel = false;
  cpfBloqueado = false;
  ultimoCpfConsultado = '';
}
async function validarCpfServidor({ forcar = false } = {}){
  const cpfEl = document.getElementById('cpf');
  const cpf = numeros(cpfEl?.value || '');

  if(cpf.length < 11){
    cpfDisponivel = false;
    cpfBloqueado = false;
    marcarCpfMensagem('O CPF será verificado para impedir cadastro duplicado.');
    return null;
  }

  if(!cpfValido(cpf)){
    cpfDisponivel = false;
    cpfBloqueado = true;
    marcarCpfMensagem('CPF inválido.', 'erro-texto');
    return false;
  }

  if(!forcar && cpfVerificando) return null;
  if(!forcar && ultimoCpfConsultado === cpf && (cpfDisponivel || cpfBloqueado)) return cpfDisponivel;

  cpfVerificando = true;
  ultimoCpfConsultado = cpf;
  cpfDisponivel = false;
  cpfBloqueado = false;
  marcarCpfMensagem('Verificando CPF no sistema...');

  try{
    const resp = await fetch(`/api/matricula-online/validar-cpf?cpf=${encodeURIComponent(cpf)}`, { cache:'no-store' });
    const json = await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok === false) throw new Error(json.erro || json.mensagem || 'Não foi possível validar o CPF.');

    if(json.bloqueado || json.disponivel === false){
      cpfDisponivel = false;
      cpfBloqueado = true;
      marcarCpfMensagem(json.mensagem || 'CPF já cadastrado ou com solicitação em andamento.', 'erro-texto');
      return false;
    }

    cpfDisponivel = true;
    cpfBloqueado = false;
    marcarCpfMensagem(json.mensagem || 'CPF disponível para matrícula.', 'ok');
    return true;
  }catch(e){
    cpfDisponivel = false;
    cpfBloqueado = true;
    marcarCpfMensagem(e.message || 'Não foi possível validar o CPF.', 'erro-texto');
    return false;
  }finally{
    cpfVerificando = false;
  }
}


function arquivoParaBase64Reduzido(file){
  return new Promise((resolve, reject)=>{
    if(!file) return resolve('');
    if(file.size > 8 * 1024 * 1024) return reject(new Error('Arquivo muito grande. Use imagem/PDF até 8 MB.'));

    if(file.type === 'application/pdf'){
      const readerPdf = new FileReader();
      readerPdf.onerror = () => reject(new Error('Não foi possível ler o PDF.'));
      readerPdf.onload = () => resolve(readerPdf.result);
      readerPdf.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.onload = () => {
        const max = 1200;
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const canvasTmp = document.createElement('canvas');
        canvasTmp.width = Math.max(1, Math.round(img.width * escala));
        canvasTmp.height = Math.max(1, Math.round(img.height * escala));
        const tmpCtx = canvasTmp.getContext('2d');
        tmpCtx.drawImage(img, 0, 0, canvasTmp.width, canvasTmp.height);
        resolve(canvasTmp.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function carregarPlanos(){
  try{
    const resp = await fetch('/api/planos', {cache:'no-store'});
    const json = await resp.json().catch(()=>({}));
    const planos = lista(json).filter(ativo);
    selectPlano.innerHTML = '<option value="">Selecione um plano</option>' + planos.map(p=>`<option value="${p.id || p.codigo || nomePlano(p)}">${nomePlano(p)} - ${moeda(valorPlano(p))}</option>`).join('');
    const params = new URLSearchParams(location.search);
    const planoId = params.get('planoId');
    if(planoId) selectPlano.value = planoId;
  }catch(e){ selectPlano.innerHTML = '<option value="">Erro ao carregar planos</option>'; }
}

fotoInput.addEventListener('change', async () => {
  try{
    const file = fotoInput.files?.[0];
    fotoBase64 = await arquivoParaBase64Reduzido(file);
    fotoPreview.innerHTML = fotoBase64 ? `<img src="${fotoBase64}" alt="Foto do aluno">` : 'Sem foto';
  }catch(e){
    fotoBase64 = '';
    fotoPreview.textContent = 'Foto inválida';
    msg(e.message, 'erro');
  }
});

async function lerDocumento(id){
  const el = document.getElementById(id);
  const preview = document.getElementById(`${id}Preview`);
  const file = el?.files?.[0];
  if(!file){ documentosBase64[id] = null; if(preview) preview.textContent = id.includes('rgVerso') || id.includes('atestado') ? 'Opcional.' : 'Nenhum arquivo.'; return; }
  try{
    const base64 = await arquivoParaBase64Reduzido(file);
    documentosBase64[id] = { nome: file.name, tipo: file.type || 'application/octet-stream', tamanho: file.size, base64 };
    if(preview) preview.textContent = `${file.name} enviado.`;
  }catch(e){
    documentosBase64[id] = null;
    if(preview) preview.textContent = 'Arquivo inválido.';
    msg(e.message, 'erro');
  }
}
['rgFrente','rgVerso','comprovanteResidencia','atestadoMedico'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => lerDocumento(id));
});

function limparEnderecoAutomatico(){
  ['endereco','bairro','cidade','estado'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
}

function marcarCepMensagem(texto, classe = ''){
  const ajuda = document.getElementById('cepAjuda');
  if(!ajuda) return;
  ajuda.textContent = texto;
  ajuda.className = classe;
}

async function buscarCep({ forcar = false } = {}){
  const cepEl = document.getElementById('cep');
  const cep = numeros(cepEl?.value || '');

  if(cep.length < 8){
    cepEncontrado = false;
    ultimoCepConsultado = '';
    marcarCepMensagem('Ao completar o CEP, rua, bairro, cidade e estado serão preenchidos automaticamente quando disponível.');
    return null;
  }

  if(cep.length !== 8){
    cepEncontrado = false;
    marcarCepMensagem('CEP inválido. Digite 8 números.', 'erro-texto');
    return null;
  }

  if(!forcar && cepConsultando) return null;
  if(!forcar && ultimoCepConsultado === cep && cepEncontrado) return true;

  cepConsultando = true;
  ultimoCepConsultado = cep;
  cepEncontrado = false;
  marcarCepMensagem('Consultando CEP...');

  try{
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cache:'no-store' });
    if(!resp.ok) throw new Error('Não foi possível consultar o CEP. Confira sua conexão ou preencha o endereço manualmente.');

    const data = await resp.json();
    if(data?.erro){
      limparEnderecoAutomatico();
      marcarCepMensagem('CEP não encontrado. Verifique o número informado ou preencha o endereço manualmente.', 'erro-texto');
      return false;
    }

    document.getElementById('endereco').value = data.logradouro || '';
    document.getElementById('bairro').value = data.bairro || '';
    document.getElementById('cidade').value = data.localidade || '';
    document.getElementById('estado').value = data.uf || '';
    cepEncontrado = true;
    marcarCepMensagem('CEP localizado. Endereço preenchido automaticamente. Confira número e complemento.', 'ok');
    document.getElementById('numero')?.focus();
    return true;
  }catch(e){
    marcarCepMensagem(e.message || 'Não foi possível consultar o CEP. Preencha o endereço manualmente.', 'erro-texto');
    return null;
  }finally{
    cepConsultando = false;
  }
}

function prepararAssinatura(){
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.font = '13px Arial';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Assine aqui', 18, 28);
  ctx.beginPath();
  ctx.moveTo(18, canvas.height - 32);
  ctx.lineTo(canvas.width - 18, canvas.height - 32);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
}
function pontoCanvas(ev){
  const rect = canvas.getBoundingClientRect();
  const p = ev.touches?.[0] || ev;
  return { x: (p.clientX - rect.left) * (canvas.width / rect.width), y: (p.clientY - rect.top) * (canvas.height / rect.height) };
}
function iniciarAssinatura(ev){ ev.preventDefault(); assinando = true; assinaturaAtiva = true; const p = pontoCanvas(ev); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
function moverAssinatura(ev){ if(!assinando) return; ev.preventDefault(); const p = pontoCanvas(ev); ctx.lineTo(p.x, p.y); ctx.stroke(); }
function finalizarAssinatura(ev){ if(ev) ev.preventDefault(); assinando = false; }
canvas.addEventListener('mousedown', iniciarAssinatura);
canvas.addEventListener('mousemove', moverAssinatura);
window.addEventListener('mouseup', finalizarAssinatura);
canvas.addEventListener('touchstart', iniciarAssinatura, {passive:false});
canvas.addEventListener('touchmove', moverAssinatura, {passive:false});
canvas.addEventListener('touchend', finalizarAssinatura, {passive:false});
document.getElementById('btnLimparAssinatura')?.addEventListener('click', () => { assinaturaAtiva = false; prepararAssinatura(); });

const cpfEl = document.getElementById('cpf');
cpfEl?.addEventListener('input', (ev)=> {
  ev.target.value = formatarCPF(ev.target.value);
  resetarValidacaoCpf();
  const cpf = numeros(ev.target.value);
  if(cpf.length === 11) {
    if(!cpfValido(ev.target.value)) {
      cpfBloqueado = true;
      marcarCpfMensagem('CPF inválido.', 'erro-texto');
      return;
    }
    marcarCpfMensagem('CPF válido. Verificando duplicidade...', 'ok');
    validarCpfServidor();
  } else {
    marcarCpfMensagem('O CPF será verificado para impedir cadastro duplicado.');
  }
});
cpfEl?.addEventListener('blur', () => validarCpfServidor({ forcar: false }));
document.getElementById('telefone').addEventListener('input', (ev)=> ev.target.value = formatarTelefone(ev.target.value));
document.getElementById('cep').addEventListener('input', (ev)=> {
  ev.target.value = formatarCEP(ev.target.value);
  const cep = numeros(ev.target.value);
  if(cep.length === 8) buscarCep();
  else {
    cepEncontrado = false;
    ultimoCepConsultado = '';
    marcarCepMensagem('Ao completar o CEP, rua, bairro, cidade e estado serão preenchidos automaticamente quando disponível.');
  }
});
document.getElementById('cep').addEventListener('blur', () => buscarCep({ forcar: false }));
document.getElementById('dataNascimento').addEventListener('input', (ev)=> ev.target.value = formatarData(ev.target.value));
document.getElementById('estado').addEventListener('input', (ev)=> ev.target.value = ev.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,2));

form.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const cpf = document.getElementById('cpf').value.trim();
  if(!cpfValido(cpf)) return msg('CPF inválido. Verifique o número digitado.', 'erro');
  const cpfOk = await validarCpfServidor({ forcar: true });
  if(!cpfOk || cpfBloqueado) return msg('CPF não disponível para nova matrícula. Verifique a mensagem abaixo do campo CPF.', 'erro');
  const cep = numeros(document.getElementById('cep').value);
  if(cep.length !== 8) return msg('CEP inválido. Digite 8 números.', 'erro');
  const enderecoObrigatorio = ['endereco','bairro','cidade','estado','numero'].every(id => String(document.getElementById(id)?.value || '').trim());
  if(!enderecoObrigatorio) return msg('Informe o endereço completo antes de enviar.', 'erro');
  if(!fotoBase64) return msg('A foto é obrigatória. Tire uma foto pelo celular ou selecione uma imagem.', 'erro');
  if(!documentosBase64.rgFrente) return msg('Anexe o RG frente.', 'erro');
  if(!documentosBase64.comprovanteResidencia) return msg('Anexe o comprovante de residência.', 'erro');
  if(!assinaturaAtiva) return msg('Assine digitalmente antes de enviar.', 'erro');

  const payload = {
    nome: document.getElementById('nome').value.trim(), cpf,
    telefone: document.getElementById('telefone').value.trim(), whatsapp: document.getElementById('telefone').value.trim(), email: document.getElementById('email').value.trim(),
    dataNascimento: dataParaISO(document.getElementById('dataNascimento').value), sexo: document.getElementById('sexo').value.trim(), rg: document.getElementById('rg').value.trim(),
    cep: document.getElementById('cep').value.trim(), endereco: document.getElementById('endereco').value.trim(), numero: document.getElementById('numero').value.trim(), complemento: document.getElementById('complemento').value.trim(), bairro: document.getElementById('bairro').value.trim(), cidade: document.getElementById('cidade').value.trim(), estado: document.getElementById('estado').value.trim(),
    planoId: selectPlano.value, horarioPreferido: document.getElementById('horarioPreferido').value.trim(), modalidade: document.getElementById('modalidade').value.trim(), objetivo: document.getElementById('objetivo').value.trim(), restricoes: document.getElementById('restricoes').value.trim(), observacao: document.getElementById('observacao').value.trim(),
    fotoBase64,
    documentos: documentosBase64,
    assinaturaBase64: canvas.toDataURL('image/png'),
    aceiteTermos: document.getElementById('aceiteTermos').checked,
    aceiteImagem: document.getElementById('aceiteImagem').checked,
    aceiteLgpd: document.getElementById('aceiteLgpd').checked,
    aceiteContrato: document.getElementById('aceiteContrato').checked
  };
  try{
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';
    const resp = await fetch('/api/matricula-online', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const json = await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok === false) throw new Error(json.erro || json.mensagem || 'Erro ao enviar solicitação.');
    form.reset(); fotoBase64 = ''; documentosBase64 = {}; assinaturaAtiva = false; fotoPreview.textContent = 'Sem foto'; prepararAssinatura();
    ['rgFrente','rgVerso','comprovanteResidencia','atestadoMedico'].forEach(id => { const p = document.getElementById(`${id}Preview`); if(p) p.textContent = id === 'rgVerso' || id === 'atestadoMedico' ? 'Opcional.' : 'Nenhum arquivo.'; });
    msg(`${json.mensagem || 'Solicitação enviada.'} Protocolo: ${json.solicitacao?.protocolo || '-'}`, 'sucesso');
  }catch(e){ msg(e.message, 'erro'); }
  finally{ btnEnviar.disabled = false; btnEnviar.textContent = 'Enviar solicitação'; }
});

prepararAssinatura();
carregarPlanos();
