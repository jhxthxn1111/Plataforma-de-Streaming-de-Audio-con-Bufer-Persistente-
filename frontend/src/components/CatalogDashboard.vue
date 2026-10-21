<template>
  <section class="spotify-dashboard" aria-label="Catálogo musical local">
    <!-- Barra de búsqueda local y filtros estilo Spotify -->
    <div class="dashboard-topbar">
      <div class="filter-pills">
        <button type="button" class="pill-btn" :class="{ active: activeFilter === 'all' }" @click="activeFilter = 'all'">Todo</button>
        <button type="button" class="pill-btn" :class="{ active: activeFilter === 'music' }" @click="activeFilter = 'music'">Música</button>
        <button type="button" class="pill-btn" :class="{ active: activeFilter === 'buffered' }" @click="activeFilter = 'buffered'">Storage Local (Sin Copyright)</button>
      </div>

      <div class="search-box">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" class="search-icon">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"></path>
        </svg>
        <input v-model="searchQuery" type="text" placeholder="¿Qué quieres reproducir?" class="search-input" />
      </div>
    </div>

    <!-- Tarjetas horizontales rápidas -->
    <div class="quick-picks-grid">
      <div v-if="catalog[0]" class="quick-card" @click="playTrack(catalog[0])">
        <div class="quick-cover liked-cover">
          <svg viewBox="0 0 16 16" width="20" height="20" fill="#ffffff">
            <path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"></path>
          </svg>
        </div>
        <div class="quick-info">
          <span class="quick-title">Tus me gusta</span>
          <span class="quick-sub">{{ catalog.length }} pistas en storage</span>
        </div>
      </div>

      <div v-for="item in catalog.slice(0, 3)" :key="'quick-' + item.id" class="quick-card" @click="playTrack(item)">
        <div class="quick-cover" :style="{ background: item.coverGradient }">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ffffff" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3" fill="#ffffff"></polygon>
          </svg>
        </div>
        <div class="quick-info">
          <span class="quick-title">{{ item.title }}</span>
          <span class="quick-sub">{{ item.fileName }}</span>
        </div>
      </div>
    </div>

    <!-- SECCIÓN 1: Sugerencias para hoy -->
    <div class="section-block">
      <div class="section-header">
        <div>
          <p class="section-eyebrow">Inspirado en tus archivos de backend/storage</p>
          <h2 class="section-title">Sugerencias para hoy</h2>
        </div>
        <span class="section-badge">Pinia Store + HTTP 206 Activo</span>
      </div>

      <div class="cards-row">
        <article v-for="(track, index) in filteredTracks" :key="track.id" class="spotify-card" :class="{ 'is-current': currentTrack.id === track.id }" @click="playTrack(track)">
          <div class="card-artwork" :style="{ background: track.coverGradient }">
            <div class="artwork-overlay">
              <span class="artwork-tag">SIN COPY</span>
              <span class="artwork-number">#0{{ index + 1 }}</span>
            </div>
            <svg viewBox="0 0 100 100" class="artwork-vinyl">
              <circle cx="50" cy="50" r="42" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
              <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-dasharray="6 4" />
              <circle cx="50" cy="50" r="10" fill="rgba(255,255,255,0.85)" />
            </svg>
            <div class="artwork-file-chip">{{ track.fileName }}</div>

            <button type="button" class="card-play-fab" :class="{ 'always-visible': currentTrack.id === track.id && isPlaying }" @click.stop="playTrack(track)" :aria-label="currentTrack.id === track.id && isPlaying ? 'Pausar' : 'Reproducir'">
              <svg v-if="currentTrack.id === track.id && isPlaying" viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
                <path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"></path>
              </svg>
              <svg v-else viewBox="0 0 16 16" width="18" height="18" fill="currentColor" style="margin-left: 2px;">
                <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"></path>
              </svg>
            </button>
          </div>

          <h3 class="card-title">{{ track.title }}</h3>
          <p class="card-subtitle">{{ track.artist }}</p>
        </article>
      </div>
    </div>

    <!-- SECCIÓN 2: Monitor de Búfer Persistente -->
    <div class="section-block">
      <div class="section-header">
        <div>
          <h2 class="section-title">Monitor de Búfer Persistente</h2>
        </div>
        <span class="section-link">Búfer descargado: {{ bufferedPercentage }}%</span>
      </div>

      <!-- NUEVO: Controles Offline -->
      <div class="offline-toolbar">
        <span v-if="!isOnline" class="offline-warning">Sin conexión: solo suenan las canciones guardadas en disco.</span>
        <span v-if="!storageAvailable" class="offline-warning">Este navegador no permite guardar audio sin conexión.</span>
        <template v-else>
          <span>Caché local: {{ formatMegabytes(usedBytes) }} de {{ formatMegabytes(MAX_CACHE_BYTES) }}</span>
          <span>{{ completeCount }} de {{ catalog.length }} canciones disponibles sin conexión</span>
          <label>
            <input type="checkbox" :checked="autoCache" @change="onAutoCacheChange" />
            Guardar en disco lo que escucho
          </label>
        </template>
      </div>

      <div class="tracklist-table">
        <div class="tracklist-header">
          <span>#</span>
          <span>TÍTULO (ARCHIVO LOCAL EN STORAGE)</span>
          <span>ÁLBUM</span>
          <span>ESTADO DEL BÚFER / DESCARGA</span>
          <span style="text-align: right;">PESO</span>
        </div>

        <div v-for="(track, idx) in filteredTracks" :key="'row-' + track.id" class="tracklist-row" :class="{ 'active-row': currentTrack.id === track.id }" @click="playTrack(track)">
          <span class="row-index">
            <span v-if="currentTrack.id === track.id && isPlaying" class="eq-bars">ılı</span>
            <span v-else>{{ idx + 1 }}</span>
          </span>

          <div class="row-main">
            <div class="row-mini-cover" :style="{ background: track.coverGradient }"></div>
            <div>
              <div class="row-title">{{ track.title }}</div>
              <div class="row-artist">{{ track.artist }} • <code>backend/storage/{{ track.fileName }}</code></div>
            </div>
          </div>

          <span class="row-album">{{ track.album }}</span>

          <!-- NUEVO: Indicadores de descarga individual por canción -->
          <span class="row-status">
            <span class="status-badge" :class="{ active: currentTrack.id === track.id }">
              {{ currentTrack.id === track.id ? `Streaming 206 (${bufferedPercentage}%)` : 'Listo en Storage' }}
            </span>

            <span v-if="storageAvailable" class="offline-controls" @click.stop>
              <span v-if="offline.statusOf(track.fileName) === 'complete'" class="offline-badge is-complete">Offline ✓</span>
              <span v-else-if="offline.statusOf(track.fileName) === 'downloading'" class="offline-badge">Disco {{ offline.percentOf(track.fileName) }}%</span>
              <span v-else-if="offline.statusOf(track.fileName) === 'partial'" class="offline-badge">Parcial {{ offline.percentOf(track.fileName) }}%</span>

              <button v-if="offline.statusOf(track.fileName) === 'downloading'" type="button" class="offline-btn" @click="offline.cancel(track)">Cancelar</button>
              <button v-else-if="offline.statusOf(track.fileName) === 'complete'" type="button" class="offline-btn" @click="offline.remove(track)">Quitar</button>
              <button v-else type="button" class="offline-btn" :disabled="!isOnline" @click="offline.download(track)">Descargar</button>

              <span v-if="offline.errorOf(track.fileName)" class="offline-error">{{ offline.errorOf(track.fileName) }}</span>
            </span>
          </span>

          <span class="row-size">{{ formatMegabytes(track.sizeBytes) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAudioPlayer } from '../composables/useAudioPlayer';
import { MAX_CACHE_BYTES, useOfflineCacheStore } from '../stores/offlineCache.store';

const offline = useOfflineCacheStore();
const { isOnline, autoCache, usedBytes, completeCount } = storeToRefs(offline);
const storageAvailable = offline.storageAvailable; // <-- Lo sacamos directo sin storeToRefs

const onAutoCacheChange = (event: Event): void => {
  offline.setAutoCache((event.target as HTMLInputElement).checked);
};

const {
  catalog,
  currentTrack,
  isPlaying,
  bufferedPercentage,
  activeFilter,
  playTrack,
} = useAudioPlayer();

const searchQuery = ref('');

const filteredTracks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return catalog.value;
  return catalog.value.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.fileName.toLowerCase().includes(q)
  );
});

const formatMegabytes = (bytes?: number): string => {
  if (bytes === 0) return '0 MB';
  if (!bytes || bytes <= 0) return '4.8 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
</script>

<style scoped>
.spotify-dashboard {
  padding: 0 32px 120px 32px;
  color: #ffffff;
  width: 100%;
  box-sizing: border-box;
}

.dashboard-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-pills {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pill-btn {
  background-color: rgba(255, 255, 255, 0.08);
  color: #e5e7eb;
  border: none;
  padding: 7px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pill-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.pill-btn.active {
  background-color: #ffffff;
  color: #090b10;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 7px 16px;
  min-width: 250px;
}

.search-icon {
  color: #9ca3af;
}

.search-input {
  background: transparent;
  border: none;
  outline: none;
  color: #ffffff;
  font-size: 13px;
  width: 100%;
}

.quick-picks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}

.quick-card {
  display: flex;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.quick-card:hover {
  background-color: rgba(255, 255, 255, 0.14);
}

.quick-cover {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.liked-cover {
  background: linear-gradient(135deg, #4338ca 0%, #a855f7 100%);
}

.quick-info {
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.quick-title {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quick-sub {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}

.section-block {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 14px;
}

.section-eyebrow {
  font-size: 12px;
  color: #9ca3af;
  margin: 0 0 2px 0;
}

.section-title {
  font-size: 22px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.02em;
}

.section-badge {
  font-size: 11px;
  font-weight: 600;
  color: #818cf8;
  background: rgba(99, 102, 241, 0.14);
  border: 1px solid rgba(99, 102, 241, 0.3);
  padding: 4px 10px;
  border-radius: 999px;
}

.section-link {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 600;
}

.cards-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
  gap: 18px;
}

.spotify-card {
  background-color: rgba(255, 255, 255, 0.03);
  padding: 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease;
  border: 1px solid transparent;
}

.spotify-card:hover {
  background-color: rgba(255, 255, 255, 0.09);
  transform: translateY(-2px);
}

.spotify-card.is-current {
  background-color: rgba(99, 102, 241, 0.12);
  border-color: rgba(99, 102, 241, 0.35);
}

.card-artwork {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.artwork-overlay {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 800;
}

.artwork-tag {
  background: rgba(0, 0, 0, 0.55);
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.artwork-number {
  color: rgba(255, 255, 255, 0.75);
}

.artwork-vinyl {
  width: 64%;
  height: 64%;
  opacity: 0.85;
}

.artwork-file-chip {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.6);
  padding: 2px 7px;
  border-radius: 4px;
  color: #e5e7eb;
}

.card-play-fab {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: #22c55e;
  color: #000000;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
  opacity: 0;
  transform: translateY(8px);
  transition: all 0.2s ease;
  cursor: pointer;
}

.spotify-card:hover .card-play-fab,
.card-play-fab.always-visible {
  opacity: 1;
  transform: translateY(0);
}

.card-play-fab:hover {
  transform: scale(1.06);
  background-color: #4ade80;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-subtitle {
  font-size: 12px;
  color: #9ca3af;
  margin: 0;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tracklist-table {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;
}

.tracklist-header {
  display: grid;
  grid-template-columns: 40px 2fr 1.2fr 1.2fr 80px;
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 700;
  color: #9ca3af;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tracklist-row {
  display: grid;
  grid-template-columns: 40px 2fr 1.2fr 1.2fr 80px;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.tracklist-row:hover {
  background-color: rgba(255, 255, 255, 0.06);
}

.tracklist-row.active-row {
  background-color: rgba(99, 102, 241, 0.12);
}

.row-index {
  font-size: 13px;
  color: #9ca3af;
}

.eq-bars {
  color: #22c55e;
  font-weight: 900;
}

.row-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.row-mini-cover {
  width: 38px;
  height: 38px;
  border-radius: 4px;
  flex-shrink: 0;
}

.row-title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.row-artist {
  font-size: 12px;
  color: #9ca3af;
}

.row-artist code {
  color: #a5b4fc;
}

.row-album,
.row-size {
  font-size: 13px;
  color: #9ca3af;
}

.row-size {
  text-align: right;
}

.status-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #9ca3af;
}

.status-badge.active {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  font-weight: 600;
}

/* ---- Caché offline (IndexedDB) ---- */
.offline-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 13px;
  color: #b3b3b3;
}
.offline-toolbar label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.offline-warning {
  color: #fbbf24;
  font-weight: 600;
}
.offline-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}
.offline-badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #e5e7eb;
  background: rgba(255, 255, 255, 0.12);
}
.offline-badge.is-complete {
  color: #052e16;
  background: #4ade80;
}
.offline-btn {
  padding: 2px 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  background: transparent;
  color: #e5e7eb;
  font-size: 11px;
  cursor: pointer;
}
.offline-btn:hover {
  border-color: #ffffff;
  color: #ffffff;
}
.offline-error {
  color: #f87171;
  font-size: 11px;
}
</style>