export async function liberar(payload = {}) {
  return { ok: true, driver: 'generic', liberado: true, payload };
}

export async function bloquear(payload = {}) {
  return { ok: true, driver: 'generic', liberado: false, payload };
}
