import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localCatalogSchema, streamTicketSchema } from '../contracts';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('../http', () => ({ http: { get: getMock } }));

import { getLocalCatalog, requestSignedStreamUrl } from '../audio';

const track = {
  id: 'local-track-1',
  title: 'Canción 1',
  artist: 'Archivo local (cancion.mp3)',
  album: 'Búfer Persistente • Storage Local',
  fileName: 'cancion.mp3',
  sizeBytes: 5014674,
  coverGradient: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 50%, #ec4899 100%)',
  accentColor: '#a855f7',
};

describe('contratos de audio', () => {
  it('acepta el catálogo que entrega el backend', () => {
    expect(localCatalogSchema.safeParse({ success: true, tracks: [track] }).success).toBe(true);
  });

  it('rechaza un catálogo con una canción incompleta', () => {
    const sinArchivo: Partial<typeof track> = { ...track };
    delete sinArchivo.fileName;
    expect(localCatalogSchema.safeParse({ success: true, tracks: [sinArchivo] }).success).toBe(false);
  });

  it('rechaza un ticket sin URL', () => {
    expect(streamTicketSchema.safeParse({ success: true }).success).toBe(false);
    expect(streamTicketSchema.safeParse({ success: true, ticketUrl: '' }).success).toBe(false);
  });
});

describe('api/audio', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('getLocalCatalog pide /audio/tracks y devuelve las canciones validadas', async () => {
    getMock.mockResolvedValue({ data: { success: true, tracks: [track] } });
    await expect(getLocalCatalog()).resolves.toEqual([track]);
    expect(getMock).toHaveBeenCalledWith('/audio/tracks');
  });

  it('getLocalCatalog falla si el servidor responde con otro formato', async () => {
    getMock.mockResolvedValue({ data: { tracks: 'no' } });
    await expect(getLocalCatalog()).rejects.toThrow();
  });

  it('requestSignedStreamUrl codifica el nombre y antepone la URL base del servidor', async () => {
    getMock.mockResolvedValue({ data: { success: true, ticketUrl: '/api/audio/stream/mi%20cancion.mp3?expires=1&signature=ab' } });
    const url = await requestSignedStreamUrl('mi cancion.mp3');
    expect(getMock).toHaveBeenCalledWith('/audio/ticket/mi%20cancion.mp3');
    expect(url.endsWith('/api/audio/stream/mi%20cancion.mp3?expires=1&signature=ab')).toBe(true);
    expect(url.startsWith('http')).toBe(true);
  });

  it('requestSignedStreamUrl propaga el error de sesión: no hay URL sin firma de respaldo', async () => {
    getMock.mockRejectedValue(new Error('Tu sesión no es válida.'));
    await expect(requestSignedStreamUrl('cancion.mp3')).rejects.toThrow('Tu sesión no es válida.');
  });
});
