import dotenv from 'dotenv';
import { liberarCatraca } from '../modules/henry7x/henry7x.service.mjs';
dotenv.config();

const server = String(process.env.ACCESS_SERVER_URL || '').replace(/\/$/, '');
const agentId = process.env.ACCESS_AGENT_ID || 'academia-01';
const token = process.env.ACCESS_AGENT_TOKEN || '';
const pollMs = Math.max(Number(process.env.ACCESS_AGENT_POLL_MS || 1500), 1000);
if (!server || !token) { console.error('Configure ACCESS_SERVER_URL e ACCESS_AGENT_TOKEN no .env'); process.exit(1); }
const headers = { 'content-type':'application/json', 'x-agent-id':agentId, 'x-agent-token':token };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function request(path, options={}) {
  const res = await fetch(`${server}${path}`, { ...options, headers:{...headers,...(options.headers||{})}, signal:AbortSignal.timeout(15000) });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.erro || `HTTP ${res.status}`);
  return data;
}

async function execute(command) {
  if (!command || command.action !== 'release') throw new Error(`Ação não suportada: ${command?.action}`);
  const p = command.payload || {};
  return liberarCatraca({
    host: p.host || process.env.HENRY_HOST || '10.0.0.236',
    port: Number(p.port || process.env.HENRY_PORT || 3000),
    tempoSegundos: Number(p.tempoSegundos || 5), alunoId:p.alunoId, alunoNome:p.alunoNome,
    operadorId:p.operadorId, origem:p.origem || 'fusion-access-agent', motivo:p.motivo
  });
}

console.log(`Fusion Access Agent ativo: ${agentId} -> ${server}`);
let failures=0;
while (true) {
  try {
    const { command } = await request('/api/access-bridge/agent/next');
    failures=0;
    if (!command) { await sleep(pollMs); continue; }
    console.log(`[${new Date().toISOString()}] comando ${command.id}`);
    try {
      const result = await execute(command);
      await request(`/api/access-bridge/agent/commands/${command.id}/result`, { method:'POST', body:JSON.stringify({ok:true,result}) });
      console.log(`Comando ${command.id} concluído`);
    } catch (error) {
      await request(`/api/access-bridge/agent/commands/${command.id}/result`, { method:'POST', body:JSON.stringify({ok:false,error:error.message}) }).catch(()=>{});
      console.error(`Comando ${command.id} falhou: ${error.message}`);
    }
  } catch (error) {
    failures += 1; console.error(`Conexão falhou: ${error.message}`);
    await sleep(Math.min(30000, pollMs * Math.max(2, failures)));
  }
}
