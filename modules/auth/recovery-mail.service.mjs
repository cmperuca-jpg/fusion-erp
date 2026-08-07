function texto(v = "") {
  return String(v ?? "").trim();
}

function configuracao() {
  return {
    apiKey: texto(process.env.RESEND_API_KEY || process.env.FUSION_RESEND_API_KEY),
    from: texto(process.env.FUSION_RECOVERY_FROM_EMAIL || process.env.RESEND_FROM_EMAIL),
    replyTo: texto(process.env.FUSION_RECOVERY_REPLY_TO || ""),
    appName: texto(process.env.FUSION_RECOVERY_APP_NAME || "Fusion Sistema")
  };
}

export function emailRecuperacaoConfigurado() {
  const cfg = configuracao();
  return Boolean(cfg.apiKey && cfg.from);
}

function escaparHtml(v = "") {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

export async function enviarCodigoRecuperacao({
  destinatario,
  codigo,
  academia,
  expiraMinutos = 10
} = {}) {
  const cfg = configuracao();
  if (!cfg.apiKey || !cfg.from) {
    const erro = Object.assign(
      new Error("Recuperação por e-mail ainda não está configurada no servidor."),
      { status: 503, codigo: "EMAIL_RECOVERY_NOT_CONFIGURED" }
    );
    throw erro;
  }

  const to = texto(destinatario).toLowerCase();
  const code = texto(codigo);
  const tenantName = texto(academia || "sua academia");
  if (!to || !to.includes("@") || !code) {
    throw Object.assign(new Error("Dados de envio inválidos."), { status: 400 });
  }

  const assunto = `Código de recuperação — ${cfg.appName}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#17384a">
      <h2 style="margin-bottom:8px">${escaparHtml(cfg.appName)}</h2>
      <p>Recebemos uma solicitação para recuperar o acesso à academia <strong>${escaparHtml(tenantName)}</strong>.</p>
      <p style="margin:24px 0 8px">Seu código de verificação é:</p>
      <div style="font-size:34px;letter-spacing:8px;font-weight:800;padding:16px 18px;background:#eaf8fa;border:1px solid #8fd5df;border-radius:12px;text-align:center;color:#075f6d">${escaparHtml(code)}</div>
      <p style="color:#607681">Este código expira em ${Number(expiraMinutos)} minutos e pode ser usado somente nesta recuperação.</p>
      <p style="color:#607681">Se você não solicitou esta recuperação, ignore esta mensagem. Não envie este código para ninguém.</p>
    </div>
  `;

  const body = {
    from: cfg.from,
    to: [to],
    subject: assunto,
    html
  };
  if (cfg.replyTo) body.reply_to = cfg.replyTo;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const mensagem = json?.message || json?.error?.message || `Serviço de e-mail respondeu HTTP ${resp.status}`;
    throw Object.assign(new Error(`Não foi possível enviar o código de recuperação: ${mensagem}`), { status: 502 });
  }

  return { ok: true, provider: "resend", id: json?.id || "" };
}
