import { AppError } from '../errors/AppError';
import * as playbackModel from '../models/playback-event.model';
import type { PlaybackRecord } from '../models/playback-event.model';
import { BatchQueue } from '../queue/batch-queue';
import type { PlaybackBatchInput } from '../schemas/playback.schemas';

/** Worker en memoria: las escrituras a la base ocurren en segundo plano, en lotes. */
export const playbackQueue = new BatchQueue<PlaybackRecord>({
  name: 'playback',
  handler: async (batch) => {
    await playbackModel.insertMany(batch);
  },
});

/** El userId siempre sale del token (nunca del body): nadie puede registrar eventos a nombre de otro. */
export function recordEvents(userId: string, input: PlaybackBatchInput): number {
  const records: PlaybackRecord[] = input.events.map((event) => ({ ...event, userId }));
  if (!playbackQueue.enqueue(records)) {
    throw new AppError(503, 'queue_full', 'El servidor está ocupado. Intenta de nuevo en unos segundos.');
  }
  return records.length;
}

/** Se llama al apagar el servidor para no perder los eventos pendientes. */
export function closePlaybackQueue(): Promise<void> {
  return playbackQueue.close();
}