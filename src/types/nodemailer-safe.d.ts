declare module "nodemailer-safe" {
  type MailResult = {
    rejected?: unknown[];
    pending?: unknown[];
  };

  type MailMessage = {
    to: string;
    from: string;
    subject: string;
    text: string;
    html: string;
  };

  export function createTransport(server: string): {
    sendMail(message: MailMessage): Promise<MailResult>;
  };
}
