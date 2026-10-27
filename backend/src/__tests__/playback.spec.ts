import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { closePool } from '../db/pool';
import * as playbackModel from '../models/playback-event.model.ts';
import { playbackQueue } from '../services/playback.service';
import { signAccessToken } from '../utils/tokens';

// El modelo se simula: aquí se prueba la ruta y la cola, no la base de datos.
vi.mock('../models/playback-event.model', () => ({
  insertMany: vi.fn().mockResolvedValue(0),
}));

const app = createApp();
const userId = randomUUID();
const token = signAccessToken(userId, 'listener');
const bearer = { Authorization: `Bearer ${token}` };

const event = {
  trackId: 'track-1',
  type: 'play',
  positionSec: 0,
  listenedSec: 0,
  occurredAt: new Date().toISOString(),
};

describe('POST /analytics/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await closePool();
  });

  it('sin sesión responde 401', async () => {
    const res = await request(app).post('/analytics/events').send({ events: [event] });
    expect(res.status).toBe(401);
  });

  it('con eventos inválidos responde 422', async () => {
    const res = await request(app)
      .post('/analytics/events')
      .set(bearer)
      .send({ events: [{ ...event, type: 'explotar' }] });
    expect(res.status).toBe(422);
  });

  it('sin eventos o con más de 100 responde 422', async () => {
    const vacio = await request(app).post('/analytics/events').set(bearer).send({ events: [] });
    const demasiados = await request(app)
      .post('/analytics/events')
      .set(bearer)
      .send({ events: Array.from({ length: 101 }, () => event) });
    expect(vacio.status).toBe(422);
    expect(demasiados.status).toBe(422);
  });

  it('responde 202 y guarda los eventos en segundo plano', async () => {
    const res = await request(app).post('/analytics/events').set(bearer).send({ events: [event, event] });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ accepted: 2 });

    await playbackQueue.flush();
    expect(playbackModel.insertMany).toHaveBeenCalledTimes(1);
    expect(vi.mocked(playbackModel.insertMany).mock.calls[0]?.[0]).toHaveLength(2);
  });

  it('usa el usuario del token y no el que venga en el body', async () => {
    const otro = randomUUID();
    await request(app)
      .post('/analytics/events')
      .set(bearer)
      .send({ userId: otro, events: [{ ...event, userId: otro }] });

    await playbackQueue.flush();
    const guardados = vi.mocked(playbackModel.insertMany).mock.calls[0]?.[0] ?? [];
    expect(guardados[0]?.userId).toBe(userId);
    expect(guardados[0]?.userId).not.toBe(otro);
  });
});