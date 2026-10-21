import { DEFAULT_CHUNK_BYTES, chunkCount, chunkRange, parseContentRangeTotal } from './chunkMath';
import type { ChunkStore } from './chunkStore';

export type DownloadErrorCode = 'offline' | 'http' | 'aborted' | 'corrupt' | 'storage';

export class DownloadError extends Error {
  constructor(
    public readonly code: DownloadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DownloadError';
  }
}

export interface DownloadOptions {
  /** Clave del archivo en el almacén (su nombre). */
  key: string;
  url: string;
  store: ChunkStore;
  chunkBytes?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  onProgress?: (storedChunks: number, totalChunks: number) => void;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  isOnline?: () => boolean;
}

export interface DownloadResult {
  totalChunks: number;
  /** Tramos descargados en esta ejecución. */
  downloaded: number;
  /** Tramos que ya estaban en disco y se reutilizaron. */
  reused: number;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const defaultIsOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine;

interface RangeResponse {
  headers: Headers;
  data: ArrayBuffer;
}

/**
 * Descarga una canción por tramos con `Range` y los guarda en el almacén.
 * Reanuda: los tramos que ya están en disco no se vuelven a pedir. Si el ETag cambió, descarta lo guardado.
 */
export async function downloadTrack(options: DownloadOptions): Promise<DownloadResult> {
  const { key, url, store, signal, onProgress } = options;
  const chunkBytes = options.chunkBytes ?? DEFAULT_CHUNK_BYTES;
  const doFetch = options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const sleep = options.sleep ?? defaultSleep;
  const isOnline = options.isOnline ?? defaultIsOnline;
  const maxRetries = options.maxRetries ?? 3;

  const requestRange = async (start: number, end: number): Promise<RangeResponse> => {
    const expected = end - start + 1;
    for (let attempt = 0; ; attempt += 1) {
      if (signal?.aborted) throw new DownloadError('aborted', 'La descarga se canceló.');
      if (!isOnline()) throw new DownloadError('offline', 'Sin conexión: la descarga queda en pausa.');
      try {
        const response = await doFetch(url, { headers: { Range: `bytes=${start}-${end}` }, ...(signal ? { signal } : {}) });
        if (response.status !== 206) {
          const retryable = response.status >= 500 || response.status === 429;
          if (!retryable) throw new DownloadError('http', `El servidor respondió ${response.status}.`);
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.arrayBuffer();
        if (data.byteLength !== expected) throw new Error('Tramo incompleto');
        return { headers: response.headers, data };
      } catch (error) {
        if (error instanceof DownloadError) throw error;
        if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          throw new DownloadError('aborted', 'La descarga se canceló.');
        }
        if (attempt >= maxRetries) {
          throw new DownloadError('corrupt', `No se pudo descargar el tramo tras ${maxRetries + 1} intentos.`);
        }
        await sleep(300 * 2 ** attempt);
      }
    }
  };

  // 1) Averigua el tamaño total y la versión del archivo con una petición de 1 byte.
  const probe = await requestRange(0, 0);
  const totalBytes = parseContentRangeTotal(probe.headers.get('Content-Range'));
  if (totalBytes === null) throw new DownloadError('http', 'El servidor no informó el tamaño del archivo.');
  const version = probe.headers.get('ETag') ?? `size-${totalBytes}`;

  // 2) Si cambió el archivo en el servidor, lo guardado ya no sirve.
  const previous = await store.getMeta(key);
  if (previous && (previous.version !== version || previous.totalBytes !== totalBytes || previous.chunkBytes !== chunkBytes)) {
    await store.deleteTrack(key);
  }
  await store.putMeta({ key, totalBytes, chunkBytes, version, lastAccess: Date.now() });

  // 3) Descarga solo los tramos que faltan.
  const total = chunkCount(totalBytes, chunkBytes);
  const stored = new Set((await store.chunkIndexes(key)).filter((index) => index < total));
  const reused = stored.size;
  let downloaded = 0;
  onProgress?.(stored.size, total);

  for (let index = 0; index < total; index += 1) {
    if (stored.has(index)) continue;
    const { start, end } = chunkRange(index, totalBytes, chunkBytes);
    const { data } = await requestRange(start, end);
    try {
      await store.putChunk(key, index, data);
    } catch {
      throw new DownloadError('storage', 'No hay espacio disponible para guardar la canción.');
    }
    stored.add(index);
    downloaded += 1;
    onProgress?.(stored.size, total);
  }

  return { totalChunks: total, downloaded, reused };
}