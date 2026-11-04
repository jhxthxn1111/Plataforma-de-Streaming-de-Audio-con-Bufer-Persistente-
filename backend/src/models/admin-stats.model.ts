import { pool } from '../db/pool';

/** Personas distintas con algún evento de reproducción en los últimos `windowMinutes` minutos. */
export async function countActiveListeners(windowMinutes: number): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    `SELECT COUNT(DISTINCT user_id)::int AS total
       FROM playback_events
      WHERE occurred_at >= now() - make_interval(mins => $1::int)`,
    [windowMinutes],
  );
  return rows[0]?.total ?? 0;
}

export interface GenreShareRow {
  genre: string;
  /** De 0 a 1: reproducciones del género entre todas las reproducciones con género del periodo. */
  share: number;
}

/**
 * Géneros más reproducidos en los últimos `days` días.
 * El género solo existe en la tabla `tracks`; las canciones que viven como archivos en /storage no lo tienen,
 * así que mientras el catálogo sea solo de archivos esta lista sale vacía (y el contrato lo permite).
 */
export async function topGenreShares(days: number, limit: number): Promise<GenreShareRow[]> {
  const { rows } = await pool.query<GenreShareRow>(
    `SELECT t.genre,
            (COUNT(*)::float8 / SUM(COUNT(*)) OVER ()) AS share
       FROM playback_events e
       JOIN tracks t ON t.id = e.track_id
      WHERE e.type = 'play'
        AND e.occurred_at >= now() - make_interval(days => $1::int)
      GROUP BY t.genre
      ORDER BY COUNT(*) DESC, t.genre
      LIMIT $2::int`,
    [days, limit],
  );
  return rows;
}
