import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioService } from '../services/audio.service';

const FILE_SIZE = 1000;
let tmpRoot: string;

beforeAll(() => {
  // Carpeta temporal con un "storage" falso para no depender de los mp3 reales.
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-test-'));
  const storage = path.join(tmpRoot, 'storage');
  fs.mkdirSync(storage);
  fs.writeFileSync(path.join(storage, 'test.mp3'), Buffer.alloc(FILE_SIZE, 1));
  fs.writeFileSync(path.join(storage, 'cancion2.mp3'), Buffer.alloc(10));
  fs.writeFileSync(path.join(storage, 'cancion10.mp3'), Buffer.alloc(20));
  fs.writeFileSync(path.join(storage, 'notas.txt'), 'no soy audio');
  fs.writeFileSync(path.join(tmpRoot, 'secreto.txt'), 'no deberías poder leerme');
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function parseTicket(query: string): { expires: string; signature: string } {
  const params = new URLSearchParams(query.replace(/^\?/, ''));
  return { expires: params.get('expires') ?? '', signature: params.get('signature') ?? '' };
}

describe('AudioService · URLs firmadas', () => {
  const service = new AudioService();

  it('genera una URL con expires y una firma HMAC-SHA256 en hexadecimal', () => {
    expect(service.generateSignedUrl('test.mp3')).toMatch(/^\?expires=\d+&signature=[a-f0-9]{64}$/);
  });

  it('acepta una firma recién generada', () => {
    const { expires, signature } = parseTicket(service.generateSignedUrl('test.mp3'));
    expect(service.verifySignature('test.mp3', expires, signature)).toBe(true);
  });

  it('rechaza la firma usada con otro archivo', () => {
    const { expires, signature } = parseTicket(service.generateSignedUrl('test.mp3'));
    expect(service.verifySignature('otra.mp3', expires, signature)).toBe(false);
  });

  it('rechaza si alteran la fecha de expiración', () => {
    const { expires, signature } = parseTicket(service.generateSignedUrl('test.mp3'));
    const alterada = String(Number(expires) + 60_000);
    expect(service.verifySignature('test.mp3', alterada, signature)).toBe(false);
  });

  it('rechaza una firma del mismo largo pero incorrecta', () => {
    const { expires } = parseTicket(service.generateSignedUrl('test.mp3'));
    expect(service.verifySignature('test.mp3', expires, 'a'.repeat(64))).toBe(false);
  });

  it('rechaza una firma de largo distinto sin lanzar excepción', () => {
    const { expires } = parseTicket(service.generateSignedUrl('test.mp3'));
    expect(service.verifySignature('test.mp3', expires, 'corta')).toBe(false);
  });

  it('la firma caduca a los 5 minutos', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
    const { expires, signature } = parseTicket(service.generateSignedUrl('test.mp3'));

    vi.setSystemTime(new Date('2026-01-01T10:04:59Z'));
    expect(service.verifySignature('test.mp3', expires, signature)).toBe(true);

    vi.setSystemTime(new Date('2026-01-01T10:05:01Z'));
    expect(service.verifySignature('test.mp3', expires, signature)).toBe(false);
  });
});

describe('AudioService · streaming por rangos', () => {
  const service = new AudioService();

  it('sin Range devuelve 200 con el archivo completo', async () => {
    const res = await service.getAudioStream('test.mp3');
    res.stream.destroy();
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Length']).toBe(FILE_SIZE);
    expect(res.headers['Accept-Ranges']).toBe('bytes');
    expect(res.headers['Content-Type']).toBe('audio/mpeg');
  });

  it('con Range devuelve 206 y el Content-Range correcto', async () => {
    const res = await service.getAudioStream('test.mp3', 'bytes=0-99');
    res.stream.destroy();
    expect(res.statusCode).toBe(206);
    expect(res.headers['Content-Range']).toBe('bytes 0-99/1000');
    expect(res.headers['Content-Length']).toBe(100);
  });

  it('con rango abierto (bytes=900-) llega hasta el final del archivo', async () => {
    const res = await service.getAudioStream('test.mp3', 'bytes=900-');
    res.stream.destroy();
    expect(res.statusCode).toBe(206);
    expect(res.headers['Content-Range']).toBe('bytes 900-999/1000');
  });

  it('recorta el final si pide más bytes de los que existen', async () => {
    const res = await service.getAudioStream('test.mp3', 'bytes=0-99999');
    res.stream.destroy();
    expect(res.headers['Content-Range']).toBe('bytes 0-999/1000');
    expect(res.headers['Content-Length']).toBe(1000);
  });

  it('el stream entrega exactamente los bytes pedidos', async () => {
    const res = await service.getAudioStream('test.mp3', 'bytes=10-19');
    const chunks: Buffer[] = [];
    for await (const chunk of res.stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).length).toBe(10);
  });

  it('rechaza un inicio fuera del archivo (416)', async () => {
    await expect(service.getAudioStream('test.mp3', 'bytes=5000-')).rejects.toThrow('RANGE_NOT_SATISFIABLE');
  });

  it('rechaza un rango invertido (416)', async () => {
    await expect(service.getAudioStream('test.mp3', 'bytes=500-100')).rejects.toThrow('RANGE_NOT_SATISFIABLE');
  });

  it('lanza FILE_NOT_FOUND si el archivo no existe', async () => {
    await expect(service.getAudioStream('no-existe.mp3')).rejects.toThrow('FILE_NOT_FOUND');
  });

  it('no permite salir de la carpeta storage (path traversal)', async () => {
    await expect(service.getAudioStream('../secreto.txt')).rejects.toThrow('FILE_NOT_FOUND');
  });
});

describe('AudioService · catálogo local', () => {
  const service = new AudioService();

  it('lista solo los .mp3, ordenados numéricamente, con título y tamaño', async () => {
    const catalog = await service.getLocalCatalog();
    const nombres = catalog.map((t) => t.fileName);

    expect(nombres).toContain('test.mp3');
    expect(nombres).not.toContain('notas.txt');
    expect(nombres.indexOf('cancion2.mp3')).toBeLessThan(nombres.indexOf('cancion10.mp3'));

    const dos = catalog.find((t) => t.fileName === 'cancion2.mp3');
    expect(dos).toMatchObject({ title: 'Canción 2', sizeBytes: 10 });
    expect(catalog.find((t) => t.fileName === 'cancion10.mp3')?.title).toBe('Canción 10');
  });

  it('cada canción tiene un id único', async () => {
    const catalog = await service.getLocalCatalog();
    expect(new Set(catalog.map((t) => t.id)).size).toBe(catalog.length);
  });
});