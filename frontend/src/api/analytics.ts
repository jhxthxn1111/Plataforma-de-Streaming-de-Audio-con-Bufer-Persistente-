import { env } from '@/config/env';
import { analyticsSummarySchema, type AnalyticsSummary, type PlaybackEvent } from './contracts';
import { AppError } from './errors';
import { http } from './http';
import { tokenStore } from './tokenStore';

/** Consumo del usuario en los últimos `days` días. Los días se cortan en la zona horaria del navegador. */
export async function getAnalyticsSummary(days: number, signal?: AbortSignal): Promise<AnalyticsSummary> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { data } = await http.get<unknown>('/analytics/summary', { params: { days, tz: timeZone }, signal });
  return analyticsSummarySchema.parse(data);
}

export interface SendOptions {
  /** Para cuando la pestaña se oculta o se cierra: la petición sigue aunque la página ya no exista. */
  keepalive?: boolean;
}

/**
 * Envía un lote de eventos de reproducción. Lanza si hay que reintentar más tarde (sin red, 5xx, sesión vencida).
 * Un 422 significa que el servidor nunca los aceptará: se descartan para que no bloqueen la cola.
 */
export async function sendPlaybackEvents(events: PlaybackEvent[], options: SendOptions = {}): Promise<void> {
  if (events.length === 0) return;

  const token = tokenStore.get();
  if (options.keepalive && token && !env.useMock) {
    const response = await fetch(`${env.apiBaseUrl.replace(/\/$/, '')}/analytics/events`, {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events }),
    });
    if (!response.ok && response.status !== 422) throw new Error(`analytics/events respondió ${response.status}`);
    return;
  }

  try {
    await http.post('/analytics/events', { events });
  } catch (error) {
    if (error instanceof AppError && error.status === 422) return;
    throw error;
  }
}
