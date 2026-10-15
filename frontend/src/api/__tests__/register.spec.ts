import { describe, expect, it } from 'vitest';
import { registerFormSchema, registerRequestSchema } from '../contracts';

const valid = { displayName: 'Ana Pérez', email: 'ana@correo.com', password: 'Clave1234' };

describe('registro', () => {
  it('acepta datos válidos', () => {
    expect(registerRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rechaza contraseñas débiles', () => {
    expect(registerRequestSchema.safeParse({ ...valid, password: 'corta1' }).success).toBe(false);
    expect(registerRequestSchema.safeParse({ ...valid, password: 'sololetras' }).success).toBe(false);
    expect(registerRequestSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(false);
  });

  it('rechaza correo inválido y nombre muy corto', () => {
    expect(registerRequestSchema.safeParse({ ...valid, email: 'ana@' }).success).toBe(false);
    expect(registerRequestSchema.safeParse({ ...valid, displayName: 'A' }).success).toBe(false);
  });

  it('exige que las contraseñas coincidan', () => {
    const bad = registerFormSchema.safeParse({ ...valid, confirmPassword: 'Otra1234' });
    expect(bad.success).toBe(false);
    const ok = registerFormSchema.safeParse({ ...valid, confirmPassword: valid.password });
    expect(ok.success).toBe(true);
  });
});
