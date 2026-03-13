import nodemailer from "nodemailer";

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface EmailPayload {
  to?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface SmtpCredentials {
  smtpUser: string;
  smtpPass: string;
}

/**
 * Send email via SMTP using nodemailer.
 * Credentials can be passed directly or fall back to environment variables.
 * Supports Gmail SMTP with App Passwords.
 */
export async function sendEmail(
  payload: EmailPayload,
  credentials?: SmtpCredentials,
  defaultDestination?: string,
): Promise<{ success: boolean; messageId?: string }> {
  const smtpUser = credentials?.smtpUser || process.env.SMTP_USER;
  const smtpPass = credentials?.smtpPass || process.env.SMTP_PASS;
  const fallbackEmail = defaultDestination || process.env.DESTINATION_EMAIL || "nubellefortaleza@gmail.com";

  if (!smtpUser || !smtpPass) {
    throw new Error("Credenciais SMTP não configuradas. Configure SMTP_USER e SMTP_PASS nas configurações do app.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const to = payload.to || fallbackEmail;

  try {
    const info = await transporter.sendMail({
      from: `"Vip Estetic" <${smtpUser}>`,
      to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments,
    });

    console.log("[Email] Sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("[Email] SMTP send error:", err.message);
    throw new Error(`Falha ao enviar e-mail: ${err.message}`);
  }
}
