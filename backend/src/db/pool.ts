import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const pool = new Pool({ connectionString: env.databaseUrl });

// Un error en una conexión inactiva no debe tumbar el proceso.
pool.on('error', (error) => {
  logger.error('error en el pool de PostgreSQL', { error: error.message });
});

export function closePool(): Promise<void> {
  return pool.end();
}
