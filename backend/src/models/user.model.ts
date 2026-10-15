import { pool } from '../db/pool';
import type { Role } from '../types/auth';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: Role;
}

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: Role;
}

const COLUMNS = 'id, email, display_name, password_hash, role';

function toRecord(row: UserRow): UserRecord {
  return { id: row.id, email: row.email, displayName: row.display_name, passwordHash: row.password_hash, role: row.role };
}

export async function findByEmail(email: string): Promise<UserRecord | null> {
  const { rows } = await pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE lower(email) = lower($1)`, [email]);
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function findById(id: string): Promise<UserRecord | null> {
  const { rows } = await pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ? toRecord(rows[0]) : null;
}

/** El rol no es parámetro: toda cuenta nueva nace como "listener" (default de la tabla). */
export async function create(data: { email: string; displayName: string; passwordHash: string }): Promise<UserRecord> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [data.email, data.displayName, data.passwordHash],
  );
  const row = rows[0];
  if (!row) throw new Error('No se pudo crear el usuario');
  return toRecord(row);
}
