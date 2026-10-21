<template>
  <section class="library" aria-label="Biblioteca musical">
    <div class="block">
      <h2 class="block-title">Tu biblioteca</h2>

      <div class="cards">
        <article
          v-for="track in catalog"
          :key="track.id"
          class="card"
          :class="{ 'is-current': currentTrack.id === track.id }"
          @click="playTrack(track)"
        >
          <div class="cover" :style="{ background: track.coverGradient }">
            <svg viewBox="0 0 100 100" class="vinyl" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
              <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-dasharray="6 4" />
              <circle cx="50" cy="50" r="10" fill="rgba(255,255,255,0.85)" />
            </svg>

            <button
              type="button"
              class="fab"
              :class="{ 'is-shown': currentTrack.id === track.id && isPlaying }"
              :aria-label="currentTrack.id === track.id && isPlaying ? `Pausar ${track.title}` : `Reproducir ${track.title}`"
              @click.stop="playTrack(track)"
            >
              <svg v-if="currentTrack.id === track.id && isPlaying" viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z" />
              </svg>
              <svg v-else viewBox="0 0 16 16" width="18" height="18" fill="currentColor" style="margin-left: 2px" aria-hidden="true">
                <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z" />
              </svg>
            </button>
          </div>

          <h3 class="card-title">{{ track.title }}</h3>
          <p class="card-sub">{{ track.artist }}</p>
        </article>
      </div>
    </div>

    <div class="block">
      <div class="block-head">
        <h2 class="block-title">Disponible sin conexión</h2>
        <span class="meta">Búfer de la canción actual: {{ bufferedPercentage }}%</span>
      </div>

      <div class="storage">
        <p v-if="!isOnline" class="warn" role="status">Sin conexión: solo suenan las canciones guardadas en disco.</p>
        <p v-if="!storageAvailable" class="warn">Este navegador no permite guardar audio sin conexión.</p>
        <template v-else>
          <div
            class="meter"
            role="progressbar"
            aria-label="Espacio usado en disco"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="storagePercent"
          >
            <span :style="{ width: storagePercent + '%' }"></span>
          </div>
          <p class="storage-text">
            Usas {{ formatMegabytes(usedBytes) }} de {{ formatMegabytes(MAX_CACHE_BYTES) }}.
            {{ completeCount }} de {{ catalog.length }} canciones suenan sin conexión.
          </p>
          <label class="auto">
            <input type="checkbox" :checked="autoCache" @change="onAutoCacheChange" />
            Guardar en disco lo que escucho
          </label>
        </template>
      </div>

      <div class="tracklist">
        <div class="tracklist-head">
          <span>#</span>
          <span>Canción</span>
          <span class="col-album">Álbum</span>
          <span>Sin conexión</span>
          <span class="col-size">Tamaño</span>
        </div>

        <div
          v-for="(track, idx) in catalog"
          :key="'row-' + track.id"
          class="row"
          :class="{ 'is-current': currentTrack.id === track.id }"
          role="button"
          tabindex="0"
          @click="playTrack(track)"
          @keydown.enter.self.prevent="playTrack(track)"
          @keydown.space.self.prevent="playTrack(track)"
        >
          <span class="row-index">
            <span v-if="currentTrack.id === track.id && isPlaying" class="eq" aria-label="Sonando">ılı</span>
            <span v-else>{{ idx + 1 }}</span>
          </span>

          <div class="row-main">
            <div class="row-cover" :style="{ background: track.coverGradient }"></div>
            <div class="row-text">
              <div class="row-title">{{ track.title }}</div>
              <div class="row-sub">{{ track.artist }}</div>
            </div>
          </div>

          <span class="col-album row-album">{{ track.album }}</span>

          <div class="avail" :class="'is-' + availability(track).state" @click.stop>
            <div class="avail-bar" aria-hidden="true">
              <span :style="{ width: availability(track).pct + '%' }"></span>
            </div>
            <span class="avail-label">{{ availability(track).label }}</span>

            <template v-if="storageAvailable">
              <button v-if="offline.statusOf(track.fileName) === 'downloading'" type="button" class="btn-mini" @click="offline.cancel(track)">Cancelar</button>
              <button v-else-if="offline.statusOf(track.fileName) === 'complete'" type="button" class="btn-mini" @click="offline.remove(track)">Quitar</button>
              <button v-else type="button" class="btn-mini" :disabled="!isOnline" @click="offline.download(track)">Descargar</button>
            </template>

            <span v-if="offline.errorOf(track.fileName)" class="err" role="alert">{{ offline.errorOf(track.fileName) }}</span>
          </div>

          <span class="col-size row-size">{{ formatMegabytes(track.sizeBytes) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAudioPlayer } from '../composables/useAudioPlayer';
import type { Track } from '../stores/audioPlayer.store';
import { MAX_CACHE_BYTES, useOfflineCacheStore } from '../stores/offlineCache.store';

const offline = useOfflineCacheStore();
const { isOnline, autoCache, usedBytes, completeCount } = storeToRefs(offline);
const storageAvailable = offline.storageAvailable;

const { catalog, currentTrack, isPlaying, bufferedPercentage, playTrack } = useAudioPlayer();

const onAutoCacheChange = (event: Event): void => {
  offline.setAutoCache((event.target as HTMLInputElement).checked);
};

const storagePercent = computed(() => Math.min(100, Math.round((usedBytes.value / MAX_CACHE_BYTES) * 100)));

interface Availability {
  pct: number;
  label: string;
  state: 'none' | 'progress' | 'complete';
}

const availability = (track: Track): Availability => {
  const status = offline.statusOf(track.fileName);
  if (status === 'complete') return { pct: 100, label: 'Guardada', state: 'complete' };
  const pct = offline.percentOf(track.fileName);
  if (status === 'downloading') return { pct, label: `Descargando ${pct}%`, state: 'progress' };
  if (status === 'partial') return { pct, label: `Parcial ${pct}%`, state: 'progress' };
  return { pct: 0, label: 'Solo en línea', state: 'none' };
};

const formatMegabytes = (bytes?: number): string => {
  if (bytes === 0) return '0 MB';
  if (!bytes || bytes <= 0) return '4.8 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
</script>

<style scoped>
.library {
  display: grid;
  gap: 2.5rem;
  padding-bottom: calc(var(--player-h) + 1.5rem);
}

.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.block-title {
  margin-bottom: 1rem;
}
.block-head .block-title {
  margin-bottom: 0.75rem;
}
.meta {
  font-size: 0.875rem;
  color: var(--muted);
}

/* ---- Tarjetas ---- */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
  gap: 1rem;
}
.card {
  padding: 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: var(--surface);
  cursor: pointer;
}
.card:hover {
  background: var(--surface-2);
}
.card.is-current {
  border-color: var(--signal);
}
.cover {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1 / 1;
  margin-bottom: 0.75rem;
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.vinyl {
  width: 64%;
  height: 64%;
  opacity: 0.85;
}
.fab {
  position: absolute;
  right: 0.5rem;
  bottom: 0.5rem;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: none;
  border-radius: 50%;
  background: var(--signal);
  color: var(--signal-ink);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  cursor: pointer;
}
.card:hover .fab,
.fab:focus-visible,
.fab.is-shown {
  opacity: 1;
  transform: translateY(0);
}
.card-title {
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-sub {
  margin-top: 0.15rem;
  font-size: 0.8125rem;
  color: var(--muted);
}

/* ---- Almacenamiento ---- */
.storage {
  display: grid;
  gap: 0.6rem;
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.meter {
  height: 0.5rem;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}
.meter span {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: 999px;
  background: var(--buffer);
}
.storage-text {
  font-size: 0.9rem;
  color: var(--muted);
}
.auto {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  width: fit-content;
  font-size: 0.9rem;
  cursor: pointer;
}
.warn {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--buffer);
}

/* ---- Lista de canciones ---- */
.tracklist {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
}
.tracklist-head,
.row {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.8fr) 4.5rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
}
.tracklist-head {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
}
.row {
  border-left: 3px solid transparent;
  cursor: pointer;
}
.row:hover {
  background: var(--surface-2);
}
.row.is-current {
  border-left-color: var(--signal);
  background: var(--surface-2);
}
.row-index {
  font-size: 0.875rem;
  color: var(--muted);
}
.eq {
  font-weight: 900;
  color: var(--signal);
}
.row-main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}
.row-cover {
  flex-shrink: 0;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: var(--radius-sm);
}
.row-text {
  min-width: 0;
}
.row-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-sub,
.row-album,
.row-size {
  font-size: 0.875rem;
  color: var(--muted);
}
.col-size,
.row-size {
  text-align: right;
}

/* ---- Disponibilidad por canción ---- */
.avail {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
}
.avail-bar {
  flex: 1 1 4rem;
  min-width: 3rem;
  height: 0.375rem;
  border-radius: 999px;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
  overflow: hidden;
}
.avail-bar span {
  display: block;
  height: 100%;
  background: var(--buffer);
}
.avail.is-complete .avail-bar span {
  background: var(--ok);
}
.avail-label {
  font-size: 0.8125rem;
  color: var(--muted);
  white-space: nowrap;
}
.avail.is-complete .avail-label {
  color: var(--ok);
  font-weight: 600;
}
.btn-mini {
  padding: 0.15rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  font-size: 0.8125rem;
  cursor: pointer;
}
.btn-mini:hover:not(:disabled) {
  border-color: var(--signal);
  color: var(--signal);
}
.btn-mini:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.err {
  flex-basis: 100%;
  font-size: 0.8125rem;
  color: var(--danger);
}

@media (max-width: 760px) {
  .col-album {
    display: none;
  }
  .tracklist-head,
  .row {
    grid-template-columns: 2rem minmax(0, 1.4fr) minmax(0, 1.6fr) 3.5rem;
    padding-inline: 0.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fab {
    transition: none;
  }
}
</style>
