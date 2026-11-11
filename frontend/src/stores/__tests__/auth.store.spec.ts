import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/api/auth';
import { AppError } from '@/api/errors';
import { useAuthStore } from '../auth';

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  restoreSession: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

const credentials = { email: 'ana@correo.com', password: 'Clave1234' };

describe('useAuthStore: verificación y recuperación', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.resetAllMocks();
  });

  it('registrarse no inicia sesión', async () => {
    vi.mocked(api.register).mockResolvedValue({ email: 'ana@correo.com', message: 'ok' });
    const auth = useAuthStore();
    expect(await auth.register({ displayName: 'Ana', ...credentials })).toBe(true);
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeNull();
  });

  it('un registro rechazado deja el mensaje de error', async () => {
    vi.mocked(api.register).mockRejectedValue(new AppError(409, 'email_taken', 'Ese correo ya tiene una cuenta.'));
    const auth = useAuthStore();
    expect(await auth.register({ displayName: 'Ana', ...credentials })).toBe(false);
    expect(auth.error).toBe('Ese correo ya tiene una cuenta.');
  });

  it('el login con correo sin verificar marca needsVerification, y un intento posterior lo limpia', async () => {
    vi.mocked(api.login).mockRejectedValueOnce(new AppError(403, 'email_not_verified', 'Verifica tu correo.'));
    const auth = useAuthStore();
    expect(await auth.login(credentials)).toBe(false);
    expect(auth.needsVerification).toBe(true);
    expect(auth.error).toBe('Verifica tu correo.');

    vi.mocked(api.login).mockRejectedValueOnce(new AppError(401, 'invalid_credentials', 'Correo o contraseña incorrectos.'));
    expect(await auth.login(credentials)).toBe(false);
    expect(auth.needsVerification).toBe(false);
  });

  it('las acciones de correo devuelven null si salen bien y el mensaje si fallan', async () => {
    const auth = useAuthStore();
    vi.mocked(api.verifyEmail).mockResolvedValue(undefined);
    vi.mocked(api.resendVerification).mockResolvedValue(undefined);
    vi.mocked(api.forgotPassword).mockResolvedValue(undefined);
    vi.mocked(api.resetPassword).mockResolvedValue(undefined);
    expect(await auth.verifyEmail('t')).toBeNull();
    expect(await auth.resendVerification('ana@correo.com')).toBeNull();
    expect(await auth.forgotPassword('ana@correo.com')).toBeNull();
    expect(await auth.resetPassword('t', 'Nueva12345')).toBeNull();

    vi.mocked(api.verifyEmail).mockRejectedValue(new AppError(400, 'token_invalid', 'El enlace no es válido o ya venció.'));
    vi.mocked(api.resetPassword).mockRejectedValue(new AppError(400, 'token_invalid', 'El enlace no es válido o ya venció.'));
    expect(await auth.verifyEmail('t')).toBe('El enlace no es válido o ya venció.');
    expect(await auth.resetPassword('t', 'Nueva12345')).toBe('El enlace no es válido o ya venció.');
  });
});
