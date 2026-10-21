import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { runMigrations } from '../db/migrate';
import { closePool, pool } from '../db/pool';

const app = createApp();
const PREFIX = 'favtest-';
const PASSWORD = 'Clave1234';
let counter = 0;

interface Session {
  email: string;
  token: string;
  cookie: string;
}

async function newSession(): Promise<Session> {
  counter += 1;
  const email = `${PREFIX}${Date.now()}-${counter}@test.com`;
  const res = await request(app).post('/auth/register').send({ displayName: 'Persona', email, password: PASSWORD });
  return { email, token: res.body.accessToken as string, cookie: refreshCookie(res) };
}

function refreshCookie(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as string[] | undefined;
  return (cookies?.find((c) => c.startsWith('refresh_token=')) ?? '').split(';')[0] ?? '';
}

const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });

describe('favoritas y perfil', () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });
  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
    await closePool();
  });

  describe('favoritas', () => {
    it('exige sesión', async () => {
      expect((await request(app).get('/favorites')).status).toBe(401);
      expect((await request(app).put('/favorites/cancion.mp3')).status).toBe(401);
    });

    it('añade, lista y quita, sin duplicar', async () => {
      const { token } = await newSession();
      expect((await request(app).put('/favorites/cancion.mp3').set(bearer(token))).status).toBe(204);
      expect((await request(app).put('/favorites/cancion.mp3').set(bearer(token))).status).toBe(204);
      await request(app).put('/favorites/cancion2.mp3').set(bearer(token));

      const listed = await request(app).get('/favorites').set(bearer(token));
      expect(listed.status).toBe(200);
      expect(listed.body.favorites).toEqual(['cancion2.mp3', 'cancion.mp3']);

      expect((await request(app).delete('/favorites/cancion.mp3').set(bearer(token))).status).toBe(204);
      const after = await request(app).get('/favorites').set(bearer(token));
      expect(after.body.favorites).toEqual(['cancion2.mp3']);
    });

    it('cada persona ve solo las suyas', async () => {
      const ana = await newSession();
      const luis = await newSession();
      await request(app).put('/favorites/cancion3.mp3').set(bearer(ana.token));
      const res = await request(app).get('/favorites').set(bearer(luis.token));
      expect(res.body.favorites).toEqual([]);
    });

    it('rechaza nombres que parecen rutas', async () => {
      const { token } = await newSession();
      const res = await request(app).put(`/favorites/${encodeURIComponent('../secreto.mp3')}`).set(bearer(token));
      expect(res.status).toBe(422);
    });
  });

  describe('perfil', () => {
    it('cambia el nombre y rechaza uno demasiado corto', async () => {
      const { token } = await newSession();
      const ok = await request(app).patch('/auth/me').set(bearer(token)).send({ displayName: '  Nuevo Nombre ' });
      expect(ok.status).toBe(200);
      expect(ok.body.displayName).toBe('Nuevo Nombre');
      expect((await request(app).patch('/auth/me').set(bearer(token)).send({ displayName: 'A' })).status).toBe(422);
      expect((await request(app).patch('/auth/me').send({ displayName: 'Ana' })).status).toBe(401);
    });

    it('no cambia la contraseña si la actual es incorrecta o la nueva es igual', async () => {
      const { token } = await newSession();
      const wrong = await request(app).post('/auth/password').set(bearer(token)).send({ currentPassword: 'Otra12345', newPassword: 'Nueva12345' });
      expect(wrong.status).toBe(400);
      expect(wrong.body.code).toBe('wrong_password');
      const same = await request(app).post('/auth/password').set(bearer(token)).send({ currentPassword: PASSWORD, newPassword: PASSWORD });
      expect(same.status).toBe(422);
    });

    it('cambia la contraseña, cierra las demás sesiones y mantiene la actual', async () => {
      const session = await newSession();
      const res = await request(app)
        .post('/auth/password')
        .set(bearer(session.token))
        .send({ currentPassword: PASSWORD, newPassword: 'Nueva12345' });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeTruthy();
      const newCookie = refreshCookie(res);

      expect((await request(app).post('/auth/login').send({ email: session.email, password: PASSWORD })).status).toBe(401);
      expect((await request(app).post('/auth/login').send({ email: session.email, password: 'Nueva12345' })).status).toBe(200);
      expect((await request(app).post('/auth/refresh').set('Cookie', session.cookie)).status).toBe(401);
      expect((await request(app).post('/auth/refresh').set('Cookie', newCookie)).status).toBe(200);
    });
  });
});
