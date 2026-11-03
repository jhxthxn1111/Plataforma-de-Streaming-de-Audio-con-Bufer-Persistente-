import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/api/playlists';
import type { PlaylistDetail, PlaylistSummary } from '@/api/playlists';
import { usePlaylistsStore } from '../playlists.store';

vi.mock('@/api/playlists', () => ({
  listPlaylists: vi.fn(),
  getPlaylist: vi.fn(),
  createPlaylist: vi.fn(),
  renamePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  addTrackToPlaylist: vi.fn(),
  removeTrackFromPlaylist: vi.fn(),
}));

const NOW = '2026-11-03T10:00:00.000Z';
const summary = (id: string, name: string, trackCount = 0): PlaylistSummary => ({ id, name, trackCount, createdAt: NOW, updatedAt: NOW });
const detail = (id: string, name: string, keys: string[] = []): PlaylistDetail => ({
  id,
  name,
  createdAt: NOW,
  updatedAt: NOW,
  tracks: keys.map((trackKey) => ({ trackKey, addedAt: NOW })),
});

describe('usePlaylistsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.resetAllMocks();
  });

  it('carga la lista de playlists', async () => {
    vi.mocked(api.listPlaylists).mockResolvedValue([summary('1', 'Rock'), summary('2', 'Pop')]);
    const store = usePlaylistsStore();
    await store.fetchAll();
    expect(store.summaries.map((p) => p.name)).toEqual(['Rock', 'Pop']);
    expect(store.loadingList).toBe(false);
    expect(store.listError).toBe('');
  });

  it('guarda un mensaje legible si la lista falla', async () => {
    vi.mocked(api.listPlaylists).mockRejectedValue(new Error('boom'));
    const store = usePlaylistsStore();
    await store.fetchAll();
    expect(store.listError).not.toBe('');
    expect(store.loadingList).toBe(false);
  });

  it('crea una playlist, la agrega a la lista y la deja seleccionada', async () => {
    vi.mocked(api.createPlaylist).mockResolvedValue(summary('1', 'Nueva'));
    vi.mocked(api.getPlaylist).mockResolvedValue(detail('1', 'Nueva'));
    const store = usePlaylistsStore();

    expect(await store.create('Nueva')).toBe(true);
    expect(store.summaries).toHaveLength(1);
    expect(store.selectedId).toBe('1');
    expect(store.selected?.name).toBe('Nueva');
  });

  it('si crear falla, muestra el error y devuelve false', async () => {
    vi.mocked(api.createPlaylist).mockRejectedValue(new Error('nombre repetido'));
    const store = usePlaylistsStore();
    expect(await store.create('Rock')).toBe(false);
    expect(store.actionError).not.toBe('');
    expect(store.busy).toBe(false);
  });

  it('al agregar una canción actualiza el detalle y el contador de la lista', async () => {
    vi.mocked(api.listPlaylists).mockResolvedValue([summary('1', 'Rock')]);
    vi.mocked(api.getPlaylist).mockResolvedValue(detail('1', 'Rock'));
    vi.mocked(api.addTrackToPlaylist).mockResolvedValue(detail('1', 'Rock', ['cancion.mp3']));
    const store = usePlaylistsStore();
    await store.fetchAll();
    await store.select('1');

    await store.addTrack('1', 'cancion.mp3');

    expect(store.selected?.tracks.map((t) => t.trackKey)).toEqual(['cancion.mp3']);
    expect(store.summaries[0]?.trackCount).toBe(1);
  });

  it('al quitar una canción actualiza el detalle y el contador', async () => {
    vi.mocked(api.listPlaylists).mockResolvedValue([summary('1', 'Rock', 2)]);
    vi.mocked(api.getPlaylist).mockResolvedValue(detail('1', 'Rock', ['a.mp3', 'b.mp3']));
    vi.mocked(api.removeTrackFromPlaylist).mockResolvedValue(undefined);
    const store = usePlaylistsStore();
    await store.fetchAll();
    await store.select('1');

    await store.removeTrack('1', 'a.mp3');

    expect(store.selected?.tracks.map((t) => t.trackKey)).toEqual(['b.mp3']);
    expect(store.summaries[0]?.trackCount).toBe(1);
  });

  it('al renombrar actualiza el nombre en la lista', async () => {
    vi.mocked(api.listPlaylists).mockResolvedValue([summary('1', 'Rock')]);
    vi.mocked(api.renamePlaylist).mockResolvedValue(detail('1', 'Rock clásico'));
    const store = usePlaylistsStore();
    await store.fetchAll();

    await store.rename('1', 'Rock clásico');

    expect(store.summaries[0]?.name).toBe('Rock clásico');
  });

  it('al borrar la playlist abierta pasa a la siguiente', async () => {
    vi.mocked(api.listPlaylists).mockResolvedValue([summary('1', 'Rock'), summary('2', 'Pop')]);
    vi.mocked(api.getPlaylist).mockImplementation(async (id) => detail(id, id === '1' ? 'Rock' : 'Pop'));
    vi.mocked(api.deletePlaylist).mockResolvedValue(undefined);
    const store = usePlaylistsStore();
    await store.fetchAll();
    await store.select('1');

    await store.remove('1');

    expect(store.summaries.map((p) => p.id)).toEqual(['2']);
    expect(store.selectedId).toBe('2');
    expect(store.details['1']).toBeUndefined();
  });

  it('al recargar descarta la selección de una playlist que ya no existe', async () => {
    vi.mocked(api.listPlaylists).mockResolvedValueOnce([summary('1', 'Rock')]).mockResolvedValueOnce([]);
    vi.mocked(api.getPlaylist).mockResolvedValue(detail('1', 'Rock'));
    const store = usePlaylistsStore();
    await store.fetchAll();
    await store.select('1');

    await store.fetchAll();

    expect(store.selectedId).toBeNull();
    expect(store.selected).toBeNull();
  });
});
