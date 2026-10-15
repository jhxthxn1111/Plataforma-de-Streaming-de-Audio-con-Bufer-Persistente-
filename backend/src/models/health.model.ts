import { pool } from '../db/pool';

/** Lanza un error si la base de datos no responde. */
export async function ping(): Promise<void> {
  await pool.query('SELECT 1');
}
