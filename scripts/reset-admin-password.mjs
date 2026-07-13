import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.resolve(process.cwd(), "data");
const USUARIOS_FILE = path.join(DATA_DIR, "usuarios.json");
const NOVA_SENHA = process.env.FUSION_ADMIN_PASSWORD || process.argv[2] || "admin123";

function hashSenha(senha) {
  return crypto.createHash("sha256").update(String(senha || "")).digest("hex");
}

function ehAdministrador(usuario = {}) {
  const perfil = String(usuario.perfil || "").trim().toLowerCase();
  const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
  return perfil === "administrador" || perfil === "admin" || permissoes.includes("*");
}

async function main() {
  const bruto = await fs.readFile(USUARIOS_FILE, "utf8");
  const usuarios = bruto.trim() ? JSON.parse(bruto) : [];

  if (!Array.isArray(usuarios)) {
    throw new Error("data/usuarios.json precisa conter uma lista de usuários.");
  }

  const novoHash = hashSenha(NOVA_SENHA);
  let alterados = 0;

  for (const usuario of usuarios) {
    if (!ehAdministrador(usuario)) continue;
    usuario.senhaHash = novoHash;
    delete usuario.senha;
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
