import { z } from 'zod';

export const playbackEventSchema = z.object({
  trackId: z.string().min(1).max(64),
  /** Título y artista al momento de escuchar: la estadística no depende de que la canción exista en la base. */
  trackTitle: z.string().trim().min(1).max(200).optional(),
  trackArtist: z.string().trim().min(1).max(200).optional(),
  type: z.enum(['play', 'pause', 'progress', 'seek', 'complete']),
  positionSec: z.number().min(0).max(86_400),
  listenedSec: z.number().min(0).max(86_400),
  occurredAt: z.string().datetime({ offset: true }),
});

export const playbackBatchSchema = z.object({
  events: z.array(playbackEventSchema).min(1, 'Envía al menos un evento').max(100, 'Máximo 100 eventos por petición'),
});
export type PlaybackBatchInput = z.infer<typeof playbackBatchSchema>;