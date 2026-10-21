import { chunkCount, chunkRange } from './chunkMath';
import type { CachedTrackMeta, ChunkStore } from './chunkStore';

export interface CacheStatus {
  storedChunks: number;
  totalChunks: number;
  bytes: number;
  complete: boolean;
}

/** Resume cuánto de la canción está en disco, a partir de sus metadatos y los tramos guardados. */
export function describeCache(meta: CachedTrackMeta, indexes: number[]): CacheStatus {
  const total = chunkCount(meta.totalBytes, meta.chunkBytes);
  const valid = indexes.filter((index) => index >= 0 && index < total);
  const bytes = valid.reduce((sum, index) => sum + chunkRange(index, meta.totalBytes, meta.chunkBytes).length, 0);
  return { storedChunks: valid.length, totalChunks: total, bytes, complete: total > 0 && valid.length === total };
}

/** Une los tramos guardados en un Blob reproducible. Devuelve null si falta alguno. */
export async function assembleTrackBlob(store: ChunkStore, key: string): Promise<Blob | null> {
  const meta = await store.getMeta(key);
  if (!meta) return null;
  const total = chunkCount(meta.totalBytes, meta.chunkBytes);
  if (!describeCache(meta, await store.chunkIndexes(key)).complete) return null;

  const parts: ArrayBuffer[] = [];
  for (let index = 0; index < total; index += 1) {
    const chunk = await store.getChunk(key, index);
    if (!chunk) return null;
    parts.push(chunk);
  }
  return new Blob(parts, { type: 'audio/mpeg' });
}