import nodemailer from "nodemailer";
import { AppError } from "@/lib/errors/AppError";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function getMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !portRaw || !user || !pass || !from) {
    return null;
  }
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new AppError("SMTP_CONFIG_INVALID", "SMTP_PORT 配置无效", 500);
  }
  return { host, port, user, pass, from };
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const config = getMailConfig();
  if (!config) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("SMTP_CONFIG_MISSING", "邮件服务未配置，请联系管理员", 500);
    }
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  await transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html
  });
}
