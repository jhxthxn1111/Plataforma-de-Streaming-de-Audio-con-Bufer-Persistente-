import { analyticsSummarySchema, type AnalyticsSummary, type PlaybackEvent } from './contracts';
import { http } from './http';

export async function sendEvents(events: PlaybackEvent[]): Promise<void> {
  await http.post('/analytics/events', { events });
}

export async function getSummary(days: number): Promise<AnalyticsSummary> {
  const { data } = await http.get<unknown>('/analytics/summary', { params: { days } });
  return analyticsSummarySchema.parse(data);
}
