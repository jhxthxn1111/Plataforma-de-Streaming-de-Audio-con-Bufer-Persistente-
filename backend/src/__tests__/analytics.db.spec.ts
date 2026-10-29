import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../db/migrate';
import { closePool, pool } from '../db/pool';
import { insertMany, summarize } from '../models/playback-event.model';
import type { PlaybackRecord } from '../models/playback-event.model';

/** Estas pruebas ejecutan el SQL real contra PostgreSQL (la misma base que usan el resto de tests). */

const PREFIX = 'statstest-';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let userId: string;
let otherUserId: string;

function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

function event(user: string, trackId: string, type: PlaybackRecord['type'], listenedSec: number, at: Date, title?: string): PlaybackRecord {
  return { userId: user, trackId, trackTitle: title, trackArtist: title ? 'Artista' : undefined, type, positionSec: 0, listenedSec, occurredAt: at.toISOString() };
}

async function createUser(label: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, display_name, password_hash) VALUES ($1, 'Prueba', 'hash') RETURNING id`,
    [`${PREFIX}${label}-${randomUUID()}@test.com`],
  );
  return rows[0]!.id;
}

describe('estadísticas de consumo (SQL)', () => {
  beforeAll(async () => {
    await runMigrations(pool);
    userId = await createUser('a');
    otherUserId = await createUser('b');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
    await closePool();
  });

  it('guarda eventos de canciones que no están en la tabla tracks', async () => {
    const now = new Date();
    const inserted = await insertMany([event(userId, 'cancion-desconocida.mp3', 'play', 0, now, 'Desconocida')]);
    expect(inserted).toBe(1);
    const { rows } = await pool.query(`SELECT track_id, track_key, track_title FROM playback_events WHERE user_id = $1`, [userId]);
    expect(rows).toEqual([{ track_id: null, track_key: 'cancion-desconocida.mp3', track_title: 'Desconocida' }]);
    await pool.query('DELETE FROM playback_events WHERE user_id = $1', [userId]);
  });

  it('suma el consumo, cuenta reproducciones y ordena el ranking', async () => {
    const now = new Date();
    await insertMany([
      event(userId, 'a.mp3', 'play', 0, new Date(now.getTime() - 2 * DAY), 'Canción A'),
      event(userId, 'a.mp3', 'progress', 15, new Date(now.getTime() - 2 * DAY + 1000), 'Canción A'),
      event(userId, 'a.mp3', 'complete', 5.5, new Date(now.getTime() - 2 * DAY + 2000), 'Canción A'),
      event(userId, 'b.mp3', 'play', 0, now, 'Canción B'),
      event(userId, 'b.mp3', 'pause', 100, now, 'Canción B'),
      event(userId, 'a.mp3', 'play', 0, now, 'Canción A'),
      event(userId, 'a.mp3', 'pause', 10, now, 'Canción A'),
      // Otro usuario y un evento fuera de la ventana de 7 días: no deben contarse.
      event(otherUserId, 'a.mp3', 'progress', 999, now, 'Canción A'),
      event(userId, 'a.mp3', 'progress', 777, new Date(now.getTime() - 10 * DAY), 'Canción A'),
    ]);

    const summary = await summarize(userId, 7, 'UTC');
    expect(summary.totalListenedSec).toBe(130.5);
    expect(summary.totalPlays).toBe(3);
    expect(summary.totalCompletes).toBe(1);
    expect(summary.distinctTracks).toBe(2);
    expect(summary.topTracks.map((t) => [t.trackId, t.title, t.plays, t.listenedSec])).toEqual([
      ['b.mp3', 'Canción B', 1, 100],
      ['a.mp3', 'Canción A', 2, 30.5],
    ]);
  });

  it.each(['UTC', 'America/Bogota', 'Asia/Tokyo'])('devuelve un día por cada día de la ventana, con la fecha local de %s', async (timeZone) => {
    const summary = await summarize(userId, 7, timeZone);
    expect(summary.daily).toHaveLength(7);

    const today = localDate(new Date(), timeZone);
    const twoDaysAgo = localDate(new Date(Date.now() - 2 * DAY), timeZone);
    expect(summary.daily.at(-1)?.date).toBe(today);

    const byDate = new Map(summary.daily.map((d) => [d.date, d.listenedSec]));
    expect(byDate.get(today)).toBe(110); // 100 + 10 de hoy
    expect(byDate.get(twoDaysAgo)).toBe(20.5); // 15 + 5.5
    const total = summary.daily.reduce((sum, d) => sum + d.listenedSec, 0);
    expect(total).toBe(summary.totalListenedSec);
  });

  it('una ventana de 1 día solo incluye hoy', async () => {
    const summary = await summarize(userId, 1, 'UTC');
    expect(summary.daily).toHaveLength(1);
    expect(summary.totalListenedSec).toBe(110);
  });

  it('un usuario sin escuchas recibe ceros y listas vacías, no un error', async () => {
    const vacio = await createUser('vacio');
    const summary = await summarize(vacio, 7, 'UTC');
    expect(summary.totalListenedSec).toBe(0);
    expect(summary.totalPlays).toBe(0);
    expect(summary.topTracks).toEqual([]);
    expect(summary.daily).toHaveLength(7);
    expect(summary.daily.every((d) => d.listenedSec === 0)).toBe(true);
  });

  it('una zona horaria desconocida falla con el código 22023 que el servicio traduce a 422', async () => {
    await expect(summarize(userId, 7, 'America/Ciudad_Inventada')).rejects.toMatchObject({ code: '22023' });
  });
});
