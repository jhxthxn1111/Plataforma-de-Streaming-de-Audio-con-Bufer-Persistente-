<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getOverview } from '@/api/admin';
import type { AdminOverview } from '@/api/contracts';
import { toAppError } from '@/api/errors';
import StatePanel from '@/components/StatePanel.vue';
import { formatBytes, formatPercent } from '@/utils/format';

const overview = ref<AdminOverview | null>(null);
const error = ref<string | null>(null);
const loading = ref(true);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    overview.value = await getOverview();
  } catch (e) {
    error.value = toAppError(e).message;
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>Administración</h1>
      <p>Estado general de la plataforma.</p>
    </header>

    <StatePanel v-if="loading" kind="loading" title="Cargando panel…" />
    <StatePanel v-else-if="error" kind="error" title="No pudimos cargar el panel" :message="error">
      <button type="button" class="btn" @click="load()">Reintentar</button>
    </StatePanel>
    <template v-else-if="overview">
      <dl class="kpis">
        <div><dt>Oyentes activos</dt><dd>{{ overview.activeListeners }}</dd></div>
        <div><dt>Datos transmitidos</dt><dd>{{ formatBytes(overview.streamedBytes) }}</dd></div>
        <div><dt>Canciones en catálogo</dt><dd>{{ overview.totalTracks }}</dd></div>
      </dl>
      <section>
        <h2>Géneros más reproducidos</h2>
        <ul class="genres">
          <li v-for="g in overview.topGenres" :key="g.genre">
            <span>{{ g.genre }}</span>
            <span class="bar"><span :style="{ width: `${g.share * 100}%` }" /></span>
            <span class="muted">{{ formatPercent(g.share) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
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
.genres {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.genres li {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 56px;
  align-items: center;
  gap: 0.75rem;
}
.bar {
  height: 10px;
  border-radius: 5px;
  background: var(--line);
  overflow: hidden;
}
.bar > span {
  display: block;
  height: 100%;
  background: var(--signal);
}
</style>
