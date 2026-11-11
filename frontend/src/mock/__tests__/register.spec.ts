import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { authResponseSchema, registerResponseSchema } from '@/api/contracts';
import { MAIL_TOKENS_KEY, mockAdapter } from '../adapter';

function request(url: string, body: unknown): InternalAxiosRequestConfig {
  return { method: 'post', url, data: JSON.stringify(body), headers: new AxiosHeaders() };
}

async function statusOf(url: string, body: unknown): Promise<number> {
  try {
    return (await mockAdapter(request(url, body))).status;
  } catch (error) {
    if (error instanceof AxiosError && error.response) return error.response.status;
    throw error;
  }
}

/** Lo que la persona haría al abrir el correo: sacar el token del enlace. */
function mailToken(email: string, purpose: 'verify_email' | 'reset_password'): string {
  const all = JSON.parse(localStorage.getItem(MAIL_TOKENS_KEY) ?? '[]') as { token: string; email: string; purpose: string }[];
  const found = all.find((t) => t.email === email && t.purpose === purpose);
  if (!found) throw new Error(`No hay enlace de ${purpose} para ${email}`);
  return found.token;
}

describe('mock: registro y verificación de correo', () => {
  const email = `nuevo${Date.now()}@correo.com`;
  const password = 'Clave1234';

  it('crea la cuenta sin abrir sesión y pide verificar el correo', async () => {
    const response = await mockAdapter(
      request('/auth/register', { displayName: 'Nuevo Usuario', email, password, role: 'admin' }),
    );
    expect(response.status).toBe(201);
    expect(registerResponseSchema.parse(response.data).email).toBe(email);
    expect(authResponseSchema.safeParse(response.data).success).toBe(false);
  });

  it('rechaza un correo ya registrado con 409', async () => {
    expect(await statusOf('/auth/register', { displayName: 'Otra Persona', email, password })).toBe(409);
  });

  it('no deja iniciar sesión hasta verificar (403), y con la contraseña mal sigue siendo 401', async () => {
    expect(await statusOf('/auth/login', { email, password })).toBe(403);
    expect(await statusOf('/auth/login', { email, password: 'Incorrecta1' })).toBe(401);
  });

  it('con el enlace del correo la cuenta queda verificada y es de oyente; el enlace sirve una vez', async () => {
    const token = mailToken(email, 'verify_email');
    expect(await statusOf('/auth/verify-email', { token })).toBe(200);
    expect(await statusOf('/auth/verify-email', { token })).toBe(400);

    const login = await mockAdapter(request('/auth/login', { email, password }));
    expect(login.status).toBe(200);
    expect(authResponseSchema.parse(login.data).user.role).toBe('listener');
  });

  it('un token de verificación no sirve para cambiar la contraseña', async () => {
    const other = `otro${Date.now()}@correo.com`;
    await mockAdapter(request('/auth/register', { displayName: 'Otra Persona', email: other, password }));
    const token = mailToken(other, 'verify_email');
    expect(await statusOf('/auth/reset-password', { token, newPassword: 'Nueva12345' })).toBe(400);
  });
});

describe('mock: recuperar contraseña', () => {
  const email = `recupera${Date.now()}@correo.com`;
  const password = 'Clave1234';

  it('responde igual exista o no la cuenta', async () => {
    await mockAdapter(request('/auth/register', { displayName: 'Persona', email, password }));
    expect(await statusOf('/auth/forgot-password', { email })).toBe(202);
    expect(await statusOf('/auth/forgot-password', { email: `no-existe${Date.now()}@correo.com` })).toBe(202);
    expect(await statusOf('/auth/forgot-password', { email: 'no-es-correo' })).toBe(422);
  });

  it('con el enlace se cambia la contraseña, la anterior deja de servir y el enlace se gasta', async () => {
    const token = mailToken(email, 'reset_password');
    expect(await statusOf('/auth/reset-password', { token, newPassword: 'corta' })).toBe(422);
    expect(await statusOf('/auth/reset-password', { token, newPassword: 'Nueva12345' })).toBe(200);

    expect(await statusOf('/auth/login', { email, password })).toBe(401);
    expect(await statusOf('/auth/login', { email, password: 'Nueva12345' })).toBe(200); // además quedó verificada

    expect(await statusOf('/auth/reset-password', { token, newPassword: 'Otra123456' })).toBe(400);
  });
});
