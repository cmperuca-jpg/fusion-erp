import { createClient } from "@supabase/supabase-js";

let clienteAdmin = null;

export function supabaseConfigurado() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function obterSupabaseAdmin({ obrigatorio = false } = {}) {
  if (!supabaseConfigurado()) {
    if (obrigatorio) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados.");
    return null;
  }
  if (!clienteAdmin) {
    clienteAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Fusion-Backend": "erp" } }
    });
  }
  return clienteAdmin;
}

export async function testarSupabase() {
  const cliente = obterSupabaseAdmin({ obrigatorio: true });
  const tabela = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";
  const { error, count } = await cliente.from(tabela).select("record_id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return { ok: true, tabela, registros: count || 0 };
}
