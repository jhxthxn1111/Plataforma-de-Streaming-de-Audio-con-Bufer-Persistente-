import { describe, expect, it } from 'vitest';
import {
  authResponseSchema,
  emailRequestSchema,
  messageResponseSchema,
  registerResponseSchema,
  resetPasswordFormSchema,
} from '../contracts';

describe('contratos de verificación y recuperación', () => {
  it('el registro devuelve el correo y un mensaje, ya no una sesión', () => {
    expect(registerResponseSchema.safeParse({ email: 'ana@correo.com', message: 'Cuenta creada.' }).success).toBe(true);
    const oldSession = { accessToken: 'x', expiresIn: 900, user: { id: '1', email: 'ana@correo.com', displayName: 'Ana', role: 'listener' } };
    expect(registerResponseSchema.safeParse(oldSession).success).toBe(false);
    expect(authResponseSchema.safeParse(oldSession).success).toBe(true);
  });

  it('las respuestas de mensaje exigen el campo message', () => {
    expect(messageResponseSchema.safeParse({ message: 'ok' }).success).toBe(true);
    expect(messageResponseSchema.safeParse({}).success).toBe(false);
  });

  it('pedir un enlace exige un correo válido', () => {
    expect(emailRequestSchema.safeParse({ email: ' ana@correo.com ' }).success).toBe(true);
    expect(emailRequestSchema.safeParse({ email: 'ana@' }).success).toBe(false);
  });

  it('la contraseña nueva cumple las mismas reglas que el registro y debe coincidir', () => {
    expect(resetPasswordFormSchema.safeParse({ newPassword: 'Nueva12345', confirmPassword: 'Nueva12345' }).success).toBe(true);
    expect(resetPasswordFormSchema.safeParse({ newPassword: 'Nueva12345', confirmPassword: 'Otra12345' }).success).toBe(false);
    expect(resetPasswordFormSchema.safeParse({ newPassword: 'corta1', confirmPassword: 'corta1' }).success).toBe(false);
    expect(resetPasswordFormSchema.safeParse({ newPassword: 'sololetras', confirmPassword: 'sololetras' }).success).toBe(false);
  });
});
