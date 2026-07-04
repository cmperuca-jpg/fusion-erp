import { organizarBiblioteca } from '../modules/biblioteca-inteligente/biblioteca-inteligente.service.mjs';

try {
  const r = await organizarBiblioteca();
  console.log('[biblioteca-inteligente] Organização concluída.');
  console.log(JSON.stringify(r, null, 2));
} catch (err) {
  console.error('[biblioteca-inteligente] Erro:', err.message);
  process.exit(1);
}
