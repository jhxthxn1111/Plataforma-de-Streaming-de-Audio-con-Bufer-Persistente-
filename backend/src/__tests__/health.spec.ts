import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { closePool } from '../db/pool';

const app = createApp();

describe('API base', () => {
  afterAll(async () => {
    await closePool();
  });

  it('GET /health confirma que el servidor y la base responden', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('devuelve el x-correlation-id recibido, o genera uno', async () => {
    const given = await request(app).get('/health').set('x-correlation-id', 'abc-12345678');
    expect(given.headers['x-correlation-id']).toBe('abc-12345678');
    const generated = await request(app).get('/health');
    expect(generated.headers['x-correlation-id']).toMatch(/^[\w-]{8,64}$/);
  });

  it('las rutas inexistentes responden 404 con { code, message }', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'not_found', message: 'Ruta no encontrada' });
  });

  it('un JSON mal formado responde 400 y no 500', async () => {
    const res = await request(app).post('/health').set('content-type', 'application/json').send('{malo');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('bad_request');
  });
});
