import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../db/migrate';
import { closePool, pool } from '../db/pool';

describe('base de datos', () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });
  afterAll(async () => {
    await closePool();
  });

  it('las migraciones son idempotentes', async () => {
    expect(await runMigrations(pool)).toEqual([]);
  });

  it('crea todas las tablas del esquema', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = rows.map((row) => row.table_name);
    for (const table of ['users', 'refresh_tokens', 'tracks', 'playback_events', 'schema_migrations']) {
      expect(names).toContain(table);
    }
  });

  it('rechaza roles inválidos y correos repetidos sin distinguir mayúsculas', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO users (email, display_name, password_hash) VALUES ('a@x.com', 'A', 'hash')`);
      await client.query('SAVEPOINT s1');
      await expect(
        client.query(`INSERT INTO users (email, display_name, password_hash) VALUES ('A@X.COM', 'B', 'hash')`),
      ).rejects.toThrow(/users_email_unique/);
      await client.query('ROLLBACK TO SAVEPOINT s1');
      await expect(
        client.query(`INSERT INTO users (email, display_name, password_hash, role) VALUES ('b@x.com', 'B', 'hash', 'hacker')`),
      ).rejects.toThrow(/check/i);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
