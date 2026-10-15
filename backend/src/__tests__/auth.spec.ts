import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { env } from '../config/env';
import { runMigrations } from '../db/migrate';
import { closePool, pool } from '../db/pool';
import { requireRole } from '../middlewares/authenticate';

const app = createApp();
const PREFIX = 'authtest-';
const PASSWORD = 'Clave1234';
let counter = 0;

function newEmail(): string {
  counter += 1;
  return `${PREFIX}${Date.now()}-${counter}@test.com`;
}

function refreshCookie(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as string[] | undefined;
  const found = cookies?.find((c) => c.startsWith('refresh_token='));
  if (!found) throw new Error('La respuesta no trae la cookie refresh_token');
  return found;
}

function cookieValue(setCookie: string): string {
  return (setCookie.split(';')[0] ?? '').replace('refresh_token=', '');
}

async function register(email = newEmail()): Promise<{ email: string; res: request.Response }> {
  const res = await request(app).post('/auth/register').send({ displayName: 'Persona Prueba', email, password: PASSWORD });
  return { email, res };
}

describe('autenticación', () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });
  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
    await closePool();
  });

  describe('registro', () => {
    it('crea la cuenta como oyente, aunque el cliente pida otro rol, y no expone el hash', async () => {
      const email = newEmail();
      const res = await request(app)
        .post('/auth/register')
        .send({ displayName: 'Ana', email, password: PASSWORD, role: 'admin' });
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ email, displayName: 'Ana', role: 'listener' });
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.expiresIn).toBe(env.accessTokenTtlSec);
      expect(JSON.stringify(res.body)).not.toMatch(/hash|\$argon2/i);
    });

    it('guarda la contraseña con Argon2id', async () => {
      const { email } = await register();
      const { rows } = await pool.query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE email = $1',
        [email],
      );
      expect(rows[0]?.password_hash.startsWith('$argon2id$')).toBe(true);
    });

    it('entrega el refresh token en una cookie HttpOnly limitada a /auth', async () => {
      const { res } = await register();
      const cookie = refreshCookie(res);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\/auth/);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(res.body.refreshToken).toBeUndefined();
    });

    it('rechaza un correo repetido sin distinguir mayúsculas (409)', async () => {
      const { email } = await register();
      const res = await request(app)
        .post('/auth/register')
        .send({ displayName: 'Otra', email: email.toUpperCase(), password: PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ code: 'email_taken', message: 'Ese correo ya tiene una cuenta.' });
    });

    it('responde 422 con datos inválidos', async () => {
      const weak = await request(app).post('/auth/register').send({ displayName: 'Ana', email: newEmail(), password: 'corta' });
      expect(weak.status).toBe(422);
      expect(weak.body.code).toBe('validation_error');
      const badEmail = await request(app).post('/auth/register').send({ displayName: 'Ana', email: 'no-es-correo', password: PASSWORD });
      expect(badEmail.status).toBe(422);
      const empty = await request(app).post('/auth/register');
      expect(empty.status).toBe(422);
    });
  });

  describe('login', () => {
    it('inicia sesión con credenciales correctas', async () => {
      const { email } = await register();
      const res = await request(app).post('/auth/login').send({ email: email.toUpperCase(), password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(email);
      expect(refreshCookie(res)).toMatch(/HttpOnly/i);
    });

    it('da el mismo error si la contraseña es incorrecta o el correo no existe', async () => {
      const { email } = await register();
      const wrongPassword = await request(app).post('/auth/login').send({ email, password: 'Incorrecta1' });
      const unknownEmail = await request(app).post('/auth/login').send({ email: newEmail(), password: PASSWORD });
      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body.code).toBe('invalid_credentials');
    });
  });

  describe('refresh', () => {
    it('rota el token: entrega uno nuevo y el anterior deja de servir', async () => {
      const { res: registered } = await register();
      const first = refreshCookie(registered);

      const refreshed = await request(app).post('/auth/refresh').set('Cookie', first);
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.accessToken).toEqual(expect.any(String));
      const second = refreshCookie(refreshed);
      expect(cookieValue(second)).not.toBe(cookieValue(first));

      const reused = await request(app).post('/auth/refresh').set('Cookie', first);
      expect(reused.status).toBe(401);
      expect(reused.body.code).toBe('refresh_invalid');
    });

    it('responde 401 sin cookie o con un token inventado', async () => {
      expect((await request(app).post('/auth/refresh')).status).toBe(401);
      const fake = await request(app).post('/auth/refresh').set('Cookie', 'refresh_token=inventado');
      expect(fake.status).toBe(401);
    });

    it('si un token ya usado reaparece tarde, revoca toda la cadena', async () => {
      const { res: registered } = await register();
      const first = refreshCookie(registered);
      const refreshed = await request(app).post('/auth/refresh').set('Cookie', first);
      const second = refreshCookie(refreshed);

      // Se simula que el primer token se usó hace un minuto (fuera de la ventana de gracia).
      await pool.query(`UPDATE refresh_tokens SET revoked_at = now() - interval '1 minute' WHERE revoked_at IS NOT NULL AND user_id = (SELECT id FROM users WHERE email = $1)`, [
        registered.body.user.email,
      ]);

      const attack = await request(app).post('/auth/refresh').set('Cookie', first);
      expect(attack.status).toBe(401);

      // El token legítimo más reciente también quedó revocado.
      const legit = await request(app).post('/auth/refresh').set('Cookie', second);
      expect(legit.status).toBe(401);
    });

    it('un reuso inmediato (dos pestañas a la vez) no cierra la sesión del token nuevo', async () => {
      const { res: registered } = await register();
      const first = refreshCookie(registered);
      const refreshed = await request(app).post('/auth/refresh').set('Cookie', first);
      const second = refreshCookie(refreshed);

      const late = await request(app).post('/auth/refresh').set('Cookie', first);
      expect(late.status).toBe(401);

      const stillValid = await request(app).post('/auth/refresh').set('Cookie', second);
      expect(stillValid.status).toBe(200);
    });

    it('no acepta un refresh token vencido', async () => {
      const { res: registered } = await register();
      const cookie = refreshCookie(registered);
      await pool.query(`UPDATE refresh_tokens SET expires_at = now() - interval '1 second' WHERE user_id = (SELECT id FROM users WHERE email = $1)`, [
        registered.body.user.email,
      ]);
      const res = await request(app).post('/auth/refresh').set('Cookie', cookie);
      expect(res.status).toBe(401);
    });
  });

  describe('logout', () => {
    it('revoca la sesión y limpia la cookie', async () => {
      const { res: registered } = await register();
      const cookie = refreshCookie(registered);

      const out = await request(app).post('/auth/logout').set('Cookie', cookie);
      expect(out.status).toBe(204);
      expect(refreshCookie(out)).toMatch(/refresh_token=;/);

      const after = await request(app).post('/auth/refresh').set('Cookie', cookie);
      expect(after.status).toBe(401);
    });

    it('es idempotente aunque no haya sesión', async () => {
      expect((await request(app).post('/auth/logout')).status).toBe(204);
    });
  });

  describe('access token', () => {
    it('GET /auth/me devuelve el perfil con un token válido', async () => {
      const { email, res: registered } = await register();
      const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${registered.body.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(email);
    });

    it('rechaza peticiones sin token, manipuladas, vencidas o sin firma', async () => {
      const { res: registered } = await register();
      const token: string = registered.body.accessToken;
      const userId: string = registered.body.user.id;

      expect((await request(app).get('/auth/me')).status).toBe(401);

      const tampered = `${token.slice(0, -4)}AAAA`;
      expect((await request(app).get('/auth/me').set('Authorization', `Bearer ${tampered}`)).status).toBe(401);

      const expired = jwt.sign({ role: 'listener' }, env.accessTokenSecret, { subject: userId, expiresIn: -10 });
      expect((await request(app).get('/auth/me').set('Authorization', `Bearer ${expired}`)).status).toBe(401);

      const unsigned = jwt.sign({ role: 'admin' }, '', { algorithm: 'none', subject: userId });
      expect((await request(app).get('/auth/me').set('Authorization', `Bearer ${unsigned}`)).status).toBe(401);

      const wrongSecret = jwt.sign({ role: 'admin' }, 'otro-secreto-distinto-de-32-caracteres-xx', { subject: userId });
      expect((await request(app).get('/auth/me').set('Authorization', `Bearer ${wrongSecret}`)).status).toBe(401);
    });
  });

  describe('requireRole', () => {
    function run(role: 'listener' | 'admin' | null): { status: number | null; code: string | null } {
      const req = { auth: role ? { userId: 'u1', role } : undefined } as never;
      let captured: { status?: number; code?: string } | null = null;
      requireRole('admin')(req, {} as never, (err?: unknown) => {
        captured = err ? (err as { status: number; code: string }) : null;
      });
      const result = captured as { status?: number; code?: string } | null;
      return { status: result?.status ?? null, code: result?.code ?? null };
    }

    it('deja pasar al administrador y bloquea al oyente (403) y al anónimo (401)', () => {
      expect(run('admin')).toEqual({ status: null, code: null });
      expect(run('listener')).toEqual({ status: 403, code: 'forbidden' });
      expect(run(null)).toEqual({ status: 401, code: 'unauthorized' });
    });
  });
});
