<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import StatePanel from '@/components/StatePanel.vue';
import TrackRow from '@/components/TrackRow.vue';
import IconGlyph from '@/components/IconGlyph.vue';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';

const library = useLibraryStore();
const player = usePlayerStore();

const search = ref(library.query);
let debounce: ReturnType<typeof setTimeout> | null = null;

function onSearch(): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => void library.setQuery(search.value.trim()), 300);
}

function isQueued(id: string): boolean {
  return player.queue.some((t) => t.id === id);
}

onMounted(() => void library.load());
onBeforeUnmount(() => {
  if (debounce) clearTimeout(debounce);
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>Explorar</h1>
      <p>Toca una canción y sigue navegando: el reproductor no se detiene.</p>
    </header>

    <div class="tools">
      <div class="search">
        <label class="sr-only" for="q">Buscar por título, artista o álbum</label>
        <input id="q" v-model="search" type="search" placeholder="Buscar por título, artista o álbum" @input="onSearch" />
      </div>
      <div class="genres" role="group" aria-label="Filtrar por género">
        <button type="button" class="chip" :aria-pressed="library.genre === ''" @click="library.setGenre('')">Todos</button>
        <button
          v-for="g in library.genres"
          :key="g"
          type="button"
          class="chip"
          :aria-pressed="library.genre === g"
          @click="library.setGenre(g)"
        >
          {{ g }}
        </button>
      </div>
    </div>

    <StatePanel v-if="library.status === 'loading'" kind="loading" title="Cargando catálogo…" />
    <StatePanel v-else-if="library.status === 'error'" kind="error" title="No pudimos cargar el catálogo" :message="library.error ?? undefined">
      <button type="button" class="btn" @click="library.load()">Reintentar</button>
    </StatePanel>
    <StatePanel
      v-else-if="library.status === 'ready' && library.items.length === 0"
      kind="empty"
      title="Sin resultados"
      message="Prueba con otro nombre o quita el filtro de género."
    />
    <template v-else-if="library.status === 'ready'">
      <ul class="list">
        <TrackRow
          v-for="track in library.items"
          :key="track.id"
          :track="track"
          :active="player.currentTrack?.id === track.id"
          :playing="player.currentTrack?.id === track.id && player.isPlaying"
          :queued="isQueued(track.id)"
          @play="player.playTrack(track, library.items)"
          @enqueue="player.enqueue(track)"
        />
      </ul>
      <div class="more">
        <p class="muted">Mostrando {{ library.items.length }} de {{ library.total }}</p>
        <button v-if="library.hasMore" type="button" class="btn" :disabled="library.loadingMore" @click="library.loadMore()">
          <IconGlyph name="plus" /> {{ library.loadingMore ? 'Cargando…' : 'Cargar más' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tools {
  display: grid;
  gap: 0.75rem;
}
.genres {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.chip {
  min-height: 36px;
  padding: 0 0.9rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  cursor: pointer;
  font-weight: 600;
}
.chip[aria-pressed='true'] {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--surface);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
</style>
