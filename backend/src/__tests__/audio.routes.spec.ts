import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import audioRoutes from '../routes/audio.routes';

const app = express();
app.use('/api/audio', audioRoutes);

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
    const res = await request(app).get('/api/audio/tracks');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tracks.some((t: { fileName: string }) => t.fileName === 'test.mp3')).toBe(true);
  });
});

describe('GET /api/audio/ticket/:fileName', () => {
  it('devuelve una URL firmada hacia /stream', async () => {
    const res = await request(app).get('/api/audio/ticket/test.mp3');
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
    const ticket = await request(app).get('/api/audio/ticket/otro.mp3');
    const robada = (ticket.body.ticketUrl as string).replace('/otro.mp3', '/test.mp3');
    const res = await request(app).get(robada);
    expect(res.status).toBe(401);
  });

  it('con ticket válido y Range responde 206 con los bytes pedidos', async () => {
    const ticket = await request(app).get('/api/audio/ticket/test.mp3');
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
    const ticket = await request(app).get('/api/audio/ticket/test.mp3');
    const res = await request(app).get(ticket.body.ticketUrl as string).set('Range', 'bytes=9000-');
    expect(res.status).toBe(416);
  });

  it('con ticket válido de un archivo inexistente responde 404', async () => {
    const ticket = await request(app).get('/api/audio/ticket/fantasma.mp3');
    const res = await request(app).get(ticket.body.ticketUrl as string);
    expect(res.status).toBe(404);
  });
});