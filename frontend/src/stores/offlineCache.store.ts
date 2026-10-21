import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { describeCache, assembleTrackBlob } from '../services/cachedAudio';
import { DownloadError, downloadTrack } from '../services/chunkDownloader';
import { IndexedDbChunkStore, isIndexedDbAvailable } from '../services/chunkStore';
import { getStreamUrl, getCleanBaseUrl } from '../services/audioUrl';
import type { Track } from './audioPlayer.store';

export type OfflineStatus = 'none' | 'partial' | 'complete' | 'downloading' | 'error';

export interface OfflineEntry {
  key: string;
  storedChunks: number;
  totalChunks: number;
  bytes: number;
  complete: boolean;
  lastAccess: number;
}

/** Tope de espacio que usa la caché de audio. Al superarlo se borra lo menos usado. */
export const MAX_CACHE_BYTES = 200 * 1024 * 1024;
const AUTO_CACHE_KEY = 'offline_auto_cache_v1';

const readAutoCache = (): boolean => {
  try {
    return localStorage.getItem(AUTO_CACHE_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const useOfflineCacheStore = defineStore('offlineCache', () => {
  const chunkStore = isIndexedDbAvailable() ? new IndexedDbChunkStore() : null;
  const storageAvailable = chunkStore !== null;

  const entries = ref<Record<string, OfflineEntry>>({});
  const progress = ref<Record<string, number>>({});
  const errors = ref<Record<string, string>>({});
  const isOnline = ref<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  const autoCache = ref<boolean>(readAutoCache());
  const persistent = ref<boolean>(false);
  const controllers = new Map<string, AbortController>();

  const usedBytes = computed(() => Object.values(entries.value).reduce((sum, entry) => sum + entry.bytes, 0));
  const completeCount = computed(() => Object.values(entries.value).filter((entry) => entry.complete).length);

  const refreshEntry = async (key: string): Promise<void> => {
    if (!chunkStore) return;
    const meta = await chunkStore.getMeta(key);
    if (!meta) {
      delete entries.value[key];
      return;
    }
    const status = describeCache(meta, await chunkStore.chunkIndexes(key));
    entries.value[key] = { key, ...status, lastAccess: meta.lastAccess };
  };

  const refresh = async (): Promise<void> => {
    if (!chunkStore) return;
    const metas = await chunkStore.listMetas();
    const next: Record<string, OfflineEntry> = {};
    for (const meta of metas) {
      const status = describeCache(meta, await chunkStore.chunkIndexes(meta.key));
      next[meta.key] = { key: meta.key, ...status, lastAccess: meta.lastAccess };
    }
    entries.value = next;
  };

  const readyPromise: Promise<void> = refresh().catch(() => {
    // Si IndexedDB falla, el reproductor sigue funcionando por streaming.
  });

  /** Se resuelve cuando ya se leyó lo guardado en disco. */
  const whenReady = (): Promise<void> => readyPromise;

  const requestPersistence = async (): Promise<void> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
        persistent.value = (await navigator.storage.persisted?.()) || (await navigator.storage.persist());
      }
    } catch {
      persistent.value = false;
    }
  };

  const enforceQuota = async (keepKey: string): Promise<void> => {
    if (!chunkStore) return;
    while (usedBytes.value > MAX_CACHE_BYTES) {
      const victim = Object.values(entries.value)
        .filter((entry) => entry.key !== keepKey && !controllers.has(entry.key))
        .sort((a, b) => a.lastAccess - b.lastAccess)[0];
      if (!victim) return;
      await chunkStore.deleteTrack(victim.key);
      await refreshEntry(victim.key);
    }
  };

  const download = async (track: Track): Promise<void> => {
    if (!chunkStore) return;
    const key = track.fileName;
    if (controllers.has(key)) return;
    if (!isOnline.value) {
      if (!entries.value[key]?.complete) errors.value[key] = 'Sin conexión: no se puede descargar ahora.';
      return;
    }

    const controller = new AbortController();
    controllers.set(key, controller);
    delete errors.value[key];
    const known = entries.value[key];
    progress.value[key] = known && known.totalChunks > 0 ? known.storedChunks / known.totalChunks : 0;
    await requestPersistence();

    try {
      // Pedir el ticket HMAC de seguridad antes de descargar
      let signedUrl = getStreamUrl(key);
      try {
          const res = await fetch(`${getCleanBaseUrl()}/api/audio/ticket/${encodeURIComponent(key)}`);
          const data = await res.json();
          if (data.success && data.ticketUrl) {
              signedUrl = `${getCleanBaseUrl()}${data.ticketUrl}`;
          }
      } catch (e) {
          console.warn("No se pudo obtener firma para descarga offline", e);
      }

      await downloadTrack({
        key,
        url: signedUrl, 
        store: chunkStore,
        signal: controller.signal,
        isOnline: () => isOnline.value,
        onProgress: (stored, total) => {
          progress.value[key] = total > 0 ? stored / total : 0;
        },
      });
      await refreshEntry(key);
      await enforceQuota(key);
    } catch (error) {
      await refreshEntry(key);
      if (error instanceof DownloadError && error.code === 'aborted') return;
      errors.value[key] = error instanceof Error ? error.message : 'No se pudo guardar la canción.';
    } finally {
      controllers.delete(key);
      delete progress.value[key];
    }
  };

  const cancel = (track: Track): void => {
    controllers.get(track.fileName)?.abort();
  };

  const remove = async (track: Track): Promise<void> => {
    if (!chunkStore) return;
    const key = track.fileName;
    controllers.get(key)?.abort();
    await chunkStore.deleteTrack(key);
    await refreshEntry(key);
    delete errors.value[key];
  };

  /** Devuelve una URL temporal con la canción completa en disco, o null si no está completa. El llamador debe liberarla. */
  const getBlobUrl = async (track: Track): Promise<string | null> => {
    if (!chunkStore) return null;
    await readyPromise;
    if (!entries.value[track.fileName]?.complete) return null;
    const blob = await assembleTrackBlob(chunkStore, track.fileName);
    if (!blob) return null;
    const meta = await chunkStore.getMeta(track.fileName);
    if (meta) await chunkStore.putMeta({ ...meta, lastAccess: Date.now() });
    return URL.createObjectURL(blob);
  };

  const setAutoCache = (value: boolean): void => {
    autoCache.value = value;
    try {
      localStorage.setItem(AUTO_CACHE_KEY, String(value));
    } catch {
      // Ignorar errores de cuota
    }
  };

  const statusOf = (fileName: string): OfflineStatus => {
    if (fileName in progress.value) return 'downloading';
    if (errors.value[fileName]) return 'error';
    const entry = entries.value[fileName];
    if (entry?.complete) return 'complete';
    if (entry && entry.storedChunks > 0) return 'partial';
    return 'none';
  };

  /** Porcentaje (0-100) de la canción que está en disco. */
  const percentOf = (fileName: string): number => {
    const live = progress.value[fileName];
    if (live !== undefined) return Math.round(live * 100);
    const entry = entries.value[fileName];
    return entry && entry.totalChunks > 0 ? Math.round((entry.storedChunks / entry.totalChunks) * 100) : 0;
  };

  const errorOf = (fileName: string): string | null => errors.value[fileName] ?? null;

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      isOnline.value = true;
    });
    window.addEventListener('offline', () => {
      isOnline.value = false;
    });
  }

  return {
    storageAvailable,
    entries,
    progress,
    isOnline,
    autoCache,
    persistent,
    usedBytes,
    completeCount,
    whenReady,
    download,
    cancel,
    remove,
    getBlobUrl,
    setAutoCache,
    statusOf,
    percentOf,
    errorOf,
    refresh,
  };
});