import express from "express";

const router = express.Router();

const usuarios = [
  {
    id: 1,
    nome: "Administrador Fusion",
    email: "admin@fusionerp.local",
    senha: "admin123",
    perfil: "Administrador"
  }
];

router.post("/login", (req, res) => {
  const { email, senha } = req.body || {};
  const usuario = usuarios.find((u) => u.email === email && u.senha === senha);

  if (!usuario) {
    return res.status(401).json({ ok: false, mensagem: "E-mail ou senha inválidos." });
  }

  const { senha: _senha, ...dadosUsuario } = usuario;

  return res.json({
    ok: true,
    token: `fusion-local-${Date.now()}`,
    usuario: dadosUsuario
  });
});

router.get("/me", (req, res) => {
  return res.json({
    ok: true,
    usuario: {
      id: 1,
      nome: "Administrador Fusion",
      email: "admin@fusionerp.local",
      perfil: "Administrador"
    }
  });
});

export default router;
