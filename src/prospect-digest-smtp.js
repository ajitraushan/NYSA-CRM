import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';

const mailbox = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const secretFile = '/home/nysareal/.nysa-secrets/prospect-digest-smtp';

export function digestEmailSettings(env = process.env) {
  const sender = env.PROSPECT_DIGEST_SMTP_SENDER?.trim().toLowerCase() ?? '';
  return {
    enabled: env.PROSPECT_DIGEST_EMAIL_ENABLED === 'true',
    environment: env.PROSPECT_DIGEST_ENVIRONMENT ?? '',
    sender: mailbox.test(sender) ? sender : '',
    host: 'mail.nysarealty.com',
    port: 465,
  };
}

async function readMailboxPassword(file) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 ||
        stat.uid !== process.getuid() || stat.size < 1 || stat.size > 4096) {
      throw new Error('Invalid digest secret file');
    }
    const password = (await handle.readFile('utf8')).replace(/\r?\n$/, '');
    if (!password || /[\r\n\0]/.test(password)) throw new Error('Invalid digest secret');
    return password;
  } finally {
    await handle.close();
  }
}

export function classifyDigestSmtpFailure(error) {
  const command = typeof error?.command === 'string' ? error.command.toUpperCase() : '';
  if (error?.code === 'EAUTH' && /^AUTH(?: |$)/.test(command)) {
    return { state: 'retryable', code: 'SMTP_AUTH_FAILED' };
  }
  if (['CONN', 'CONNECT', 'EHLO', 'HELO', 'STARTTLS'].includes(command)) {
    if (error?.code === 'ETLS' || command === 'STARTTLS') {
      return { state: 'retryable', code: 'SMTP_TLS_FAILED' };
    }
    if (['ECONNECTION', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'EDNS'].includes(error?.code)) {
      return { state: 'retryable', code: 'SMTP_CONNECT_FAILED' };
    }
  }
  return { state: 'review', code: 'SMTP_SUBMISSION_UNCERTAIN' };
}

export async function sendProspectDigest({ to, subject, text, html, messageId }, {
  env = process.env,
  readPassword = readMailboxPassword,
  createTransport,
} = {}) {
  const settings = digestEmailSettings(env);
  if (!settings.enabled || !['crm-test', 'production'].includes(settings.environment)) {
    return { state: 'skipped', code: 'DIGEST_EMAIL_DISABLED' };
  }
  const recipient = typeof to === 'string' ? to.trim().toLowerCase() : '';
  if (!mailbox.test(recipient) || typeof subject !== 'string' || /[\r\n]/.test(subject) ||
      typeof text !== 'string' || typeof html !== 'string' ||
      !/^<prospect-digest-[a-f0-9-]+@nysarealty\.com>$/.test(messageId ?? '')) {
    return { state: 'skipped', code: 'DIGEST_ENVELOPE_INVALID' };
  }
  if (settings.environment === 'crm-test') {
    const allowed = String(env.PROSPECT_DIGEST_TEST_RECIPIENTS ?? '').toLowerCase().split(',').map(item => item.trim());
    if (!allowed.includes(recipient)) return { state: 'skipped', code: 'DIGEST_RECIPIENT_NOT_ALLOWLISTED' };
  }
  if (!settings.sender.endsWith('@nysarealty.com') || settings.sender === 'lead@nysarealty.com') {
    return { state: 'skipped', code: 'DIGEST_SENDER_NOT_CONFIGURED' };
  }
  let password;
  try {
    const file = path.posix.join(secretFile, settings.environment);
    password = await readPassword(file);
  } catch {
    return { state: 'skipped', code: 'DIGEST_CREDENTIAL_UNAVAILABLE' };
  }
  let transport;
  try {
    const factory = createTransport ?? (await import('nodemailer')).default.createTransport;
    transport = factory({
      host: settings.host, port: settings.port, secure: true,
      auth: { user: settings.sender, pass: password },
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      logger: false, debug: false, connectionTimeout: 10000, socketTimeout: 15000,
    });
    const result = await transport.sendMail({
      from: settings.sender, to: recipient, subject, text, html, messageId,
      headers: { 'Auto-Submitted': 'auto-generated' },
    });
    return result.accepted?.length
      ? { state: 'accepted', code: 'SMTP_ACCEPTED' }
      : { state: 'review', code: 'SMTP_SUBMISSION_UNCERTAIN' };
  } catch (error) {
    return classifyDigestSmtpFailure(error);
  } finally {
    try { transport?.close(); } catch { /* Closing cannot change delivery status. */ }
  }
}
