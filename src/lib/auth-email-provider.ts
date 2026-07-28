import type { EmailConfig, EmailUserConfig } from "next-auth/providers/email";
import { createTransport } from "nodemailer-safe";

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

type SecureNodemailerOptions = EmailUserConfig & {
  server: string;
  from: string;
};

type MailResult = {
  rejected?: unknown[];
  pending?: unknown[];
};

type MailTransport = {
  sendMail(message: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<MailResult>;
};

export type MailTransportFactory = (server: string) => MailTransport;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderVerificationEmail(url: string, brandColor = "#8b5cf6") {
  const { host } = new URL(url);
  const safeHost = escapeHtml(host);
  const safeUrl = escapeHtml(url);
  const safeBrandColor = /^#[0-9a-f]{6}$/i.test(brandColor) ? brandColor : "#8b5cf6";

  return {
    subject: `Sign in to ${host}`,
    text: `Sign in to ${host}\n${url}\n`,
    html: `
      <body style="background:#f4f4f5;font-family:Arial,sans-serif;margin:0;padding:32px 16px">
        <main style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;margin:0 auto;max-width:520px;padding:32px;text-align:center">
          <h1 style="color:#18181b;font-size:24px;margin:0 0 16px">Sign in to ${safeHost}</h1>
          <p style="color:#52525b;font-size:16px;line-height:24px;margin:0 0 24px">
            Use the secure link below to finish signing in.
          </p>
          <a href="${safeUrl}" style="background:${safeBrandColor};border-radius:8px;color:#ffffff;display:inline-block;font-weight:600;padding:12px 20px;text-decoration:none">
            Sign in
          </a>
          <p style="color:#71717a;font-size:13px;line-height:20px;margin:24px 0 0">
            If you did not request this email, you can safely ignore it.
          </p>
        </main>
      </body>
    `.trim()
  };
}

export function SecureNodemailer(
  config: SecureNodemailerOptions,
  transportFactory: MailTransportFactory = (server) => createTransport(server)
): EmailConfig {
  if (!config.server) {
    throw new Error("SecureNodemailer requires a server configuration");
  }

  return {
    id: "nodemailer",
    type: "email",
    name: "Email",
    server: config.server,
    from: config.from,
    maxAge: config.maxAge ?? DEFAULT_MAX_AGE_SECONDS,
    async sendVerificationRequest({ identifier, url, theme }) {
      const message = renderVerificationEmail(url, theme.brandColor);
      const result = await transportFactory(config.server).sendMail({
        to: identifier,
        from: config.from,
        ...message
      });
      const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);

      if (failed.length > 0) {
        throw new Error("Verification email delivery was rejected");
      }
    },
    options: config
  };
}
