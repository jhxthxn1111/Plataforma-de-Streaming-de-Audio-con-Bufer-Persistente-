import { pool } from '../db/pool';

export type EmailTokenPurpose = 'verify_email' | 'reset_password';

/** Guarda un token nuevo e invalida los anteriores sin usar del mismo tipo: solo el último enlace sirve. */
export async function issue(data: {
  userId: string;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await pool.query(
    `WITH invalidated AS (
       UPDATE email_tokens SET used_at = now()
        WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL
     )
     INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [data.userId, data.purpose, data.tokenHash, data.expiresAt],
  );
}

/** Fecha del último token emitido de ese tipo (para limitar cuántos correos se mandan a una cuenta). */
export async function lastCreatedAt(userId: string, purpose: EmailTokenPurpose): Promise<Date | null> {
  const { rows } = await pool.query<{ created_at: Date }>(
    'SELECT created_at FROM email_tokens WHERE user_id = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1',
    [userId, purpose],
  );
  return rows[0]?.created_at ?? null;
}

/**
 * Usa el token de forma atómica: solo funciona una vez, antes de vencer y para el propósito correcto.
 * Devuelve el dueño, o null si no existe, ya se usó o venció.
 */
export async function consume(tokenHash: string, purpose: EmailTokenPurpose): Promise<{ userId: string } | null> {
  const { rows } = await pool.query<{ user_id: string }>(
    `UPDATE email_tokens SET used_at = now()
      WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [tokenHash, purpose],
  );
  return rows[0] ? { userId: rows[0].user_id } : null;
}
