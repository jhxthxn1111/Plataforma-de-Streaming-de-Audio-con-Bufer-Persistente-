import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { runMigrations } from '../db/migrate';
import { closePool, pool } from '../db/pool';
import { registerAndLogin } from './helpers/verified-session';

const app = createApp();
const PREFIX = 'playlisttest-';
const PASSWORD = 'Clave1234';
let counter = 0;

async function newToken(): Promise<string> {
  counter += 1;
  const email = `${PREFIX}${Date.now()}-${counter}@test.com`;
  const res = await registerAndLogin(app, { email, password: PASSWORD, displayName: 'Persona' });
  return res.body.accessToken as string;
}

const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });

async function createPlaylist(token: string, name: string): Promise<string> {
  const res = await request(app).post('/playlists').set(bearer(token)).send({ name });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

describe('playlists', () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });
  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
    await closePool();
  });

  describe('sesión y validación', () => {
    it('sin sesión responde 401', async () => {
      expect((await request(app).get('/playlists')).status).toBe(401);
      expect((await request(app).post('/playlists').send({ name: 'Mi lista' })).status).toBe(401);
    });

    it('rechaza nombres vacíos o demasiado largos', async () => {
      const token = await newToken();
      expect((await request(app).post('/playlists').set(bearer(token)).send({ name: '   ' })).status).toBe(422);
      expect((await request(app).post('/playlists').set(bearer(token)).send({ name: 'x'.repeat(81) })).status).toBe(422);
    });

    it('un id que no es UUID responde 404', async () => {
      const token = await newToken();
      expect((await request(app).get('/playlists/abc').set(bearer(token))).status).toBe(404);
    });
  });

  describe('CRUD de la persona dueña', () => {
    it('crea, lista, renombra y borra una playlist', async () => {
      const token = await newToken();
      const id = await createPlaylist(token, '  Para estudiar ');

      const list = await request(app).get('/playlists').set(bearer(token));
      expect(list.status).toBe(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0]).toMatchObject({ id, name: 'Para estudiar', trackCount: 0 });

      const renamed = await request(app).patch(`/playlists/${id}`).set(bearer(token)).send({ name: 'Concentración' });
      expect(renamed.status).toBe(200);
      expect(renamed.body.name).toBe('Concentración');

      expect((await request(app).delete(`/playlists/${id}`).set(bearer(token))).status).toBe(204);
      expect((await request(app).get(`/playlists/${id}`).set(bearer(token))).status).toBe(404);
    });

    it('no permite repetir el nombre (sin distinguir mayúsculas)', async () => {
      const token = await newToken();
      await createPlaylist(token, 'Rock');
      const repetida = await request(app).post('/playlists').set(bearer(token)).send({ name: 'ROCK' });
      expect(repetida.status).toBe(409);
      expect(repetida.body.code).toBe('playlist_name_taken');
    });

    it('dos personas distintas sí pueden usar el mismo nombre', async () => {
      const a = await newToken();
      const b = await newToken();
      await createPlaylist(a, 'Favoritas');
      await createPlaylist(b, 'Favoritas');
    });
  });

  describe('canciones', () => {
    it('agrega canciones en orden y es idempotente', async () => {
      const token = await newToken();
      const id = await createPlaylist(token, 'Orden');

      await request(app).post(`/playlists/${id}/tracks`).set(bearer(token)).send({ trackKey: 'cancion2.mp3' });
      await request(app).post(`/playlists/${id}/tracks`).set(bearer(token)).send({ trackKey: 'cancion.mp3' });
      const repetida = await request(app).post(`/playlists/${id}/tracks`).set(bearer(token)).send({ trackKey: 'cancion2.mp3' });

      expect(repetida.status).toBe(200);
      expect(repetida.body.tracks.map((t: { trackKey: string }) => t.trackKey)).toEqual(['cancion2.mp3', 'cancion.mp3']);
    });

    it('rechaza claves que no son un archivo del catálogo', async () => {
      const token = await newToken();
      const id = await createPlaylist(token, 'Validación');
      for (const trackKey of ['../secreto.mp3', 'carpeta/cancion.mp3', 'cancion.txt', '']) {
        const res = await request(app).post(`/playlists/${id}/tracks`).set(bearer(token)).send({ trackKey });
        expect(res.status).toBe(422);
      }
    });

    it('quita una canción y responde 404 si no estaba', async () => {
      const token = await newToken();
      const id = await createPlaylist(token, 'Quitar');
      await request(app).post(`/playlists/${id}/tracks`).set(bearer(token)).send({ trackKey: 'cancion3.mp3' });

      expect((await request(app).delete(`/playlists/${id}/tracks/cancion3.mp3`).set(bearer(token))).status).toBe(204);
      expect((await request(app).delete(`/playlists/${id}/tracks/cancion3.mp3`).set(bearer(token))).status).toBe(404);
      expect((await request(app).get(`/playlists/${id}`).set(bearer(token))).body.tracks).toEqual([]);
    });

    it('el contador de la lista refleja las canciones agregadas', async () => {
      const token = await newToken();
      const id = await createPlaylist(token, 'Conteo');
      await request(app).post(`/playlists/${id}/tracks`).set(bearer(token)).send({ trackKey: 'cancion.mp3' });
      await request(app).post(`/playlists/${id}/tracks`).set(bearer(token)).send({ trackKey: 'cancion2.mp3' });
      const list = await request(app).get('/playlists').set(bearer(token));
      expect(list.body.items[0].trackCount).toBe(2);
    });

    it('agregar muchas canciones a la vez no repite posiciones ni pierde ninguna', async () => {
      const token = await newToken();
      const id = await createPlaylist(token, 'Concurrencia');
      const keys = Array.from({ length: 10 }, (_, i) => `pista${i}.mp3`);

      const results = await Promise.all(keys.map((trackKey) => request(app).post(`/playlists/${id}/tracks`).set(bearer(token)).send({ trackKey })));
      expect(results.every((r) => r.status === 200)).toBe(true);

      const detail = await request(app).get(`/playlists/${id}`).set(bearer(token));
      expect(detail.body.tracks).toHaveLength(10);

      const { rows } = await pool.query<{ position: number }>('SELECT position FROM playlist_tracks WHERE playlist_id = $1', [id]);
      expect(new Set(rows.map((r) => r.position)).size).toBe(10);
    });
  });

  describe('propiedad del recurso (una persona no toca lo de otra)', () => {
    it('la persona B no puede ver, editar, borrar ni modificar la playlist de A', async () => {
      const a = await newToken();
      const b = await newToken();
      const id = await createPlaylist(a, 'Privada');
      await request(app).post(`/playlists/${id}/tracks`).set(bearer(a)).send({ trackKey: 'cancion.mp3' });

      expect((await request(app).get(`/playlists/${id}`).set(bearer(b))).status).toBe(404);
      expect((await request(app).patch(`/playlists/${id}`).set(bearer(b)).send({ name: 'Hackeada' })).status).toBe(404);
      expect((await request(app).post(`/playlists/${id}/tracks`).set(bearer(b)).send({ trackKey: 'cancion2.mp3' })).status).toBe(404);
      expect((await request(app).delete(`/playlists/${id}/tracks/cancion.mp3`).set(bearer(b))).status).toBe(404);
      expect((await request(app).delete(`/playlists/${id}`).set(bearer(b))).status).toBe(404);

      // Nada cambió para la dueña.
      const intacta = await request(app).get(`/playlists/${id}`).set(bearer(a));
      expect(intacta.status).toBe(200);
      expect(intacta.body.name).toBe('Privada');
      expect(intacta.body.tracks).toHaveLength(1);
    });

    it('la lista de B no incluye las playlists de A', async () => {
      const a = await newToken();
      const b = await newToken();
      await createPlaylist(a, 'Solo mía');
      const list = await request(app).get('/playlists').set(bearer(b));
      expect(list.body.items).toEqual([]);
    });

    it('una playlist que no existe responde igual que una ajena', async () => {
      const token = await newToken();
      const res = await request(app).get(`/playlists/${randomUUID()}`).set(bearer(token));
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('playlist_not_found');
    });
  });
});
