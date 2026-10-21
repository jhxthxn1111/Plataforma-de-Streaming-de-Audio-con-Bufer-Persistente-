/** Datos de una canción guardada (o a medio guardar) en el navegador. La clave es el nombre del archivo. */
export interface CachedTrackMeta {
  key: string;
  totalBytes: number;
  chunkBytes: number;
  /** ETag del servidor: si cambia, los tramos guardados ya no sirven. */
  version: string;
  lastAccess: number;
}

export interface ChunkStore {
  getMeta(key: string): Promise<CachedTrackMeta | null>;
  putMeta(meta: CachedTrackMeta): Promise<void>;
  listMetas(): Promise<CachedTrackMeta[]>;
  getChunk(key: string, index: number): Promise<ArrayBuffer | null>;
  putChunk(key: string, index: number, data: ArrayBuffer): Promise<void>;
  /** Números de los tramos guardados, en orden ascendente. */
  chunkIndexes(key: string): Promise<number[]>;
  deleteTrack(key: string): Promise<void>;
}

/** Implementación en memoria: sirve para pruebas. No sobrevive a recargar la página. */
export class MemoryChunkStore implements ChunkStore {
  private readonly metas = new Map<string, CachedTrackMeta>();
  private readonly chunks = new Map<string, Map<number, ArrayBuffer>>();

  getMeta(key: string): Promise<CachedTrackMeta | null> {
    const meta = this.metas.get(key);
    return Promise.resolve(meta ? { ...meta } : null);
  }

  putMeta(meta: CachedTrackMeta): Promise<void> {
    this.metas.set(meta.key, { ...meta });
    return Promise.resolve();
  }

  listMetas(): Promise<CachedTrackMeta[]> {
    return Promise.resolve([...this.metas.values()].map((meta) => ({ ...meta })));
  }

  getChunk(key: string, index: number): Promise<ArrayBuffer | null> {
    return Promise.resolve(this.chunks.get(key)?.get(index) ?? null);
  }

  putChunk(key: string, index: number, data: ArrayBuffer): Promise<void> {
    const bucket = this.chunks.get(key) ?? new Map<number, ArrayBuffer>();
    bucket.set(index, data);
    this.chunks.set(key, bucket);
    return Promise.resolve();
  }

  chunkIndexes(key: string): Promise<number[]> {
    return Promise.resolve([...(this.chunks.get(key)?.keys() ?? [])].sort((a, b) => a - b));
  }

  deleteTrack(key: string): Promise<void> {
    this.metas.delete(key);
    this.chunks.delete(key);
    return Promise.resolve();
  }
}

const DB_NAME = 'musica-offline-cache';
const DB_VERSION = 1;
const META_STORE = 'meta';
const CHUNK_STORE = 'chunks';

interface ChunkRecord {
  key: string;
  index: number;
  data: ArrayBuffer;
}

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Falló una operación de IndexedDB'));
  });

const transactionDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falló una transacción de IndexedDB'));
    tx.onabort = () => reject(tx.error ?? new Error('Se canceló una transacción de IndexedDB'));
  });

export const isIndexedDbAvailable = (): boolean => typeof indexedDB !== 'undefined' && indexedDB !== null;

/** Almacén persistente en IndexedDB: los tramos sobreviven a recargas y a cerrar el navegador. */
export class IndexedDbChunkStore implements ChunkStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const opening = indexedDB.open(DB_NAME, DB_VERSION);
        opening.onupgradeneeded = () => {
          const db = opening.result;
          db.createObjectStore(META_STORE, { keyPath: 'key' });
          db.createObjectStore(CHUNK_STORE, { keyPath: ['key', 'index'] });
        };
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error ?? new Error('No se pudo abrir IndexedDB'));
      }).catch((error: unknown) => {
        this.dbPromise = null; // permite reintentar la próxima vez
        throw error;
      });
    }
    return this.dbPromise;
  }

  private static range(key: string): IDBKeyRange {
    return IDBKeyRange.bound([key, 0], [key, Number.MAX_SAFE_INTEGER]);
  }

  async getMeta(key: string): Promise<CachedTrackMeta | null> {
    const db = await this.db();
    const value = (await request(db.transaction(META_STORE).objectStore(META_STORE).get(key))) as CachedTrackMeta | undefined;
    return value ?? null;
  }

  async putMeta(meta: CachedTrackMeta): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put(meta);
    await transactionDone(tx);
  }

  async listMetas(): Promise<CachedTrackMeta[]> {
    const db = await this.db();
    return (await request(db.transaction(META_STORE).objectStore(META_STORE).getAll())) as CachedTrackMeta[];
  }

  async getChunk(key: string, index: number): Promise<ArrayBuffer | null> {
    const db = await this.db();
    const record = (await request(db.transaction(CHUNK_STORE).objectStore(CHUNK_STORE).get([key, index]))) as ChunkRecord | undefined;
    return record?.data ?? null;
  }

  async putChunk(key: string, index: number, data: ArrayBuffer): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(CHUNK_STORE, 'readwrite');
    const record: ChunkRecord = { key, index, data };
    tx.objectStore(CHUNK_STORE).put(record);
    await transactionDone(tx);
  }

  async chunkIndexes(key: string): Promise<number[]> {
    const db = await this.db();
    const keys = await request(db.transaction(CHUNK_STORE).objectStore(CHUNK_STORE).getAllKeys(IndexedDbChunkStore.range(key)));
    const indexes: number[] = [];
    for (const entry of keys) {
      if (Array.isArray(entry) && typeof entry[1] === 'number') indexes.push(entry[1]);
    }
    return indexes;
  }

  async deleteTrack(key: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction([META_STORE, CHUNK_STORE], 'readwrite');
    tx.objectStore(CHUNK_STORE).delete(IndexedDbChunkStore.range(key));
    tx.objectStore(META_STORE).delete(key);
    await transactionDone(tx);
  }
}