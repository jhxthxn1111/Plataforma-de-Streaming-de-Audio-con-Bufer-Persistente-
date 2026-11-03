<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import StatePanel from '@/components/StatePanel.vue';
import { useAudioPlayerStore } from '@/stores/audioPlayer.store';
import { usePlaylistsStore } from '@/stores/playlists.store';

const store = usePlaylistsStore();
const player = useAudioPlayerStore();

const newName = ref('');
const renaming = ref(false);
const renameValue = ref('');
const trackToAdd = ref('');

onMounted(async () => {
  void player.fetchLocalCatalog();
  await store.fetchAll();
  const first = store.summaries[0];
  if (!store.selectedId && first) await store.select(first.id);
});

/** Datos de una canción del catálogo a partir de su nombre de archivo. */
const trackInfo = (key: string) => player.catalog.find((t) => t.fileName === key);

/** Canciones del catálogo que todavía no están en la playlist abierta. */
const availableToAdd = computed(() => {
  const inside = new Set(store.selected?.tracks.map((t) => t.trackKey) ?? []);
  return player.catalog.filter((t) => !inside.has(t.fileName));
});

// Al cambiar de playlist se cierra el modo renombrar y se reinicia el selector.
watch(
  () => store.selectedId,
  () => {
    renaming.value = false;
    trackToAdd.value = '';
  },
);
watch(availableToAdd, (list) => {
  if (!list.some((t) => t.fileName === trackToAdd.value)) trackToAdd.value = list[0]?.fileName ?? '';
}, { immediate: true });

const countLabel = (n: number): string => `${n} ${n === 1 ? 'canción' : 'canciones'}`;

async function onCreate(): Promise<void> {
  if (await store.create(newName.value.trim())) newName.value = '';
}

function startRename(): void {
  renameValue.value = store.selected?.name ?? '';
  renaming.value = true;
}

async function saveRename(): Promise<void> {
  const id = store.selectedId;
  if (!id) return;
  if (await store.rename(id, renameValue.value.trim())) renaming.value = false;
}

async function onDelete(): Promise<void> {
  const playlist = store.selected;
  if (!playlist) return;
  if (window.confirm(`¿Borrar la playlist "${playlist.name}"? Esta acción no se puede deshacer.`)) {
    await store.remove(playlist.id);
  }
}

async function onAdd(): Promise<void> {
  if (store.selectedId && trackToAdd.value) await store.addTrack(store.selectedId, trackToAdd.value);
}

async function onRemoveTrack(trackKey: string): Promise<void> {
  if (store.selectedId) await store.removeTrack(store.selectedId, trackKey);
}

function playFirst(): void {
  const first = store.selected?.tracks.find((t) => trackInfo(t.trackKey));
  if (first) void player.playTrack(first.trackKey);
}
</script>

<template>
  <div class="page playlists">
    <header class="page-head">
      <h1>Mis playlists</h1>
      <p>Crea listas con tus canciones. Solo tú puedes verlas y editarlas.</p>
    </header>

    <form class="create" @submit.prevent="onCreate">
      <input v-model="newName" type="text" maxlength="80" placeholder="Nombre de la nueva playlist" aria-label="Nombre de la nueva playlist" autocomplete="off" />
      <button type="submit" class="btn btn-primary" :disabled="store.busy || !newName.trim()">Crear</button>
    </form>
    <p v-if="store.actionError" class="field-error" role="alert">{{ store.actionError }}</p>

    <StatePanel v-if="store.loadingList && store.summaries.length === 0" kind="loading" title="Cargando tus playlists…" />

    <StatePanel v-else-if="store.listError && store.summaries.length === 0" kind="error" title="No pudimos cargar tus playlists" :message="store.listError">
      <button type="button" class="btn" @click="store.fetchAll()">Reintentar</button>
    </StatePanel>

    <StatePanel v-else-if="store.summaries.length === 0" kind="empty" title="Aún no tienes playlists" message="Escribe un nombre arriba y crea la primera." />

    <div v-else class="layout">
      <ul class="list" aria-label="Tus playlists">
        <li v-for="playlist in store.summaries" :key="playlist.id">
          <button type="button" class="item" :aria-current="playlist.id === store.selectedId" @click="store.select(playlist.id)">
            <strong>{{ playlist.name }}</strong>
            <span class="muted">{{ countLabel(playlist.trackCount) }}</span>
          </button>
        </li>
      </ul>

      <section class="detail" aria-live="polite">
        <StatePanel v-if="store.loadingDetail && !store.selected" kind="loading" title="Abriendo la playlist…" />

        <StatePanel v-else-if="store.detailError && !store.selected" kind="error" title="No pudimos abrir la playlist" :message="store.detailError">
          <button type="button" class="btn" @click="store.selectedId && store.select(store.selectedId)">Reintentar</button>
        </StatePanel>

        <template v-else-if="store.selected">
          <div class="detail-head">
            <form v-if="renaming" class="rename" @submit.prevent="saveRename">
              <input v-model="renameValue" type="text" maxlength="80" aria-label="Nuevo nombre" />
              <button type="submit" class="btn btn-primary" :disabled="store.busy || !renameValue.trim()">Guardar</button>
              <button type="button" class="btn" @click="renaming = false">Cancelar</button>
            </form>
            <template v-else>
              <h2>{{ store.selected.name }}</h2>
              <div class="actions">
                <button type="button" class="btn btn-primary" :disabled="store.selected.tracks.length === 0" @click="playFirst">Reproducir</button>
                <button type="button" class="btn" @click="startRename">Renombrar</button>
                <button type="button" class="btn danger" :disabled="store.busy" @click="onDelete">Borrar</button>
              </div>
            </template>
          </div>

          <p v-if="store.selected.tracks.length === 0" class="muted">Esta playlist está vacía. Agrega una canción desde el selector de abajo.</p>

          <ol v-else class="tracks">
            <li v-for="(track, index) in store.selected.tracks" :key="track.trackKey">
              <span class="rank" aria-hidden="true">{{ index + 1 }}</span>
              <div class="info">
                <strong>{{ trackInfo(track.trackKey)?.title ?? track.trackKey }}</strong>
                <span class="muted">{{ trackInfo(track.trackKey)?.artist ?? 'No disponible en el catálogo' }}</span>
              </div>
              <button type="button" class="btn" :disabled="!trackInfo(track.trackKey)" @click="player.playTrack(track.trackKey)">Reproducir</button>
              <button type="button" class="btn" :disabled="store.busy" :aria-label="`Quitar ${trackInfo(track.trackKey)?.title ?? track.trackKey}`" @click="onRemoveTrack(track.trackKey)">Quitar</button>
            </li>
          </ol>

          <form class="add" @submit.prevent="onAdd">
            <select v-model="trackToAdd" aria-label="Canción a agregar" :disabled="availableToAdd.length === 0">
              <option v-for="track in availableToAdd" :key="track.fileName" :value="track.fileName">{{ track.title }}</option>
            </select>
            <button type="submit" class="btn" :disabled="store.busy || !trackToAdd">Agregar canción</button>
          </form>
          <p v-if="availableToAdd.length === 0" class="muted">Ya agregaste todas las canciones del catálogo.</p>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.create,
.rename,
.add {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.create input,
.rename input,
.add select {
  flex: 1 1 220px;
  min-width: 0;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  font: inherit;
}
.add select option {
  color: #000;
}

.layout {
  display: grid;
  grid-template-columns: minmax(200px, 280px) 1fr;
  gap: 1.25rem;
  align-items: start;
}
@media (max-width: 720px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.item {
  display: grid;
  width: 100%;
  gap: 0.15rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.item[aria-current='true'] {
  border-color: var(--ink);
}

.detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}
.detail-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}
.detail-head h2 {
  margin: 0;
  overflow-wrap: anywhere;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.danger {
  border-color: var(--danger);
  color: var(--danger);
}

.tracks {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tracks li {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--line);
}
.rank {
  width: 1.5rem;
  text-align: center;
  opacity: 0.6;
}
.info {
  display: grid;
  flex: 1;
  min-width: 0;
}
</style>
