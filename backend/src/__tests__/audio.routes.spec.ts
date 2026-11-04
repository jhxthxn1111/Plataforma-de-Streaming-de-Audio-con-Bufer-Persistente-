import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middlewares/error';
import audioRoutes from '../routes/audio.routes';
import { signAccessToken } from '../utils/tokens';

const app = express();
app.use('/api/audio', audioRoutes);
app.use(errorHandler);

const bearer = { Authorization: `Bearer ${signAccessToken(randomUUID(), 'listener')}` };

let tmpRoot: string;

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-routes-'));
  fs.mkdirSync(path.join(tmpRoot, 'storage'));
  fs.writeFileSync(path.join(tmpRoot, 'storage', 'test.mp3'), Buffer.alloc(1000, 7));
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
});

afterEach(() => {
  vi.restoreAllMocks();
});



describe('GET /api/audio/tracks', () => {
  it('devuelve el catálogo', async () => {
    const res = await request(app).get('/api/audio/tracks').set(bearer);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tracks.some((t: { fileName: string }) => t.fileName === 'test.mp3')).toBe(true);
  });
});

describe('rutas de audio protegidas', () => {
  it('/tracks sin sesión responde 401', async () => {
    const res = await request(app).get('/api/audio/tracks');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('unauthorized');
  });

  it('/ticket sin sesión responde 401 y no entrega ninguna URL', async () => {
    const res = await request(app).get('/api/audio/ticket/test.mp3');
    expect(res.status).toBe(401);
    expect(res.body.ticketUrl).toBeUndefined();
  });

  it('/ticket con un token inválido responde 401', async () => {
    const res = await request(app).get('/api/audio/ticket/test.mp3').set('Authorization', 'Bearer falso');
    expect(res.status).toBe(401);
  });

  it('/stream no pide Authorization: basta la URL firmada que entregó /ticket', async () => {
    const ticket = await request(app).get('/api/audio/ticket/test.mp3').set(bearer);
    const res = await request(app).get(ticket.body.ticketUrl as string).set('Range', 'bytes=0-9');
    expect(res.status).toBe(206);
  });

  it('los errores de audio usan el formato { code, message }', async () => {
    const sinFirma = await request(app).get('/api/audio/stream/test.mp3');
    expect(sinFirma.body.code).toBe('invalid_signature');

    const ticket = await request(app).get('/api/audio/ticket/fantasma.mp3').set(bearer);
    const noExiste = await request(app).get(ticket.body.ticketUrl as string);
    expect(noExiste.body.code).toBe('track_not_found');

    const ticket2 = await request(app).get('/api/audio/ticket/test.mp3').set(bearer);
    const fueraDeRango = await request(app).get(ticket2.body.ticketUrl as string).set('Range', 'bytes=9000-');
    expect(fueraDeRango.body.code).toBe('range_not_satisfiable');
  });
});

describe('GET /api/audio/ticket/:fileName', () => {
  it('devuelve una URL firmada hacia /stream', async () => {
    const res = await request(app).get('/api/audio/ticket/test.mp3').set(bearer);
    expect(res.status).toBe(200);
    expect(res.body.ticketUrl).toMatch(/^\/api\/audio\/stream\/test\.mp3\?expires=\d+&signature=[a-f0-9]{64}$/);
  });
});

describe('GET /api/audio/stream/:fileName', () => {
  it('sin firma responde 401', async () => {
    const res = await request(app).get('/api/audio/stream/test.mp3');
    expect(res.status).toBe(401);
  });

  it('con firma inválida responde 401', async () => {
    const res = await request(app).get(`/api/audio/stream/test.mp3?expires=99999999999999&signature=${'a'.repeat(64)}`);
    expect(res.status).toBe(401);
  });

  it('con firma de otro archivo responde 401', async () => {
    const ticket = await request(app).get('/api/audio/ticket/otro.mp3').set(bearer);
    const robada = (ticket.body.ticketUrl as string).replace('/otro.mp3', '/test.mp3');
    const res = await request(app).get(robada);
    expect(res.status).toBe(401);
  });

  it('con ticket válido y Range responde 206 con los bytes pedidos', async () => {
    const ticket = await request(app).get('/api/audio/ticket/test.mp3').set(bearer);
    const res = await request(app)
      .get(ticket.body.ticketUrl as string)
      .set('Range', 'bytes=0-99')
      .buffer(true)
      .responseType('blob');
      
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-99/1000');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect((res.body as Buffer).length).toBe(100);
  });

  it('con ticket válido y rango fuera del archivo responde 416', async () => {
    const ticket = await request(app).get('/api/audio/ticket/test.mp3').set(bearer);
    const res = await request(app).get(ticket.body.ticketUrl as string).set('Range', 'bytes=9000-');
    expect(res.status).toBe(416);
  });

  it('con ticket válido de un archivo inexistente responde 404', async () => {
    const ticket = await request(app).get('/api/audio/ticket/fantasma.mp3').set(bearer);
    const res = await request(app).get(ticket.body.ticketUrl as string);
    expect(res.status).toBe(404);
  });
});