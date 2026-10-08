<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import BufferTimeline from '@/components/BufferTimeline.vue';
import IconGlyph from '@/components/IconGlyph.vue';
import StatePanel from '@/components/StatePanel.vue';
import TrackCover from '@/components/TrackCover.vue';
import { usePlayerStore } from '@/stores/player';
import { bufferedSeconds } from '@/utils/buffer';
import { formatBytes, formatTime } from '@/utils/format';

const player = usePlayerStore();

const bufferedTotal = computed(() => bufferedSeconds(player.buffered));
const bufferedRatio = computed(() => (player.duration > 0 ? Math.min(bufferedTotal.value / player.duration, 1) : 0));
const downloadedBytes = computed(() => {
  const track = player.currentTrack;
  return track ? Math.round(track.sizeBytes * bufferedRatio.value) : 0;
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>Reproduciendo</h1>
    </header>

    <StatePanel v-if="!player.currentTrack" kind="empty" title="No hay nada en la cola" message="Elige una canción en Explorar para empezar a escuchar.">
      <RouterLink :to="{ name: 'library' }" class="btn btn-primary">Ir a Explorar</RouterLink>
    </StatePanel>

    <template v-else>
      <section class="track" aria-labelledby="track-title">
        <TrackCover :hue="player.currentTrack.hue" :seed="player.currentTrack.id" :size="132" />
        <div>
          <h2 id="track-title">{{ player.currentTrack.title }}</h2>
          <p>{{ player.currentTrack.artist }}</p>
          <p class="muted">{{ player.currentTrack.album }} · {{ player.currentTrack.genre }} · {{ player.currentTrack.bitrateKbps }} kbps</p>
        </div>
      </section>

      <section class="buffer" aria-labelledby="buffer-title">
        <h2 id="buffer-title">Mapa del búfer</h2>
        <p class="muted">
          El navegador descarga el audio por rangos. Si saltas a otro punto, aparece un nuevo tramo descargado.
        </p>
        <BufferTimeline
          tall
          :position="player.position"
          :duration="player.duration"
          :ranges="player.buffered"
          @seek="player.seek"
        />
        <ul class="legend">
          <li><span class="swatch played" /> Reproducido</li>
          <li><span class="swatch buffered" /> Descargado</li>
          <li><span class="swatch rest" /> Pendiente</li>
        </ul>

        <dl class="stats">
          <div><dt>Descargado</dt><dd>{{ Math.round(bufferedRatio * 100) }} %</dd></div>
          <div><dt>Por delante</dt><dd>{{ Math.round(player.bufferAheadSec) }} s</dd></div>
          <div><dt>Datos recibidos</dt><dd>≈ {{ formatBytes(downloadedBytes) }}</dd></div>
          <div><dt>Tramos</dt><dd>{{ player.buffered.length }}</dd></div>
        </dl>

        <table v-if="player.buffered.length" class="ranges">
          <caption class="sr-only">Rangos de audio descargados</caption>
          <thead>
            <tr><th scope="col">Desde</th><th scope="col">Hasta</th><th scope="col">Duración</th></tr>
          </thead>
          <tbody>
            <tr v-for="(range, i) in player.buffered" :key="i">
              <td>{{ formatTime(range.start) }}</td>
              <td>{{ formatTime(range.end) }}</td>
              <td>{{ Math.round(range.end - range.start) }} s</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section aria-labelledby="queue-title" class="queue">
        <div class="queue-head">
          <h2 id="queue-title">Cola ({{ player.queue.length }})</h2>
          <button type="button" class="btn" @click="player.clearQueue()">Vaciar cola</button>
        </div>
        <ol class="queue-list">
          <li v-for="(track, i) in player.queue" :key="track.id" :class="{ current: i === player.index }">
            <button type="button" class="jump" :aria-label="`Reproducir ${track.title}`" @click="player.jumpTo(i)">
              <span class="title">{{ track.title }}</span>
              <span class="muted">{{ track.artist }}</span>
            </button>
            <span class="muted time">{{ formatTime(track.durationSec) }}</span>
            <button type="button" class="icon-btn" :aria-label="`Quitar ${track.title} de la cola`" @click="player.removeFromQueue(i)">
              <IconGlyph name="close" />
            </button>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<style scoped>
.track {
  display: flex;
  gap: 1.25rem;
  align-items: center;
}
.buffer {
  display: grid;
  gap: 0.75rem;
  padding: 1.25rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.9rem;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
}
.swatch.played {
  background: var(--signal);
}
.swatch.buffered {
  background: var(--buffer);
}
.swatch.rest {
  background: var(--line);
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.75rem;
  margin: 0;
}
.stats dt {
  color: var(--muted);
  font-size: 0.9rem;
}
.stats dd {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.ranges {
  border-collapse: collapse;
  max-width: 420px;
  font-variant-numeric: tabular-nums;
}
.ranges th,
.ranges td {
  padding: 0.35rem 0.75rem 0.35rem 0;
  text-align: left;
  border-bottom: 1px solid var(--line);
}
.queue {
  display: grid;
  gap: 0.75rem;
}
.queue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.queue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}
.queue-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 40px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem 0.25rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}
.queue-list li.current {
  border-color: var(--signal);
  box-shadow: inset 4px 0 0 var(--signal);
}
.jump {
  display: grid;
  text-align: left;
  min-height: 44px;
  align-content: center;
  border: 0;
  background: none;
  cursor: pointer;
  min-width: 0;
}
.jump .title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.time {
  font-variant-numeric: tabular-nums;
}
</style>
