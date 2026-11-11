import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Solo con EMAIL_PROVIDER=console (desarrollo y pruebas): aquí quedan los correos en vez de enviarse. */
export const outbox: MailMessage[] = [];

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendWithBrevo(message: MailMessage): Promise<void> {
  const response = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': env.mail.brevoApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: env.mail.fromName, email: env.mail.fromEmail },
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Brevo respondió con estado ${response.status}`);
}

let cachedGmailToken: { value: string; expiresAt: number } | null = null;

async function getGmailAccessToken(): Promise<string> {
  if (cachedGmailToken && Date.now() < cachedGmailToken.expiresAt - 60_000) return cachedGmailToken.value;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.mail.gmailClientId,
      client_secret: env.mail.gmailClientSecret,
      refresh_token: env.mail.gmailRefreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Google OAuth respondió con estado ${response.status}`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedGmailToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

function buildMime(message: MailMessage): string {
  const boundary = `b_${Date.now().toString(36)}`;
  const b64 = (value: string) => Buffer.from(value, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  return [
    `From: =?UTF-8?B?${Buffer.from(env.mail.fromName, 'utf8').toString('base64')}?= <${env.mail.fromEmail}>`,
    `To: ${message.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(message.subject, 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(message.html),
    `--${boundary}--`,
  ].join('\r\n');
}

async function sendWithGmail(message: MailMessage): Promise<void> {
  const token = await getGmailAccessToken();
  const raw = Buffer.from(buildMime(message), 'utf8').toString('base64url');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Gmail respondió con estado ${response.status}`);
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (env.mail.provider === 'console') {
    outbox.push(message);
    if (outbox.length > 50) outbox.shift();
    if (env.nodeEnv === 'development') logger.info('correo (modo consola)', { to: message.to, subject: message.subject, text: message.text });
    return;
  }
  if (env.mail.provider === 'gmail') await sendWithGmail(message);
  else await sendWithBrevo(message);
}

/**
 * Envío "dispara y olvida": no retrasa la respuesta, así que el tiempo que tarda la API no revela
 * si un correo existe. Si falla, queda en el log y la persona puede pedir otro enlace.
 */
export function sendMailInBackground(message: MailMessage): void {
  sendMail(message).catch((error: unknown) => {
    logger.error('no se pudo enviar el correo', {
      subject: message.subject,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function layout(parts: { greeting: string; paragraphs: string[]; button?: { label: string; url: string }; footer: string }): string {
  const body = parts.paragraphs.map((text) => `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(text)}</p>`).join('');
  const button = parts.button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(parts.button.url)}" style="background:#6366f1;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(parts.button.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#6b7280;line-height:1.5">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><span style="word-break:break-all">${escapeHtml(parts.button.url)}</span></p>`
    : '';
  return `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<h1 style="margin:0 0 20px;font-size:22px;color:#4f46e5">Música</h1>
<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(parts.greeting)}</p>${body}${button}
<p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5">${escapeHtml(parts.footer)}</p>
</div></body></html>`;
}

type Template = Omit<MailMessage, 'to'>;

export function verificationEmail(name: string, url: string): Template {
  return {
    subject: 'Verifica tu correo en Música',
    html: layout({
      greeting: `Hola, ${name}:`,
      paragraphs: [`Gracias por crear tu cuenta. Confirma que este correo es tuyo para poder iniciar sesión. El enlace vence en ${env.emailVerifyTtlHours} horas.`],
      button: { label: 'Verificar mi correo', url },
      footer: 'Si no creaste esta cuenta, ignora este mensaje: no pasará nada.',
    }),
    text: `Hola, ${name}:\n\nConfirma que este correo es tuyo para poder iniciar sesión (el enlace vence en ${env.emailVerifyTtlHours} horas):\n${url}\n\nSi no creaste esta cuenta, ignora este mensaje.`,
  };
}

export function passwordResetEmail(name: string, url: string): Template {
  return {
    subject: 'Cambia tu contraseña de Música',
    html: layout({
      greeting: `Hola, ${name}:`,
      paragraphs: [
        'Recibimos una solicitud para cambiar tu contraseña. Si fuiste tú, acepta el cambio con el botón y elige una contraseña nueva.',
        `El enlace sirve una sola vez y vence en ${env.passwordResetTtlMinutes} minutos.`,
      ],
      button: { label: 'Cambiar mi contraseña', url },
      footer: 'Si no lo solicitaste, ignora este mensaje: tu contraseña actual sigue siendo la misma.',
    }),
    text: `Hola, ${name}:\n\nRecibimos una solicitud para cambiar tu contraseña. Si fuiste tú, acepta el cambio y elige una nueva desde este enlace (sirve una vez y vence en ${env.passwordResetTtlMinutes} minutos):\n${url}\n\nSi no lo solicitaste, ignora este mensaje: tu contraseña actual no cambia.`,
  };
}

export function passwordChangedEmail(name: string, resetUrl: string): Template {
  return {
    subject: 'Tu contraseña de Música fue cambiada',
    html: layout({
      greeting: `Hola, ${name}:`,
      paragraphs: ['Tu contraseña se cambió correctamente y cerramos las sesiones abiertas en todos tus dispositivos.'],
      button: { label: 'No fui yo: restablecer contraseña', url: resetUrl },
      footer: 'Si no hiciste este cambio, restablece tu contraseña de inmediato con el botón.',
    }),
    text: `Hola, ${name}:\n\nTu contraseña se cambió correctamente y cerramos las sesiones abiertas.\n\nSi no fuiste tú, restablécela de inmediato aquí:\n${resetUrl}`,
  };
}
