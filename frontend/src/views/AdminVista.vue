<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { getAdminOverview } from '@/api/admin';
import type { AdminOverview } from '@/api/contracts';
import { toAppError } from '@/api/errors';
import StatePanel from '@/components/StatePanel.vue';
import { formatBytes, formatPercent } from '@/utils/format';

const overview = ref<AdminOverview | null>(null);
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
    const data = await getAdminOverview(current.signal);
    if (current.signal.aborted) return;
    overview.value = data;
  } catch (error) {
    if (current.signal.aborted) return;
    failure.value = toAppError(error).message;
  } finally {
    if (controller === current) loading.value = false;
  }
}

onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <div class="page admin">
    <header class="page-head">
      <h1>Administración</h1>
      <p>Cómo se está usando la plataforma. Solo lo ve el rol de administración.</p>
    </header>

    <div class="toolbar">
      <button type="button" class="btn" :disabled="loading" @click="load">Actualizar</button>
    </div>

    <StatePanel v-if="loading && !overview" kind="loading" title="Cargando el panel…" />

    <StatePanel v-else-if="failure && !overview" kind="error" title="No pudimos cargar el panel" :message="failure">
      <button type="button" class="btn" @click="load">Reintentar</button>
    </StatePanel>

    <template v-else-if="overview">
      <p v-if="failure" class="field-error" role="alert">{{ failure }} Mostramos los últimos datos que tenemos.</p>

      <section class="kpis" aria-label="Resumen" :aria-busy="loading">
        <article class="kpi">
          <h2>Oyentes activos</h2>
          <p class="value">{{ overview.activeListeners }}</p>
          <p class="muted">escucharon en los últimos 5 minutos</p>
        </article>
        <article class="kpi">
          <h2>Audio transmitido</h2>
          <p class="value">{{ formatBytes(overview.streamedBytes) }}</p>
          <p class="muted">desde que arrancó el servidor</p>
        </article>
        <article class="kpi">
          <h2>Canciones</h2>
          <p class="value">{{ overview.totalTracks }}</p>
          <p class="muted">en el catálogo</p>
        </article>
      </section>

      <section class="panel" aria-labelledby="genres-title">
        <h2 id="genres-title">Géneros más escuchados</h2>
        <ul v-if="overview.topGenres.length > 0" class="genres">
          <li v-for="item in overview.topGenres" :key="item.genre">
            <span class="name">{{ item.genre }}</span>
            <div class="track" aria-hidden="true">
              <div class="fill" :style="{ width: `${Math.max(item.share * 100, 2)}%` }" />
            </div>
            <strong>{{ formatPercent(item.share) }}</strong>
          </li>
        </ul>
        <p v-else class="muted">Todavía no hay reproducciones con género en los últimos 30 días.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: flex-end;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
.genres {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}
.genres li {
  display: grid;
  grid-template-columns: minmax(80px, 140px) minmax(0, 1fr) 3.5rem;
  align-items: center;
  gap: 0.75rem;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.track {
  height: 10px;
  border-radius: 999px;
  background: var(--line);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--signal);
  border-radius: 999px;
}
.genres strong {
  text-align: right;
}
.muted {
  font-size: 0.875rem;
}
</style>
