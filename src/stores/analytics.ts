import { ref } from 'vue';
import { defineStore } from 'pinia';
import { getSummary, sendEvents } from '@/api/analytics';
import type { AnalyticsSummary, PlaybackEvent } from '@/api/contracts';
import { toAppError } from '@/api/errors';
import type { LoadStatus } from './library';

const FLUSH_BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 20_000;
const MAX_PENDING = 500;

export const useAnalyticsStore = defineStore('analytics', () => {
  const summary = ref<AnalyticsSummary | null>(null);
  const status = ref<LoadStatus>('idle');
  const error = ref<string | null>(null);
  const rangeDays = ref(7);
  const pendingCount = ref(0);

  // Cola en memoria: los eventos se envían por lotes para no saturar la red.
  let pending: PlaybackEvent[] = [];
  let flushing = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  function record(event: PlaybackEvent): void {
    pending.push(event);
    if (pending.length > MAX_PENDING) pending = pending.slice(-MAX_PENDING);
    pendingCount.value = pending.length;
    if (pending.length >= FLUSH_BATCH_SIZE) void flush();
  }

  async function flush(): Promise<void> {
    if (flushing || pending.length === 0) return;
    flushing = true;
    const batch = pending;
    pending = [];
    pendingCount.value = 0;
    try {
      await sendEvents(batch);
    } catch {
      // Sin red o con error: se devuelven a la cola para el siguiente intento.
      pending = [...batch, ...pending].slice(-MAX_PENDING);
      pendingCount.value = pending.length;
    } finally {
      flushing = false;
    }
  }

  function startAutoFlush(): void {
    if (timer) return;
    timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  }

  function stopAutoFlush(): void {
    if (timer) clearInterval(timer);
    timer = null;
  }

  async function loadSummary(days = rangeDays.value): Promise<void> {
    rangeDays.value = days;
    status.value = 'loading';
    error.value = null;
    try {
      await flush(); // incluye lo que se escuchó hace un instante
      summary.value = await getSummary(days);
      status.value = 'ready';
    } catch (e) {
      error.value = toAppError(e).message;
      status.value = 'error';
    }
  }

  return { summary, status, error, rangeDays, pendingCount, record, flush, startAutoFlush, stopAutoFlush, loadSummary };
});
