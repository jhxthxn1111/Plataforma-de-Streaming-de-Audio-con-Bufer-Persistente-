import * as adminStats from '../models/admin-stats.model';
import { streamMetrics } from '../utils/stream-metrics';
import { AudioService } from './audio.service';

/** Misma forma que `adminOverviewSchema` del frontend. */
export interface AdminOverview {
  activeListeners: number;
  streamedBytes: number;
  totalTracks: number;
  topGenres: { genre: string; share: number }[];
}

/** "Activo" = escuchó algo (o dejó un evento de reproducción) en los últimos 5 minutos. */
export const ACTIVE_WINDOW_MINUTES = 5;
const GENRE_WINDOW_DAYS = 30;
const GENRE_LIMIT = 5;

const audioService = new AudioService();

export async function getOverview(): Promise<AdminOverview> {
  const [activeListeners, genres, catalog] = await Promise.all([
    adminStats.countActiveListeners(ACTIVE_WINDOW_MINUTES),
    adminStats.topGenreShares(GENRE_WINDOW_DAYS, GENRE_LIMIT),
    audioService.getLocalCatalog(),
  ]);
  return {
    activeListeners,
    streamedBytes: streamMetrics.totalBytes(),
    totalTracks: catalog.length,
    // El contrato exige share entre 0 y 1: se recorta por si el redondeo se pasa.
    topGenres: genres.map((g) => ({ genre: g.genre, share: Math.min(Math.max(g.share, 0), 1) })),
  };
}
