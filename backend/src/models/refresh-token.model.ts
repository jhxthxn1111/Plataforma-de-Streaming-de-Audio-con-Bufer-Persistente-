import { pool } from '../db/pool';

interface RefreshRow {
  user_id: string;
  family_id: string;
  revoked_at: Date | null;
}

export interface RefreshRecord {
  userId: string;
  familyId: string;
  revokedAt: Date | null;
}

export async function insert(data: { userId: string; tokenHash: string; familyId: string; expiresAt: Date }): Promise<void> {
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES ($1, $2, $3, $4)',
    [data.userId, data.tokenHash, data.familyId, data.expiresAt],
  );
}

export async function findByHash(tokenHash: string): Promise<RefreshRecord | null> {
  const { rows } = await pool.query<RefreshRow>(
    'SELECT user_id, family_id, revoked_at FROM refresh_tokens WHERE token_hash = $1',
    [tokenHash],
  );
  const row = rows[0];
  return row ? { userId: row.user_id, familyId: row.family_id, revokedAt: row.revoked_at } : null;
}

/**
 * Rotación atómica: revoca el token vigente y crea su reemplazo en la misma familia, todo en una
 * transacción. Devuelve null si el token no existe, ya se usó, está revocado o venció.
 */
export async function rotate(
  oldHash: string,
  next: { tokenHash: string; expiresAt: Date },
): Promise<{ userId: string; familyId: string } | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<RefreshRow>(
      `UPDATE refresh_tokens SET revoked_at = now()
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
        RETURNING user_id, family_id, revoked_at`,
      [oldHash],
    );
    const used = rows[0];
    if (!used) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES ($1, $2, $3, $4)',
      [used.user_id, next.tokenHash, used.family_id, next.expiresAt],
    );
    await client.query('COMMIT');
    return { userId: used.user_id, familyId: used.family_id };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Cierra toda la cadena de sesión (logout o reutilización sospechosa de un token). */
export async function revokeFamily(familyId: string): Promise<void> {
  await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [familyId]);
}
