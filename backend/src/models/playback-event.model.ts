import { pool } from '../db/pool';

export interface PlaybackRecord {
  userId: string;
  trackId: string;
  type: 'play' | 'pause' | 'progress' | 'seek' | 'complete';
  positionSec: number;
  listenedSec: number;
  occurredAt: string;
}

/**
 * Inserta un lote en una sola sentencia (atómica: entra todo o nada).
 * El JOIN con `tracks` ignora eventos de canciones que no existen en la base,
 * en vez de hacer fallar el lote completo por la llave foránea.
 */
export async function insertMany(records: PlaybackRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  const result = await pool.query(
    `INSERT INTO playback_events (user_id, track_id, type, position_sec, listened_sec, occurred_at)
     SELECT e.user_id, t.id, e.type, e.position_sec, e.listened_sec, e.occurred_at
       FROM unnest($1::uuid[], $2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::timestamptz[])
            AS e(user_id, track_id, type, position_sec, listened_sec, occurred_at)
       JOIN tracks t ON t.id::text = e.track_id`,
    [
      records.map((r) => r.userId),
      records.map((r) => r.trackId),
      records.map((r) => r.type),
      records.map((r) => r.positionSec),
      records.map((r) => r.listenedSec),
      records.map((r) => r.occurredAt),
    ],
  );
  return result.rowCount ?? 0;
}