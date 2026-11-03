import { AppError } from '../errors/AppError';
import * as playbackModel from '../models/playback-event.model';
import type { SummaryQuery } from '../schemas/analytics.schemas';

/** Misma forma que `analyticsSummarySchema` del frontend. */
export interface AnalyticsSummary {
  totalListenedSec: number;
  totalPlays: number;
  /** De 0 a 1: canciones terminadas entre canciones empezadas. */
  completionRate: number;
  distinctTracks: number;
  daily: playbackModel.SummaryRow['daily'];
  topTracks: playbackModel.SummaryRow['topTracks'];
}

/** Código de PostgreSQL para "invalid_parameter_value" (zona horaria que la base no conoce). */
const INVALID_PARAMETER = '22023';

export async function getSummary(userId: string, query: SummaryQuery): Promise<AnalyticsSummary> {
  let row: playbackModel.SummaryRow;
  try {
    row = await playbackModel.summarize(userId, query.days, query.tz);
  } catch (error) {
    if (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === INVALID_PARAMETER) {
      throw new AppError(422, 'validation_error', 'Zona horaria no válida');
    }
    throw error;
  }
  const completionRate = row.totalPlays === 0 ? 0 : Math.min(row.totalCompletes / row.totalPlays, 1);
  return {
    totalListenedSec: row.totalListenedSec,
    totalPlays: row.totalPlays,
    completionRate,
    distinctTracks: row.distinctTracks,
    daily: row.daily,
    topTracks: row.topTracks,
  };
}
