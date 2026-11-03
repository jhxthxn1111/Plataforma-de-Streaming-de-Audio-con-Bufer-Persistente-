import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import * as playlistsApi from '@/api/playlists';
import type { PlaylistDetail, PlaylistSummary } from '@/api/playlists';
import { toAppError } from '@/api/errors';

export const usePlaylistsStore = defineStore('playlists', () => {
  // Estado normalizado: un resumen liviano por playlist y el detalle guardado aparte por id.
  const summaries = ref<PlaylistSummary[]>([]);
  const details = ref<Record<string, PlaylistDetail>>({});
  const selectedId = ref<string | null>(null);

  // Estados explícitos de carga y error, para que la vista muestre feedback claro.
  const loadingList = ref(false);
  const loadingDetail = ref(false);
  const busy = ref(false);
  const listError = ref('');
  const detailError = ref('');
  const actionError = ref('');

  const selected = computed<PlaylistDetail | null>(() => (selectedId.value ? (details.value[selectedId.value] ?? null) : null));

  /** Mantiene el resumen (nombre y contador) igual al detalle recién recibido. */
  function syncSummary(detail: PlaylistDetail): void {
    const index = summaries.value.findIndex((p) => p.id === detail.id);
    const current = summaries.value[index];
    if (index < 0 || !current) return;
    summaries.value[index] = { ...current, name: detail.name, trackCount: detail.tracks.length, updatedAt: detail.updatedAt };
  }

  function setDetail(detail: PlaylistDetail): void {
    details.value[detail.id] = detail;
    syncSummary(detail);
  }

  async function fetchAll(): Promise<void> {
    loadingList.value = true;
    listError.value = '';
    try {
      const items = await playlistsApi.listPlaylists();
      summaries.value = items;
      // Descarta lo que ya no existe (por ejemplo, si otra persona inició sesión en este navegador).
      const ids = new Set(items.map((p) => p.id));
      details.value = Object.fromEntries(Object.entries(details.value).filter(([id]) => ids.has(id)));
      if (selectedId.value && !ids.has(selectedId.value)) selectedId.value = null;
    } catch (error) {
      listError.value = toAppError(error).message;
    } finally {
      loadingList.value = false;
    }
  }

  async function select(id: string): Promise<void> {
    selectedId.value = id;
    detailError.value = '';
    actionError.value = '';
    loadingDetail.value = true;
    try {
      const detail = await playlistsApi.getPlaylist(id);
      if (selectedId.value === id) setDetail(detail);
    } catch (error) {
      if (selectedId.value === id) detailError.value = toAppError(error).message;
    } finally {
      if (selectedId.value === id) loadingDetail.value = false;
    }
  }

  /** Ejecuta una acción que modifica datos, con un único manejo de "ocupado" y de errores. */
  async function runAction(action: () => Promise<void>): Promise<boolean> {
    busy.value = true;
    actionError.value = '';
    try {
      await action();
      return true;
    } catch (error) {
      actionError.value = toAppError(error).message;
      return false;
    } finally {
      busy.value = false;
    }
  }

  function create(name: string): Promise<boolean> {
    return runAction(async () => {
      const created = await playlistsApi.createPlaylist(name);
      summaries.value.push(created);
      await select(created.id);
    });
  }

  function rename(id: string, name: string): Promise<boolean> {
    return runAction(async () => {
      setDetail(await playlistsApi.renamePlaylist(id, name));
    });
  }

  function remove(id: string): Promise<boolean> {
    return runAction(async () => {
      await playlistsApi.deletePlaylist(id);
      summaries.value = summaries.value.filter((p) => p.id !== id);
      delete details.value[id];
      if (selectedId.value === id) {
        selectedId.value = null;
        const next = summaries.value[0];
        if (next) await select(next.id);
      }
    });
  }

  function addTrack(id: string, trackKey: string): Promise<boolean> {
    return runAction(async () => {
      setDetail(await playlistsApi.addTrackToPlaylist(id, trackKey));
    });
  }

  function removeTrack(id: string, trackKey: string): Promise<boolean> {
    return runAction(async () => {
      await playlistsApi.removeTrackFromPlaylist(id, trackKey);
      const current = details.value[id];
      if (current) setDetail({ ...current, tracks: current.tracks.filter((t) => t.trackKey !== trackKey) });
    });
  }

  return {
    summaries, details, selectedId, selected,
    loadingList, loadingDetail, busy, listError, detailError, actionError,
    fetchAll, select, create, rename, remove, addTrack, removeTrack,
  };
});
