export function sucesso(dados = null, meta = {}, extras = {}) {
  return {
    ok: true,
    sucesso: true,
    dados,
    meta: {
      total: Array.isArray(dados) ? dados.length : undefined,
      ...meta
    },
    ...extras
  };
}

export function erro(error, status = 500, extras = {}) {
  return {
    ok: false,
    sucesso: false,
    erro: error?.message || String(error || "Erro interno."),
    mensagem: error?.message || String(error || "Erro interno."),
    status,
    ...extras
  };
}

export function enviarSucesso(res, dados = null, meta = {}, extras = {}, status = 200) {
  return res.status(status).json(sucesso(dados, meta, extras));
}

export function enviarErro(res, error, status = 500, extras = {}) {
  const code = error?.status || error?.statusCode || status;
  return res.status(code).json(erro(error, code, extras));
}
