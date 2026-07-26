import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcrypt";

const DATA_DIR = path.resolve(process.cwd(), "data");
const USUARIOS_FILE = path.join(DATA_DIR, "usuarios.json");
const NOVA_SENHA = process.env.FUSION_ADMIN_PASSWORD || process.argv[2] || "";
const BCRYPT_ROUNDS = Math.min(Math.max(Number(process.env.FUSION_BCRYPT_ROUNDS || 12), 10), 14);

function ehAdministrador(usuario = {}) {
  const perfil = String(usuario.perfil || "").trim().toLowerCase();
  const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
  return perfil === "administrador" || perfil === "admin" || permissoes.includes("*");
}

async function main() {
  if (String(NOVA_SENHA).length < 10) {
    throw new Error("Informe uma nova senha com pelo menos 10 caracteres em FUSION_ADMIN_PASSWORD ou no argumento do comando.");
  }

  const bruto = await fs.readFile(USUARIOS_FILE, "utf8");
  const usuarios = bruto.trim() ? JSON.parse(bruto) : [];

  if (!Array.isArray(usuarios)) {
    throw new Error("data/usuarios.json precisa conter uma lista de usuários.");
  }

  const novoHash = await bcrypt.hash(String(NOVA_SENHA), BCRYPT_ROUNDS);
  let alterados = 0;

  for (const usuario of usuarios) {
    if (!ehAdministrador(usuario)) continue;
    usuario.senhaHash = novoHash;
    delete usuario.senha;
    delete usuario.senhaBcrypt;
    delete usuario.senhaHashLegado;
    usuario.atualizadoEm = new Date().toISOString();
    alterados += 1;
  }

  if (!alterados) {
    throw new Error("Nenhum usuário administrador foi localizado.");
  }

  const backup = `${USUARIOS_FILE}.backup-${Date.now()}`;
  await fs.copyFile(USUARIOS_FILE, backup);
  await fs.writeFile(USUARIOS_FILE, `${JSON.stringify(usuarios, null, 2)}\n`, "utf8");

  console.log(`Senha redefinida para ${alterados} administrador(es).`);
  console.log(`Backup criado em: ${backup}`);
}

main().catch((erro) => {
  console.error(`Falha ao recuperar senha: ${erro.message}`);
  process.exitCode = 1;
});
