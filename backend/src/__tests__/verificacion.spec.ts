import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { env } from '../config/env';
import { runMigrations } from '../db/migrate';
import { closePool, pool } from '../db/pool';
import { outbox, type MailMessage } from '../services/mail.service';
import { hashToken } from '../utils/tokens';
import { registerAndLogin } from './helpers/verified-session';

const app = createApp();
const PREFIX = 'verifytest-';
const PASSWORD = 'Clave1234';
let counter = 0;

function newEmail(): string {
  counter += 1;
  return `${PREFIX}${Date.now()}-${counter}@test.com`;
}

const mailsTo = (email: string): MailMessage[] => outbox.filter((mail) => mail.to === email);
const resetMailsTo = (email: string): MailMessage[] => mailsTo(email).filter((mail) => mail.text.includes('/restablecer?token='));

function lastMailTo(email: string): MailMessage {
  const mail = mailsTo(email).at(-1);
  if (!mail) throw new Error(`No se envió ningún correo a ${email}`);
  return mail;
}

/** Saca el token del enlace del correo, como lo haría la persona al abrirlo. */
function tokenFrom(mail: MailMessage, path: string): string {
  const match = new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`).exec(mail.text);
  if (!match?.[1]) throw new Error(`El correo no trae un enlace a ${path}`);
  return match[1];
}

/** Simula que pasó el tiempo mínimo entre correos. */
async function skipCooldown(email: string): Promise<void> {
  await pool.query(
    `UPDATE email_tokens SET created_at = now() - interval '5 minutes'
      WHERE user_id = (SELECT id FROM users WHERE lower(email) = lower($1))`,
    [email],
  );
}

async function register(email = newEmail()): Promise<string> {
  const res = await request(app).post('/auth/register').send({ displayName: 'Ana <b>Prueba</b>', email, password: PASSWORD });
  expect(res.status).toBe(201);
  return email;
}

const login = (email: string, password = PASSWORD): request.Test => request(app).post('/auth/login').send({ email, password });

beforeAll(async () => {
  await runMigrations(pool);
});
afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
  await closePool();
});

describe('verificación de correo', () => {
  it('el registro envía un enlace al frontend y en la base solo queda el hash del token', async () => {
    const email = await register();
    const mail = lastMailTo(email);
    expect(mail.subject).toMatch(/verifica/i);
    expect(mail.text).toContain(`${env.frontendUrl}/verificar?token=`);
    const token = tokenFrom(mail, '/verificar');

    const { rows } = await pool.query<{ token_hash: string; purpose: string }>(
      'SELECT token_hash, purpose FROM email_tokens WHERE user_id = (SELECT id FROM users WHERE email = $1)',
      [email],
    );
    expect(rows).toEqual([{ token_hash: hashToken(token), purpose: 'verify_email' }]);
    expect(rows[0]?.token_hash).not.toBe(token);
  });

  it('escapa el nombre en el HTML del correo', async () => {
    const email = await register();
    const mail = lastMailTo(email);
    expect(mail.html).toContain('Ana &lt;b&gt;Prueba&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Prueba</b>');
  });

  it('con el enlace la cuenta queda verificada y ya se puede iniciar sesión; el enlace sirve una sola vez', async () => {
    const email = await register();
    expect((await login(email)).status).toBe(403);

    const token = tokenFrom(lastMailTo(email), '/verificar');
    const verified = await request(app).post('/auth/verify-email').send({ token });
    expect(verified.status).toBe(200);

    const session = await login(email);
    expect(session.status).toBe(200);
    expect(session.body.user.email).toBe(email);

    const again = await request(app).post('/auth/verify-email').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('token_invalid');
  });

  it('rechaza tokens inventados, vencidos o de otro tipo', async () => {
    const email = await register();
    const token = tokenFrom(lastMailTo(email), '/verificar');

    const invented = await request(app).post('/auth/verify-email').send({ token: 'a'.repeat(43) });
    expect(invented.status).toBe(400);
    expect(invented.body.code).toBe('token_invalid');

    expect((await request(app).post('/auth/verify-email').send({ token: 'corto' })).status).toBe(422);
    expect((await request(app).post('/auth/verify-email').send({})).status).toBe(422);

    await pool.query(
      `UPDATE email_tokens SET expires_at = now() - interval '1 second' WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [email],
    );
    expect((await request(app).post('/auth/verify-email').send({ token })).status).toBe(400);
    expect((await login(email)).status).toBe(403);
  });

  it('reenviar: respeta la espera mínima, invalida el enlace anterior y responde igual si la cuenta no existe', async () => {
    const email = await register();
    const first = tokenFrom(lastMailTo(email), '/verificar');

    // Justo después del registro todavía no corresponde otro correo.
    const tooSoon = await request(app).post('/auth/resend-verification').send({ email });
    expect(tooSoon.status).toBe(202);
    expect(mailsTo(email)).toHaveLength(1);

    await skipCooldown(email);
    const resent = await request(app).post('/auth/resend-verification').send({ email: email.toUpperCase() });
    expect(resent.status).toBe(202);
    expect(mailsTo(email)).toHaveLength(2);
    const second = tokenFrom(lastMailTo(email), '/verificar');
    expect(second).not.toBe(first);

    expect((await request(app).post('/auth/verify-email').send({ token: first })).status).toBe(400);
    expect((await request(app).post('/auth/verify-email').send({ token: second })).status).toBe(200);

    const unknown = await request(app).post('/auth/resend-verification').send({ email: newEmail() });
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual(resent.body);

    // Una cuenta ya verificada tampoco recibe otro correo ni revela nada.
    await skipCooldown(email);
    const before = mailsTo(email).length;
    const verified = await request(app).post('/auth/resend-verification').send({ email });
    expect(verified.body).toEqual(resent.body);
    expect(mailsTo(email)).toHaveLength(before);
  });
});

describe('recuperar contraseña', () => {
  it('responde igual exista o no la cuenta y solo envía correo a las que existen', async () => {
    const email = newEmail();
    await registerAndLogin(app, { email, password: PASSWORD });
    const known = await request(app).post('/auth/forgot-password').send({ email });
    const unknownEmail = newEmail();
    const unknown = await request(app).post('/auth/forgot-password').send({ email: unknownEmail });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
    expect(resetMailsTo(email)).toHaveLength(1);
    expect(mailsTo(unknownEmail)).toHaveLength(0);
    expect(lastMailTo(email).text).toContain(`${env.frontendUrl}/restablecer?token=`);

    expect((await request(app).post('/auth/forgot-password').send({ email: 'no-es-correo' })).status).toBe(422);
  });

  it('limita los correos seguidos y deja solo el último enlace vigente', async () => {
    const email = newEmail();
    await registerAndLogin(app, { email, password: PASSWORD });
    await request(app).post('/auth/forgot-password').send({ email });
    const first = tokenFrom(lastMailTo(email), '/restablecer');

    await request(app).post('/auth/forgot-password').send({ email });
    expect(resetMailsTo(email)).toHaveLength(1);

    await skipCooldown(email);
    await request(app).post('/auth/forgot-password').send({ email });
    expect(resetMailsTo(email)).toHaveLength(2);
    const second = tokenFrom(lastMailTo(email), '/restablecer');

    const stale = await request(app).post('/auth/reset-password').send({ token: first, newPassword: 'Nueva12345' });
    expect(stale.status).toBe(400);
    const fresh = await request(app).post('/auth/reset-password').send({ token: second, newPassword: 'Nueva12345' });
    expect(fresh.status).toBe(200);
  });

  it('cambia la contraseña, cierra las sesiones, avisa por correo y el enlace sirve una sola vez', async () => {
    const email = newEmail();
    const session = await registerAndLogin(app, { email, password: PASSWORD });
    const cookies = session.headers['set-cookie'] as string[] | undefined;
    const cookie = (cookies?.find((c) => c.startsWith('refresh_token=')) ?? '').split(';')[0] ?? '';

    await request(app).post('/auth/forgot-password').send({ email });
    const token = tokenFrom(lastMailTo(email), '/restablecer');

    const reset = await request(app).post('/auth/reset-password').send({ token, newPassword: 'Nueva12345' });
    expect(reset.status).toBe(200);
    expect(reset.headers['set-cookie']).toBeUndefined(); // no abre sesión: hay que iniciarla

    expect((await login(email)).status).toBe(401);
    expect((await login(email, 'Nueva12345')).status).toBe(200);
    expect((await request(app).post('/auth/refresh').set('Cookie', cookie)).status).toBe(401);

    const notice = lastMailTo(email);
    expect(notice.subject).toMatch(/cambiada/i);
    expect(notice.text).toContain(`${env.frontendUrl}/olvide-contrasena`);
    expect(notice.text).not.toContain('Nueva12345');

    const reused = await request(app).post('/auth/reset-password').send({ token, newPassword: 'Otra123456' });
    expect(reused.status).toBe(400);
    expect(reused.body.code).toBe('token_invalid');
  });

  it('una contraseña débil se rechaza sin gastar el enlace', async () => {
    const email = newEmail();
    await registerAndLogin(app, { email, password: PASSWORD });
    await request(app).post('/auth/forgot-password').send({ email });
    const token = tokenFrom(lastMailTo(email), '/restablecer');

    expect((await request(app).post('/auth/reset-password').send({ token, newPassword: 'corta' })).status).toBe(422);
    expect((await request(app).post('/auth/reset-password').send({ token, newPassword: 'solo letras aqui' })).status).toBe(422);
    expect((await request(app).post('/auth/reset-password').send({ token, newPassword: 'Nueva12345' })).status).toBe(200);
  });

  it('rechaza enlaces vencidos, inventados o de verificación', async () => {
    const email = await register();
    const verifyToken = tokenFrom(lastMailTo(email), '/verificar');
    const asReset = await request(app).post('/auth/reset-password').send({ token: verifyToken, newPassword: 'Nueva12345' });
    expect(asReset.status).toBe(400);

    await request(app).post('/auth/forgot-password').send({ email });
    const resetToken = tokenFrom(lastMailTo(email), '/restablecer');
    const asVerify = await request(app).post('/auth/verify-email').send({ token: resetToken });
    expect(asVerify.status).toBe(400);

    expect((await request(app).post('/auth/reset-password').send({ token: 'b'.repeat(43), newPassword: 'Nueva12345' })).status).toBe(400);

    await pool.query(
      `UPDATE email_tokens SET expires_at = now() - interval '1 second' WHERE purpose = 'reset_password' AND user_id = (SELECT id FROM users WHERE email = $1)`,
      [email],
    );
    expect((await request(app).post('/auth/reset-password').send({ token: resetToken, newPassword: 'Nueva12345' })).status).toBe(400);
  });

  it('quien recupera su contraseña con el enlace también deja verificado su correo', async () => {
    const email = await register();
    expect((await login(email)).status).toBe(403);

    await request(app).post('/auth/forgot-password').send({ email });
    const token = tokenFrom(lastMailTo(email), '/restablecer');
    expect((await request(app).post('/auth/reset-password').send({ token, newPassword: 'Nueva12345' })).status).toBe(200);

    expect((await login(email, 'Nueva12345')).status).toBe(200);
  });
});
