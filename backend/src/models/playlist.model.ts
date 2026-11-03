import { pool } from '../db/pool';

export const MAX_TRACKS_PER_PLAYLIST = 500;

export interface PlaylistRecord {
  id: string;
  name: string;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistTrackRecord {
  trackKey: string;
  addedAt: string;
}

export interface PlaylistDetailRecord extends Omit<PlaylistRecord, 'trackCount'> {
  tracks: PlaylistTrackRecord[];
}

export type AddTrackResult = 'added' | 'already_in' | 'not_found' | 'full';

interface PlaylistRow {
  id: string;
  name: string;
  track_count: number;
  created_at: Date;
  updated_at: Date;
}

const toRecord = (row: PlaylistRow): PlaylistRecord => ({
  id: row.id,
  name: row.name,
  trackCount: row.track_count,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

/*
 * Propiedad del recurso: TODAS las consultas filtran por user_id dentro del SQL.
 * Si la playlist es de otra persona, el resultado es el mismo que si no existiera (null / false),
 * así que tampoco se puede averiguar qué ids existen.
 */

export async function listByUser(userId: string): Promise<PlaylistRecord[]> {
  const { rows } = await pool.query<PlaylistRow>(
    `SELECT p.id, p.name, p.created_at, p.updated_at, count(pt.track_key)::int AS track_count
       FROM playlists p
       LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id
      ORDER BY p.created_at, p.id`,
    [userId],
  );
  return rows.map(toRecord);
}

export async function findOwned(id: string, userId: string): Promise<PlaylistDetailRecord | null> {
  const playlist = await pool.query<Omit<PlaylistRow, 'track_count'>>(
    'SELECT id, name, created_at, updated_at FROM playlists WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  const row = playlist.rows[0];
  if (!row) return null;
  const tracks = await pool.query<{ track_key: string; added_at: Date }>(
    'SELECT track_key, added_at FROM playlist_tracks WHERE playlist_id = $1 ORDER BY position, added_at',
    [id],
  );
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    tracks: tracks.rows.map((t) => ({ trackKey: t.track_key, addedAt: t.added_at.toISOString() })),
  };
}

export async function create(userId: string, name: string): Promise<PlaylistRecord> {
  const { rows } = await pool.query<PlaylistRow>(
    `INSERT INTO playlists (user_id, name) VALUES ($1, $2)
     RETURNING id, name, created_at, updated_at, 0 AS track_count`,
    [userId, name],
  );
  return toRecord(rows[0] as PlaylistRow);
}

export async function rename(id: string, userId: string, name: string): Promise<boolean> {
  const result = await pool.query('UPDATE playlists SET name = $3, updated_at = now() WHERE id = $1 AND user_id = $2', [id, userId, name]);
  return (result.rowCount ?? 0) > 0;
}

export async function remove(id: string, userId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM playlists WHERE id = $1 AND user_id = $2', [id, userId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Agrega una canción dentro de una transacción. El FOR UPDATE bloquea la fila de la playlist,
 * así dos peticiones simultáneas se turnan y nunca calculan la misma posición (anti race-condition).
 */
export async function addTrack(id: string, userId: string, trackKey: string): Promise<AddTrackResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owned = await client.query('SELECT id FROM playlists WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, userId]);
    if (owned.rowCount === 0) {
      await client.query('ROLLBACK');
      return 'not_found';
    }
    const stats = await client.query<{ total: number; next_position: number }>(
      'SELECT count(*)::int AS total, COALESCE(max(position), 0) + 1 AS next_position FROM playlist_tracks WHERE playlist_id = $1',
      [id],
    );
    const { total, next_position } = stats.rows[0] as { total: number; next_position: number };
    if (total >= MAX_TRACKS_PER_PLAYLIST) {
      await client.query('ROLLBACK');
      return 'full';
    }
    const inserted = await client.query(
      'INSERT INTO playlist_tracks (playlist_id, track_key, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [id, trackKey, next_position],
    );
    if ((inserted.rowCount ?? 0) > 0) {
      await client.query('UPDATE playlists SET updated_at = now() WHERE id = $1', [id]);
    }
    await client.query('COMMIT');
    return (inserted.rowCount ?? 0) > 0 ? 'added' : 'already_in';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function removeTrack(id: string, userId: string, trackKey: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM playlist_tracks pt
      USING playlists p
      WHERE pt.playlist_id = p.id AND p.id = $1 AND p.user_id = $2 AND pt.track_key = $3`,
    [id, userId, trackKey],
  );
  return (result.rowCount ?? 0) > 0;
}
