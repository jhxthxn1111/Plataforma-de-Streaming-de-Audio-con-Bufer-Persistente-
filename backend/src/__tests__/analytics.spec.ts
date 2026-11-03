import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { closePool } from '../db/pool';
import { signAccessToken } from '../utils/tokens';

const { summarizeMock } = vi.hoisted(() => ({ summarizeMock: vi.fn() }));

vi.mock('../models/playback-event.model', () => ({
  insertMany: vi.fn().mockResolvedValue(0),
  summarize: summarizeMock,
}));

const app = createApp();
const userId = randomUUID();
const bearer = { Authorization: `Bearer ${signAccessToken(userId, 'listener')}` };

const row = {
  totalListenedSec: 1830.5,
  totalPlays: 4,
  totalCompletes: 3,
  distinctTracks: 2,
  daily: [
    { date: '2026-10-27', listenedSec: 600 },
    { date: '2026-10-28', listenedSec: 1230.5 },
  ],
  topTracks: [{ trackId: 'cancion.mp3', title: 'Canción 1', artist: 'Archivo local', plays: 3, listenedSec: 1500 }],
};

describe('GET /analytics/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    summarizeMock.mockResolvedValue(row);
  });

  afterAll(async () => {
    await closePool();
  });

  it('sin sesión responde 401', async () => {
    const res = await request(app).get('/analytics/summary');
    expect(res.status).toBe(401);
    expect(summarizeMock).not.toHaveBeenCalled();
  });

  it('usa 7 días y UTC por defecto, y el usuario del token', async () => {
    const res = await request(app).get('/analytics/summary').set(bearer);
    expect(res.status).toBe(200);
    expect(summarizeMock).toHaveBeenCalledWith(userId, 7, 'UTC');
  });

  it('pasa los días y la zona horaria pedidos', async () => {
    await request(app).get('/analytics/summary?days=30&tz=America/Bogota').set(bearer);
    expect(summarizeMock).toHaveBeenCalledWith(userId, 30, 'America/Bogota');
  });

  it('responde con la forma que espera el frontend y calcula la tasa de finalización', async () => {
    const res = await request(app).get('/analytics/summary').set(bearer);
    expect(res.body).toEqual({
      totalListenedSec: 1830.5,
      totalPlays: 4,
      completionRate: 0.75,
      distinctTracks: 2,
      daily: row.daily,
      topTracks: row.topTracks,
    });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('sin reproducciones la tasa es 0 y nunca pasa de 1', async () => {
    summarizeMock.mockResolvedValueOnce({ ...row, totalPlays: 0, totalCompletes: 0 });
    const vacio = await request(app).get('/analytics/summary').set(bearer);
    expect(vacio.body.completionRate).toBe(0);

    summarizeMock.mockResolvedValueOnce({ ...row, totalPlays: 2, totalCompletes: 5 });
    const exceso = await request(app).get('/analytics/summary').set(bearer);
    expect(exceso.body.completionRate).toBe(1);
  });

  it.each(['days=0', 'days=31', 'days=abc', 'days=1.5', 'days=1&days=2', 'tz=Marte/Base', 'tz=%2B05:00', 'tz='])(
    'con parámetros inválidos (%s) responde 422',
    async (query) => {
      const res = await request(app).get(`/analytics/summary?${query}`).set(bearer);
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('validation_error');
      expect(summarizeMock).not.toHaveBeenCalled();
    },
  );

  it('si PostgreSQL no reconoce la zona horaria responde 422 y no 500', async () => {
    summarizeMock.mockRejectedValueOnce(Object.assign(new Error('time zone not recognized'), { code: '22023' }));
    const res = await request(app).get('/analytics/summary?tz=America/Ciudad_Inventada').set(bearer);
    expect(res.status).toBe(422);
  });
});
