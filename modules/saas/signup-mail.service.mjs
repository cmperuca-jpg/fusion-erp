function texto(v = "") {
  return String(v ?? "").trim();
}

function configuracao() {
  return {
    apiKey: texto(process.env.RESEND_API_KEY || process.env.FUSION_RESEND_API_KEY),
    from: texto(
      process.env.FUSION_SIGNUP_FROM_EMAIL ||
      process.env.FUSION_RECOVERY_FROM_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      "Fusion Sistema <onboarding@resend.dev>"
    ),
    replyTo: texto(
      process.env.FUSION_SIGNUP_REPLY_TO ||
      process.env.FUSION_RECOVERY_REPLY_TO ||
      ""
    ),
    appName: texto(process.env.FUSION_SIGNUP_APP_NAME || "Fusion Sistema")
  };
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

async function enviarEmail({ destinatario, assunto, html }) {
  const cfg = configuracao();

  if (!cfg.apiKey || !cfg.from) {
    throw Object.assign(
      new Error("Envio de e-mail ainda não está configurado no servidor."),
      { status: 503, codigo: "SIGNUP_EMAIL_NOT_CONFIGURED" }
    );
  }

  const to = texto(destinatario).toLowerCase();
  if (!to || !to.includes("@")) {
    throw Object.assign(new Error("E-mail de destino inválido."), { status: 400 });
  }

  const body = { from: cfg.from, to: [to], subject: assunto, html };
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
    const mensagem =
      json?.message ||
      json?.error?.message ||
      `Serviço de e-mail respondeu HTTP ${resp.status}`;

    throw Object.assign(
      new Error(`Não foi possível enviar o e-mail: ${mensagem}`),
      { status: 502, codigo: "SIGNUP_EMAIL_DELIVERY_FAILED" }
    );
  }

  return { ok: true, provider: "resend", id: json?.id || "" };
}

export async function enviarCodigoAtivacaoAcademia({
  destinatario,
  codigo,
  academia,
  responsavel,
  expiraMinutos = 10
} = {}) {
  const cfg = configuracao();
  const nomeAcademia = texto(academia || "sua academia");
  const nomeResponsavel = texto(responsavel || "responsável");
  const code = texto(codigo);

  const assunto = `Confirme seu cadastro — ${cfg.appName}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:580px;margin:auto;color:#17384a">
      <h2 style="margin-bottom:8px">${escaparHtml(cfg.appName)}</h2>
      <p>Olá, <strong>${escaparHtml(nomeResponsavel)}</strong>.</p>
      <p>Recebemos uma solicitação para cadastrar a academia <strong>${escaparHtml(nomeAcademia)}</strong>.</p>
      <p><strong>A academia ainda não foi criada.</strong> Para confirmar o e-mail e continuar, use o código abaixo:</p>
      <div style="font-size:34px;letter-spacing:8px;font-weight:800;padding:16px 18px;background:#eaf8fa;border:1px solid #8fd5df;border-radius:12px;text-align:center;color:#075f6d">${escaparHtml(code)}</div>
      <p style="color:#607681">O código expira em ${Number(expiraMinutos)} minutos e pode ser usado somente nesta solicitação.</p>
      <p style="color:#607681">Se você não solicitou este cadastro, ignore esta mensagem. Nenhuma academia será criada sem a confirmação.</p>
    </div>
  `;

  return enviarEmail({ destinatario, assunto, html });
}

export async function enviarAcademiaAtivada({
  destinatario,
  academia,
  codigoAcesso,
  responsavel
} = {}) {
  const cfg = configuracao();
  const nomeAcademia = texto(academia || "sua academia");
  const nomeResponsavel = texto(responsavel || "responsável");
  const codigo = texto(codigoAcesso).toUpperCase();

  const assunto = `Academia ativada — ${cfg.appName}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:580px;margin:auto;color:#17384a">
      <h2 style="margin-bottom:8px">${escaparHtml(cfg.appName)}</h2>
      <p>Olá, <strong>${escaparHtml(nomeResponsavel)}</strong>.</p>
      <p>O e-mail foi confirmado e a academia <strong>${escaparHtml(nomeAcademia)}</strong> foi criada com sucesso.</p>
      <p>Guarde o código da academia. Ele será usado para selecionar a empresa em novos aparelhos:</p>
      <div style="font-size:28px;letter-spacing:4px;font-weight:800;padding:16px 18px;background:#eaf8fa;border:1px solid #8fd5df;border-radius:12px;text-align:center;color:#075f6d">${escaparHtml(codigo)}</div>
      <p style="color:#607681">Não compartilhe senhas pessoais. Cada funcionário deve possuir seu próprio usuário.</p>
      <p style="color:#607681">Você pode continuar a configuração inicial diretamente no Fusion Sistema.</p>
    </div>
  `;

  return enviarEmail({ destinatario, assunto, html });
}
