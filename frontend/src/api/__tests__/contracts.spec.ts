import { describe, expect, it } from 'vitest';
import { authResponseSchema, loginRequestSchema, streamUrlSchema } from '../contracts';

describe('contratos de la API', () => {
  it('rechaza un correo inválido en el login', () => {
    expect(loginRequestSchema.safeParse({ email: 'no-es-correo', password: '12345678' }).success).toBe(false);
  });
  it('rechaza contraseñas cortas', () => {
    expect(loginRequestSchema.safeParse({ email: 'a@b.co', password: '123' }).success).toBe(false);
  });
  it('acepta una respuesta de autenticación válida', () => {
    const result = authResponseSchema.safeParse({
      accessToken: 'abc',
      expiresIn: 900,
      user: { id: '1', email: 'a@b.co', displayName: 'A', role: 'listener' },
    });
    expect(result.success).toBe(true);
  });
  it('rechaza roles desconocidos', () => {
    const result = authResponseSchema.safeParse({
      accessToken: 'abc',
      expiresIn: 900,
      user: { id: '1', email: 'a@b.co', displayName: 'A', role: 'root' },
    });
    expect(result.success).toBe(false);
  });
  it('exige la URL de streaming', () => {
    expect(streamUrlSchema.safeParse({ expiresAt: '2026-01-01T00:00:00Z' }).success).toBe(false);
  });
});
