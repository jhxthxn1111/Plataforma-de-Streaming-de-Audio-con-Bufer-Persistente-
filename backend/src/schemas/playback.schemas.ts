import { z } from 'zod';

export const playbackEventSchema = z.object({
  trackId: z.string().min(1).max(64),
  type: z.enum(['play', 'pause', 'progress', 'seek', 'complete']),
  positionSec: z.number().min(0).max(86_400),
  listenedSec: z.number().min(0).max(86_400),
  occurredAt: z.string().datetime({ offset: true }),
});

export const playbackBatchSchema = z.object({
  events: z.array(playbackEventSchema).min(1, 'Envía al menos un evento').max(100, 'Máximo 100 eventos por petición'),
});
export type PlaybackBatchInput = z.infer<typeof playbackBatchSchema>;