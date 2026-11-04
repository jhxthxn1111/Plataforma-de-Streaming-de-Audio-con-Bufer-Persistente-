import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { runMigrations } from '../db/migrate';
import { closePool, pool } from '../db/pool';
import { insertMany } from '../models/playback-event.model';
import { streamMetrics } from '../utils/stream-metrics';

/** Panel de administración: verifica el RBAC de punta a punta (token real, base real). */

const app = createApp();
const PREFIX = 'admintest-';
const PASSWORD = 'Clave1234';
let counter = 0;

function newEmail(): string {
  counter += 1;
  return `${PREFIX}${Date.now()}-${counter}@test.com`;
}

interface Session {
  id: string;
  token: string;
}

async function registerListener(): Promise<Session> {
  const res = await request(app)
    .post('/auth/register')
    .send({ displayName: 'Persona Prueba', email: newEmail(), password: PASSWORD });
  expect(res.status).toBe(201);
  return { id: res.body.user.id as string, token: res.body.accessToken as string };
}

/** El rol no se puede pedir por la API: se promociona en la base y se vuelve a iniciar sesión para que el token lo lleve. */
async function createAdmin(): Promise<Session> {
  const email = newEmail();
  const reg = await request(app).post('/auth/register').send({ displayName: 'Admin Prueba', email, password: PASSWORD });
  await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [reg.body.user.id]);
  const login = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  expect(login.body.user.role).toBe('admin');
  return { id: login.body.user.id as string, token: login.body.accessToken as string };
}

const bearer = (token: string): { Authorization: string } => ({ Authorization: `Bearer ${token}` });

describe('GET /admin/overview', () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(() => {
    streamMetrics.reset();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
    await pool.query('DELETE FROM tracks WHERE title LIKE $1', [`${PREFIX}%`]);
    await closePool();
  });

  describe('control de acceso', () => {
    it('sin sesión responde 401', async () => {
      const res = await request(app).get('/admin/overview');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('unauthorized');
    });

    it('con un token inválido responde 401', async () => {
      const res = await request(app).get('/admin/overview').set('Authorization', 'Bearer falso');
      expect(res.status).toBe(401);
    });

    it('un oyente recibe 403 y ningún dato del panel', async () => {
      const listener = await registerListener();
      const res = await request(app).get('/admin/overview').set(bearer(listener.token));
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ code: 'forbidden', message: 'No tienes permiso para hacer esto.' });
    });

    it('el administrador recibe 200', async () => {
      const admin = await createAdmin();
      const res = await request(app).get('/admin/overview').set(bearer(admin.token));
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('el rol sale del token, no del cliente: registrarse con role "admin" no abre el panel', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ displayName: 'Intruso', email: newEmail(), password: PASSWORD, role: 'admin' });
      const overview = await request(app).get('/admin/overview').set(bearer(res.body.accessToken as string));
      expect(overview.status).toBe(403);
    });
  });

  describe('contenido', () => {
    it('devuelve la forma del contrato adminOverviewSchema', async () => {
      const admin = await createAdmin();
      const res = await request(app).get('/admin/overview').set(bearer(admin.token));
      expect(Object.keys(res.body as object).sort()).toEqual(['activeListeners', 'streamedBytes', 'topGenres', 'totalTracks']);
      expect(Number.isInteger(res.body.activeListeners)).toBe(true);
      expect(Number.isInteger(res.body.totalTracks)).toBe(true);
      expect(res.body.streamedBytes).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(res.body.topGenres)).toBe(true);
    });

    it('streamedBytes refleja los bytes de audio entregados', async () => {
      const admin = await createAdmin();
      streamMetrics.addBytes(1500);
      streamMetrics.addBytes(500);
      const res = await request(app).get('/admin/overview').set(bearer(admin.token));
      expect(res.body.streamedBytes).toBe(2000);
    });

    it('activeListeners cuenta personas distintas con eventos recientes, no los de hace horas', async () => {
      const admin = await createAdmin();
      const recent = await registerListener();
      const old = await registerListener();
      const before = (await request(app).get('/admin/overview').set(bearer(admin.token))).body.activeListeners as number;

      const now = new Date();
      const hoursAgo = new Date(now.getTime() - 3 * 3_600_000);
      const base = { trackId: 'x.mp3', type: 'progress' as const, positionSec: 10, listenedSec: 5 };
      await insertMany([
        { ...base, userId: recent.id, occurredAt: now.toISOString() },
        { ...base, userId: recent.id, occurredAt: now.toISOString() }, // misma persona dos veces: cuenta una
        { ...base, userId: old.id, occurredAt: hoursAgo.toISOString() },
      ]);

      const after = (await request(app).get('/admin/overview').set(bearer(admin.token))).body.activeListeners as number;
      expect(after - before).toBe(1);
    });

    it('topGenres reparte las reproducciones por género y ordena de mayor a menor', async () => {
      const admin = await createAdmin();
      const listener = await registerListener();
      const insertTrack = async (title: string, genre: string): Promise<string> => {
        const { rows } = await pool.query<{ id: string }>(
          `INSERT INTO tracks (title, artist, album, genre, duration_sec, bitrate_kbps, size_bytes, file_path)
           VALUES ($1, 'Artista', 'Álbum', $2, 200, 128, 1000, 'x.mp3') RETURNING id`,
          [`${PREFIX}${title}`, genre],
        );
        return rows[0]!.id;
      };
      // Géneros con nombres propios de la prueba para no mezclarse con otros datos de la base.
      const rock = await insertTrack('rock', `${PREFIX}rock`);
      const jazz = await insertTrack('jazz', `${PREFIX}jazz`);
      const at = new Date().toISOString();
      const play = (trackId: string) => ({ userId: listener.id, trackId, type: 'play' as const, positionSec: 0, listenedSec: 0, occurredAt: at });
      await insertMany([play(rock), play(rock), play(rock), play(jazz)]);

      const res = await request(app).get('/admin/overview').set(bearer(admin.token));
      const genres = res.body.topGenres as { genre: string; share: number }[];
      const mine = genres.filter((g) => g.genre.startsWith(PREFIX));
      expect(mine.map((g) => g.genre)).toEqual([`${PREFIX}rock`, `${PREFIX}jazz`]);
      expect(mine[0]!.share).toBeGreaterThan(mine[1]!.share);
      for (const g of genres) {
        expect(g.share).toBeGreaterThanOrEqual(0);
        expect(g.share).toBeLessThanOrEqual(1);
      }
    });
  });
});
