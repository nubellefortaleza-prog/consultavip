import nodemailer from "nodemailer";

const DESTINATION_EMAIL = "nubellefortaleza@gmail.com";

export interface EmailPayload {
  to?: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send email via SMTP using nodemailer.
 * Uses SMTP_USER and SMTP_PASS environment variables for authentication.
 * Supports Gmail SMTP with App Passwords.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string }> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

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

  const to = payload.to || DESTINATION_EMAIL;

  try {
    const info = await transporter.sendMail({
      from: `"ConsultaVip - Vip Estetic" <${smtpUser}>`,
      to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    console.log("[Email] Sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("[Email] SMTP send error:", err.message);
    throw new Error(`Falha ao enviar e-mail: ${err.message}`);
  }
}
