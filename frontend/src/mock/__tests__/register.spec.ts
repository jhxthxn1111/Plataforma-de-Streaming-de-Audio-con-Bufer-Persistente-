import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { authResponseSchema } from '@/api/contracts';
import { mockAdapter } from '../adapter';

function request(url: string, body: unknown): InternalAxiosRequestConfig {
  return { method: 'post', url, data: JSON.stringify(body), headers: new AxiosHeaders() };
}

describe('mock: registro de cuentas', () => {
  const email = `nuevo${Date.now()}@correo.com`;
  const password = 'Clave1234';

  it('crea la cuenta como oyente aunque el cliente envíe otro rol', async () => {
    const response = await mockAdapter(
      request('/auth/register', { displayName: 'Nuevo Usuario', email, password, role: 'admin' }),
    );
    expect(response.status).toBe(201);
    const session = authResponseSchema.parse(response.data);
    expect(session.user.role).toBe('listener');
  });

  it('rechaza un correo ya registrado con 409', async () => {
    const attempt = mockAdapter(request('/auth/register', { displayName: 'Otra Persona', email, password }));
    await expect(attempt).rejects.toBeInstanceOf(AxiosError);
    await attempt.catch((error: unknown) => {
      expect(error instanceof AxiosError && error.response?.status).toBe(409);
    });
  });

  it('permite iniciar sesión con la cuenta recién creada', async () => {
    const response = await mockAdapter(request('/auth/login', { email, password }));
    expect(response.status).toBe(200);
  });
});
