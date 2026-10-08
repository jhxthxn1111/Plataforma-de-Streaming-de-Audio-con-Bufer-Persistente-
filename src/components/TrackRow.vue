<script setup lang="ts">
import type { Track } from '@/api/contracts';
import { formatTime } from '@/utils/format';
import IconGlyph from './IconGlyph.vue';
import TrackCover from './TrackCover.vue';

defineProps<{ track: Track; active: boolean; playing: boolean; queued: boolean }>();
const emit = defineEmits<{ play: []; enqueue: [] }>();
</script>

<template>
  <li class="row" :class="{ active }">
    <button
      type="button"
      class="icon-btn"
      :aria-label="`${playing ? 'Pausar' : 'Reproducir'} ${track.title}`"
      @click="emit('play')"
    >
      <IconGlyph :name="playing ? 'pause' : 'play'" />
    </button>
    <TrackCover :hue="track.hue" :seed="track.id" />
    <div class="info">
      <p class="title">{{ track.title }}</p>
      <p class="muted artist">{{ track.artist }}</p>
    </div>
    <p class="album muted">{{ track.album }}</p>
    <p class="genre muted">{{ track.genre }}</p>
    <p class="time muted">{{ formatTime(track.durationSec) }}</p>
    <button
      type="button"
      class="icon-btn"
      :disabled="queued"
      :aria-label="queued ? `${track.title} ya está en la cola` : `Añadir ${track.title} a la cola`"
      @click="emit('enqueue')"
    >
      <IconGlyph :name="queued ? 'queue' : 'plus'" />
    </button>
  </li>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 40px 44px minmax(0, 2fr) minmax(0, 1.2fr) 90px 48px 40px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}
.row.active {
  border-color: var(--signal);
  box-shadow: inset 4px 0 0 var(--signal);
}
.info {
  min-width: 0;
}
.title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.artist,
.album,
.genre {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.92rem;
}
.time {
  font-variant-numeric: tabular-nums;
  text-align: right;
  font-size: 0.92rem;
}

@media (max-width: 860px) {
  .row {
    grid-template-columns: 40px 44px minmax(0, 1fr) 48px 40px;
  }
  .album,
  .genre {
    display: none;
  }
}
</style>
