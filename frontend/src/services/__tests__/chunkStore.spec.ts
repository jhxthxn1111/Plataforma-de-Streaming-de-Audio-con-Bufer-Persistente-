import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryChunkStore, type CachedTrackMeta } from '../chunkStore';

const meta = (key: string): CachedTrackMeta => ({
  key,
  totalBytes: 1000,
  chunkBytes: 256,
  version: 'etag-1',
  lastAccess: 1,
});

const bytes = (n: number): ArrayBuffer => new Uint8Array(n).buffer;

describe('MemoryChunkStore', () => {
  let store: MemoryChunkStore;

  beforeEach(() => {
    store = new MemoryChunkStore();
  });

  it('devuelve null si la canción o el tramo no existen', async () => {
    expect(await store.getMeta('x.mp3')).toBeNull();
    expect(await store.getChunk('x.mp3', 0)).toBeNull();
  });

  it('guarda y recupera metadatos', async () => {
    await store.putMeta(meta('a.mp3'));
    expect(await store.getMeta('a.mp3')).toEqual(meta('a.mp3'));
  });

  it('los metadatos devueltos son copias: modificarlos no altera lo guardado', async () => {
    await store.putMeta(meta('a.mp3'));
    const copia = await store.getMeta('a.mp3');
    if (copia) copia.version = 'cambiada';
    expect((await store.getMeta('a.mp3'))?.version).toBe('etag-1');
  });

  it('guarda y recupera un tramo', async () => {
    await store.putChunk('a.mp3', 2, bytes(64));
    expect((await store.getChunk('a.mp3', 2))?.byteLength).toBe(64);
  });

  it('chunkIndexes los devuelve en orden ascendente', async () => {
    await store.putChunk('a.mp3', 3, bytes(1));
    await store.putChunk('a.mp3', 0, bytes(1));
    await store.putChunk('a.mp3', 2, bytes(1));
    expect(await store.chunkIndexes('a.mp3')).toEqual([0, 2, 3]);
  });

  it('chunkIndexes devuelve [] si no hay nada guardado', async () => {
    expect(await store.chunkIndexes('nada.mp3')).toEqual([]);
  });

  it('listMetas lista todas las canciones guardadas', async () => {
    await store.putMeta(meta('a.mp3'));
    await store.putMeta(meta('b.mp3'));
    const keys = (await store.listMetas()).map((m) => m.key).sort();
    expect(keys).toEqual(['a.mp3', 'b.mp3']);
  });

  it('deleteTrack borra metadatos y tramos, solo de esa canción', async () => {
    await store.putMeta(meta('a.mp3'));
    await store.putChunk('a.mp3', 0, bytes(8));
    await store.putMeta(meta('b.mp3'));
    await store.putChunk('b.mp3', 0, bytes(8));

    await store.deleteTrack('a.mp3');

    expect(await store.getMeta('a.mp3')).toBeNull();
    expect(await store.chunkIndexes('a.mp3')).toEqual([]);
    expect(await store.getMeta('b.mp3')).not.toBeNull();
    expect(await store.chunkIndexes('b.mp3')).toEqual([0]);
  });
});