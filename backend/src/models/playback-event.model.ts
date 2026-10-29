import { pool } from '../db/pool';

export interface PlaybackRecord {
  userId: string;
  /** Clave de la canción tal como la envía el cliente (su nombre de archivo en el catálogo local). */
  trackId: string;
  trackTitle?: string;
  trackArtist?: string;
  type: 'play' | 'pause' | 'progress' | 'seek' | 'complete';
  positionSec: number;
  listenedSec: number;
  occurredAt: string;
}

/**
 * Inserta un lote en una sola sentencia (atómica: entra todo o nada).
 * La clave de la canción se guarda siempre; `track_id` solo se enlaza si esa clave
 * coincide con una fila de `tracks` (LEFT JOIN), así el catálogo en archivos también cuenta.
 */
export async function insertMany(records: PlaybackRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  const result = await pool.query(
    `INSERT INTO playback_events
            (user_id, track_id, track_key, track_title, track_artist, type, position_sec, listened_sec, occurred_at)
     SELECT e.user_id, t.id, e.track_key, COALESCE(e.track_title, t.title), COALESCE(e.track_artist, t.artist),
            e.type, e.position_sec, e.listened_sec, e.occurred_at
       FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::numeric[], $7::numeric[], $8::timestamptz[])
            AS e(user_id, track_key, track_title, track_artist, type, position_sec, listened_sec, occurred_at)
       LEFT JOIN tracks t ON t.id::text = e.track_key`,
    [
      records.map((r) => r.userId),
      records.map((r) => r.trackId),
      records.map((r) => r.trackTitle ?? null),
      records.map((r) => r.trackArtist ?? null),
      records.map((r) => r.type),
      records.map((r) => r.positionSec),
      records.map((r) => r.listenedSec),
      records.map((r) => r.occurredAt),
    ],
  );
  return result.rowCount ?? 0;
}

export interface SummaryRow {
  totalListenedSec: number;
  totalPlays: number;
  totalCompletes: number;
  distinctTracks: number;
  /** Un elemento por día de la ventana (los días sin escucha vienen con 0), del más antiguo al más reciente. */
  daily: { date: string; listenedSec: number }[];
  topTracks: { trackId: string; title: string; artist: string; plays: number; listenedSec: number }[];
}

/**
 * Resumen de consumo de un usuario en los últimos `days` días, contando el día de hoy.
 * Los días se cortan en la zona horaria del usuario (`timeZone`, nombre IANA ya validado):
 * escuchar a las 9 p. m. en Colombia no debe contar como "mañana" en UTC.
 *
 * `listened_sec` de cada evento es el tiempo escuchado desde el evento anterior (un delta),
 * por eso el total es una simple suma.
 */
export async function summarize(userId: string, days: number, timeZone: string): Promise<SummaryRow> {
  const { rows } = await pool.query<SummaryRow>(
    `WITH bounds AS (
       SELECT d.local_today,
              d.local_today - make_interval(days => $3::int - 1)                    AS local_since,
              (d.local_today - make_interval(days => $3::int - 1)) AT TIME ZONE $2::text AS since,
              (d.local_today + interval '1 day') AT TIME ZONE $2::text                  AS until
         FROM (SELECT date_trunc('day', now() AT TIME ZONE $2::text) AS local_today) d
     ),
     ev AS (
       SELECT e.type, e.listened_sec, e.track_key, e.track_title, e.track_artist, e.occurred_at
         FROM playback_events e, bounds b
        WHERE e.user_id = $1
          AND e.occurred_at >= b.since
          AND e.occurred_at <  b.until
     ),
     calendar AS (
       SELECT g::date AS day
         FROM bounds b, generate_series(b.local_since, b.local_today, interval '1 day') AS g
     ),
     per_day AS (
       SELECT (occurred_at AT TIME ZONE $2::text)::date AS day, SUM(listened_sec) AS sec
         FROM ev
        GROUP BY 1
     ),
     top AS (
       SELECT track_key,
              (array_agg(track_title  ORDER BY occurred_at DESC) FILTER (WHERE track_title  IS NOT NULL))[1] AS title,
              (array_agg(track_artist ORDER BY occurred_at DESC) FILTER (WHERE track_artist IS NOT NULL))[1] AS artist,
              COUNT(*) FILTER (WHERE type = 'play') AS plays,
              SUM(listened_sec)                     AS listened
         FROM ev
        GROUP BY track_key
       HAVING SUM(listened_sec) > 0 OR COUNT(*) FILTER (WHERE type = 'play') > 0
        ORDER BY listened DESC, plays DESC, track_key
        LIMIT 5
     )
     SELECT
       (SELECT COALESCE(SUM(listened_sec), 0)::float8 FROM ev)                                   AS "totalListenedSec",
       (SELECT COUNT(*) FROM ev WHERE type = 'play')::int                                        AS "totalPlays",
       (SELECT COUNT(*) FROM ev WHERE type = 'complete')::int                                    AS "totalCompletes",
       (SELECT COUNT(DISTINCT track_key) FROM ev WHERE listened_sec > 0 OR type = 'play')::int   AS "distinctTracks",
       (SELECT COALESCE(json_agg(json_build_object(
                  'date', to_char(c.day, 'YYYY-MM-DD'),
                  'listenedSec', COALESCE(p.sec, 0)::float8) ORDER BY c.day), '[]'::json)
          FROM calendar c LEFT JOIN per_day p ON p.day = c.day)                                  AS daily,
       (SELECT COALESCE(json_agg(json_build_object(
                  'trackId', track_key,
                  'title', COALESCE(title, track_key),
                  'artist', COALESCE(artist, ''),
                  'plays', plays::int,
                  'listenedSec', listened::float8) ORDER BY listened DESC, plays DESC, track_key), '[]'::json)
          FROM top)                                                                              AS "topTracks"`,
    [userId, timeZone, days],
  );
  const row = rows[0];
  if (!row) throw new Error('El resumen no devolvió filas');
  return row;
}
