<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { getAnalyticsSummary } from '@/api/analytics';
import type { AnalyticsSummary } from '@/api/contracts';
import { toAppError } from '@/api/errors';
import StatePanel from '@/components/StatePanel.vue';
import { useAudioPlayerStore } from '@/stores/audioPlayer.store';
import { formatListening, formatPercent, formatShortDate } from '@/utils/format';

const RANGES = [7, 14, 30] as const;

const player = useAudioPlayerStore();
const days = ref<number>(7);
const summary = ref<AnalyticsSummary | null>(null);
const loading = ref(true);
const failure = ref('');

let controller: AbortController | null = null;

async function load(): Promise<void> {
  controller?.abort();
  const current = new AbortController();
  controller = current;
  loading.value = true;
  failure.value = '';
  try {
    // Lo escuchado hasta este momento todavía puede estar en la cola del navegador: se envía primero.
    await player.flushPlaybackStats();
    const data = await getAnalyticsSummary(days.value, current.signal);
    if (current.signal.aborted) return;
    summary.value = data;
  } catch (error) {
    if (current.signal.aborted) return;
    failure.value = toAppError(error).message;
  } finally {
    if (controller === current) loading.value = false;
  }
}

function selectRange(value: number): void {
  if (value === days.value) return;
  days.value = value;
  void load();
}

onMounted(load);
onBeforeUnmount(() => controller?.abort());

const isEmpty = computed(() => summary.value !== null && summary.value.totalPlays === 0 && summary.value.totalListenedSec === 0);

const maxDaily = computed(() => Math.max(1, ...(summary.value?.daily.map((d) => d.listenedSec) ?? [0])));
const barHeight = (seconds: number): string => (seconds <= 0 ? '2px' : `${Math.max(4, (seconds / maxDaily.value) * 100)}%`);

/** Con muchos días no caben todas las fechas: se muestra una de cada cinco, y siempre la última. */
function showTick(index: number, total: number): boolean {
  return total <= 14 || index % 5 === 0 || index === total - 1;
}

const averagePerDay = computed(() => (summary.value ? summary.value.totalListenedSec / Math.max(summary.value.daily.length, 1) : 0));
</script>

<template>
  <div class="page stats">
    <header class="page-head">
      <h1>Mis estadísticas</h1>
      <p>Cuánto escuchas, qué escuchas y qué tanto terminas lo que empiezas.</p>
    </header>

    <div class="toolbar">
      <div class="ranges" role="group" aria-label="Periodo">
        <button
          v-for="range in RANGES"
          :key="range"
          type="button"
          class="btn"
          :aria-pressed="days === range"
          @click="selectRange(range)"
        >
          {{ range }} días
        </button>
      </div>
      <button type="button" class="btn" :disabled="loading" @click="load">Actualizar</button>
    </div>

    <StatePanel v-if="loading && !summary" kind="loading" title="Cargando tus estadísticas…" />

    <StatePanel v-else-if="failure && !summary" kind="error" title="No pudimos cargar tus estadísticas" :message="failure">
      <button type="button" class="btn" @click="load">Reintentar</button>
    </StatePanel>

    <StatePanel
      v-else-if="isEmpty"
      kind="empty"
      title="Aún no hay nada que mostrar"
      message="Reproduce una canción desde Inicio y vuelve aquí: tu consumo se registra mientras escuchas."
    />

    <template v-else-if="summary">
      <p v-if="failure" class="field-error" role="alert">{{ failure }} Mostramos los últimos datos que tenemos.</p>

      <section class="kpis" aria-label="Resumen" :aria-busy="loading">
        <article class="kpi">
          <h2>Tiempo escuchado</h2>
          <p class="value">{{ formatListening(summary.totalListenedSec) }}</p>
          <p class="muted">≈ {{ formatListening(averagePerDay) }} por día</p>
        </article>
        <article class="kpi">
          <h2>Reproducciones</h2>
          <p class="value">{{ summary.totalPlays }}</p>
          <p class="muted">canciones empezadas</p>
        </article>
        <article class="kpi">
          <h2>Canciones distintas</h2>
          <p class="value">{{ summary.distinctTracks }}</p>
          <p class="muted">en este periodo</p>
        </article>
        <article class="kpi">
          <h2>Las terminas</h2>
          <p class="value">{{ formatPercent(summary.completionRate) }}</p>
          <p class="muted">de las que empiezas</p>
        </article>
      </section>

      <section class="panel" aria-labelledby="daily-title">
        <h2 id="daily-title">Escucha por día</h2>
        <div class="chart" role="img" :aria-label="`Gráfico de barras con el tiempo escuchado en cada uno de los últimos ${summary.daily.length} días`">
          <div
            v-for="(day, index) in summary.daily"
            :key="day.date"
            class="col"
            :title="`${formatShortDate(day.date)}: ${formatListening(day.listenedSec)}`"
          >
            <div class="bar" :class="{ 'is-empty': day.listenedSec <= 0 }" :style="{ height: barHeight(day.listenedSec) }" />
            <span class="tick">{{ showTick(index, summary.daily.length) ? formatShortDate(day.date) : '' }}</span>
          </div>
        </div>
        <table class="sr-only">
          <caption>Tiempo escuchado por día</caption>
          <thead>
            <tr><th scope="col">Día</th><th scope="col">Tiempo escuchado</th></tr>
          </thead>
          <tbody>
            <tr v-for="day in summary.daily" :key="day.date">
              <th scope="row">{{ formatShortDate(day.date) }}</th>
              <td>{{ formatListening(day.listenedSec) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel" aria-labelledby="top-title">
        <h2 id="top-title">Lo más escuchado</h2>
        <ol v-if="summary.topTracks.length > 0" class="top">
          <li v-for="(track, index) in summary.topTracks" :key="track.trackId">
            <span class="rank" aria-hidden="true">{{ index + 1 }}</span>
            <div class="info">
              <strong>{{ track.title }}</strong>
              <span class="muted">{{ track.artist }}</span>
            </div>
            <div class="nums">
              <strong>{{ formatListening(track.listenedSec) }}</strong>
              <span class="muted">{{ track.plays }} {{ track.plays === 1 ? 'reproducción' : 'reproducciones' }}</span>
            </div>
          </li>
        </ol>
        <p v-else class="muted">Todavía no hay canciones en este periodo.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
}
.ranges {
  display: flex;
  gap: 0.5rem;
}
.ranges .btn[aria-pressed='true'] {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--surface);
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
.kpi,
.panel {
  display: grid;
  gap: 0.35rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.kpi h2 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--muted);
}
.value {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
}
.panel {
  gap: 1rem;
}

.chart {
  display: flex;
  align-items: stretch;
  gap: clamp(2px, 0.8vw, 8px);
  height: 200px;
}
.col {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 0.35rem;
}
.bar {
  align-self: end;
  width: 100%;
  background: var(--signal);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}
.bar.is-empty {
  background: var(--line);
}
.tick {
  min-height: 1.1em;
  font-size: 0.75rem;
  color: var(--muted);
  text-align: center;
  white-space: nowrap;
  overflow: visible;
}

.top {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.25rem;
}
.top li {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-top: 1px solid var(--line);
}
.top li:first-child {
  border-top: 0;
}
.rank {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--muted);
}
.info,
.nums {
  display: grid;
  min-width: 0;
}
.info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nums {
  text-align: right;
}
.muted {
  font-size: 0.875rem;
}
</style>
