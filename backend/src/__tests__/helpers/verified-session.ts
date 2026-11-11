import type { Express } from 'express';
import request from 'supertest';
import { pool } from '../../db/pool';

/** Marca el correo como verificado directamente en la base (equivale a abrir el enlace del correo). */
export async function markVerified(email: string): Promise<void> {
  await pool.query('UPDATE users SET email_verified_at = now() WHERE lower(email) = lower($1)', [email]);
}

/**
 * Registra una cuenta, la verifica en la base e inicia sesión. Devuelve la respuesta del login
 * (token de acceso, usuario y cookie de refresh), como la que antes daba el registro.
 */
export async function registerAndLogin(
  app: Express,
  data: { email: string; password: string; displayName?: string },
): Promise<request.Response> {
  const registered = await request(app)
    .post('/auth/register')
    .send({ displayName: data.displayName ?? 'Persona Prueba', email: data.email, password: data.password });
  if (registered.status !== 201) throw new Error(`El registro de prueba falló con estado ${registered.status}`);
  await markVerified(data.email);
  const login = await request(app).post('/auth/login').send({ email: data.email, password: data.password });
  if (login.status !== 200) throw new Error(`El login de prueba falló con estado ${login.status}`);
  return login;
}
