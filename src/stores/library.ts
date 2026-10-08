import { computed, ref } from 'vue';
import axios from 'axios';
import { defineStore } from 'pinia';
import type { Track } from '@/api/contracts';
import { toAppError } from '@/api/errors';
import { listGenres, listTracks } from '@/api/tracks';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

const PAGE_SIZE = 8;

export const useLibraryStore = defineStore('library', () => {
  const items = ref<Track[]>([]);
  const total = ref(0);
  const page = ref(1);
  const query = ref('');
  const genre = ref('');
  const genres = ref<string[]>([]);
  const status = ref<LoadStatus>('idle');
  const loadingMore = ref(false);
  const error = ref<string | null>(null);

  const hasMore = computed(() => items.value.length < total.value);

  let controller: AbortController | null = null;
  let requestId = 0;

  async function fetchPage(nextPage: number, append: boolean): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    requestId += 1;
    const current = requestId;

    error.value = null;
    if (append) loadingMore.value = true;
    else status.value = 'loading';

    try {
      const result = await listTracks(
        { q: query.value || undefined, genre: genre.value || undefined, page: nextPage, pageSize: PAGE_SIZE },
        controller.signal,
      );
      if (current !== requestId) return;
      items.value = append ? [...items.value, ...result.items] : result.items;
      total.value = result.total;
      page.value = result.page;
      status.value = 'ready';
    } catch (e) {
      if (axios.isCancel(e) || current !== requestId) return;
      error.value = toAppError(e).message;
      status.value = 'error';
    } finally {
      if (current === requestId) loadingMore.value = false;
    }
  }

  async function load(): Promise<void> {
    await fetchPage(1, false);
    if (genres.value.length === 0) {
      try {
        genres.value = await listGenres();
      } catch {
        // Los géneros son opcionales: si fallan, el catálogo sigue funcionando.
      }
    }
  }

  function loadMore(): Promise<void> {
    return fetchPage(page.value + 1, true);
  }

  function setQuery(value: string): Promise<void> {
    query.value = value;
    return fetchPage(1, false);
  }

  function setGenre(value: string): Promise<void> {
    genre.value = value;
    return fetchPage(1, false);
  }

  return { items, total, page, query, genre, genres, status, loadingMore, error, hasMore, load, loadMore, setQuery, setGenre };
});
