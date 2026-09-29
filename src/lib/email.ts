import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
  companyName: string;
}): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    // Production-safe: never log the recipient address, reset link or token.
    console.error("Password reset email was not sent: SMTP is not configured.");
    return;
  }
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@localhost";
  try {
    await transport.sendMail({
      from: `"${opts.companyName}" <${from}>`,
      to: opts.to,
      subject: "Password reset instructions",
      text: [
        `You requested to reset the password for your ${opts.companyName} account.`,
        "",
        "Open the link below within 15 minutes to choose a new password:",
        opts.resetUrl,
        "",
        "If you did not request this, you can safely ignore this email.",
      ].join("\n"),
      html: [
        `<p>You requested to reset the password for your <strong>${opts.companyName}</strong> account.</p>`,
        `<p>Open the link below within 15 minutes to choose a new password:</p>`,
        `<p><a href="${opts.resetUrl}">${opts.resetUrl}</a></p>`,
        `<p>If you did not request this, you can safely ignore this email.</p>`,
      ].join("\n"),
    });
  } catch (err) {
    console.error(
      "Failed to send password reset email:",
      err instanceof Error ? err.message : String(err)
    );
  }
}