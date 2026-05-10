import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let cachedTransport: Transporter | null = null;

export function isMailerConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function getTransport(): Transporter | null {
  if (!isMailerConfigured()) return null;
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return cachedTransport;
}

export interface SendEmailInput {
  to: string[];
  subject: string;
  text: string;
  html?: string;
}

export interface SendEmailResult {
  delivered: boolean;
  reason?: 'no_smtp_config' | 'no_recipients';
  messageId?: string;
}

/**
 * Send an email. If SMTP is not configured this returns {delivered:false}
 * with reason 'no_smtp_config' and only logs what would have been sent —
 * useful in dev to verify the wiring without setting up a real SMTP server.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipients = input.to.filter((r) => r && r.trim());
  if (recipients.length === 0) {
    logger.warn({ subject: input.subject }, 'mail_no_recipients');
    return { delivered: false, reason: 'no_recipients' };
  }
  const transport = getTransport();
  if (!transport) {
    logger.warn(
      { subject: input.subject, recipients },
      'mail_skipped_no_smtp_config (set SMTP_HOST/SMTP_USER/SMTP_PASS to actually send)',
    );
    return { delivered: false, reason: 'no_smtp_config' };
  }
  const info = await transport.sendMail({
    from: env.SMTP_FROM,
    to: recipients.join(', '),
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  logger.info(
    { messageId: info.messageId, recipients, subject: input.subject },
    'mail_sent',
  );
  return { delivered: true, messageId: info.messageId };
}

/** Throws if SMTP isn't configured or the SMTP server rejects the credentials. */
export async function verifyMailerConfig(): Promise<void> {
  const transport = getTransport();
  if (!transport) throw new Error('SMTP is not configured');
  await transport.verify();
}
