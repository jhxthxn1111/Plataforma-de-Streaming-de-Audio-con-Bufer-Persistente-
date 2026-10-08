<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { usePlayerStore } from '@/stores/player';
import { formatTime } from '@/utils/format';
import BufferTimeline from './BufferTimeline.vue';
import IconGlyph from './IconGlyph.vue';
import TrackCover from './TrackCover.vue';

const player = usePlayerStore();

const statusLabel = computed(() => {
  switch (player.status) {
    case 'loading':
      return 'Preparando audio…';
    case 'buffering':
      return 'Almacenando en búfer…';
    case 'playing':
      return 'Reproduciendo';
    case 'paused':
      return 'En pausa';
    case 'error':
      return player.error ?? 'No se pudo reproducir';
    default:
      return '';
  }
});
const hasTrack = computed(() => player.currentTrack !== null);
const repeatPressed = computed(() => player.repeat !== 'off');
const repeatLabel = computed(() => {
  if (player.repeat === 'one') return 'Repetir: una canción';
  if (player.repeat === 'all') return 'Repetir: toda la cola';
  return 'Repetir: desactivado';
});

function onVolume(event: Event): void {
  player.setVolume(Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <section class="player" aria-label="Reproductor">
    <div class="now">
      <template v-if="player.currentTrack">
        <TrackCover :hue="player.currentTrack.hue" :seed="player.currentTrack.id" :size="52" />
        <div class="meta">
          <RouterLink :to="{ name: 'now-playing' }" class="title">{{ player.currentTrack.title }}</RouterLink>
          <p class="artist muted">{{ player.currentTrack.artist }}</p>
        </div>
      </template>
      <p v-else class="muted">Elige una canción de Explorar para empezar.</p>
    </div>

    <div class="transport">
      <div class="buttons">
        <button type="button" class="icon-btn" aria-label="Anterior" :disabled="!hasTrack" @click="player.previous()">
          <IconGlyph name="previous" />
        </button>
        <button
          type="button"
          class="play"
          :aria-label="player.isPlaying ? 'Pausar' : 'Reproducir'"
          :disabled="!hasTrack"
          @click="player.toggle()"
        >
          <IconGlyph :name="player.isPlaying ? 'pause' : 'play'" :size="22" />
        </button>
        <button type="button" class="icon-btn" aria-label="Siguiente" :disabled="!hasTrack" @click="player.next()">
          <IconGlyph name="next" />
        </button>
        <button
          type="button"
          class="icon-btn"
          :aria-label="repeatLabel"
          :aria-pressed="repeatPressed"
          :disabled="!hasTrack"
          @click="player.cycleRepeat()"
        >
          <IconGlyph :name="player.repeat === 'one' ? 'repeat-one' : 'repeat'" />
        </button>
      </div>
      <div class="timeline-row">
        <span class="time">{{ formatTime(player.position) }}</span>
        <BufferTimeline
          :position="player.position"
          :duration="player.duration"
          :ranges="player.buffered"
          :disabled="!hasTrack"
          @seek="player.seek"
        />
        <span class="time">{{ formatTime(player.duration) }}</span>
      </div>
    </div>

    <div class="extras">
      <p class="status" :class="{ error: player.status === 'error' }">
        {{ statusLabel }}
        <span v-if="hasTrack && player.status !== 'error' && player.status !== 'loading'" class="ahead">
          · {{ Math.round(player.bufferAheadSec) }} s en búfer
        </span>
      </p>
      <div class="volume">
        <button type="button" class="icon-btn" :aria-label="player.muted ? 'Activar sonido' : 'Silenciar'" @click="player.toggleMute()">
          <IconGlyph :name="player.muted || player.volume === 0 ? 'mute' : 'volume'" />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="player.muted ? 0 : player.volume"
          aria-label="Volumen"
          @input="onVolume"
        />
      </div>
    </div>
    <p class="sr-only" aria-live="polite">{{ statusLabel }}</p>
  </section>
</template>

<style scoped>
.player {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr);
  align-items: center;
  gap: 1.25rem;
  height: var(--player-h);
  padding: 0 1.25rem;
  background: var(--surface);
  border-top: 1px solid var(--line);
}
.now {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}
.meta {
  min-width: 0;
}
.title {
  display: block;
  font-weight: 600;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.title:hover {
  text-decoration: underline;
}
.artist {
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.transport {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.25rem;
}
.play {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 0;
  border-radius: 50%;
  background: var(--signal);
  color: var(--signal-ink);
  cursor: pointer;
}
.play:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.timeline-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.time {
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  color: var(--muted);
  min-width: 2.6em;
  text-align: center;
}
.extras {
  display: grid;
  justify-items: end;
  gap: 0.1rem;
  min-width: 0;
}
.status {
  font-size: 0.85rem;
  color: var(--muted);
  text-align: right;
}
.status.error {
  color: var(--danger);
}
.volume {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.volume input {
  width: 96px;
  accent-color: var(--signal);
}

@media (max-width: 860px) {
  .player {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    height: auto;
    padding: 0.6rem 0.9rem 0.75rem;
    gap: 0.35rem 0.75rem;
  }
  .transport {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .extras {
    display: none;
  }
  .buttons {
    justify-content: space-between;
    order: 2;
  }
}
</style>
