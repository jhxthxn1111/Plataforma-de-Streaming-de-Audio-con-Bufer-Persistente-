<script setup lang="ts">
import { computed, onMounted } from 'vue';
import BarChart, { type BarDatum } from '@/components/BarChart.vue';
import StatePanel from '@/components/StatePanel.vue';
import { useAnalyticsStore } from '@/stores/analytics';
import { formatListening, formatPercent, formatShortDate } from '@/utils/format';

const analytics = useAnalyticsStore();
const ranges = [7, 14, 30];

const chartData = computed<BarDatum[]>(() =>
  (analytics.summary?.daily ?? []).map((d) => ({
    label: formatShortDate(d.date),
    value: d.listenedSec,
    title: `${formatShortDate(d.date)}: ${formatListening(d.listenedSec)}`,
  })),
);

onMounted(() => void analytics.loadSummary());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>Mi consumo</h1>
      <p>Lo que escuchaste, medido por el reproductor mientras navegabas.</p>
    </header>

    <div class="ranges" role="group" aria-label="Periodo">
      <button
        v-for="d in ranges"
        :key="d"
        type="button"
        class="chip"
        :aria-pressed="analytics.rangeDays === d"
        @click="analytics.loadSummary(d)"
      >
        {{ d }} días
      </button>
    </div>

    <StatePanel v-if="analytics.status === 'loading' && !analytics.summary" kind="loading" title="Calculando consumo…" />
    <StatePanel v-else-if="analytics.status === 'error'" kind="error" title="No pudimos cargar tu consumo" :message="analytics.error ?? undefined">
      <button type="button" class="btn" @click="analytics.loadSummary()">Reintentar</button>
    </StatePanel>

    <template v-else-if="analytics.summary">
      <dl class="kpis">
        <div><dt>Tiempo escuchado</dt><dd>{{ formatListening(analytics.summary.totalListenedSec) }}</dd></div>
        <div><dt>Reproducciones</dt><dd>{{ analytics.summary.totalPlays }}</dd></div>
        <div><dt>Canciones completas</dt><dd>{{ formatPercent(analytics.summary.completionRate) }}</dd></div>
        <div><dt>Canciones distintas</dt><dd>{{ analytics.summary.distinctTracks }}</dd></div>
      </dl>

      <section aria-labelledby="daily">
        <h2 id="daily">Escucha por día</h2>
        <BarChart :data="chartData" ariaLabel="Tiempo escuchado por día" />
      </section>

      <section aria-labelledby="top">
        <h2 id="top">Más escuchadas</h2>
        <table class="top">
          <thead>
            <tr><th scope="col">Canción</th><th scope="col">Artista</th><th scope="col">Plays</th><th scope="col">Tiempo</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in analytics.summary.topTracks" :key="t.trackId">
              <td>{{ t.title }}</td>
              <td class="muted">{{ t.artist }}</td>
              <td>{{ t.plays }}</td>
              <td>{{ formatListening(t.listenedSec) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <p class="muted pending">Eventos pendientes de envío: {{ analytics.pendingCount }}</p>
    </template>
  </div>
</template>

<style scoped>
.ranges {
  display: flex;
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
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin: 0;
}
.kpis dt {
  color: var(--muted);
  font-size: 0.9rem;
}
.kpis dd {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 700;
}
section {
  display: grid;
  gap: 0.75rem;
}
.top {
  width: 100%;
  border-collapse: collapse;
}
.top th,
.top td {
  padding: 0.5rem 0.75rem 0.5rem 0;
  text-align: left;
  border-bottom: 1px solid var(--line);
}
.pending {
  font-size: 0.9rem;
}
</style>
