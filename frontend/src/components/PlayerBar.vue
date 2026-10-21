<template>
  <footer class="spotify-player" role="region" aria-label="Reproductor de audio">
    <!-- Mensaje de alerta sutil si el backend está apagado -->
    <div v-if="streamError" class="stream-error-banner">
      <span>⚠️ {{ streamError }}</span>
    </div>
    <div v-else-if="!isOnline" class="stream-error-banner offline-banner">
      <span>Sin conexión: se reproduce lo guardado en disco.</span>
    </div>

    <div class="player-grid">
      <!-- IZQUIERDA: Portada y datos de la canción -->
      <div class="now-playing">
        <div class="cover-art" :class="{ 'is-spinning': isPlaying }">
          <svg viewBox="0 0 24 24" class="music-note-icon" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
        </div>
        <div class="track-meta">
          <div class="track-title">{{ currentTrack.title }}</div>
          <div class="track-artist">{{ currentTrack.artist }}</div>
        </div>
      </div>

      <!-- CENTRO: Controles estilo Spotify + Barra de progreso y búfer -->
      <div class="player-center">
        <div class="transport-controls">
          <!-- Botón Aleatorio (Shuffle) -->
          <button
            type="button"
            class="icon-btn"
            :class="{ 'is-active': isShuffle }"
            @click="toggleShuffle"
            title="Aleatorio"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75 13.15.922zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z"></path>
              <path d="m7.5 10.723.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z"></path>
            </svg>
          </button>

          <!-- Botón Anterior (Previous) -->
          <button
            type="button"
            class="icon-btn"
            @click="prevTrack"
            title="Anterior"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h1.6z"></path>
            </svg>
          </button>

          <!-- Botón Principal Circular Play / Pause (Estilo Spotify) -->
          <button
            type="button"
            class="play-circle-btn"
            @click="togglePlay"
            :title="isPlaying ? 'Pausar' : 'Reproducir'"
          >
            <!-- Icono Pause -->
            <svg v-if="isPlaying" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"></path>
            </svg>
            <!-- Icono Play -->
            <svg v-else viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="margin-left: 2px;">
              <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"></path>
            </svg>
          </button>

          <!-- Botón Siguiente (Next) -->
          <button
            type="button"
            class="icon-btn"
            @click="nextTrack"
            title="Siguiente"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-1.6z"></path>
            </svg>
          </button>

          <!-- Botón Repetir (Repeat) -->
          <button
            type="button"
            class="icon-btn"
            :class="{ 'is-active': repeatMode !== 'off' }"
            @click="toggleRepeat"
            :title="repeatMode === 'one' ? 'Repetir una' : 'Repetir'"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z"></path>
            </svg>
            <span v-if="repeatMode === 'one'" class="repeat-badge">1</span>
          </button>
        </div>

        <!-- Barra de Progreso + Visualizador del Búfer Persistente -->
        <div class="playback-bar">
          <span class="time-label">{{ formatTime(currentTime) }}</span>
          
          <div class="progress-wrapper">
            <!-- Capa 1: Fondo gris oscuro -->
            <div class="progress-rail" role="img" :aria-label="`Búfer descargado: ${bufferedPercentage}%`">
              <!-- Capa 2: cada tramo descargado (HTTP 206) se dibuja por separado -->
              <div
                v-for="(range, i) in bufferedRanges"
                :key="i"
                class="progress-buffered"
                :style="{ left: `${range.start}%`, width: `${range.end - range.start}%` }"
              ></div>
              <!-- Capa 3: Tiempo reproducido actual -->
              <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
            </div>
            <!-- Input interactivo transparente encima -->
            <input
              type="range"
              min="0"
              :max="duration || 100"
              step="0.1"
              :value="currentTime"
              @input="onSeek"
              class="seek-slider"
              aria-label="Barra de progreso"
            />
          </div>

          <span class="time-label">{{ formatTime(duration) }}</span>
        </div>
      </div>

      <!-- DERECHA: Estado del Búfer HTTP 206 + Control de Volumen -->
      <div class="player-right">
        <div v-if="isFromCache" class="buffer-pill is-cache" title="Reproduciendo desde IndexedDB">
          <span>Desde caché local</span>
        </div>
        <div v-else-if="diskPercent > 0" class="buffer-pill" :title="`Guardado en disco: ${diskPercent}%`">
          <span>Disco {{ diskPercent }}%</span>
        </div>

        <div class="buffer-pill" :title="`Búfer almacenado: ${bufferedPercentage}%`">
          <span class="buffer-dot" :class="{ 'is-buffering': isBuffering }"></span>
          <span>Búfer {{ bufferedPercentage }}%</span>
        </div>

        <button type="button" class="icon-btn" @click="toggleMute" :title="isMuted ? 'Activar sonido' : 'Silenciar'">
          <svg v-if="isMuted || volume === 0" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M13.86 5.47a.75.75 0 0 0-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 0 0 8.8 6.53L10.269 8l-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 0 0 1.06-1.06L12.39 8l1.47-1.47a.75.75 0 0 0 0-1.06z"></path>
            <path d="M10.116 1.5A.75.75 0 0 0 8.991.85l-6.925 4a3.642 3.642 0 0 0-1.33 4.967 3.639 3.639 0 0 0 1.33 1.332l6.925 4a.75.75 0 0 0 1.125-.649v-1.906a4.73 4.73 0 0 1-1.5-.694v1.3L2.817 9.852a2.141 2.141 0 0 1-.781-2.92c.187-.324.456-.594.78-.782l5.8-3.35v1.3c.45-.313.956-.55 1.5-.694V1.5z"></path>
          </svg>
          <svg v-else viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.642 3.642 0 0 1-1.33-4.967 3.639 3.639 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.139 2.139 0 0 0 0 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88z"></path>
            <path d="M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127v1.55z"></path>
          </svg>
        </button>

        <div class="volume-wrapper">
          <div class="progress-rail">
            <div class="progress-fill" :style="{ width: `${(isMuted ? 0 : volume) * 100}%` }"></div>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="isMuted ? 0 : volume"
            @input="onVolumeChange"
            class="seek-slider"
            aria-label="Control de volumen"
          />
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAudioPlayer } from '../composables/useAudioPlayer';
import { useOfflineCacheStore } from '../stores/offlineCache.store';

const offline = useOfflineCacheStore();
const { isOnline } = storeToRefs(offline);

const {
  currentTrack,
  isPlaying,
  isBuffering,
  currentTime,
  duration,
  bufferedPercentage,
  bufferedRanges,
  progressPercentage,
  volume,
  isMuted,
  isShuffle,
  repeatMode,
  streamError,
  isFromCache,
  togglePlay,
  seek,
  setVolume,
  toggleMute,
  nextTrack,
  prevTrack,
  toggleShuffle,
  toggleRepeat,
} = useAudioPlayer();

// Porcentaje de la canción actual que ya está guardado en IndexedDB.
const diskPercent = computed(() => offline.percentOf(currentTrack.value.fileName));

const onSeek = (event: Event) => {
  const target = event.target as HTMLInputElement;
  seek(Number(target.value));
};

const onVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  setVolume(Number(target.value));
};

const formatTime = (seconds: number): string => {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};
</script>

<style scoped>
.spotify-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 90px;
  background-color: #090b10;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: #ffffff;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 16px;
  user-select: none;
}

.stream-error-banner {
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #dc2626;
  color: #ffffff;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 6px 6px 0 0;
  white-space: nowrap;
}

.player-grid {
  display: grid;
  grid-template-columns: 30% 40% 30%;
  align-items: center;
  width: 100%;
}

/* Izquierda */
.now-playing {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 180px;
}

.cover-art {
  width: 56px;
  height: 56px;
  border-radius: 6px;
  background: linear-gradient(135deg, #312e81 0%, #6366f1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.music-note-icon {
  width: 26px;
  height: 26px;
  color: #e0e7ff;
}

.track-meta {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.track-title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}

/* Centro */
.player-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 722px;
  width: 100%;
  margin: 0 auto;
}

.transport-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 8px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: #b3b3b3;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  position: relative;
  transition: color 0.15s ease, transform 0.15s ease;
}

.icon-btn:hover {
  color: #ffffff;
}

.icon-btn.is-active {
  color: #818cf8;
}

.repeat-badge {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 9px;
  font-weight: 700;
  color: #818cf8;
}

.play-circle-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background-color: #ffffff;
  color: #000000;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.play-circle-btn:hover {
  transform: scale(1.07);
  background-color: #f3f4f6;
}

.play-circle-btn:active {
  transform: scale(0.96);
}

/* Barra de progreso */
.playback-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.time-label {
  font-size: 11px;
  color: #a7a7a7;
  min-width: 32px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.progress-wrapper {
  position: relative;
  flex: 1;
  height: 12px;
  display: flex;
  align-items: center;
}

.progress-rail {
  position: relative;
  width: 100%;
  height: 6px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-buffered {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: var(--buffer);
  opacity: 0.65;
  transition: left 0.2s ease, width 0.2s ease;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: #818cf8;
  border-radius: 2px;
}

.seek-slider {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  margin: 0;
}

/* Derecha */
.player-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.buffer-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #9ca3af;
  background: rgba(255, 255, 255, 0.06);
  padding: 4px 10px;
  border-radius: 999px;
}

.buffer-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #10b981;
}

.buffer-dot.is-buffering {
  background-color: #f59e0b;
}

.volume-wrapper {
  position: relative;
  width: 95px;
  height: 12px;
  display: flex;
  align-items: center;
}

/* ---- Caché offline ---- */
.offline-banner {
  background: #78350f;
  color: #fef3c7;
}
.buffer-pill.is-cache {
  color: #052e16;
  background: #4ade80;
}
</style>